/**
 * F014 — Login
 * Two modes: Microsoft SSO (MSAL) + Email & Password fallback.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'sso' | 'email';

export default function Login() {
  const { login, loginSSO, error: authError } = useAuth();
  const navigate                              = useNavigate();
  const [tab, setTab]                         = useState<Tab>('sso');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [loading, setLoading]                 = useState(false);
  const [localError, setLocalError]           = useState<string | null>(null);

  const displayError = localError ?? authError;

  const handleSSO = async () => {
    setLocalError(null);
    setLoading(true);
    try {
      await loginSSO();
      navigate('/dashboard', { replace: true });
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : 'SSO login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email || !password) { setLocalError('Email and password required'); return; }
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 420, background: 'white', borderRadius: 16,
        padding: 48, boxShadow: '0 25px 50px rgba(0,0,0,.3)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #1e3a8a, #1e40af)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 24 }}>RI</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            i-CFO<span style={{ color: '#1f6b66' }}>360</span>
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            RIA Advisory · Financial Intelligence Platform
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 28 }}>
          {(['sso', 'email'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setLocalError(null); }}
              style={{
                flex: 1, padding: '10px 0', border: 'none', background: 'none',
                fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#1e40af' : '#94a3b8',
                borderBottom: tab === t ? '2px solid #1e40af' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {t === 'sso' ? 'Microsoft SSO' : 'Email & Password'}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {displayError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 20,
          }}>
            {displayError}
          </div>
        )}

        {/* ── SSO Tab ── */}
        {tab === 'sso' && (
          <div>
            <button
              onClick={handleSSO}
              disabled={loading}
              style={{
                width: '100%', padding: '14px 20px',
                background: loading ? '#94a3b8' : '#0072c6',
                color: 'white', border: 'none', borderRadius: 8,
                fontSize: 15, fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all .2s',
              }}
            >
              {!loading && (
                <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
                  <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
                  <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
                  <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                </svg>
              )}
              {loading ? 'Signing in…' : 'Sign in with Microsoft'}
            </button>
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
              Uses your organisation's Microsoft / Entra ID account.
            </p>
          </div>
        )}

        {/* ── Email Tab ── */}
        {tab === 'email' && (
          <form onSubmit={handleEmail}>
            {/* Dev quick-login */}
            <button
              type="button"
              onClick={() => { setEmail('admin@ria-advisory.com'); setPassword('Admin@2026'); }}
              style={{
                width: '100%', padding: '8px 0', marginBottom: 16,
                border: '1px dashed #d1d5db', borderRadius: 8,
                background: '#f9fafb', color: '#6b7280',
                fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>⚡</span> Dev: fill admin credentials
            </button>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 12px',
                  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 12px',
                  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 8, border: 'none',
                background: loading ? '#93c5fd' : '#1e40af',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: '#cbd5e1' }}>
            Authorised users only · RIA Advisory i-CFO360
          </span>
        </div>
      </div>
    </div>
  );
}
