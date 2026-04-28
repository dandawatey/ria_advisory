/**
 * F040 — Settings
 * Business Central Dynamics 365 connection + application defaults
 */
import { useState, useEffect } from 'react';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BCStatus {
  connected: boolean;
  last_tested: string | null;
  env_name: string;
  company_name: string;
  configured: boolean;
}
interface BCTestResult {
  ok: boolean;
  message: string;
  companies?: { id: string; name: string; displayName: string }[];
}
interface AppSettings {
  [key: string]: string;
}

const PLACEHOLDER_SECRET = '••••••••';

// ── Helpers ───────────────────────────────────────────────────────────────────
function Badge({ ok, label }: { ok: boolean | null; label: string }) {
  const color = ok === null ? '#94a3b8' : ok ? '#10b981' : '#ef4444';
  const bg    = ok === null ? 'rgba(148,163,184,0.12)' : ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
  return (
    <span style={{ background: bg, color, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
      {ok === null ? '○' : ok ? '●' : '●'} {label}
    </span>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', maxWidth: 480, padding: '7px 10px', borderRadius: 6,
          border: '1px solid var(--color-border)', background: 'var(--color-surface)',
          color: 'inherit', fontSize: 13,
        }}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  // BC form state
  const [bcEnv,     setBcEnv]     = useState('');
  const [bcTenant,  setBcTenant]  = useState('');
  const [bcClient,  setBcClient]  = useState('');
  const [bcSecret,  setBcSecret]  = useState('');
  const [bcCompany, setBcCompany] = useState('');
  const [bcApiVer,  setBcApiVer]  = useState('v2.0');

  // BC status + test state
  const [bcStatus,     setBcStatus]     = useState<BCStatus | null>(null);
  const [testResult,   setTestResult]   = useState<BCTestResult | null>(null);
  const [testLoading,  setTestLoading]  = useState(false);
  const [saveLoading,  setSaveLoading]  = useState(false);
  const [saveMsg,      setSaveMsg]      = useState('');

  // Load current settings on mount
  useEffect(() => {
    fetch(`${BASE}/api/settings`)
      .then((r) => r.json())
      .then((data: AppSettings) => {
        setBcEnv(data['bc.env_name']     || '');
        setBcTenant(data['bc.tenant_id'] || '');
        setBcClient(data['bc.client_id'] || '');
        setBcSecret(data['bc.client_secret'] ? PLACEHOLDER_SECRET : '');
        setBcCompany(data['bc.company_name'] || '');
        setBcApiVer(data['bc.api_version']   || 'v2.0');
      })
      .catch(() => {});

    fetch(`${BASE}/api/settings/bc/status`)
      .then((r) => r.json())
      .then(setBcStatus)
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaveLoading(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${BASE}/api/settings/bc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env_name:      bcEnv,
          tenant_id:     bcTenant,
          client_id:     bcClient,
          client_secret: bcSecret,
          company_name:  bcCompany,
          api_version:   bcApiVer || 'v2.0',
        }),
      });
      const data = await res.json();
      setSaveMsg(data.ok ? '✓ Saved' : `Error: ${data.message}`);
    } catch {
      setSaveMsg('Save failed — backend unreachable');
    } finally {
      setSaveLoading(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(`${BASE}/api/settings/bc/test`, { method: 'POST' });
      const data: BCTestResult = await res.json();
      setTestResult(data);
      // Refresh status after test
      fetch(`${BASE}/api/settings/bc/status`).then((r) => r.json()).then(setBcStatus).catch(() => {});
    } catch {
      setTestResult({ ok: false, message: 'Test failed — backend unreachable' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear all BC configuration?')) return;
    await fetch(`${BASE}/api/settings/bc`, { method: 'DELETE' });
    setBcEnv(''); setBcTenant(''); setBcClient('');
    setBcSecret(''); setBcCompany(''); setBcApiVer('v2.0');
    setTestResult(null);
    setBcStatus(null);
  };

  return (
    <div className="page-content">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Settings</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Data source connections · Application preferences
        </div>
      </div>

      {/* ── Business Central Connection ─────────────────────────────────────── */}
      <Section
        title="Business Central — Dynamics 365"
        subtitle="OAuth 2.0 service-to-service (client credentials) · Azure AD app registration required"
      >
        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '10px 14px', background: 'var(--color-surface-alt)', borderRadius: 8 }}>
          <Badge
            ok={bcStatus?.configured ? bcStatus.connected : null}
            label={
              !bcStatus?.configured ? 'Not configured'
              : bcStatus.connected  ? `Connected — ${bcStatus.env_name}`
              : 'Disconnected'
            }
          />
          {bcStatus?.last_tested && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Last tested: {new Date(bcStatus.last_tested).toLocaleString()}
            </span>
          )}
        </div>

        {/* Config form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <Field label="Environment Name" value={bcEnv} onChange={setBcEnv} placeholder="Production" hint='e.g. "Production" or "Sandbox"' />
          <Field label="Company Name" value={bcCompany} onChange={setBcCompany} placeholder="Cronus International Ltd." hint="Default BC company (optional)" />
          <Field label="Azure AD Tenant ID" value={bcTenant} onChange={setBcTenant} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <Field label="API Version" value={bcApiVer} onChange={setBcApiVer} placeholder="v2.0" />
          <Field label="Client ID (App Registration)" value={bcClient} onChange={setBcClient} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <Field label="Client Secret" value={bcSecret} onChange={setBcSecret} type="password" placeholder="Enter secret to update" hint="Leave unchanged to keep existing secret" />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            disabled={saveLoading}
            style={{
              padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 13,
              opacity: saveLoading ? 0.7 : 1,
            }}
          >
            {saveLoading ? 'Saving…' : 'Save Configuration'}
          </button>

          <button
            onClick={handleTest}
            disabled={testLoading || !bcStatus?.configured}
            style={{
              padding: '7px 18px', borderRadius: 6, border: '1px solid var(--color-border)',
              cursor: testLoading || !bcStatus?.configured ? 'not-allowed' : 'pointer',
              background: 'transparent', fontWeight: 600, fontSize: 13,
              opacity: testLoading || !bcStatus?.configured ? 0.6 : 1,
            }}
          >
            {testLoading ? 'Testing…' : 'Test Connection'}
          </button>

          {saveMsg && (
            <span style={{ fontSize: 12, color: saveMsg.startsWith('✓') ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {saveMsg}
            </span>
          )}

          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={handleClear}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)',
                cursor: 'pointer', background: 'transparent', fontSize: 12, color: '#ef4444',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div style={{
            marginTop: 14, padding: '12px 16px', borderRadius: 8,
            background: testResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: testResult.ok ? '#10b981' : '#ef4444', marginBottom: 4 }}>
              {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
            </div>
            {testResult.companies && testResult.companies.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, marginTop: 6 }}>COMPANIES IN BC</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {testResult.companies.map((c) => (
                    <span key={c.id} style={{ padding: '2px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 12, fontWeight: 500 }}>
                      {c.displayName || c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Setup guide */}
        <details style={{ marginTop: 18 }}>
          <summary style={{ fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}>
            ▶ How to get BC credentials
          </summary>
          <div style={{ marginTop: 10, padding: '12px 14px', background: 'var(--color-surface-alt)', borderRadius: 8, fontSize: 12, lineHeight: 1.7 }}>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>Go to <strong>Azure Portal → App registrations → New registration</strong></li>
              <li>Copy the <strong>Application (client) ID</strong> → paste above as Client ID</li>
              <li>Copy the <strong>Directory (tenant) ID</strong> → paste above as Tenant ID</li>
              <li>Go to <strong>Certificates &amp; secrets → New client secret</strong> → paste above</li>
              <li>In <strong>BC Admin Center → Environments</strong>, copy the environment name (e.g. "Production")</li>
              <li>In <strong>BC → Microsoft Entra Applications</strong>, register the App ID and grant permissions</li>
            </ol>
          </div>
        </details>
      </Section>

      {/* ── BC MCP Server ───────────────────────────────────────────────────── */}
      <Section
        title="BC MCP Server (Claude AI)"
        subtitle="Enables Claude to query Business Central data interactively in this session"
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
              The BC MCP server (<code>mcp.businesscentral.dynamics.com</code>) gives Claude direct access
              to GL entries, customers, and other BC entities via natural language queries.
              Authentication is session-based — ask Claude to <em>"authenticate to BC"</em> to start the OAuth flow.
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--color-surface-alt)', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', color: '#8b5cf6' }}>
              Try: "Claude, connect to Business Central and show me the top 5 GL accounts"
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
            <Badge ok={null} label="Session-based auth" />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Ask Claude to authenticate via the chat interface. No persistent token is stored here.
            </div>
          </div>
        </div>
      </Section>

      {/* ── Application Defaults ─────────────────────────────────────────────── */}
      <Section
        title="Application Defaults"
        subtitle="UI preferences — stored locally in your browser"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', maxWidth: 600 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Default Year Filter
            </label>
            <select
              defaultValue={localStorage.getItem('pref.default_year') ?? ''}
              onChange={(e) => localStorage.setItem('pref.default_year', e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'inherit', fontSize: 13, width: '100%' }}
            >
              <option value="">All years</option>
              {[2026, 2025, 2024, 2023, 2022].map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Currency Display
            </label>
            <select
              defaultValue={localStorage.getItem('pref.currency') ?? 'USD'}
              onChange={(e) => localStorage.setItem('pref.currency', e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'inherit', fontSize: 13, width: '100%' }}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AED">AED (د.إ)</option>
            </select>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Preferences are stored in your browser. Clearing browser data resets these.
        </div>
      </Section>
    </div>
  );
}
