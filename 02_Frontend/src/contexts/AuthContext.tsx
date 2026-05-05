import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';
import { User, LoginResponse } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY         = 'ria_token';
const REFRESH_KEY       = 'ria_refresh';
const IMP_TOKEN_KEY     = 'ria_imp_token';   // impersonation token
const IMP_USER_KEY      = 'ria_imp_user';    // impersonated user object

interface ImpersonatedUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  // Impersonation
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  impersonateUser: (targetUserId: string, reason?: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  // Auth
  login: (email: string, password: string) => Promise<User>;
  loginSSO: () => Promise<User>;
  logout: () => void;
  // Effective token (impersonation token when active, else regular token)
  effectiveToken: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance } = useMsal();
  const [user, setUser]                       = useState<User | null>(null);
  const [token, setToken]                     = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading]             = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [impToken, setImpToken]               = useState<string | null>(() => localStorage.getItem(IMP_TOKEN_KEY));
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(() => {
    const raw = localStorage.getItem(IMP_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const effectiveToken = impToken ?? token;
  const isImpersonating = !!impToken && !!impersonatedUser;

  const _storeTokens = (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    setToken(access);
  };

  const _hydrateUser = useCallback(async (accessToken: string) => {
    const res = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Session expired');
    return (await res.json()) as User;
  }, []);

  // On mount — restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setIsLoading(false); return; }
    _hydrateUser(stored)
      .then((u) => { setUser(u); setToken(stored); })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(IMP_TOKEN_KEY);
        localStorage.removeItem(IMP_USER_KEY);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, [_hydrateUser]);

  const login = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Invalid credentials');
      }
      const data: LoginResponse = await res.json();
      _storeTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      return data.user;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const loginSSO = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await instance.loginPopup(loginRequest);
      const idToken     = result.idToken;
      const displayName = result.account?.name;
      const res = await fetch(`${BASE}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, display_name: displayName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'SSO login failed');
      }
      const data: LoginResponse = await res.json();
      _storeTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      return data.user;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'SSO login failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const impersonateUser = async (targetUserId: string, reason?: string) => {
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${BASE}/api/rbac/impersonate/${targetUserId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: reason ?? null }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail ?? 'Impersonation failed');
    }
    const data = await res.json();
    const impUser: ImpersonatedUser = data.impersonating;

    localStorage.setItem(IMP_TOKEN_KEY, data.impersonation_token);
    localStorage.setItem(IMP_USER_KEY, JSON.stringify(impUser));
    setImpToken(data.impersonation_token);
    setImpersonatedUser(impUser);
  };

  const stopImpersonation = async () => {
    if (impToken) {
      // Notify backend (best-effort — don't block on failure)
      await fetch(`${BASE}/api/rbac/impersonate/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${impToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem(IMP_TOKEN_KEY);
    localStorage.removeItem(IMP_USER_KEY);
    setImpToken(null);
    setImpersonatedUser(null);
  };

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(IMP_TOKEN_KEY);
    localStorage.removeItem(IMP_USER_KEY);
    setToken(null);
    setUser(null);
    setImpToken(null);
    setImpersonatedUser(null);
    setError(null);
    window.location.href = '/';
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      isAuthenticated: !!user && !!token,
      error, login, loginSSO, logout,
      isImpersonating,
      impersonatedUser,
      impersonateUser,
      stopImpersonation,
      effectiveToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
