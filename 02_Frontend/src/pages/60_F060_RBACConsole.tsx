/**
 * F060 — RBAC Console
 * IC-34 | Tenant admin: manage user roles, subsidiary access, impersonation
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PageExplainer from '../components/common/PageExplainer';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RBACUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  subsidiary_access: string[] | null;
  created_at: string | null;
  last_login: string | null;
}

interface RoleOption { role: string; label: string; description: string; }

interface AuditEntry {
  id: string;
  admin_email: string;
  admin_name: string;
  target_email: string;
  target_name: string;
  target_role: string;
  started_at: string;
  stopped_at: string | null;
  reason: string | null;
  ip_address: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  viewer:        'Viewer',
  finance_user:  'Finance User',
  ria_admin:     'RIA Admin',
  isource_admin: 'iSource Admin',
  superadmin:    'Super Admin',
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  superadmin:    { bg: '#fef3c7', color: '#92400e' },
  ria_admin:     { bg: '#dbeafe', color: '#1e40af' },
  isource_admin: { bg: '#e0e7ff', color: '#3730a3' },
  finance_user:  { bg: '#dcfce7', color: '#166534' },
  viewer:        { bg: '#f3f4f6', color: '#374151' },
};

// All BC subsidiaries for RIA Advisory
const ALL_SUBSIDIARIES = [
  'RIA001','RIA002','RIA003','RIA004','RIA005','RIA006','RIA007','RIA008','RIA009',
  'RIA010','RIA011','RIA012','RIA013','RIA014','RIA015','RIA016','RIA017',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function useApi(token: string | null) {
  return useCallback(async (path: string, method = 'GET', body?: unknown) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json();
  }, [token]);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RBACConsolePage() {
  const { token, user, impersonateUser } = useAuth();
  const api = useApi(token);

  const [activeTab, setActiveTab]       = useState<'users' | 'audit'>('users');
  const [users, setUsers]               = useState<RBACUser[]>([]);
  const [roles, setRoles]               = useState<RoleOption[]>([]);
  const [audit, setAudit]               = useState<AuditEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [saving, setSaving]             = useState<string | null>(null);   // user_id being saved
  const [impersonating, setImpersonating] = useState<string | null>(null); // user_id being impersonated
  const [toast, setToast]               = useState<string | null>(null);

  // Editing state per user
  const [editRole, setEditRole]   = useState<Record<string, string>>({});
  const [editSubs, setEditSubs]   = useState<Record<string, string[] | null>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [impersonateReason, setImpersonateReason] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, rolesData] = await Promise.all([
        api('/api/rbac/users'),
        api('/api/rbac/roles'),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      // Initialise edit state from current values
      const roleMap: Record<string, string> = {};
      const subsMap: Record<string, string[] | null> = {};
      usersData.forEach((u: RBACUser) => {
        roleMap[u.id] = u.role;
        subsMap[u.id] = u.subsidiary_access;
      });
      setEditRole(roleMap);
      setEditSubs(subsMap);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadAudit = useCallback(async () => {
    try {
      const data = await api('/api/rbac/impersonation-audit');
      setAudit(data);
    } catch { /* non-fatal */ }
  }, [api]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (activeTab === 'audit') loadAudit(); }, [activeTab, loadAudit]);

  const saveRole = async (userId: string) => {
    setSaving(userId);
    try {
      await api('/api/rbac/assign-role', 'POST', {
        user_id: userId,
        role: editRole[userId],
      });
      showToast('Role updated successfully');
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to save role');
    } finally {
      setSaving(null);
    }
  };

  const saveSubsidiaries = async (userId: string) => {
    setSaving(userId + '_subs');
    try {
      await api('/api/rbac/subsidiary-access', 'POST', {
        user_id: userId,
        subsidiary_access: editSubs[userId],
      });
      showToast('Subsidiary access updated');
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to save subsidiaries');
    } finally {
      setSaving(null);
    }
  };

  const handleImpersonate = async (targetUser: RBACUser) => {
    setImpersonating(targetUser.id);
    try {
      await impersonateUser(targetUser.id, impersonateReason || undefined);
      showToast(`Now impersonating ${targetUser.display_name || targetUser.email}`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Impersonation failed');
    } finally {
      setImpersonating(null);
    }
  };

  const toggleSubsidiary = (userId: string, code: string) => {
    setEditSubs(prev => {
      const current = prev[userId] ?? ALL_SUBSIDIARIES;
      const next = current.includes(code)
        ? current.filter(c => c !== code)
        : [...current, code];
      return { ...prev, [userId]: next };
    });
  };

  const canImpersonate = (targetRole: string): boolean => {
    const order = ['viewer', 'finance_user', 'isource_admin', 'ria_admin', 'superadmin'];
    const myLevel = order.indexOf(user?.role ?? 'viewer');
    const targetLevel = order.indexOf(targetRole);
    return myLevel > targetLevel;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const adminRoles = roles.filter(r =>
    r.role !== 'superadmin' || user?.role === 'superadmin'
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>RBAC Console</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Manage user roles and subsidiary access. Impersonate users to validate their experience.
        </p>
      </div>

      <PageExplainer
        icon="🔐"
        title="What is the RBAC Console?"
        description="This page is the <strong>Role-Based Access Control admin panel</strong> for managing who can see what in i-CFO360. Admins assign roles (Viewer, Finance User, RIA Admin, Superadmin) and control which subsidiaries each user can access. The Impersonation Audit tab logs every time an admin has impersonated another user for compliance and accountability."
        concepts={[
          { icon: '●', color: '#92400e', label: 'Super Admin', desc: 'Full platform access — all tenants and settings' },
          { icon: '●', color: '#1e40af', label: 'RIA Admin', desc: 'Admin for RIA Advisory tenant — manage users and config' },
          { icon: '●', color: '#166534', label: 'Finance User', desc: 'Read/write access to financial dashboards' },
          { icon: '●', color: '#374151', label: 'Viewer', desc: 'Read-only access to assigned subsidiaries' },
        ]}
        glossary={[
          { term: 'Subsidiary Access', def: 'Which of the 17 BC subsidiaries a user can see data for' },
          { term: 'Impersonation', def: 'Admin viewing the platform as another user — logged for audit' },
        ]}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
        {(['users', 'audit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
              marginBottom: -1,
            }}
          >
            {tab === 'users' ? 'Users & Roles' : 'Impersonation Audit'}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, right: 20, zIndex: 9000,
          background: '#1e293b', color: '#fff',
          padding: '10px 16px', borderRadius: 8,
          fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          color: '#991b1b', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* ── USERS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
              Loading users...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {users.map(u => {
                const isExpanded = expandedUser === u.id;
                const roleBadge  = ROLE_COLORS[u.role] ?? ROLE_COLORS.viewer;
                const isDirtyRole = editRole[u.id] !== u.role;
                const isDirtySubs = JSON.stringify(editSubs[u.id]) !== JSON.stringify(u.subsidiary_access);

                return (
                  <div key={u.id} style={{
                    background: '#fff', border: '1px solid var(--color-border)',
                    borderRadius: 10, overflow: 'hidden',
                    opacity: u.is_active ? 1 : 0.6,
                  }}>
                    {/* User row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', cursor: 'pointer',
                    }}
                      onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--color-primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}>
                        {(u.display_name ?? u.email).slice(0, 2).toUpperCase()}
                      </div>

                      {/* Identity */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {u.display_name ?? u.email}
                          {!u.is_active && (
                            <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 6 }}>inactive</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
                          {u.email}
                        </div>
                      </div>

                      {/* Role badge */}
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: roleBadge.bg, color: roleBadge.color,
                      }}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>

                      {/* Subsidiary count */}
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 80, textAlign: 'right' }}>
                        {u.subsidiary_access
                          ? `${u.subsidiary_access.length} subsidiaries`
                          : 'All (inherited)'}
                      </span>

                      {/* Impersonate button */}
                      {canImpersonate(u.role) && u.is_active && (
                        <button
                          onClick={e => { e.stopPropagation(); handleImpersonate(u); }}
                          disabled={impersonating === u.id}
                          style={{
                            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            border: '1px solid #7c3aed', color: '#7c3aed',
                            background: impersonating === u.id ? '#ede9fe' : '#fff',
                            cursor: impersonating === u.id ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          {impersonating === u.id ? 'Starting...' : 'Impersonate'}
                        </button>
                      )}

                      {/* Expand chevron */}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                        <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div style={{
                        borderTop: '1px solid var(--color-border)',
                        padding: '16px 20px',
                        background: '#fafafa',
                        display: 'flex', flexDirection: 'column', gap: 20,
                      }}>
                        {/* Role assignment */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                            Role Assignment
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {adminRoles.map(r => {
                              const isSelected = editRole[u.id] === r.role;
                              const badge = ROLE_COLORS[r.role] ?? ROLE_COLORS.viewer;
                              return (
                                <button
                                  key={r.role}
                                  onClick={() => setEditRole(prev => ({ ...prev, [u.id]: r.role }))}
                                  title={r.description}
                                  style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    cursor: 'pointer',
                                    border: isSelected ? `2px solid ${badge.color}` : '2px solid transparent',
                                    background: isSelected ? badge.bg : '#fff',
                                    color: isSelected ? badge.color : 'var(--color-text-muted)',
                                    boxShadow: isSelected ? `0 0 0 1px ${badge.color}` : '0 0 0 1px #e5e7eb',
                                  }}
                                >
                                  {r.label}
                                </button>
                              );
                            })}

                            {isDirtyRole && (
                              <button
                                onClick={() => saveRole(u.id)}
                                disabled={saving === u.id}
                                style={{
                                  padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                  background: 'var(--color-primary)', color: '#fff',
                                  border: 'none', cursor: saving === u.id ? 'wait' : 'pointer',
                                  marginLeft: 8,
                                }}
                              >
                                {saving === u.id ? 'Saving...' : 'Save Role'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Subsidiary access */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                            Subsidiary Access
                            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400 }}>
                              {editSubs[u.id] === null ? '(inheriting from tenant)' : `(${editSubs[u.id]?.length ?? 0} selected)`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            <button
                              onClick={() => setEditSubs(prev => ({ ...prev, [u.id]: null }))}
                              style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                border: editSubs[u.id] === null ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                background: editSubs[u.id] === null ? '#dbeafe' : '#fff',
                                color: editSubs[u.id] === null ? '#1e40af' : 'var(--color-text-muted)',
                                cursor: 'pointer',
                              }}
                            >
                              Inherit from tenant
                            </button>
                            {ALL_SUBSIDIARIES.map(code => {
                              const list = editSubs[u.id] ?? ALL_SUBSIDIARIES;
                              const checked = list.includes(code);
                              return (
                                <button
                                  key={code}
                                  onClick={() => {
                                    if (editSubs[u.id] === null) {
                                      // Switch from inherit to explicit list first
                                      setEditSubs(prev => ({ ...prev, [u.id]: ALL_SUBSIDIARIES.filter(c => c !== code) }));
                                    } else {
                                      toggleSubsidiary(u.id, code);
                                    }
                                  }}
                                  style={{
                                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                    border: checked && editSubs[u.id] !== null ? '2px solid #16a34a' : '1px solid #e5e7eb',
                                    background: checked && editSubs[u.id] !== null ? '#dcfce7' : '#fff',
                                    color: checked && editSubs[u.id] !== null ? '#166534' : '#9ca3af',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {code}
                                </button>
                              );
                            })}
                          </div>
                          {isDirtySubs && (
                            <button
                              onClick={() => saveSubsidiaries(u.id)}
                              disabled={saving === u.id + '_subs'}
                              style={{
                                padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                background: 'var(--color-primary)', color: '#fff',
                                border: 'none', cursor: saving === u.id + '_subs' ? 'wait' : 'pointer',
                              }}
                            >
                              {saving === u.id + '_subs' ? 'Saving...' : 'Save Access'}
                            </button>
                          )}
                        </div>

                        {/* Impersonation reason input */}
                        {canImpersonate(u.role) && u.is_active && (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                              Impersonation Reason (optional — logged in audit trail)
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="e.g. Validating user's dashboard view"
                                value={impersonateReason}
                                onChange={e => setImpersonateReason(e.target.value)}
                                style={{
                                  flex: 1, padding: '6px 10px', borderRadius: 6,
                                  border: '1px solid var(--color-border)', fontSize: 13,
                                }}
                              />
                              <button
                                onClick={() => handleImpersonate(u)}
                                disabled={impersonating === u.id}
                                style={{
                                  padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                                  background: '#7c3aed', color: '#fff',
                                  border: 'none', cursor: impersonating === u.id ? 'wait' : 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 6,
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                  <circle cx="12" cy="12" r="3"/>
                                </svg>
                                {impersonating === u.id ? 'Starting...' : `Impersonate ${u.display_name?.split(' ')[0] ?? u.email}`}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Meta */}
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          Created: {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          &nbsp;·&nbsp;
                          Last login: {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                          &nbsp;·&nbsp;
                          ID: {u.id}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {users.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                  No users found.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                {['Admin', 'Impersonated User', 'Role', 'Started', 'Stopped', 'Duration', 'Reason', 'IP'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.map(a => {
                const started  = new Date(a.started_at);
                const stopped  = a.stopped_at ? new Date(a.stopped_at) : null;
                const durMs    = stopped ? stopped.getTime() - started.getTime() : null;
                const durStr   = durMs ? `${Math.round(durMs / 60000)}m` : 'Active';
                const badge    = ROLE_COLORS[a.target_role] ?? ROLE_COLORS.viewer;

                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{a.admin_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.admin_email}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{a.target_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.target_email}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color }}>
                        {ROLE_LABELS[a.target_role] ?? a.target_role}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {started.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {stopped ? stopped.toLocaleString() : <span style={{ color: '#7c3aed', fontWeight: 600 }}>Active</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{durStr}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {a.reason ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {a.ip_address ?? '—'}
                    </td>
                  </tr>
                );
              })}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No impersonation events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
