import { useAuth } from '../../contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  viewer:        'Viewer',
  finance_user:  'Finance User',
  ria_admin:     'RIA Admin',
  isource_admin: 'iSource Admin',
  superadmin:    'Super Admin',
};

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedUser, stopImpersonation } = useAuth();

  if (!isImpersonating || !impersonatedUser) return null;

  const roleLabel = ROLE_LABELS[impersonatedUser.role] ?? impersonatedUser.role;

  const handleStop = async () => {
    await stopImpersonation();
    // Reload to restore admin context cleanly
    window.location.reload();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'linear-gradient(90deg, #7c3aed, #4f46e5)',
      color: '#fff',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 13,
      fontWeight: 500,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Eye icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>
          Impersonating&nbsp;
          <strong>{impersonatedUser.display_name || impersonatedUser.email}</strong>
          &nbsp;·&nbsp;
          <span style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 11,
          }}>
            {roleLabel}
          </span>
          &nbsp;·&nbsp;
          <span style={{ opacity: 0.8, fontSize: 12 }}>{impersonatedUser.email}</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          You are viewing the platform as this user
        </span>
        <button
          onClick={handleStop}
          style={{
            padding: '4px 14px',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          Exit Impersonation
        </button>
      </div>
    </div>
  );
}
