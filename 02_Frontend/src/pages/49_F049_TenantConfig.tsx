/**
 * F049 — Tenant Configuration
 * 4-tab config page: Branding | BC Dynamics | Subsidiaries | Plan & Billing
 * Access: ria_admin (own tenant) | isource_admin (own tenant) | superadmin (any)
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, put, post } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branding {
  display_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  support_email?: string;
}

interface Billing {
  contact_email?: string;
  max_users?: number;
  max_subsidiaries?: number;
  renewal_date?: string;
  auto_renew?: boolean;
}

interface TenantConfig {
  branding: Branding;
  subsidiary_access: string[];
  billing: Billing;
}

interface BCConfig {
  bc_tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  environment?: string;
  api_version?: string;
  auth_status?: string;
  last_tested?: string;
  detail?: string;
}

type Tab = 'branding' | 'bc' | 'subsidiaries' | 'billing';

// ── All 17 subsidiaries from the GL data ─────────────────────────────────────
const ALL_SUBSIDIARIES = [
  'RIA001', 'RIA002', 'RIA003', 'RIA004', 'RIA005',
  'RIA006', 'RIA007', 'RIA008', 'RIA009', 'RIA010',
  'RIA011', 'RIA012', 'RIA013', 'RIA014', 'RIA015',
  'RIA016', 'RIA017',
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TenantConfig() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate     = useNavigate();

  const [activeTab,  setActiveTab]  = useState<Tab>('branding');
  const [tenantName, setTenantName] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Branding state
  const [branding,    setBranding]    = useState<Branding>({});
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandOk,     setBrandOk]     = useState(false);

  // BC config state
  const [bc,          setBC]          = useState<BCConfig>({});
  const [bcSaving,    setBCSaving]    = useState(false);
  const [bcTesting,   setBCTesting]   = useState(false);
  const [bcOk,        setBCOk]        = useState(false);

  // Subsidiaries state
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [subSaving,    setSubSaving]    = useState(false);
  const [subOk,        setSubOk]        = useState(false);

  // Billing state
  const [billing,      setBilling]      = useState<Billing>({});
  const [billSaving,   setBillSaving]   = useState(false);
  const [billOk,       setBillOk]       = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [tenantData, configData, bcData] = await Promise.all([
        get<{ name: string }>(`/api/tenants/${tenantId}`),
        get<TenantConfig>(`/api/tenants/${tenantId}/config`),
        get<BCConfig>(`/api/tenants/${tenantId}/bc-config`),
      ]);
      setTenantName(tenantData.name);
      setBranding(configData.branding ?? {});
      setSelectedSubs(configData.subsidiary_access ?? []);
      setBilling(configData.billing ?? {});
      setBC(bcData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [tenantId]);

  // ── Save helpers ──────────────────────────────────────────────────────────

  const saveBranding = async () => {
    if (!tenantId) return;
    setBrandSaving(true);
    setBrandOk(false);
    try {
      await put(`/api/tenants/${tenantId}/config`, { branding });
      setBrandOk(true);
      setTimeout(() => setBrandOk(false), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBrandSaving(false);
    }
  };

  const saveBC = async () => {
    if (!tenantId) return;
    setBCSaving(true);
    setBCOk(false);
    try {
      const payload: BCConfig = {};
      if (bc.bc_tenant_id  !== undefined) payload.bc_tenant_id  = bc.bc_tenant_id;
      if (bc.client_id     !== undefined) payload.client_id     = bc.client_id;
      if (bc.environment   !== undefined) payload.environment   = bc.environment;
      if (bc.api_version   !== undefined) payload.api_version   = bc.api_version;
      // Only send client_secret if user typed a new value (not the masked placeholder)
      if (bc.client_secret && bc.client_secret !== '••••••') payload.client_secret = bc.client_secret;
      await put(`/api/tenants/${tenantId}/bc-config`, payload);
      setBCOk(true);
      setTimeout(() => setBCOk(false), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBCSaving(false);
    }
  };

  const testBC = async () => {
    if (!tenantId) return;
    setBCTesting(true);
    try {
      const result = await post<BCConfig>(`/api/tenants/${tenantId}/bc-config/test`, {});
      setBC((prev) => ({ ...prev, auth_status: result.auth_status, last_tested: result.last_tested, detail: result.detail }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setBCTesting(false);
    }
  };

  const saveSubsidiaries = async () => {
    if (!tenantId) return;
    setSubSaving(true);
    setSubOk(false);
    try {
      await put(`/api/tenants/${tenantId}/config`, { subsidiary_access: selectedSubs });
      setSubOk(true);
      setTimeout(() => setSubOk(false), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubSaving(false);
    }
  };

  const saveBilling = async () => {
    if (!tenantId) return;
    setBillSaving(true);
    setBillOk(false);
    try {
      await put(`/api/tenants/${tenantId}/config`, { billing });
      setBillOk(true);
      setTimeout(() => setBillOk(false), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBillSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
        Loading configuration…
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'branding',      label: 'Branding' },
    { key: 'bc',            label: 'BC Dynamics' },
    { key: 'subsidiaries',  label: 'Subsidiaries' },
    { key: 'billing',       label: 'Plan & Billing' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: 14,
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 5,
  };
  const saveBtn = (saving: boolean, ok: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        padding: '9px 22px', borderRadius: 8, border: 'none',
        background: ok ? '#15803d' : 'var(--color-primary)',
        color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
        opacity: saving ? 0.7 : 1, transition: 'background 200ms',
      }}
    >
      {saving ? 'Saving…' : ok ? '✓ Saved' : 'Save Changes'}
    </button>
  );

  return (
    <div style={{ padding: 28, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => navigate('/admin/tenants')}
          style={{ padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: 7,
            background: '#fff', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)' }}
        >
          ← Tenants
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {tenantName} — Configuration
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Manage branding, integrations, access, and billing for this organisation
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', marginBottom: 32 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none',
              fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500,
              color: activeTab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeTab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Branding ── */}
      {activeTab === 'branding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input style={inputStyle} value={branding.display_name ?? ''}
                onChange={(e) => setBranding((b) => ({ ...b, display_name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Support Email</label>
              <input style={inputStyle} type="email" value={branding.support_email ?? ''}
                onChange={(e) => setBranding((b) => ({ ...b, support_email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Primary Colour</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={branding.primary_color || '#0F3F3C'}
                  onChange={(e) => setBranding((b) => ({ ...b, primary_color: e.target.value }))}
                  style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input style={{ ...inputStyle, flex: 1 }} value={branding.primary_color ?? '#0F3F3C'}
                  onChange={(e) => setBranding((b) => ({ ...b, primary_color: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Secondary Colour</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={branding.secondary_color || '#E8443B'}
                  onChange={(e) => setBranding((b) => ({ ...b, secondary_color: e.target.value }))}
                  style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input style={{ ...inputStyle, flex: 1 }} value={branding.secondary_color ?? '#E8443B'}
                  onChange={(e) => setBranding((b) => ({ ...b, secondary_color: e.target.value }))} />
              </div>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Logo URL</label>
            <input style={inputStyle} placeholder="https://…" value={branding.logo_url ?? ''}
              onChange={(e) => setBranding((b) => ({ ...b, logo_url: e.target.value }))} />
          </div>
          <div>{saveBtn(brandSaving, brandOk, saveBranding)}</div>
        </div>
      )}

      {/* ── Tab: BC Dynamics ── */}
      {activeTab === 'bc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Status badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 10,
            background: bc.auth_status === 'authenticated' ? '#ecfdf5'
              : bc.auth_status === 'error' ? '#fef2f2' : '#f9fafb',
            border: `1px solid ${bc.auth_status === 'authenticated' ? '#a7f3d0'
              : bc.auth_status === 'error' ? '#fecaca' : '#e5e7eb'}`,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: bc.auth_status === 'authenticated' ? '#15803d'
                : bc.auth_status === 'error' ? '#dc2626' : '#d1d5db',
              flexShrink: 0,
            }} />
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                Status: {bc.auth_status ?? 'pending'}
              </span>
              {bc.last_tested && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 12 }}>
                  Last tested: {bc.last_tested}
                </span>
              )}
              {bc.detail && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>{bc.detail}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <label style={labelStyle}>BC Tenant ID (Directory ID)</label>
              <input style={inputStyle} value={bc.bc_tenant_id ?? ''}
                onChange={(e) => setBC((b) => ({ ...b, bc_tenant_id: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Client ID (App Registration)</label>
              <input style={inputStyle} value={bc.client_id ?? ''}
                onChange={(e) => setBC((b) => ({ ...b, client_id: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Client Secret</label>
              <input style={inputStyle} type="password"
                placeholder={bc.client_secret === '••••••' ? '••••••  (saved)' : 'Enter new secret'}
                value={bc.client_secret === '••••••' ? '' : (bc.client_secret ?? '')}
                onChange={(e) => setBC((b) => ({ ...b, client_secret: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Environment</label>
              <select style={inputStyle} value={bc.environment ?? 'production'}
                onChange={(e) => setBC((b) => ({ ...b, environment: e.target.value }))}>
                <option value="production">Production</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>API Version</label>
              <select style={inputStyle} value={bc.api_version ?? 'v2.0'}
                onChange={(e) => setBC((b) => ({ ...b, api_version: e.target.value }))}>
                <option value="v2.0">v2.0</option>
                <option value="v1.0">v1.0</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {saveBtn(bcSaving, bcOk, saveBC)}
            <button
              onClick={testBC}
              disabled={bcTesting}
              style={{
                padding: '9px 22px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: '#fff', fontSize: 13, fontWeight: 600,
                cursor: bcTesting ? 'default' : 'pointer',
                opacity: bcTesting ? 0.7 : 1,
              }}
            >
              {bcTesting ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Subsidiaries ── */}
      {activeTab === 'subsidiaries' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <button
              onClick={() => setSelectedSubs([...ALL_SUBSIDIARIES])}
              style={{ padding: '5px 12px', border: '1px solid var(--color-border)',
                borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer' }}>
              Select All
            </button>
            <button
              onClick={() => setSelectedSubs([])}
              style={{ padding: '5px 12px', border: '1px solid var(--color-border)',
                borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer' }}>
              Clear All
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
              {selectedSubs.length} / {ALL_SUBSIDIARIES.length} selected
            </span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24,
          }}>
            {ALL_SUBSIDIARIES.map((sub) => {
              const checked = selectedSubs.includes(sub);
              return (
                <label key={sub} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 8,
                  border: `1px solid ${checked ? '#a7f3d0' : 'var(--color-border)'}`,
                  background: checked ? '#ecfdf5' : '#fff',
                  cursor: 'pointer', userSelect: 'none',
                }}>
                  <input type="checkbox" checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedSubs((s) => [...s, sub]);
                      else setSelectedSubs((s) => s.filter((x) => x !== sub));
                    }}
                    style={{ accentColor: '#15803d' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400 }}>{sub}</span>
                </label>
              );
            })}
          </div>

          <div>{saveBtn(subSaving, subOk, saveSubsidiaries)}</div>
        </div>
      )}

      {/* ── Tab: Plan & Billing ── */}
      {activeTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <label style={labelStyle}>Billing Contact Email</label>
              <input style={inputStyle} type="email" value={billing.contact_email ?? ''}
                onChange={(e) => setBilling((b) => ({ ...b, contact_email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Renewal Date</label>
              <input style={inputStyle} type="date" value={billing.renewal_date ?? ''}
                onChange={(e) => setBilling((b) => ({ ...b, renewal_date: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Max Users</label>
              <input style={inputStyle} type="number" min={1} value={billing.max_users ?? 50}
                onChange={(e) => setBilling((b) => ({ ...b, max_users: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={labelStyle}>Max Subsidiaries</label>
              <input style={inputStyle} type="number" min={1} max={17} value={billing.max_subsidiaries ?? 17}
                onChange={(e) => setBilling((b) => ({ ...b, max_subsidiaries: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input id="auto-renew" type="checkbox"
              checked={billing.auto_renew ?? true}
              onChange={(e) => setBilling((b) => ({ ...b, auto_renew: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
            <label htmlFor="auto-renew" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Auto-renew subscription
            </label>
          </div>

          <div>{saveBtn(billSaving, billOk, saveBilling)}</div>
        </div>
      )}
    </div>
  );
}
