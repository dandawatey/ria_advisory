/**
 * F048 — User Management
 * Tenant admin+: list / invite / change role / deactivate users per tenant.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, post, put } from '../api/client';
import { TenantUser, UserRole } from '../types';
import PageExplainer from '../components/common/PageExplainer';

const ROLES: UserRole[] = ['viewer', 'finance_user', 'isource_admin', 'ria_admin', 'superadmin'];

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin:    'Super Admin',
  ria_admin:     'RIA Admin',
  isource_admin: 'iSource Admin',
  finance_user:  'Finance User',
  viewer:        'Viewer',
};

const ROLE_COLORS: Record<UserRole, { bg: string; fg: string }> = {
  superadmin:    { bg: '#eff6ff', fg: '#1d4ed8' },
  ria_admin:     { bg: '#ecfdf5', fg: '#065f46' },
  isource_admin: { bg: '#f5f3ff', fg: '#6d28d9' },
  finance_user:  { bg: '#f0fdf4', fg: '#15803d' },
  viewer:        { bg: '#f9fafb', fg: '#6b7280' },
};

interface InviteForm { email: string; display_name: string; role: UserRole; password: string; }
const emptyInvite = (): InviteForm => ({ email: '', display_name: '', role: 'viewer', password: '' });

export default function UserManagement() {
  const { tenantId }                = useParams<{ tenantId: string }>();
  const navigate                    = useNavigate();
  const [users, setUsers]           = useState<TenantUser[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm]             = useState<InviteForm>(emptyInvite());
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [usersData, tenantData] = await Promise.all([
        get<TenantUser[]>(`/api/tenants/${tenantId}/users`),
        get<{ name: string }>(`/api/tenants/${tenantId}`),
      ]);
      setUsers(usersData);
      setTenantName(tenantData.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.email) { setFormError('Email required'); return; }
    if (!form.display_name) { setFormError('Name required'); return; }
    setSaving(true);
    try {
      await post(`/api/tenants/${tenantId}/users`, form);
      setInviteOpen(false);
      setForm(emptyInvite());
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (user: TenantUser, newRole: UserRole) => {
    try {
      await put(`/api/tenants/${tenantId}/users/${user.id}`, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const handleDeactivate = async (user: TenantUser) => {
    if (!confirm(`Remove "${user.display_name ?? user.email}" from this tenant?`)) return;
    try {
      const token = localStorage.getItem('ria_token');
      await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/tenants/${tenantId}/users/${user.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div style={{ padding: 28, maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <button onClick={() => navigate('/admin/tenants')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              color: 'var(--color-text-muted)', marginBottom: 6, padding: 0 }}>
            ← Back to Tenants
          </button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {tenantName || 'Users'} — User Management
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Manage access and roles for users in this organisation
          </p>
        </div>
        <button onClick={() => { setForm(emptyInvite()); setFormError(null); setInviteOpen(true); }}
          style={{ padding: '8px 18px', background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Invite User
        </button>
      </div>

      <PageExplainer
        icon="👥"
        title="What is User Management?"
        description="This page manages <strong>all users for this tenant organisation</strong>. Admins can invite new users, assign roles (Viewer → Finance User → RIA Admin → Superadmin), and remove users who no longer need access. Each role controls which dashboards and features a user can see and interact with in i-CFO360."
        concepts={[
          { icon: '●', color: '#1d4ed8', label: 'Super Admin', desc: 'Full platform access across all tenants' },
          { icon: '●', color: '#065f46', label: 'RIA Admin', desc: 'Full access within this tenant — manage users and config' },
          { icon: '●', color: '#15803d', label: 'Finance User', desc: 'Access to financial dashboards and reports' },
          { icon: '●', color: '#6b7280', label: 'Viewer', desc: 'Read-only access to assigned subsidiaries only' },
        ]}
        glossary={[
          { term: 'Role', def: 'Determines which pages and actions a user can access within the platform' },
          { term: 'Active', def: 'User can log in; Inactive = access revoked but record preserved for audit' },
        ]}
      />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {ROLES.map((role) => {
          const count = users.filter((u) => u.role === role && u.is_active).length;
          const c = ROLE_COLORS[role];
          return (
            <div key={role} style={{ padding: '14px 18px', background: '#fff',
              borderRadius: 10, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.fg }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{ROLE_LABELS[role]}</div>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-secondary, #f9fafb)', borderBottom: '1px solid var(--color-border)' }}>
              {['User', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600,
                  fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Loading…
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No users yet. Invite the first user.
              </td></tr>
            ) : users.map((u) => {
              const rc = ROLE_COLORS[u.role] ?? { bg: '#f9fafb', fg: '#374151' };
              const initials = (u.display_name ?? u.email).slice(0, 2).toUpperCase();
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)',
                  opacity: u.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%',
                        background: 'var(--color-primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.display_name ?? '—'}</div>
                        {!u.is_active && <div style={{ fontSize: 11, color: '#dc2626' }}>Inactive</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                      disabled={!u.is_active}
                      style={{ padding: '4px 8px', border: `1px solid ${rc.fg}30`,
                        borderRadius: 8, background: rc.bg, color: rc.fg,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: u.is_active ? '#f0fdf4' : '#f9fafb',
                      color: u.is_active ? '#15803d' : '#9ca3af' }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                    {u.last_login
                      ? new Date(u.last_login).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Never'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {u.is_active && (
                      <button onClick={() => handleDeactivate(u)}
                        style={{ padding: '4px 10px', border: '1px solid #fecaca', borderRadius: 6,
                          fontSize: 12, cursor: 'pointer', background: '#fef2f2', color: '#dc2626' }}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700 }}>Invite User</h2>

            {formError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 7, fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{formError}</div>
            )}

            <form onSubmit={handleInvite}>
              {[
                { label: 'Display Name *', key: 'display_name', type: 'text', placeholder: 'Jane Smith' },
                { label: 'Email *',        key: 'email',        type: 'email', placeholder: 'jane@company.com' },
                { label: 'Temporary Password', key: 'password', type: 'password', placeholder: '(optional)' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 5 }}>{label}</label>
                  <input type={type} placeholder={placeholder}
                    value={form[key as keyof InviteForm]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                      border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                </div>
              ))}

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 5 }}>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                    borderRadius: 8, fontSize: 14, background: '#fff' }}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setInviteOpen(false)}
                  style={{ padding: '9px 18px', border: '1px solid #d1d5db', borderRadius: 8,
                    fontSize: 13, cursor: 'pointer', background: '#fff' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '9px 18px', background: 'var(--color-primary)', color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Inviting…' : 'Invite User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
