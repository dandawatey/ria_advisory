/**
 * F034 — Monthly Income Report
 * Revenue (4xx) and Other Income (7xx) by period, account, and entity
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  api,
  type FilterOptions,
  type IncomeSummary,
  type IncomeMonthRow,
  type IncomeAccountRow,
  type IncomeEntityRow,
} from '../api/client';

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtFull(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const s = n < 0 ? '-' : '';
  return `${s}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  rev:   '#3b82f6',
  other: '#f59e0b',
  total: '#22c55e',
  avg:   '#a855f7',
  cyan:  '#06b6d4',
  muted: 'var(--color-text-muted)',
};

const ALT_COLORS = ['#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4','#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9'];

// ── Income type filter ────────────────────────────────────────────────────────
type IncomeType = 'all' | 'revenue' | 'other';
type TabKey = 'monthly' | 'trend' | 'account' | 'entity';

// ── Drill state ───────────────────────────────────────────────────────────────
interface DrillState { label: string; type: 'month' | 'account' | 'entity'; value: string; }

// ── Tooltip ───────────────────────────────────────────────────────────────────
interface TooltipPayloadItem { name: string; value: number; color?: string; }

function USDTip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)', marginBottom: 2 }}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KPITile({ label, value, sub, color, loading }: { label: string; value: string; sub?: string; color: string; loading: boolean }) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{loading ? '…' : value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, loading, error, height = 320, children }: {
  title: string; subtitle?: string; loading: boolean; error: boolean; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: -8, marginBottom: 8 }}>{subtitle}</div>}
      {loading
        ? <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>Loading…</div>
        : error
          ? <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>Failed to load</div>
          : <div style={{ height }}>{children}</div>
      }
    </div>
  );
}

// ── Rolling 3-month avg helper ─────────────────────────────────────────────────
function addRolling3(rows: IncomeMonthRow[]): (IncomeMonthRow & { rolling3: number | null })[] {
  return rows.map((r, i) => ({
    ...r,
    rolling3: i >= 2
      ? (rows[i].total_income + rows[i - 1].total_income + rows[i - 2].total_income) / 3
      : null,
  }));
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MonthlyIncome() {
  // Filter state
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ companies: [], years: [], months: [], currencies: [], account_categories: [] });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [monthFrom, setMonthFrom] = useState<string>('');
  const [monthTo, setMonthTo] = useState<string>('');
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [incomeType, setIncomeType] = useState<IncomeType>('all');
  const [accountCategory, setAccountCategory] = useState<string>('');
  const [drill, setDrill] = useState<DrillState | null>(null);
  const [tab, setTab] = useState<TabKey>('monthly');

  // Data state
  const [summary, setSummary]     = useState<IncomeSummary | null>(null);
  const [monthly, setMonthly]     = useState<IncomeMonthRow[]>([]);
  const [accounts, setAccounts]   = useState<IncomeAccountRow[]>([]);
  const [entities, setEntities]   = useState<IncomeEntityRow[]>([]);

  // Loading / error
  const [loadSum, setLoadSum]     = useState(true);
  const [loadMon, setLoadMon]     = useState(true);
  const [loadAcc, setLoadAcc]     = useState(false);
  const [loadEnt, setLoadEnt]     = useState(false);
  const [, setErrSum]             = useState(false);
  const [errMon, setErrMon]       = useState(false);
  const [errAcc, setErrAcc]       = useState(false);
  const [errEnt, setErrEnt]       = useState(false);

  // Args builder
  const apiArgs = useCallback(
    (): [number[], number | null, string | undefined, string | undefined, Record<string, string> | undefined] => [
      selectedCompanies,
      selectedYear,
      monthFrom || undefined,
      monthTo || undefined,
      accountCategory ? { account_category: accountCategory } : undefined,
    ],
    [selectedCompanies, selectedYear, monthFrom, monthTo, accountCategory]
  );

  // Load filter options once
  useEffect(() => {
    api.analytics.filters().then(setFilterOpts).catch(() => null);
  }, []);

  // Load summary
  useEffect(() => {
    setLoadSum(true); setErrSum(false);
    const [ids, yr, mf, mt] = apiArgs();
    api.income.summary(ids, yr, mf, mt)
      .then(setSummary)
      .catch(() => setErrSum(true))
      .finally(() => setLoadSum(false));
  }, [apiArgs]);

  // Load monthly (always — used by Tab 1 and Tab 2)
  useEffect(() => {
    setLoadMon(true); setErrMon(false);
    const [ids, yr, mf, mt] = apiArgs();
    api.income.monthly(ids, yr, mf, mt)
      .then(setMonthly)
      .catch(() => setErrMon(true))
      .finally(() => setLoadMon(false));
  }, [apiArgs]);

  // Load accounts (Tab 3)
  useEffect(() => {
    if (tab !== 'account') return;
    setLoadAcc(true); setErrAcc(false);
    const [ids, yr, mf, mt] = apiArgs();
    api.income.byAccount(ids, yr, mf, mt)
      .then(setAccounts)
      .catch(() => setErrAcc(true))
      .finally(() => setLoadAcc(false));
  }, [tab, apiArgs]);

  // Load entities (Tab 4)
  useEffect(() => {
    if (tab !== 'entity') return;
    setLoadEnt(true); setErrEnt(false);
    const [ids, yr, mf, mt] = apiArgs();
    api.income.byEntity(ids, yr, mf, mt)
      .then(setEntities)
      .catch(() => setErrEnt(true))
      .finally(() => setLoadEnt(false));
  }, [tab, apiArgs]);
  // Note: apiArgs includes accountCategory in its extra param for future backend support

  // Helpers
  const toggleCompany = (id: number) => {
    setSelectedCompanies((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setDrill(null);
  };

  const clearAll = () => {
    setSelectedYear(null);
    setMonthFrom('');
    setMonthTo('');
    setSelectedCompanies([]);
    setIncomeType('all');
    setAccountCategory('');
    setDrill(null);
  };

  // incomeType display helpers
  const showRevenue    = incomeType === 'all' || incomeType === 'revenue';
  const showOther      = incomeType === 'all' || incomeType === 'other';
  const showTotal      = incomeType === 'all';

  // Derived KPIs
  const totalIncome   = summary?.total_income ?? 0;
  const revenue       = summary?.revenue ?? 0;
  const otherIncome   = summary?.other_income ?? 0;
  const avgMonthly    = summary?.avg_monthly_income ?? 0;
  const entityCount   = summary?.entity_count ?? 0;

  // Rolling 3-month data for Tab 2
  const monthlyWithRolling = addRolling3(monthly);

  // Peak / low month for Tab 2
  const peakRow = monthly.length > 0
    ? monthly.reduce((a, b) => (b.total_income > a.total_income ? b : a))
    : null;
  const lowRow = monthly.length > 0
    ? monthly.reduce((a, b) => (b.total_income < a.total_income ? b : a))
    : null;

  // YTD total (sum of monthly data shown)
  const ytdTotal = monthly.reduce((sum, r) => sum + r.total_income, 0);

  const TABS: [TabKey, string][] = [
    ['monthly', 'Monthly Breakdown'],
    ['trend',   'Income Trend'],
    ['account', 'By Account'],
    ['entity',  'By Entity'],
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Monthly Income Report</h1>
        <p className="page-subtitle">Revenue and other income by period, account, and entity</p>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label="Total Income"        value={fmt(totalIncome)} color={C.total} loading={loadSum} sub={summary ? `${summary.entry_count.toLocaleString()} entries` : undefined} />
        <KPITile label="Revenue (4xx)"       value={fmt(revenue)}     color={C.rev}   loading={loadSum} sub="Sales / service revenue" />
        <KPITile label="Other Income (7xx)"  value={fmt(otherIncome)} color={C.other} loading={loadSum} sub="Non-operating income" />
        <KPITile label="Avg Monthly Income"  value={fmt(avgMonthly)}  color={C.avg}   loading={loadSum} sub={summary ? `${summary.months_count} months` : undefined} />
        <KPITile label="Entities with Income" value={String(entityCount)} color={C.cyan} loading={loadSum} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>

        {/* ── Filter Panel ── */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="card-title" style={{ fontSize: 12, marginBottom: 0 }}>Filters</div>
              <button
                style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 0 }}
                onClick={clearAll}
              >Clear All</button>
            </div>

            {/* Year chips */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button
                  className={`btn btn-sm ${selectedYear === null ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setSelectedYear(null)}
                >All</button>
                {filterOpts.years.map((y) => (
                  <button
                    key={y}
                    className={`btn btn-sm ${selectedYear === y ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setSelectedYear(selectedYear === y ? null : y)}
                  >{y}</button>
                ))}
              </div>
            </div>

            {/* Month From */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>Month From</div>
              <select
                value={monthFrom}
                onChange={(e) => setMonthFrom(e.target.value)}
                style={{ width: '100%', fontSize: 11, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                <option value="">All</option>
                {filterOpts.months.map((m) => (
                  <option key={m.month_key} value={m.month_key}>{m.month_name}</option>
                ))}
              </select>
            </div>

            {/* Month To */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>Month To</div>
              <select
                value={monthTo}
                onChange={(e) => setMonthTo(e.target.value)}
                style={{ width: '100%', fontSize: 11, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                <option value="">All</option>
                {filterOpts.months.map((m) => (
                  <option key={m.month_key} value={m.month_key}>{m.month_name}</option>
                ))}
              </select>
            </div>

            {/* Entities */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                Entities
                {selectedCompanies.length > 0 && (
                  <button
                    style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 11, padding: 0 }}
                    onClick={() => setSelectedCompanies([])}
                  >Clear</button>
                )}
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {filterOpts.companies.map((c) => (
                  <label key={c.company_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0' }}>
                    <input
                      type="checkbox"
                      checked={selectedCompanies.includes(c.company_id)}
                      onChange={() => toggleCompany(c.company_id)}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Income Type */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Income Type</div>
              {([['all', 'All Income'], ['revenue', 'Revenue only (4xx)'], ['other', 'Other Income only (7xx)']] as [IncomeType, string][]).map(([val, lbl]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0' }}>
                  <input
                    type="radio"
                    name="incomeType"
                    checked={incomeType === val}
                    onChange={() => setIncomeType(val)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span>{lbl}</span>
                </label>
              ))}
              {incomeType !== 'all' && (
                <div style={{ marginTop: 6, fontSize: 10, color: C.other, padding: '3px 6px', background: 'rgba(245,158,11,0.08)', borderRadius: 4 }}>
                  Showing {incomeType === 'revenue' ? 'Revenue (4xx)' : 'Other Income (7xx)'} only
                </div>
              )}
            </div>

            {/* GL Group */}
            {filterOpts.account_categories?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6 }}>GL Group</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button
                    className={`btn btn-sm ${accountCategory === '' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setAccountCategory('')}
                  >All</button>
                  {filterOpts.account_categories.map((cat) => (
                    <button
                      key={cat}
                      className={`btn btn-sm ${accountCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={() => setAccountCategory(accountCategory === cat ? '' : cat)}
                    >{cat}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Active drill indicator */}
            {drill && (
              <div style={{ marginTop: 4, padding: '6px 10px', background: 'rgba(59,130,246,0.08)', borderRadius: 6, fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                  Drill: {drill.label}
                </span>
                <button
                  onClick={() => setDrill(null)}
                  style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700, fontSize: 14, lineHeight: 1 }}
                >×</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Main Content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Breadcrumb */}
          {drill && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, padding: '6px 12px', background: 'rgba(59,130,246,0.06)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.2)' }}>
              <span style={{ color: C.muted, cursor: 'pointer' }} onClick={() => setDrill(null)}>All</span>
              <span style={{ color: C.muted }}>→</span>
              <span style={{ fontWeight: 600, color: C.rev }}>{drill.label}</span>
              <span style={{ color: C.muted, fontSize: 11 }}>({drill.type})</span>
              <button
                onClick={() => setDrill(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.rev, fontWeight: 700 }}
              >×</button>
            </div>
          )}

          {/* Tab bar */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {TABS.map(([key, label]) => (
              <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {/* ══ TAB 1 — Monthly Breakdown ══ */}
          {tab === 'monthly' && (
            <>
              <ChartCard
                title="Monthly Income — Revenue & Other Income"
                subtitle="Stacked bars: Revenue (blue) + Other Income (amber) · Green line = Total Income (right axis) · Click a bar to drill"
                loading={loadMon} error={errMon} height={360}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthly}
                    margin={{ top: 8, right: 64, bottom: 4, left: 10 }}
                    onClick={(d) => {
                      if (!d?.activeLabel) return;
                      const row = monthly.find((r) => r.month_name === d.activeLabel || r.month === d.activeLabel);
                      if (row) setDrill({ label: row.month_name, type: 'month', value: row.month });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="l" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="r" orientation="right" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <Tooltip content={<USDTip />} />
                    <Legend />
                    {showRevenue && (
                      <Bar yAxisId="l" dataKey="revenue"     name="Revenue"      fill={C.rev}   stackId="inc" style={{ cursor: 'pointer' }} />
                    )}
                    {showOther && (
                      <Bar yAxisId="l" dataKey="other_income" name="Other Income" fill={C.other} stackId="inc" radius={[3,3,0,0]} style={{ cursor: 'pointer' }} />
                    )}
                    {showTotal && (
                      <Line yAxisId="r" type="monotone" dataKey="total_income" name="Total Income" stroke={C.total} strokeWidth={2.5} dot={false} />
                    )}
                    <ReferenceLine yAxisId="l" y={0} stroke="var(--color-border)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Monthly Detail</div>
                <div className="table-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Year</th>
                        <th style={{ textAlign: 'right' }}>Quarter</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>Other Income</th>
                        <th style={{ textAlign: 'right' }}>Total Income</th>
                        <th style={{ textAlign: 'right' }}>Entities</th>
                        <th style={{ textAlign: 'right' }}>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadMon ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16, color: C.muted }}>Loading…</td></tr>
                      ) : monthly.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16, color: C.muted }}>No data</td></tr>
                      ) : monthly.map((r) => (
                        <tr
                          key={r.month}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDrill({ label: r.month_name, type: 'month', value: r.month })}
                        >
                          <td style={{ fontWeight: 500 }}>{r.month_name}</td>
                          <td style={{ textAlign: 'right' }}>{r.year}</td>
                          <td style={{ textAlign: 'right' }}>Q{r.quarter}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: C.rev }}>{fmtFull(r.revenue)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: C.other }}>{fmtFull(r.other_income)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.total }}>{fmtFull(r.total_income)}</td>
                          <td style={{ textAlign: 'right' }}>{r.entity_count}</td>
                          <td style={{ textAlign: 'right' }}>{r.entry_count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ TAB 2 — Income Trend ══ */}
          {tab === 'trend' && (
            <>
              <ChartCard
                title="Income Trend — Monthly Total with 3-Month Rolling Average"
                subtitle="Light blue bars = monthly total · Green line = 3-month rolling average"
                loading={loadMon} error={errMon} height={380}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyWithRolling} margin={{ top: 8, right: 24, bottom: 4, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <Tooltip content={<USDTip />} />
                    <Legend />
                    <Bar
                      dataKey={incomeType === 'revenue' ? 'revenue' : incomeType === 'other' ? 'other_income' : 'total_income'}
                      name={incomeType === 'revenue' ? 'Revenue' : incomeType === 'other' ? 'Other Income' : 'Total Income'}
                      fill="#93c5fd"
                      radius={[3,3,0,0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="rolling3"
                      name="3-Month Avg"
                      stroke={C.total}
                      strokeWidth={2.5}
                      dot={false}
                      strokeDasharray="6 3"
                      connectNulls
                    />
                    <ReferenceLine y={0} stroke="var(--color-border)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Peak month badge */}
              {peakRow && (
                <div style={{ marginBottom: 16, padding: '8px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 13, display: 'inline-block' }}>
                  <span style={{ fontWeight: 600, color: C.total }}>Peak Month:</span>{' '}
                  <span style={{ fontWeight: 700 }}>{peakRow.month_name} {peakRow.year}</span>{' '}
                  — {fmtFull(peakRow.total_income)}
                </div>
              )}

              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${C.total}` }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Peak Month</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.total }}>{peakRow ? peakRow.month_name : '—'}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{peakRow ? fmtFull(peakRow.total_income) : ''}</div>
                </div>
                <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid #ef4444` }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Low Month</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{lowRow ? lowRow.month_name : '—'}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{lowRow ? fmtFull(lowRow.total_income) : ''}</div>
                </div>
                <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${C.rev}` }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>YTD Total</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.rev }}>{fmtFull(ytdTotal)}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{monthly.length} months</div>
                </div>
                <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${C.avg}` }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Avg Monthly</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.avg }}>{fmt(avgMonthly)}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>per period</div>
                </div>
              </div>

              {/* Trend table */}
              <div className="card">
                <div className="card-title">Monthly Trend Detail</div>
                <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>Other Income</th>
                        <th style={{ textAlign: 'right' }}>Total Income</th>
                        <th style={{ textAlign: 'right' }}>3-Month Avg</th>
                        <th style={{ textAlign: 'right' }}>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadMon ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: C.muted }}>Loading…</td></tr>
                      ) : monthlyWithRolling.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: C.muted }}>No data</td></tr>
                      ) : monthlyWithRolling.map((r) => (
                        <tr key={r.month}>
                          <td style={{ fontWeight: 500 }}>{r.month_name} {r.year}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: C.rev }}>{fmtFull(r.revenue)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: C.other }}>{fmtFull(r.other_income)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.total }}>{fmtFull(r.total_income)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: C.avg }}>{r.rolling3 != null ? fmt(r.rolling3) : '—'}</td>
                          <td style={{ textAlign: 'right' }}>{r.entry_count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ TAB 3 — By Account ══ */}
          {tab === 'account' && (
            <>
              <ChartCard
                title="Top Income Accounts"
                subtitle="Horizontal bar chart — click a row or bar to drill"
                loading={loadAcc} error={errAcc} height={Math.max(300, accounts.slice(0, 20).length * 28 + 40)}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={accounts.slice(0, 20)}
                    margin={{ top: 4, right: 60, bottom: 4, left: 10 }}
                    onClick={(d) => {
                      if (!d?.activeLabel) return;
                      const row = accounts.find((r) => r.account_name === d.activeLabel || r.account_no === d.activeLabel);
                      if (row) setDrill({ label: `${row.account_no} — ${row.account_name}`, type: 'account', value: row.account_no });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="account_name"
                      tick={{ fontSize: 10 }}
                      width={180}
                      tickFormatter={(v: string) => v?.length > 26 ? v.slice(0, 24) + '…' : v}
                    />
                    <Tooltip content={<USDTip />} />
                    <Bar dataKey="total_income" name="Total Income" radius={[0,3,3,0]} style={{ cursor: 'pointer' }}>
                      {accounts.slice(0, 20).map((_, i) => (
                        <Cell key={i} fill={ALT_COLORS[i % ALT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Income by Account</div>
                <div className="table-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Account No</th>
                        <th>Account Name</th>
                        <th>Category</th>
                        <th>Subcategory</th>
                        <th style={{ textAlign: 'right' }}>Total Income</th>
                        <th style={{ textAlign: 'right' }}>Entities</th>
                        <th style={{ textAlign: 'right' }}>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadAcc ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: C.muted }}>Loading…</td></tr>
                      ) : accounts.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: C.muted }}>No data</td></tr>
                      ) : accounts.map((r) => (
                        <tr
                          key={r.account_no}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDrill({ label: `${r.account_no} — ${r.account_name}`, type: 'account', value: r.account_no })}
                        >
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.account_no}</td>
                          <td style={{ fontWeight: 500 }}>{r.account_name}</td>
                          <td>
                            <span style={{ background: 'rgba(59,130,246,0.1)', color: C.rev, borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>
                              {r.account_category}
                            </span>
                          </td>
                          <td style={{ color: C.muted, fontSize: 11 }}>{r.account_subcategory}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.total }}>{fmtFull(r.total_income)}</td>
                          <td style={{ textAlign: 'right' }}>{r.entity_count}</td>
                          <td style={{ textAlign: 'right' }}>{r.entry_count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ TAB 4 — By Entity ══ */}
          {tab === 'entity' && (
            <>
              <ChartCard
                title="Income by Entity — Revenue vs Other Income"
                subtitle="Click a bar or row to drill into that entity"
                loading={loadEnt} error={errEnt} height={Math.max(300, entities.length * 32 + 60)}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={entities}
                    margin={{ top: 4, right: 60, bottom: 4, left: 10 }}
                    onClick={(d) => {
                      if (!d?.activeLabel) return;
                      const row = entities.find((r) => r.company_name === d.activeLabel);
                      if (row) setDrill({ label: row.company_name, type: 'entity', value: row.company_name });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="company_name"
                      tick={{ fontSize: 10 }}
                      width={180}
                      tickFormatter={(v: string) => v?.length > 26 ? v.slice(0, 24) + '…' : v}
                    />
                    <Tooltip content={<USDTip />} />
                    <Legend />
                    {showRevenue && (
                      <Bar dataKey="revenue"      name="Revenue"      fill={C.rev}   style={{ cursor: 'pointer' }} />
                    )}
                    {showOther && (
                      <Bar dataKey="other_income" name="Other Income" fill={C.other} radius={[0,3,3,0]} style={{ cursor: 'pointer' }} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Income by Entity</div>
                <div className="table-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Entity</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>Other Income</th>
                        <th style={{ textAlign: 'right' }}>Total Income</th>
                        <th style={{ textAlign: 'right' }}>Months Active</th>
                        <th style={{ textAlign: 'right' }}>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadEnt ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: C.muted }}>Loading…</td></tr>
                      ) : entities.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: C.muted }}>No data</td></tr>
                      ) : entities.map((r) => (
                        <tr
                          key={r.company_name}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDrill({ label: r.company_name, type: 'entity', value: r.company_name })}
                        >
                          <td style={{ fontWeight: 500 }}>{r.company_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: C.rev }}>{fmtFull(r.revenue)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: C.other }}>{fmtFull(r.other_income)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.total }}>{fmtFull(r.total_income)}</td>
                          <td style={{ textAlign: 'right' }}>{r.months_active}</td>
                          <td style={{ textAlign: 'right' }}>{r.entry_count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
