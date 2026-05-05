import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { ImpersonationBanner } from '../shared/ImpersonationBanner';

function initials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  superadmin:    'Super Admin',
  ria_admin:     'RIA Admin',
  isource_admin: 'iSource Admin',
  finance_user:  'Finance',
  viewer:        'Viewer',
};

export function AppShell() {
  const { user, logout, isImpersonating } = useAuth();
  const { tenant }                        = useTenant();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const displayName  = user?.display_name ?? user?.email ?? 'User';
  const userInitials = initials(user?.display_name, user?.email ?? '');
  const roleLabel    = ROLE_LABELS[user?.role ?? 'viewer'] ?? user?.role;
  const tenantLabel  = tenant?.name ?? user?.tenant_name ?? 'RIA Advisory';

  return (
    <div className="app-layout" style={{ paddingTop: isImpersonating ? 40 : 0 }}>
      <ImpersonationBanner />
      <Sidebar />
      <div className="app-main">
        <header className="app-header">
          <div className="flex-1">
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {tenantLabel} · Unified Financial Intelligence Platform
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
            Data loaded: {new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })} · 188,380 GL entries · 17 entities
          </div>

          {/* User dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 10px', background: 'var(--color-bg)',
                borderRadius: 20, border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--color-primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {userInitials}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{roleLabel}</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--color-text-muted)' }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {dropdownOpen && (
              <>
                {/* Overlay to close */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setDropdownOpen(false)}
                />
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: '#fff', border: '1px solid var(--color-border)',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  minWidth: 220, zIndex: 100, overflow: 'hidden',
                }}>
                  {/* User info */}
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{user?.email}</div>
                    <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 12,
                      background: user?.role === 'superadmin' ? 'var(--teal-100)' : 'var(--success-50)',
                      color:      user?.role === 'superadmin' ? 'var(--teal-700)' : 'var(--success-700)',
                      fontSize: 11, fontWeight: 600,
                    }}>
                      {roleLabel}
                    </div>
                  </div>

                  {/* Tenant */}
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)',
                    fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      Organisation
                    </div>
                    {tenantLabel}
                  </div>

                  {/* Actions */}
                  {user?.role === 'superadmin' && (
                    <a href="/admin/tenants" style={{
                      display: 'block', padding: '10px 16px',
                      fontSize: 13, color: 'var(--color-text)',
                      textDecoration: 'none', borderBottom: '1px solid var(--color-border)',
                    }}
                      onClick={() => setDropdownOpen(false)}
                    >
                      Tenant Management
                    </a>
                  )}
                  {(user?.role === 'superadmin' || user?.role === 'ria_admin' || user?.role === 'isource_admin') && user?.tenant_id && (
                    <a href={`/admin/tenants/${user.tenant_id}/users`} style={{
                      display: 'block', padding: '10px 16px',
                      fontSize: 13, color: 'var(--color-text)',
                      textDecoration: 'none', borderBottom: '1px solid var(--color-border)',
                    }}
                      onClick={() => setDropdownOpen(false)}
                    >
                      Manage Users
                    </a>
                  )}
                  <a href="/settings" style={{
                    display: 'block', padding: '10px 16px',
                    fontSize: 13, color: 'var(--color-text)',
                    textDecoration: 'none', borderBottom: '1px solid var(--color-border)',
                  }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    Settings
                  </a>

                  {/* Logout */}
                  <button
                    onClick={() => { setDropdownOpen(false); logout(); }}
                    style={{
                      width: '100%', padding: '10px 16px', border: 'none',
                      background: 'none', textAlign: 'left', cursor: 'pointer',
                      fontSize: 13, color: '#dc2626',
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
