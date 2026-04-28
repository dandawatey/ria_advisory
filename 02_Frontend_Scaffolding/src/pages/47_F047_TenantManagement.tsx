/**
 * F047 — Tenant Management
 * Superadmin: list / create / edit / deactivate tenants.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put } from '../api/client';
import { Tenant } from '../types';

const PLANS = ['trial', 'starter', 'professional', 'enterprise'];

interface TenantForm { name: string; slug: string; plan: string; }
const emptyForm = (): TenantForm => ({ name: '', slug: '', plan: 'trial' });

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function TenantManagement() {
  const navigate = useNavigate();
  const [tenants, setTenants]       = useState<Tenant[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [modal, setModal]           = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);
  const [form, setForm]             = useState<TenantForm>(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await get<Tenant[]>('/api/tenants');
      setTenants(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError(null);
    setEditTarget(null);
    setModal('create');
  };

  const openEdit = (t: Tenant) => {
    setForm({ name: t.name, slug: t.slug, plan: t.plan });
    setFormError(null);
    setEditTarget(t);
    setModal('edit');
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name required'); return; }
    if (!form.slug.trim()) { setFormError('Slug required'); return; }
    setSaving(true);
    try {
      if (modal === 'create') {
        await post<Tenant>('/api/tenants', form);
      } else if (editTarget) {
        await put<Tenant>(`/api/tenants/${editTarget.id}`, { name: form.name, plan: form.plan });
      }
      setModal(null);
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (t: Tenant) => {
    if (!confirm(`Deactivate tenant "${t.name}"?`)) return;
    try {
      await put(`/api/tenants/${t.id}`, { status: 'suspended' });
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const statusColor = (s: string) =>
    s === 'active' ? { bg: '#f0fdf4', fg: '#15803d' }
    : s === 'suspended' ? { bg: '#fef3c7', fg: '#b45309' }
    : { bg: '#f3f4f6', fg: '#6b7280' };

  const planColor = (p: string) =>
    p === 'enterprise' ? { bg: '#eff6ff', fg: '#1d4ed8' }
    : p === 'professional' ? { bg: '#f5f3ff', fg: '#6d28d9' }
    : { bg: '#f9fafb', fg: '#374151' };

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tenant Management</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Manage organisations using the i-finsights platform
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            padding: '8px 18px', background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          + New Tenant
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Tenants',  value: tenants.length,                                  color: '#1d4ed8' },
          { label: 'Active',         value: tenants.filter((t) => t.status === 'active').length, color: '#15803d' },
          { label: 'Total Users',    value: tenants.reduce((s, t) => s + (t.user_count ?? 0), 0), color: '#7c3aed' },
        ].map((c) => (
          <div key={c.label} style={{
            padding: '16px 20px', background: '#fff',
            borderRadius: 10, border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Error */}
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
              {['Organisation', 'Slug', 'Plan', 'Status', 'Users', 'Created', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600,
                  fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Loading…
              </td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No tenants found
              </td></tr>
            ) : tenants.map((t) => {
              const sc = statusColor(t.status);
              const pc = planColor(t.plan);
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{t.slug}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: pc.bg, color: pc.fg, fontSize: 11, fontWeight: 600 }}>
                      {t.plan}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: sc.bg, color: sc.fg, fontSize: 11, fontWeight: 600 }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{t.user_count ?? 0}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(t)}
                        style={{ padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: 6,
                          fontSize: 12, cursor: 'pointer', background: '#fff' }}>
                        Edit
                      </button>
                      <button onClick={() => navigate(`/admin/tenants/${t.id}/users`)}
                        style={{ padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: 6,
                          fontSize: 12, cursor: 'pointer', background: '#fff' }}>
                        Users
                      </button>
                      <button onClick={() => navigate(`/admin/tenants/${t.id}/config`)}
                        style={{ padding: '4px 10px', border: '1px solid #bfdbfe', borderRadius: 6,
                          fontSize: 12, cursor: 'pointer', background: '#eff6ff', color: '#1d4ed8' }}>
                        Configure
                      </button>
                      {t.status === 'active' && (
                        <button onClick={() => handleDeactivate(t)}
                          style={{ padding: '4px 10px', border: '1px solid #fecaca', borderRadius: 6,
                            fontSize: 12, cursor: 'pointer', background: '#fef2f2', color: '#dc2626' }}>
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700 }}>
              {modal === 'create' ? 'New Tenant' : `Edit — ${editTarget?.name}`}
            </h2>

            {formError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 7, fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{formError}</div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 5 }}>Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({
                ...f, name: e.target.value,
                slug: modal === 'create' ? slugify(e.target.value) : f.slug,
              }))}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            </div>

            {modal === 'create' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 5 }}>Slug *</label>
                <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                    border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'monospace' }} />
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 5 }}>Plan</label>
              <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                  borderRadius: 8, fontSize: 14, background: '#fff' }}>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)}
                style={{ padding: '9px 18px', border: '1px solid #d1d5db', borderRadius: 8,
                  fontSize: 13, cursor: 'pointer', background: '#fff' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '9px 18px', background: 'var(--color-primary)', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : modal === 'create' ? 'Create Tenant' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
