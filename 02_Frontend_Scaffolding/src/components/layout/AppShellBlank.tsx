/**
 * AppShellBlank — same chrome as AppShell but sidebar has logo only, no navigation.
 * Used for focused full-page forms (e.g. New Tenant creation).
 */
import { Outlet } from 'react-router-dom';
import { useAuth }   from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import riaLogo       from '../../assets/ria-advisory-logo.svg';
import isourceLogo   from '../../assets/isource-logo.png';

export function AppShellBlank() {
  const { user }   = useAuth();
  const { tenant } = useTenant();

  const isISource = user?.role === 'isource_admin';
  const logo      = isISource ? isourceLogo : riaLogo;
  const logoAlt   = isISource ? 'i-Source Infosystems' : 'RIA Advisory';

  const tenantLabel = tenant?.name ?? user?.tenant_name ?? 'RIA Advisory';

  return (
    <div className="app-layout">
      {/* Sidebar — logo only, no nav */}
      <aside className="app-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-logo" style={{ padding: '16px 12px 12px' }}>
          <img src={logo} alt={logoAlt} style={{ width: '100%', maxWidth: 160, display: 'block', marginBottom: 4 }} />
          <span style={{ fontSize: 10 }}>Unified Financial Intelligence</span>
        </div>
        {/* Intentionally blank — focused form mode */}
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="flex-1">
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {tenantLabel} · Unified Financial Intelligence Platform
            </span>
          </div>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
