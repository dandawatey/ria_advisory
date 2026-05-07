/**
 * F038 — Expense Analysis
 * Source: fact_gl_entries (5xx COGS + 6xx OpEx)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { get, type FilterOptions } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExpSummary {
  total_cogs: number;
  total_opex: number;
  total_expenses: number;
  entry_count: number;
  entity_count: number;
}
interface ExpAccountRow {
  gl_account_no: string;
  gl_account_name: string | null;
  account_category: string | null;
  account_subcategory: string | null;
  cogs: number;
  opex: number;
  total_amount: number;
  entry_count: number;
  entity_count: number;
}
interface ExpEntityRow {
  company_name: string;
  cogs: number;
  opex: number;
  total_amount: number;
}
interface ExpMonthRow {
  year: number;
  month: number;
  month_name: string;
  cogs: number;
  opex: number;
  total_amount: number;
  entry_count: number;
}

type Tab = 'accounts' | 'entity' | 'trend';

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function ChartCard({ title, loading, error, height = 280, children }: {
  title: string; loading: boolean; error: boolean; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>Failed to load</div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ExpenseAnalysis() {
  const [tab, setTab] = useState<Tab>('accounts');
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ companies: [], years: [], months: [], currencies: [], account_categories: [] });
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [accountCategory, setAccountCategory] = useState<string>('');

  const [summary, setSummary]    = useState<ExpSummary | null>(null);
  const [accounts, setAccounts]  = useState<ExpAccountRow[]>([]);
  const [entities, setEntities]  = useState<ExpEntityRow[]>([]);
  const [trend, setTrend]        = useState<ExpMonthRow[]>([]);

  const [loadSummary, setLoadSummary]   = useState(true);
  const [loadAccounts, setLoadAccounts] = useState(false);
  const [loadEntities, setLoadEntities] = useState(false);
  const [loadTrend, setLoadTrend]       = useState(false);
  const [errAccounts, setErrAccounts]   = useState(false);
  const [errEntities, setErrEntities]   = useState(false);
  const [errTrend, setErrTrend]         = useState(false);

  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilterOpts).catch(() => {});
  }, []);

  const buildQS = useCallback(() => {
    const qs = new URLSearchParams();
    selectedCompanies.forEach((id) => qs.append('company_id', String(id)));
    if (year)            qs.set('year',             String(year));
    if (monthFilter)     qs.set('month',             String(monthFilter));
    if (accountCategory) qs.set('account_category', accountCategory);
    return qs;
  }, [selectedCompanies, year, monthFilter, accountCategory]);

  // Summary
  useEffect(() => {
    setLoadSummary(true);
    get<ExpSummary>(`/api/reports/expense/summary?${buildQS()}`)
      .then(setSummary).catch(() => setSummary(null)).finally(() => setLoadSummary(false));
  }, [buildQS]);

  // Accounts
  useEffect(() => {
    if (tab !== 'accounts') return;
    setLoadAccounts(true); setErrAccounts(false);
    get<ExpAccountRow[]>(`/api/reports/expense?${buildQS()}`)
      .then(setAccounts).catch(() => { setErrAccounts(true); setAccounts([]); }).finally(() => setLoadAccounts(false));
  }, [tab, buildQS]);

  // By Entity
  useEffect(() => {
    if (tab !== 'entity') return;
    setLoadEntities(true); setErrEntities(false);
    get<ExpEntityRow[]>(`/api/reports/expense/by-entity?${buildQS()}`)
      .then(setEntities).catch(() => { setErrEntities(true); setEntities([]); }).finally(() => setLoadEntities(false));
  }, [tab, buildQS]);

  // Trend
  useEffect(() => {
    if (tab !== 'trend') return;
    setLoadTrend(true); setErrTrend(false);
    get<ExpMonthRow[]>(`/api/reports/expense/by-month?${buildQS()}`)
      .then(setTrend).catch(() => { setErrTrend(true); setTrend([]); }).finally(() => setLoadTrend(false));
  }, [tab, buildQS]);

  const chip = (active: boolean, color = '#3b82f6') => ({
    padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
    border: '1px solid', borderColor: active ? color : 'var(--color-border)',
    background: active ? `${color}20` : 'transparent',
    color: active ? color : 'inherit', fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Expense Analysis</h1>
        <p className="page-subtitle">COGS (5xx) + Operating Expenses (6xx)</p>
      </div>

      <PageExplainer
        icon="💸"
        title="What is Expense Analysis?"
        description="This page breaks down <strong>COGS (5xx) and Operating Expenses (6xx)</strong> from the GL. COGS are the direct costs of delivering advisory services. OpEx covers overhead — salaries, rent, technology, and administration. The By Period tab shows monthly expense trends. By Account ranks the top expense accounts. By Entity compares spend across subsidiaries. Use the filter panel to scope by entity, fiscal year, and expense category."
        concepts={[
          { icon: '5', color: '#ef4444', label: 'COGS (5xx)', desc: 'Cost of Goods Sold — direct costs tied to delivering client services' },
          { icon: '6', color: '#f59e0b', label: 'OpEx (6xx)', desc: 'Operating Expenses — indirect overhead: salaries, rent, marketing, technology' },
          { icon: '÷', color: '#3b82f6', label: 'COGS %', desc: 'COGS as percentage of total expenses — measures direct vs overhead cost mix' },
        ]}
        glossary={[
          { term: 'Total Expenses', def: 'Sum of all COGS (5xx) and OpEx (6xx) accounts for the period' },
          { term: 'Account 601201', def: 'Income Tax Expense — often misclassified in OpEx; should be in 8xx Tax accounts' },
          { term: 'Entry Count', def: 'Number of GL lines posted to expense accounts — not the monetary amount' },
        ]}
      />

      {/* KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <KPITile label="Total COGS"     value={fmt(summary?.total_cogs)}              color="#ef4444" loading={loadSummary} />
        <KPITile label="Total OpEx"     value={fmt(summary?.total_opex)}              color="#f59e0b" loading={loadSummary} />
        <KPITile label="Total Expenses" value={fmt(summary?.total_expenses)}          color="#3b82f6" loading={loadSummary} />
        <KPITile label="Entries"        value={String(summary?.entry_count  ?? '—')} color="#8b5cf6" loading={loadSummary} />
        <KPITile label="Entities"       value={String(summary?.entity_count ?? '—')} color="#6366f1" loading={loadSummary} />
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
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setYear(null)} style={chip(year === null)}>All</button>
                {filterOpts.years.map((y) => (
                  <button key={y} onClick={() => setYear(y === year ? null : y)} style={chip(year === y)}>{y}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Month</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setMonthFilter(null)} style={chip(monthFilter === null)}>All</button>
                {MONTHS.map((m, i) => (
                  <button key={m} onClick={() => setMonthFilter(monthFilter === i + 1 ? null : i + 1)} style={chip(monthFilter === i + 1)}>{m}</button>
                ))}
              </div>
            </div>

            {filterOpts.account_categories?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>GL Group</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button onClick={() => setAccountCategory('')} style={chip(accountCategory === '')}>All</button>
                  {filterOpts.account_categories.map((cat) => (
                    <button key={cat} onClick={() => setAccountCategory(cat === accountCategory ? '' : cat)} style={chip(accountCategory === cat)}>{cat}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={`tab${tab === 'accounts' ? ' active' : ''}`} onClick={() => setTab('accounts')}>By Account</button>
            <button className={`tab${tab === 'entity'   ? ' active' : ''}`} onClick={() => setTab('entity')}>By Entity</button>
            <button className={`tab${tab === 'trend'    ? ' active' : ''}`} onClick={() => setTab('trend')}>Monthly Trend</button>
          </div>

          {tab === 'accounts' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {loadAccounts ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
              ) : errAccounts ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-error)' }}>Failed to load</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Account No</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Account Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Category</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>COGS</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>OpEx</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Total</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '5px 12px', fontFamily: 'monospace' }}>{r.gl_account_no}</td>
                          <td style={{ padding: '5px 12px' }}>{r.gl_account_name ?? '—'}</td>
                          <td style={{ padding: '5px 12px', color: 'var(--color-text-muted)' }}>{r.account_category ?? '—'}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', color: '#ef4444' }}>{fmt(r.cogs)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', color: '#f59e0b' }}>{fmt(r.opex)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(r.total_amount)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{r.entry_count}</td>
                        </tr>
                      ))}
                      {accounts.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'entity' && (
            <>
              <ChartCard title="Expenses by Entity" loading={loadEntities} error={errEntities} height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={entities} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="company_name" width={115} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="cogs" name="COGS" fill="#ef4444" stackId="a" />
                    <Bar dataKey="opex" name="OpEx" fill="#f59e0b" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Entity</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>COGS</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>OpEx</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entities.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '5px 10px' }}>{row.company_name}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#ef4444' }}>{fmt(row.cogs)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#f59e0b' }}>{fmt(row.opex)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600 }}>{fmt(row.total_amount)}</td>
                      </tr>
                    ))}
                    {entities.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'trend' && (
            <>
              <ChartCard title="Monthly Expense Trend" loading={loadTrend} error={errTrend} height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trend} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month_name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="cogs" name="COGS" fill="#ef4444" stackId="a" />
                    <Bar dataKey="opex" name="OpEx" fill="#f59e0b" stackId="a" />
                    <Line dataKey="total_amount" name="Total" stroke="#3b82f6" dot={false} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Month</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>COGS</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>OpEx</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '5px 10px' }}>{row.month_name}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#ef4444' }}>{fmt(row.cogs)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#f59e0b' }}>{fmt(row.opex)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600 }}>{fmt(row.total_amount)}</td>
                      </tr>
                    ))}
                    {trend.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
