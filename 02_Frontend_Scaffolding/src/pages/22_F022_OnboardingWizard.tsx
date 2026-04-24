/**
 * F022 — Subsidiary Onboarding Wizard
 * Admin page: 7-step guided onboarding for new BC tenant.
 */
import { useState } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';

const STEPS = [
  { id: 1, label: 'Entity Registration' },
  { id: 2, label: 'Auth Config' },
  { id: 3, label: 'Entity Catalog' },
  { id: 4, label: 'Validation Load' },
  { id: 5, label: 'Account Mapping' },
  { id: 6, label: 'Full Load' },
  { id: 7, label: 'Go Live' },
];

const activeOnboardings = [
  { code: 'SUB18', name: 'Harbor Springs Capital', currentStep: 4, startedAt: '2026-04-10', targetGoLive: '2026-05-10', controller: 'David Wu', status: 'running' as const },
];

export default function OnboardingWizard() {
  const [view, setView] = useState<'list' | 'wizard'>('list');
  const [step, setStep] = useState(1);
  const [testStatus, setTestStatus] = useState<null | 'running' | 'success' | 'error'>(null);

  const handleTestAuth = () => {
    setTestStatus('running');
    setTimeout(() => setTestStatus('success'), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Subsidiary Onboarding Wizard</h1>
        <p className="page-subtitle">
          End-to-end guided onboarding for new BC tenants. Target: ≤ 30 calendar days to Go Live. (F022)
        </p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setView('wizard'); setStep(1); }}>
            + Onboard New Subsidiary
          </button>
          <button className="btn btn-secondary" onClick={() => setView('list')}>Active Onboardings</button>
        </div>
      </div>

      {view === 'list' && (
        <div>
          <div className="card mb-16">
            <div className="card-title">Active Onboardings</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Code</th><th>Subsidiary</th><th>Current Step</th><th>Progress</th><th>Started</th><th>Target Go Live</th><th>Controller</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {activeOnboardings.map((o) => {
                    const pct = Math.round((o.currentStep / STEPS.length) * 100);
                    return (
                      <tr key={o.code}>
                        <td><span className="badge badge-muted">{o.code}</span></td>
                        <td style={{ fontWeight: 500 }}>{o.name}</td>
                        <td>
                          <span className="badge badge-info">Step {o.currentStep}: {STEPS[o.currentStep - 1].label}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ width: 80 }}>
                              <div className="progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: 12 }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }} className="text-muted">{o.startedAt}</td>
                        <td style={{ fontSize: 12 }}>{o.targetGoLive}</td>
                        <td style={{ fontSize: 12 }}>{o.controller}</td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => { setView('wizard'); setStep(o.currentStep); }}>
                            Resume
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'wizard' && (
        <div className="card">
          {/* Wizard steps */}
          <div className="wizard-steps">
            {STEPS.map((s) => (
              <div key={s.id} className={`wizard-step ${s.id < step ? 'complete' : s.id === step ? 'active' : ''}`}>
                <div className="wizard-dot">{s.id < step ? '✓' : s.id}</div>
                <div className="wizard-step-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Step content */}
          {step === 1 && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Step 1: Entity Registration</h3>
              <div className="form-row form-row-2">
                <div className="form-group"><label className="form-label">Legal Entity Name *</label><input className="form-input" placeholder="e.g. Harbor Springs Capital LLC" /></div>
                <div className="form-group"><label className="form-label">Subsidiary Code * (≤10 chars)</label><input className="form-input" placeholder="e.g. SUB18" maxLength={10} /></div>
                <div className="form-group"><label className="form-label">Jurisdiction *</label><select className="form-select"><option>United States</option><option>Canada</option><option>United Kingdom</option></select></div>
                <div className="form-group"><label className="form-label">Functional Currency *</label><select className="form-select"><option>USD</option><option>GBP</option><option>CAD</option><option>EUR</option></select></div>
                <div className="form-group"><label className="form-label">BC API Tenant ID *</label><input className="form-input table-mono" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
                <div className="form-group"><label className="form-label">Fiscal Year Start Month *</label><select className="form-select">{Array.from({ length: 12 }, (_, i) => <option key={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}</select></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Step 2: Authentication Configuration</h3>
              <div className="form-row form-row-2">
                <div className="form-group"><label className="form-label">Entra ID App Client ID *</label><input className="form-input table-mono" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
                <div className="form-group"><label className="form-label">Key Vault Secret Reference *</label><input className="form-input table-mono" defaultValue="kv-ufip-prod/sub18-bc-cert" /></div>
              </div>
              <div className="mt-16">
                <button className="btn btn-secondary" onClick={handleTestAuth} disabled={testStatus === 'running'}>
                  {testStatus === 'running' ? '⟳ Testing…' : '▶ Test Authentication'}
                </button>
                {testStatus === 'success' && (
                  <div className="alert alert-success" style={{ marginTop: 12 }}>
                    ✓ Authentication successful. BC API v2.0 accessible for tenant.
                  </div>
                )}
                {testStatus === 'error' && (
                  <div className="alert alert-error" style={{ marginTop: 12 }}>
                    ✗ Authentication failed. Check client ID and certificate in Key Vault.
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Step 3: Entity Catalog Configuration</h3>
              <p className="text-secondary mb-16" style={{ fontSize: 13 }}>Select entities to extract. Default: all standard BC entities.</p>
              {['GeneralLedgerEntries', 'ChartOfAccounts', 'Dimensions', 'DimensionValues', 'Customers', 'Vendors', 'SalesInvoices', 'PurchaseInvoices', 'BankAccounts', 'BankAccountLedgerEntries', 'FixedAssets', 'CurrencyExchangeRates'].map((e) => (
                <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                  <input type="checkbox" defaultChecked id={e} />
                  <label htmlFor={e} style={{ fontSize: 13, fontFamily: 'monospace', cursor: 'pointer' }}>{e}</label>
                </div>
              ))}
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Step 4: Validation Load</h3>
              <div className="alert alert-info mb-16">Extracting: CoA + Dimensions + 1 month GL entries for SUB18…</div>
              {[
                { entity: 'ChartOfAccounts',   status: 'success' as const, rows: 387,   dqPass: 100 },
                { entity: 'Dimensions',         status: 'success' as const, rows: 12,    dqPass: 100 },
                { entity: 'DimensionValues',    status: 'success' as const, rows: 94,    dqPass: 100 },
                { entity: 'GeneralLedgerEntries', status: 'success' as const, rows: 41203, dqPass: 98.7 },
              ].map((r) => (
                <div key={r.entity} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                  <StatusBadge status={r.status} />
                  <span style={{ fontFamily: 'monospace', fontSize: 13, flex: 1 }}>{r.entity}</span>
                  <span style={{ fontSize: 12 }}>{r.rows.toLocaleString()} rows</span>
                  <span style={{ fontSize: 12, color: r.dqPass < 100 ? 'var(--color-warning)' : 'var(--color-success)' }}>DQ: {r.dqPass}%</span>
                </div>
              ))}
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Unmapped accounts: <strong>18</strong> — will be addressed in Step 5.
              </div>
            </div>
          )}

          {[5, 6, 7].includes(step) && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{step === 7 ? '🎉' : '⟳'}</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {step === 5 && 'Account & Dimension Mapping — see Mapping Console (F021)'}
                {step === 6 && 'Full Historical Load — asynchronous. Check Pipeline Health for progress.'}
                {step === 7 && 'SUB18 is Live! Entity visible in all platform views.'}
              </div>
            </div>
          )}

          <div className="divider" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>← Back</button>
            <button className="btn btn-primary" onClick={() => step < STEPS.length ? setStep((s) => s + 1) : setView('list')}
              disabled={step === 2 && testStatus !== 'success'}>
              {step === STEPS.length ? 'Done' : 'Next →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
