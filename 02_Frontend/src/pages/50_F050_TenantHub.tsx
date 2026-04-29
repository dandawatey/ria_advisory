/**
 * F050 — Superadmin Tenant Hub
 * Landing page for superadmin: tiles for every tenant.
 * Click a tile → switchTenant + navigate to /dashboard.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../contexts/AuthContext';
import { useTenant }   from '../contexts/TenantContext';
import { Tenant }      from '../types';
import riaLogo         from '../assets/ria-advisory-logo.svg';
import isourceLogo     from '../assets/isource-logo.png';

// ── Tenant meta helpers ────────────────────────────────────────────────────

function tenantLogo(t: Tenant) {
  if (t.slug === 'isource') return isourceLogo;
  return riaLogo;
}

function tenantLogoAlt(t: Tenant) {
  return t.slug === 'isource' ? 'i-Source Infosystems' : t.name;
}

function planColor(plan: string): { bg: string; fg: string } {
  if (plan === 'enterprise')    return { bg: '#eff6ff', fg: '#1d4ed8' };
  if (plan === 'professional')  return { bg: '#f5f3ff', fg: '#6d28d9' };
  if (plan === 'starter')       return { bg: '#f0fdf4', fg: '#15803d' };
  return { bg: '#f9fafb', fg: '#6b7280' };
}

function statusDot(status: string): string {
  if (status === 'active')    return '#15803d';
  if (status === 'suspended') return '#b45309';
  return '#d1d5db';
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TenantHub() {
  const navigate               = useNavigate();
  const { user }               = useAuth();
  const { tenants, switchTenant } = useTenant();

  const handleEnter = (t: Tenant) => {
    switchTenant(t.id);
    navigate('/dashboard');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--neutral-25, #f8fafa)',
      fontFamily: "'Nunito Sans', system-ui, sans-serif",
    }}>
      {/* ── Top bar ── */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid var(--neutral-100, #e5e7eb)',
        padding: '0 40px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--teal-800, #0F3F3C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 900, color: '#fff',
          }}>i</div>
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: '#111' }}>
            i-CFO<span style={{ color: 'var(--coral-500, #E8443B)' }}>360</span>
          </span>
        </div>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          Superadmin · {user?.display_name ?? user?.email}
        </span>
      </header>

      {/* ── Content ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 40px' }}>

        {/* Heading */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: 'inline-block', marginBottom: 12,
            fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: 'var(--teal-600, #1F6B66)', background: 'var(--teal-50, #f0faf9)',
            padding: '4px 14px', borderRadius: 999,
          }}>
            Platform Administration
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', color: '#111' }}>
            Select a tenant
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, color: '#6b7280' }}>
            {tenants.length} organisation{tenants.length !== 1 ? 's' : ''} on this platform
          </p>
        </div>

        {/* Tenant tiles grid */}
        {tenants.length === 0 ? (
          <div style={{
            padding: 60, textAlign: 'center', color: '#9ca3af',
            border: '2px dashed #e5e7eb', borderRadius: 16, fontSize: 15,
          }}>
            No tenants found. Create one in Tenant Management.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
          }}>
            {tenants.map((t) => {
              const pc  = planColor(t.plan);
              const dot = statusDot(t.status);
              return (
                <button
                  key={t.id}
                  onClick={() => handleEnter(t)}
                  style={{
                    textAlign: 'left',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 16,
                    padding: 28,
                    cursor: 'pointer',
                    transition: 'all 160ms ease',
                    boxShadow: '0 1px 4px rgba(0,0,0,.05)',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--teal-300, #5bbfb8)';
                    e.currentTarget.style.boxShadow  = '0 6px 20px rgba(15,63,60,.12)';
                    e.currentTarget.style.transform  = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow  = '0 1px 4px rgba(0,0,0,.05)';
                    e.currentTarget.style.transform  = 'translateY(0)';
                  }}
                >
                  {/* Logo */}
                  <div style={{ marginBottom: 20, height: 36, display: 'flex', alignItems: 'center' }}>
                    <img
                      src={tenantLogo(t)}
                      alt={tenantLogoAlt(t)}
                      style={{ maxHeight: 36, maxWidth: 160, objectFit: 'contain' }}
                    />
                  </div>

                  {/* Name + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: dot, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 17, fontWeight: 800, color: '#111', letterSpacing: '-0.01em' }}>
                      {t.name}
                    </span>
                  </div>

                  {/* Slug */}
                  <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 16 }}>
                    /{t.slug}
                  </div>

                  {/* Badges row */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20,
                      background: pc.bg, color: pc.fg,
                      fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                    }}>
                      {t.plan}
                    </span>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20,
                      background: t.status === 'active' ? '#ecfdf5' : '#fef3c7',
                      color: t.status === 'active' ? '#065f46' : '#92400e',
                      fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                    }}>
                      {t.status}
                    </span>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20,
                      background: '#f3f4f6', color: '#4b5563',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {t.user_count ?? 0} users
                    </span>
                  </div>

                  {/* Enter CTA */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingTop: 16, borderTop: '1px solid #f3f4f6',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-600, #1F6B66)' }}>
                      Enter tenant →
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/tenants/${t.id}/config`); }}
                        style={{
                          padding: '4px 10px', fontSize: 11, fontWeight: 600,
                          border: '1px solid #bfdbfe', borderRadius: 6,
                          background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer',
                        }}
                      >
                        Configure
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/tenants/${t.id}/users`); }}
                        style={{
                          padding: '4px 10px', fontSize: 11, fontWeight: 600,
                          border: '1px solid #e5e7eb', borderRadius: 6,
                          background: '#f9fafb', color: '#374151', cursor: 'pointer',
                        }}
                      >
                        Users
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Quick actions footer */}
        <div style={{
          marginTop: 48, paddingTop: 32, borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: 12,
        }}>
          <button
            onClick={() => navigate('/admin/tenants/new')}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: 'none', background: 'var(--teal-700, #0F3F3C)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff',
            }}
          >
            + New Tenant
          </button>
          <button
            onClick={() => navigate('/admin/api')}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: '1px solid #e5e7eb', background: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151',
            }}
          >
            API Status
          </button>
          <button
            onClick={() => navigate('/admin/pipeline-health')}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: '1px solid #e5e7eb', background: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151',
            }}
          >
            Pipeline Health
          </button>
        </div>
      </main>
    </div>
  );
}
