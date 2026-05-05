/**
 * F036 — Trial Balance
 * Source: v_trial_balance (company, account, debit, credit, net)
 */
import { useState, useEffect, useCallback } from 'react';
import { get, type FilterOptions } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TBRow {
  company_name: string;
  account_no: string;
  account_name: string | null;
  account_category: string | null;
  income_balance: string | null;
  total_debit: number;
  total_credit: number;
  net_balance: number;
}
interface TBSummary {
  total_debit: number;
  total_credit: number;
  net_balance: number;
  account_count: number;
  entity_count: number;
}

const CATEGORIES = ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses', 'COGS'];

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toFixed(0)}`;
}

function KPITile({ label, value, color = '#3b82f6', loading }: {
  label: string; value: string; color?: string; loading?: boolean;
}) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{loading ? '…' : value}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TrialBalance() {
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ companies: [], years: [], months: [], currencies: [], account_categories: [] });
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [accountCategory, setAccountCategory] = useState('');
  const [search, setSearch] = useState('');

  const [summary, setSummary] = useState<TBSummary | null>(null);
  const [rows, setRows] = useState<TBRow[]>([]);
  const [loadSummary, setLoadSummary] = useState(true);
  const [loadRows, setLoadRows] = useState(true);
  const [errRows, setErrRows] = useState(false);

  // Load filter options
  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilterOpts).catch(() => {});
  }, []);

  const buildQS = useCallback(() => {
    const qs = new URLSearchParams();
    selectedCompanies.forEach((id) => qs.append('company_id', String(id)));
    if (accountCategory) qs.set('account_category', accountCategory);
    return qs;
  }, [selectedCompanies, accountCategory]);

  // Fetch summary
  useEffect(() => {
    setLoadSummary(true);
    const qs = new URLSearchParams();
    selectedCompanies.forEach((id) => qs.append('company_id', String(id)));
    get<TBSummary>(`/api/reports/trial-balance/summary?${qs}`)
      .then(setSummary).catch(() => setSummary(null)).finally(() => setLoadSummary(false));
  }, [selectedCompanies]);

  // Fetch rows
  useEffect(() => {
    setLoadRows(true);
    setErrRows(false);
    get<TBRow[]>(`/api/reports/trial-balance?${buildQS()}`)
      .then(setRows).catch(() => { setErrRows(true); setRows([]); }).finally(() => setLoadRows(false));
  }, [buildQS]);

  const chip = (active: boolean) => ({
    padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#3b82f6' : 'var(--color-border)',
    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: active ? '#3b82f6' : 'inherit', fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  });

  // Filter + search
  const visible = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.account_no.toLowerCase().includes(q)
      || (r.account_name ?? '').toLowerCase().includes(q)
      || r.company_name.toLowerCase().includes(q);
  });

  // Group by company for display
  const companies = Array.from(new Set(visible.map((r) => r.company_name)));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Trial Balance</h1>
        <p className="page-subtitle">All accounts · Debit, Credit, Net Balance per entity</p>
      </div>

      {/* KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <KPITile label="Total Debit"  value={fmt(summary?.total_debit)}              color="#3b82f6" loading={loadSummary} />
        <KPITile label="Total Credit" value={fmt(summary?.total_credit)}             color="#10b981" loading={loadSummary} />
        <KPITile label="Net Balance"  value={fmt(summary?.net_balance)}              color="#f59e0b" loading={loadSummary} />
        <KPITile label="Accounts"     value={String(summary?.account_count ?? '—')} color="#8b5cf6" loading={loadSummary} />
        <KPITile label="Entities"     value={String(summary?.entity_count  ?? '—')} color="#6366f1" loading={loadSummary} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Filter Panel */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Entity</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setSelectedCompanies([])} style={chip(selectedCompanies.length === 0)}>All</button>
                {filterOpts.companies.map((c) => (
                  <button key={c.company_id} onClick={() => {
                    setSelectedCompanies((prev) =>
                      prev.includes(c.company_id) ? prev.filter((x) => x !== c.company_id) : [...prev, c.company_id]
                    );
                  }} style={chip(selectedCompanies.includes(c.company_id))}>{c.company_name}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Account Category</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setAccountCategory('')} style={chip(accountCategory === '')}>All</button>
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setAccountCategory(cat === accountCategory ? '' : cat)} style={chip(accountCategory === cat)}>{cat}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Search</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Account no / name…"
                style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'inherit', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loadRows ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
            ) : errRows ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-error)' }}>Failed to load trial balance</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Account No</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Account Name</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Category</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>I/B</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Debit</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Credit</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Net Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((co) => {
                      const coRows   = visible.filter((r) => r.company_name === co);
                      const coDebit  = coRows.reduce((s, r) => s + (r.total_debit  ?? 0), 0);
                      const coCredit = coRows.reduce((s, r) => s + (r.total_credit ?? 0), 0);
                      const coNet    = coRows.reduce((s, r) => s + (r.net_balance  ?? 0), 0);
                      return [
                        <tr key={`hdr-${co}`} style={{ background: 'rgba(59,130,246,0.08)', borderTop: '1px solid var(--color-border)' }}>
                          <td colSpan={4} style={{ padding: '6px 12px', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>{co}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(coDebit)}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(coCredit)}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: coNet < 0 ? '#ef4444' : '#10b981' }}>{fmt(coNet)}</td>
                        </tr>,
                        ...coRows.map((r, i) => (
                          <tr key={`${co}-${r.account_no}-${i}`} style={{ borderBottom: '1px solid var(--color-border)', opacity: 0.9 }}>
                            <td style={{ padding: '5px 12px 5px 24px', fontFamily: 'monospace' }}>{r.account_no}</td>
                            <td style={{ padding: '5px 12px' }}>{r.account_name ?? '—'}</td>
                            <td style={{ padding: '5px 12px', color: 'var(--color-text-muted)' }}>{r.account_category ?? '—'}</td>
                            <td style={{ padding: '5px 12px', color: 'var(--color-text-muted)' }}>{r.income_balance ?? '—'}</td>
                            <td style={{ padding: '5px 12px', textAlign: 'right' }}>{fmt(r.total_debit)}</td>
                            <td style={{ padding: '5px 12px', textAlign: 'right' }}>{fmt(r.total_credit)}</td>
                            <td style={{ padding: '5px 12px', textAlign: 'right', color: r.net_balance < 0 ? '#ef4444' : 'inherit' }}>{fmt(r.net_balance)}</td>
                          </tr>
                        )),
                      ];
                    })}
                    {rows.length > 0 && (
                      <tr style={{ background: 'rgba(59,130,246,0.12)', borderTop: '2px solid var(--color-border)', fontWeight: 700 }}>
                        <td colSpan={4} style={{ padding: '8px 12px', fontSize: 12 }}>Grand Total</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(summary?.total_debit)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(summary?.total_credit)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: (summary?.net_balance ?? 0) < 0 ? '#ef4444' : '#10b981' }}>{fmt(summary?.net_balance)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {visible.length === 0 && !loadRows && (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No records</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
