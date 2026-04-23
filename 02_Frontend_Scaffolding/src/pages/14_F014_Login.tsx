/**
 * F014 — React Application Foundation & Authentication
 * Login page: Entra ID SSO via MSAL.
 */
import React, { useState } from 'react';

export default function Login() {
  const [loading, setLoading] = useState(false);

  const handleSSO = () => {
    setLoading(true);
    // In production: instance.loginRedirect(loginRequest)
    // where loginRequest = { scopes: ['api://<client-id>/user_impersonation'] }
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 420,
        background: 'white',
        borderRadius: 16,
        padding: 48,
        boxShadow: '0 25px 50px rgba(0,0,0,.3)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #1e3a8a, #1e40af)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 24 }}>U</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            UFIP
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Unified Financial Intelligence Platform
          </p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            RIA Advisory · Centre of Excellence
          </p>
        </div>

        {/* SSO button */}
        <button
          onClick={handleSSO}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: loading ? '#94a3b8' : '#0072c6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'all .2s',
          }}
        >
          {/* Microsoft logo */}
          {!loading && (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="1"  y="1"  width="8.5" height="8.5" fill="#f25022" />
              <rect x="10.5" y="1"  width="8.5" height="8.5" fill="#7fba00" />
              <rect x="1"  y="10.5" width="8.5" height="8.5" fill="#00a4ef" />
              <rect x="10.5" y="10.5" width="8.5" height="8.5" fill="#ffb900" />
            </svg>
          )}
          {loading ? 'Signing in…' : 'Sign in with Microsoft'}
        </button>

        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          Authentication via <strong>Entra ID SSO</strong> (MSAL).
          Your existing corporate credentials are used — no separate password required.
        </p>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>
            Authorised users only · Access controlled by Entra ID groups<br />
            Regulated by SEC Investment Advisers Act · Reg S-P
          </p>
        </div>

        {/* Dev note */}
        <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef3c7', borderRadius: 6, fontSize: 11, color: '#92400e' }}>
          <strong>Scaffold mode:</strong> MSAL not configured. Clicking "Sign in" navigates to /dashboard directly.
          Install <code>@azure/msal-react</code> and configure <code>msalConfig</code> for production.
        </div>
      </div>
    </div>
  );
}
