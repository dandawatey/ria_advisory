import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';
import { User, LoginResponse } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY    = 'ria_token';
const REFRESH_KEY  = 'ria_refresh';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User>;
  loginSSO: () => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance } = useMsal();
  const [user, setUser]           = useState<User | null>(null);
  const [token, setToken]         = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

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
      .catch(() => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); setToken(null); })
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

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setToken(null);
    setUser(null);
    setError(null);
    // Redirect handled by ProtectedRoute
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      isAuthenticated: !!user && !!token,
      error, login, loginSSO, logout,
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
