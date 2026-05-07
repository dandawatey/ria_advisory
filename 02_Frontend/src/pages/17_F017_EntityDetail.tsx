/**
 * F017 — Entity Detail View
 * Subsidiary-scoped: trial balance, GL entries, IC reconciliation, Power BI embed.
 * Real data from FastAPI /api/entities/:code — falls back gracefully if offline.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PowerBIEmbed } from '../components/shared/PowerBIEmbed';
import { api } from '../api/client';
import type { EntityDetail as EntityDetailType, TrialBalanceLine, GLEntry } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

function fmtUSD(n: number) {
  const abs = Math.abs(n ?? 0);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return d.slice(0, 10);
}

const dqExceptions = [
  { ruleId: 'DQ-001', ruleName: 'GL Account Canonical Mapping Required', severity: 'critical', rowsFailed: 0, guidance: 'Run ETL and canonical mapping to detect exceptions.' },
];

export default function EntityDetail() {
  const { id } = useParams<{ id: string }>();
  const code = (id ?? '').toUpperCase();

  const [activeTab, setActiveTab] = useState<'tb' | 'gl' | 'dq' | 'ic' | 'pbi'>('tb');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<EntityDetailType | null>(null);
  const [tb, setTb] = useState<TrialBalanceLine[]>([]);
  const [gl, setGl] = useState<GLEntry[]>([]);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setApiError(false);
    Promise.all([
      api.entities.summary(code),
      api.entities.trialBalance(code),
      api.entities.glEntries(code, 200, 0),
    ])
      .then(([s, t, g]) => {
        setSummary(s);
        setTb(t);
        setGl(g);
      })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, [code]);

  const entityName = summary?.name ?? code;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="badge badge-info" style={{ fontSize: 13 }}>{code}</span>
              <h1 className="page-title" style={{ margin: 0 }}>{entityName}</h1>
            </div>
            <p className="page-subtitle">
              {summary
                ? `${summary.entry_count.toLocaleString()} GL entries · ${fmtDate(summary.earliest_date)} → ${fmtDate(summary.latest_date)}`
                : apiError ? 'API offline — start 03_Backend backend' : 'Loading…'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm">Export Trial Balance</button>
          </div>
        </div>
      </div>

      <PageExplainer
        icon="🏢"
        title="What is Entity Detail?"
        description="This page provides a <strong>subsidiary-scoped deep-dive</strong> into a single legal entity's financial data. The CFO, entity controllers, and finance team use it to review the Trial Balance, search GL entries, investigate DQ exceptions, reconcile inter-company positions, and view the embedded Power BI report. The entity is identified by its code in the URL and all data is scoped to that subsidiary only."
        concepts={[
          { icon: '⚖', color: '#2563eb', label: 'Trial Balance', desc: 'All accounts with debit, credit, and net balance totals' },
          { icon: '📄', color: '#16a34a', label: 'GL Entries', desc: 'Individual posted journal entries with date, account, amount' },
          { icon: '✓', color: '#7c3aed', label: 'DQ Exceptions', desc: 'Data quality rule violations for this entity' },
          { icon: '⚖️', color: '#d97706', label: 'IC Recon', desc: 'Inter-company balances and reconciliation status' },
        ]}
        glossary={[
          { term: 'Net Balance', def: 'Debit minus credit for an account — positive = debit balance, negative = credit balance' },
          { term: 'Doc Type', def: 'Document type of the GL entry (Invoice, Credit Memo, Journal, Payment)' },
        ]}
      />

      {/* Summary KPI strip */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Revenue', val: summary.revenue },
            { label: 'COGS', val: summary.cogs },
            { label: 'OpEx', val: summary.opex },
            { label: 'Total Assets', val: summary.total_assets },
          ].map(({ label, val }) => (
            <div key={label} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtUSD(val)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'tb' ? 'active' : ''}`} onClick={() => setActiveTab('tb')}>Trial Balance</div>
          <div className={`tab ${activeTab === 'gl' ? 'active' : ''}`} onClick={() => setActiveTab('gl')}>GL Entries</div>
          <div className={`tab ${activeTab === 'dq' ? 'active' : ''}`} onClick={() => setActiveTab('dq')}>DQ Exceptions</div>
          <div className={`tab ${activeTab === 'ic' ? 'active' : ''}`} onClick={() => setActiveTab('ic')}>IC Reconciliation</div>
          <div className={`tab ${activeTab === 'pbi' ? 'active' : ''}`} onClick={() => setActiveTab('pbi')}>Power BI Report</div>
        </div>

        {/* Trial Balance */}
        {activeTab === 'tb' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account No</th><th>Account Name</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                  <th style={{ textAlign: 'right' }}>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                ) : tb.length > 0 ? tb.map((r) => (
                  <tr key={r.gl_account_no}>
                    <td className="table-mono">{r.gl_account_no}</td>
                    <td>{r.gl_account_name ?? '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-info)' }}>{r.debit > 0 ? fmtUSD(r.debit) : '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>{r.credit < 0 ? fmtUSD(Math.abs(r.credit)) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: r.net_balance >= 0 ? 'inherit' : 'var(--color-error)' }}>
                      {fmtUSD(r.net_balance)}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                    {apiError ? `API offline. Run: cd 03_Backend && uvicorn main:app --reload` : 'No data'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* GL Entries */}
        {activeTab === 'gl' && (
          <div className="table-wrap">
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Date</th><th>Doc Type</th><th>Doc No</th>
                  <th>Account</th><th>Description</th>
                  <th>Department</th><th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                ) : gl.length > 0 ? gl.map((r) => (
                  <tr key={r.id}>
                    <td className="table-mono">{fmtDate(r.posting_date)}</td>
                    <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{r.document_type ?? '—'}</span></td>
                    <td className="table-mono" style={{ fontSize: 11 }}>{r.document_no ?? '—'}</td>
                    <td className="table-mono">{r.gl_account_no}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description ?? r.customer_or_vendor_name ?? '—'}
                    </td>
                    <td style={{ fontSize: 11 }}>{r.department_code ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: r.amount >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {fmtUSD(r.amount)}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                    {apiError ? 'API offline' : 'No entries'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* DQ Exceptions — static until DQ engine is wired */}
        {activeTab === 'dq' && (
          <div style={{ padding: 16 }}>
            {dqExceptions.map((e) => (
              <div key={e.ruleId} style={{ padding: 16, border: '2px solid var(--color-border)', borderRadius: 8, marginBottom: 12 }}>
                <div className="flex items-center gap-8 mb-16">
                  <span className="badge badge-muted">{e.severity}</span>
                  <span style={{ fontWeight: 600 }}>{e.ruleName}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{e.guidance}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ic' && (
          <div style={{ padding: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            IC elimination module (F010) will populate intercompany entries here once the canonical CoA mapping is complete.
          </div>
        )}

        {activeTab === 'pbi' && (
          <div style={{ padding: '0 0 16px' }}>
            <PowerBIEmbed title={`${entityName} — Entity Financial Report`} height={450} />
          </div>
        )}
      </div>
    </div>
  );
}
