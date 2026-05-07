/**
 * F049 — Tenant Configuration
 * 5-tab config page: Branding | BC Dynamics | Subsidiaries | Plan & Billing | Feature Flags
 * Access: ria_admin (own tenant) | isource_admin (own tenant) | superadmin (any)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, put, post } from '../api/client';
import type { FeatureFlag } from '../contexts/FeatureFlagContext';

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

type Tab = 'branding' | 'bc' | 'subsidiaries' | 'billing' | 'flags';

const FLAG_CATEGORY_LABELS: Record<string, string> = {
  ar:          'Accounts Receivable',
  revenue:     'Revenue & Income',
  command:     'Command Center',
  financial:   'Financial Statements',
  performance: 'Performance',
  cost:        'Cost Management',
  planning:    'Planning',
  erp:         'ERP Integration',
  close:       'Close & Control',
  pipeline:    'Data Pipeline',
  admin:       'Administration',
  insights:    'Insights',
};

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
  const [branding,      setBranding]      = useState<Branding>({});
  const [brandSaving,   setBrandSaving]   = useState(false);
  const [brandOk,       setBrandOk]       = useState(false);
  const [logoFile,      setLogoFile]      = useState<File | null>(null);
  const [logoPreview,   setLogoPreview]   = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  // Feature flags state
  const [featureFlags,    setFeatureFlags]    = useState<FeatureFlag[]>([]);
  const [flagsLoading,    setFlagsLoading]    = useState(false);
  const [flagSaving,      setFlagSaving]      = useState<string | null>(null);
  const [flagError,       setFlagError]       = useState<string | null>(null);
  const [flagBulkWorking, setFlagBulkWorking] = useState(false);

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

  const loadFlags = useCallback(async () => {
    if (!tenantId) return;
    setFlagsLoading(true);
    setFlagError(null);
    try {
      const data = await get<FeatureFlag[]>(`/api/tenants/${tenantId}/feature-flags`);
      setFeatureFlags(data);
    } catch (e: unknown) {
      setFlagError(e instanceof Error ? e.message : 'Failed to load flags');
    } finally {
      setFlagsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (activeTab === 'flags') loadFlags();
  }, [activeTab, loadFlags]);

  const handleFlagToggle = async (flag: FeatureFlag) => {
    setFlagSaving(flag.flag_key);
    setFlagError(null);
    try {
      await put(`/api/tenants/${tenantId}/feature-flags/${flag.flag_key}`, {
        is_enabled: !flag.is_enabled,
      });
      setFeatureFlags((prev) =>
        prev.map((f) => f.flag_key === flag.flag_key ? { ...f, is_enabled: !f.is_enabled } : f)
      );
    } catch (e: unknown) {
      setFlagError(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setFlagSaving(null);
    }
  };

  const handleFlagBulk = async (action: 'enable-all' | 'reset') => {
    setFlagBulkWorking(true);
    setFlagError(null);
    try {
      await post(`/api/tenants/${tenantId}/feature-flags/${action}`, {});
      await loadFlags();
    } catch (e: unknown) {
      setFlagError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setFlagBulkWorking(false);
    }
  };

  // ── Save helpers ──────────────────────────────────────────────────────────

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !tenantId) return null;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', logoFile);
      const apiBase = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${apiBase}/api/tenants/${tenantId}/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ria_token')}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Logo upload failed');
      const data = await res.json();
      return data.logo_url as string;
    } finally {
      setLogoUploading(false);
    }
  };

  const saveBranding = async () => {
    if (!tenantId) return;
    setBrandSaving(true);
    setBrandOk(false);
    try {
      // Upload new logo first if one was selected
      if (logoFile) {
        const url = await uploadLogo();
        if (url) setBranding((b) => ({ ...b, logo_url: url }));
        const updatedBranding = { ...branding, ...(url ? { logo_url: url } : {}) };
        await put(`/api/tenants/${tenantId}/config`, { branding: updatedBranding });
      } else {
        await put(`/api/tenants/${tenantId}/config`, { branding });
      }
      setLogoFile(null);
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
    { key: 'branding',     label: 'Branding' },
    { key: 'bc',           label: 'BC Dynamics' },
    { key: 'subsidiaries', label: 'Subsidiaries' },
    { key: 'billing',      label: 'Plan & Billing' },
    { key: 'flags',        label: 'Feature Flags' },
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
          {/* Logo upload */}
          <div>
            <label style={labelStyle}>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {(logoPreview || branding.logo_url) && (
                <img
                  src={logoPreview ?? (
                    (branding.logo_url ?? '').startsWith('http')
                      ? branding.logo_url!
                      : `${import.meta.env.VITE_API_URL ?? ''}${branding.logo_url}`
                  )}
                  alt="Logo"
                  style={{ height: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 6,
                    border: '1px solid #e5e7eb', padding: 4, background: '#f9fafb' }}
                />
              )}
              <div>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  style={{
                    padding: '7px 14px', border: '1px solid #d1d5db', borderRadius: 7,
                    background: '#fff', fontSize: 13, fontWeight: 600,
                    color: '#374151', cursor: 'pointer',
                  }}
                >
                  {logoUploading ? 'Uploading…' : logoFile ? 'Change logo' : 'Upload logo'}
                </button>
                {logoFile && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>{logoFile.name}</div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleLogoChange}
                />
              </div>
            </div>
          </div>
          <div>{saveBtn(brandSaving || logoUploading, brandOk, saveBranding)}</div>
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

      {/* ── Tab: Feature Flags ── */}
      {activeTab === 'flags' && (
        <div>
          {/* Header + bulk actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2423' }}>
                Page &amp; Feature Visibility
              </div>
              <div style={{ fontSize: 12, color: '#66726F', marginTop: 2 }}>
                Phase 1 features are enabled. Toggle Phase 2 features when ready to expose them to this tenant.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleFlagBulk('enable-all')}
                disabled={flagBulkWorking}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: '1px solid #1F6B66', background: '#1F6B66', color: 'white',
                  cursor: flagBulkWorking ? 'default' : 'pointer', opacity: flagBulkWorking ? 0.7 : 1,
                }}
              >
                {flagBulkWorking ? '…' : 'Enable All'}
              </button>
              <button
                onClick={() => handleFlagBulk('reset')}
                disabled={flagBulkWorking}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: '1px solid #D1D8D8', background: 'white', color: '#333938',
                  cursor: flagBulkWorking ? 'default' : 'pointer', opacity: flagBulkWorking ? 0.7 : 1,
                }}
              >
                {flagBulkWorking ? '…' : 'Reset to Phase 1'}
              </button>
            </div>
          </div>

          {flagError && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6,
              padding: '8px 12px', color: '#991B1B', fontSize: 13, marginBottom: 14,
            }}>
              {flagError}
            </div>
          )}

          {flagsLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#66726F', fontSize: 13 }}>
              Loading flags…
            </div>
          ) : (
            (() => {
              const grouped = featureFlags.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
                if (!acc[f.category]) acc[f.category] = [];
                acc[f.category].push(f);
                return acc;
              }, {});

              const enabledCount  = featureFlags.filter((f) => f.is_enabled).length;
              const totalCount    = featureFlags.length;

              return (
                <>
                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                    {[
                      { label: 'Enabled', value: enabledCount, color: '#166534', bg: '#F0FDF4' },
                      { label: 'Disabled', value: totalCount - enabledCount, color: '#991B1B', bg: '#FEF2F2' },
                      { label: 'Total', value: totalCount, color: '#1F6B66', bg: '#EEF5F4' },
                    ].map((s) => (
                      <div key={s.label} style={{
                        background: s.bg, border: `1px solid ${s.color}22`,
                        borderRadius: 6, padding: '8px 14px', minWidth: 70,
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: '#66726F' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Flag list grouped by category */}
                  {Object.entries(grouped)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([category, items]) => (
                      <div key={category} style={{ marginBottom: 20 }}>
                        <div style={{
                          fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
                          textTransform: 'uppercase', color: '#1F6B66', marginBottom: 6,
                        }}>
                          {FLAG_CATEGORY_LABELS[category] ?? category}
                        </div>
                        <div style={{ border: '1px solid #E8ECEC', borderRadius: 8, overflow: 'hidden' }}>
                          {items.map((flag, i) => (
                            <div
                              key={flag.flag_key}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 14px',
                                borderBottom: i < items.length - 1 ? '1px solid #F4F6F6' : 'none',
                                background: flag.is_enabled ? 'white' : '#FAFBFB',
                              }}
                            >
                              {/* Toggle */}
                              <button
                                onClick={() => handleFlagToggle(flag)}
                                disabled={flagSaving === flag.flag_key}
                                aria-label={`${flag.is_enabled ? 'Disable' : 'Enable'} ${flag.label}`}
                                style={{
                                  flexShrink: 0,
                                  width: 34, height: 18, borderRadius: 9,
                                  border: 'none',
                                  background: flagSaving === flag.flag_key
                                    ? '#D1D8D8'
                                    : flag.is_enabled ? '#1F6B66' : '#D1D8D8',
                                  position: 'relative',
                                  cursor: flagSaving === flag.flag_key ? 'default' : 'pointer',
                                  transition: 'background 0.2s',
                                  padding: 0,
                                }}
                              >
                                <span style={{
                                  position: 'absolute',
                                  top: 2,
                                  left: flag.is_enabled ? 16 : 2,
                                  width: 14, height: 14,
                                  borderRadius: '50%', background: 'white',
                                  transition: 'left 0.15s',
                                }} />
                              </button>

                              {/* Label */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{
                                  fontSize: 13, fontWeight: 600,
                                  color: flag.is_enabled ? '#1F2423' : '#B0BABA',
                                }}>
                                  {flag.label}
                                </span>
                                {flag.phase === 'phase1' && (
                                  <span style={{
                                    marginLeft: 7, fontSize: 10, fontWeight: 700,
                                    letterSpacing: '0.08em', textTransform: 'uppercase',
                                    background: '#EEF5F4', color: '#1F6B66',
                                    padding: '1px 5px', borderRadius: 3,
                                  }}>
                                    Phase 1
                                  </span>
                                )}
                              </div>

                              {/* Status */}
                              <span style={{
                                flexShrink: 0, fontSize: 11, fontWeight: 600,
                                padding: '2px 7px', borderRadius: 4,
                                background: flag.is_enabled ? '#F0FDF4' : '#F4F6F6',
                                color: flag.is_enabled ? '#166534' : '#66726F',
                              }}>
                                {flagSaving === flag.flag_key ? '…' : flag.is_enabled ? 'On' : 'Off'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  }
                </>
              );
            })()
          )}
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
