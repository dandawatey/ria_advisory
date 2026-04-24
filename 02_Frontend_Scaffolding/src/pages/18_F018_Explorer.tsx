/**
 * F018 — GL Explorer
 * Chart-first GL analytics from the gl_unified table (188,380 rows, 17 subsidiaries).
 *
 * Tab 0 — Charts   : 6 Recharts visualisations built directly from gl_unified
 * Tab 1 — Search   : ad-hoc GL entry search with CSV export
 * Tab 2 — Stats    : per-subsidiary load statistics
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, BarChart, PieChart,
  Bar, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api } from '../api/client';
import type {
  GLEntry, GLStats,
  PLWaterfallRow, EntityContributionRow,
  ExpenseAccountRow, AccountSummaryRow,
  MonthlyVolumeRow, DocTypeMixRow,
} from '../api/client';

// ── colours ───────────────────────────────────────────────────────────────────
const PIE_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9','#a3e635',
];
const CAT_COLORS: Record<string, string> = {
  Assets: '#3b82f6', Liabilities: '#ef4444', Equity: '#8b5cf6',
  Revenue: '#22c55e', COGS: '#f97316', OpEx: '#a855f7',
  'Other Income': '#06b6d4', Tax: '#f59e0b', Other: '#94a3b8',
};

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
  : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
  : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function fmtUSD(n: number) {
  const abs = Math.abs(n ?? 0);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

// ── tooltips ──────────────────────────────────────────────────────────────────
function USDTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => <div key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</div>)}
    </div>
  );
}

// ── ChartCard ─────────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, loading, error, height = 280, children }: {
  title: string; subtitle?: string; loading: boolean; error: boolean; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{subtitle}</div>}
      {loading
        ? <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        : error
        ? <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>Failed to load — check backend</div>
        : <div style={{ height }}>{children}</div>
      }
    </div>
  );
}

// ── SUBSIDIARIES list ─────────────────────────────────────────────────────────
const SUBSIDIARIES = [
  { code: 'PHILS', name: 'RIA Advisory Philippines' },
  { code: 'MXN',   name: 'RIA Advisory Mexico' },
  { code: 'AGG',   name: 'RIA Advisory Aggregator LLC' },
  { code: 'BOR',   name: 'RIA Advisory Borrower LLC' },
  { code: 'CAN',   name: 'RIA Advisory Canada Ltd' },
  { code: 'GUA',   name: 'RIA Advisory Guarantor LLC' },
  { code: 'PTY',   name: 'RIA Advisory Pty Ltd (AUS)' },
  { code: 'USA',   name: 'RIA Advisory LLC (USA)' },
  { code: 'IND',   name: 'RIA Advisory LLP India' },
  { code: 'GBP',   name: 'RIA Advisory Ltd (UK)' },
  { code: 'ZAF',   name: 'RIA Advisory SA (ZAF)' },
  { code: 'SYN',   name: 'Synersys Global Inc' },
  { code: 'TBID',  name: 'TMG Bidco Inc' },
  { code: 'TSUB',  name: 'TMG Bidco Sub Inc' },
  { code: 'TCAN',  name: 'TMG Consulting Canada Inc' },
  { code: 'TOFF',  name: 'TMG Offshore Synersys Global' },
  { code: 'TUAS',  name: 'TMG Utility Advisory Services' },
];

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════

type Tab = 'charts' | 'search' | 'stats';

export default function Explorer() {
  const [tab, setTab] = useState<Tab>('charts');

  // ── chart data ──────────────────────────────────────────────────────────────
  const [plData,       setPLData]       = useState<PLWaterfallRow[]>([]);
  const [entityData,   setEntityData]   = useState<EntityContributionRow[]>([]);
  const [expenseData,  setExpenseData]  = useState<ExpenseAccountRow[]>([]);
  const [catData,      setCatData]      = useState<AccountSummaryRow[]>([]);
  const [volData,      setVolData]      = useState<MonthlyVolumeRow[]>([]);
  const [docData,      setDocData]      = useState<DocTypeMixRow[]>([]);

  const [cLoading, setCLoading] = useState({ pl: true, entity: true, exp: true, cat: true, vol: true, doc: true });
  const [cErrors,  setCErrors]  = useState({ pl: false, entity: false, exp: false, cat: false, vol: false, doc: false });

  useEffect(() => {
    api.analytics.plWaterfall()
      .then(setPLData).catch(() => setCErrors((e) => ({ ...e, pl: true })))
      .finally(() => setCLoading((l) => ({ ...l, pl: false })));

    api.analytics.entityContribution()
      .then(setEntityData).catch(() => setCErrors((e) => ({ ...e, entity: true })))
      .finally(() => setCLoading((l) => ({ ...l, entity: false })));

    api.analytics.expenseAccounts()
      .then(setExpenseData).catch(() => setCErrors((e) => ({ ...e, exp: true })))
      .finally(() => setCLoading((l) => ({ ...l, exp: false })));

    api.analytics.accountSummary()
      .then(setCatData).catch(() => setCErrors((e) => ({ ...e, cat: true })))
      .finally(() => setCLoading((l) => ({ ...l, cat: false })));

    api.analytics.monthlyVolume()
      .then(setVolData).catch(() => setCErrors((e) => ({ ...e, vol: true })))
      .finally(() => setCLoading((l) => ({ ...l, vol: false })));

    api.analytics.docTypeMix()
      .then(setDocData).catch(() => setCErrors((e) => ({ ...e, doc: true })))
      .finally(() => setCLoading((l) => ({ ...l, doc: false })));
  }, []);

  // ── search state ────────────────────────────────────────────────────────────
  const [subsidiary, setSubsidiary] = useState('');
  const [accountNo,  setAccountNo]  = useState('');
  const [department, setDepartment] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [rows,       setRows]       = useState<GLEntry[]>([]);
  const [stats,      setStats]      = useState<GLStats[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [apiError,   setApiError]   = useState(false);

  const handleSearch = useCallback(() => {
    setSearching(true); setApiError(false);
    const params: Record<string, string | number> = { limit: 300 };
    if (subsidiary) params.subsidiary = subsidiary;
    if (accountNo)  params.account_no = accountNo;
    if (department) params.department = department;
    if (dateFrom)   params.date_from  = dateFrom;
    if (dateTo)     params.date_to    = dateTo;
    api.gl.entries(params)
      .then(setRows).catch(() => setApiError(true))
      .finally(() => { setSearching(false); setSearched(true); });
  }, [subsidiary, accountNo, department, dateFrom, dateTo]);

  const handleLoadStats = useCallback(() => {
    setSearching(true); setApiError(false);
    api.gl.stats().then(setStats).catch(() => setApiError(true)).finally(() => setSearching(false));
  }, []);

  // ── derived ─────────────────────────────────────────────────────────────────

  // Top 15 expense accounts for chart (horizontal bar)
  const top15Expenses = expenseData.slice(0, 15).map((e) => ({
    name: e.gl_account_name ? `${e.gl_account_no} · ${e.gl_account_name}` : e.gl_account_no,
    amount: Math.abs(e.total_amount),
    fill: e.gl_account_no.startsWith('5') ? '#f97316' : '#8b5cf6',
    no: e.gl_account_no,
  }));

  // Entity revenue bar (top 12, sorted by revenue)
  const top12Entities = entityData
    .filter((r) => r.revenue > 0)
    .slice(0, 12)
    .map((r) => ({
      name: r.subsidiary_code,
      revenue: r.revenue,
      cogs: r.cogs,
      gross_margin_pct: r.gross_margin_pct ?? 0,
    }));

  // Category totals (abs display amount, sorted)
  const catBar = [...catData]
    .sort((a, b) => Math.abs(b.display_amount) - Math.abs(a.display_amount))
    .map((r) => ({ name: r.category, amount: Math.abs(r.display_amount) }));

  // Net income summary
  const totalRevenue  = plData.reduce((s, r) => s + r.revenue,   0);
  const totalExpenses = plData.reduce((s, r) => s + r.cogs + r.opex, 0);
  const netIncome     = plData.reduce((s, r) => s + r.net_income, 0);
  const totalEntries  = volData.reduce((s, r) => s + r.entry_count, 0);

  const totalAmount = rows.reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">GL Explorer</h1>
            <p className="page-subtitle">
              gl_unified · 188,380 entries · 17 subsidiaries · May 2025 – Apr 2026
              {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚠ API offline</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Entries',    val: totalEntries > 0 ? totalEntries.toLocaleString() : '…', color: 'var(--color-primary)' },
          { label: 'Total Revenue',    val: totalRevenue  > 0 ? fmt(totalRevenue)  : '…', color: 'var(--color-success)' },
          { label: 'Total Expenses',   val: totalExpenses > 0 ? fmt(totalExpenses) : '…', color: 'var(--color-warning)' },
          { label: 'Net Income',       val: netIncome !== 0   ? fmt(netIncome)     : '…', color: netIncome >= 0 ? 'var(--color-success)' : 'var(--color-error)' },
        ].map(({ label, val, color }) => (
          <div key={label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {([['charts','Charts & Insights'],['search','GL Search'],['stats','Load Stats']] as [Tab,string][]).map(([key,label]) => (
          <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => { setTab(key); if (key === 'stats' && stats.length === 0) handleLoadStats(); }}>
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 0 — CHARTS & INSIGHTS                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'charts' && (
        <>
          {/* Chart 1 — Monthly P&L: Revenue, COGS, OpEx, Net Income */}
          <ChartCard
            title="Monthly P&L — Revenue vs Expenses vs Net Income"
            subtitle="Revenue (green line) · COGS (orange bar) · OpEx (purple bar) · Net Income (blue dashed line) · Source: gl_unified 4xx/5xx/6xx accounts"
            loading={cLoading.pl} error={cErrors.pl} height={320}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={plData} margin={{ top: 8, right: 20, bottom: 4, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <Tooltip content={<USDTip />} />
                <Legend />
                <Bar dataKey="cogs"       name="COGS"       fill="#f97316" stackId="exp" />
                <Bar dataKey="opex"       name="OpEx"       fill="#8b5cf6" stackId="exp" radius={[3,3,0,0]} />
                <Line dataKey="revenue"   name="Revenue"    stroke="#22c55e" strokeWidth={2.5} dot={false} type="monotone" />
                <Line dataKey="net_income" name="Net Income" stroke="#3b82f6" strokeWidth={2} dot={false} type="monotone" strokeDasharray="6 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart 2 — Top 15 GL Expense Accounts */}
          <ChartCard
            title="Top 15 GL Expense Accounts by Total Spend"
            subtitle="Orange = COGS (5xx accounts) · Purple = OpEx (6xx accounts) · Sorted by absolute spend · Source: gl_unified"
            loading={cLoading.exp} error={cErrors.exp} height={460}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top15Expenses} layout="vertical" margin={{ top: 4, right: 80, bottom: 4, left: 230 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={230} />
                <Tooltip formatter={(v) => [fmt(Number(v)), 'Total Spend']} />
                <Bar dataKey="amount" name="Total Spend" radius={[0, 4, 4, 0]}>
                  {top15Expenses.map((row) => (
                    <Cell key={row.no} fill={row.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Row: Entity Revenue + Account Categories */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>
            {/* Chart 3 — Entity Revenue vs COGS Comparison */}
            <ChartCard
              title="Entity Revenue vs COGS"
              subtitle="Top 12 subsidiaries · Blue = Revenue · Orange = COGS · Source: gl_unified"
              loading={cLoading.entity} error={cErrors.entity} height={320}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top12Entities} margin={{ top: 8, right: 16, bottom: 40, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <Tooltip content={<USDTip />} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[3,3,0,0]} />
                  <Bar dataKey="cogs"    name="COGS"    fill="#f97316" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Chart 4 — GL Account Category Distribution */}
            <ChartCard
              title="GL Account Category Totals"
              subtitle="All categories from gl_unified · abs display amount"
              loading={cLoading.cat} error={cErrors.cat} height={320}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catBar} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => [fmt(Number(v)), 'Amount']} />
                  <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                    {catBar.map((row) => <Cell key={row.name} fill={CAT_COLORS[row.name] ?? '#94a3b8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Row: Monthly Volume + Doc Type Mix */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Chart 5 — Monthly GL Entry Volume */}
            <ChartCard
              title="Monthly GL Entry Volume"
              subtitle="Total entries posted per month · amber = partial/open months · Source: gl_unified posting_date"
              loading={cLoading.vol} error={cErrors.vol} height={260}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [Number(v).toLocaleString(), 'Entries']} />
                  <ReferenceLine y={18000} stroke="var(--color-warning)" strokeDasharray="4 4" />
                  <Bar dataKey="entry_count" name="Entries" radius={[3,3,0,0]}>
                    {volData.map((row) => (
                      <Cell key={row.month} fill={['2025-05','2026-03','2026-04'].includes(row.month) ? '#f59e0b' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Chart 6 — Document Type Mix (Donut) */}
            <ChartCard
              title="Document Type Mix"
              subtitle="Entry count by document_type · Source: gl_unified"
              loading={cLoading.doc} error={cErrors.doc} height={260}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={docData}
                    cx="50%" cy="45%"
                    innerRadius={55} outerRadius={95}
                    dataKey="entry_count"
                    nameKey="document_type"
                  >
                    {docData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, _n, p) => [`${Number(v).toLocaleString()} (${p.payload.pct_of_entries}%)`, p.payload.document_type]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart 7 — Revenue Trend Per Entity (LineChart) */}
          <ChartCard
            title="Gross Margin % by Entity"
            subtitle="Entities sorted by revenue · gross margin = (Revenue − COGS) / Revenue · Source: gl_unified"
            loading={cLoading.entity} error={cErrors.entity} height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={entityData.filter(r => r.revenue > 0 && r.gross_margin_pct !== null).slice(0,14)}
                margin={{ top: 8, right: 20, bottom: 40, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="subsidiary_code" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} domain={['auto','auto']} />
                <Tooltip formatter={(v) => [`${v}%`, 'Gross Margin']} />
                <ReferenceLine y={0} stroke="var(--color-error)" strokeDasharray="3 3" />
                <Bar dataKey="gross_margin_pct" name="Gross Margin %" radius={[3,3,0,0]}>
                  {entityData.filter(r => r.revenue > 0 && r.gross_margin_pct !== null).slice(0,14).map((r, i) => (
                    <Cell key={i} fill={(r.gross_margin_pct ?? 0) >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Entity contribution table */}
          <div className="card">
            <div className="card-title">Entity P&L Summary — All Subsidiaries</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Aggregated from gl_unified · 4xx = Revenue · 5xx = COGS · 6xx = OpEx
            </div>
            <div className="table-wrap">
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Code</th><th>Subsidiary</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>COGS</th>
                    <th style={{ textAlign: 'right' }}>OpEx</th>
                    <th style={{ textAlign: 'right' }}>Gross Margin</th>
                    <th style={{ textAlign: 'right' }}>Rev Share</th>
                  </tr>
                </thead>
                <tbody>
                  {cLoading.entity ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                  ) : entityData.map((r) => (
                    <tr key={r.subsidiary_code}>
                      <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{r.subsidiary_code}</span></td>
                      <td style={{ fontWeight: 500 }}>{r.subsidiary_name}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-success)' }}>{fmt(r.revenue)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-warning)' }}>{fmt(r.cogs)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-warning)' }}>{fmt(r.opex)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {r.gross_margin_pct !== null ? (
                          <span className={`badge ${Number(r.gross_margin_pct) >= 0 ? 'badge-success' : 'badge-error'}`} style={{ fontSize: 10 }}>
                            {r.gross_margin_pct}%
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>
                        {r.revenue_share_pct !== null ? `${Math.abs(r.revenue_share_pct)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — GL SEARCH                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'search' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card-title">Filters</div>
            <div className="form-group mb-12">
              <label className="form-label">Subsidiary</label>
              <select className="form-select" value={subsidiary} onChange={(e) => setSubsidiary(e.target.value)}>
                <option value="">All subsidiaries</option>
                {SUBSIDIARIES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div className="form-group mb-12">
              <label className="form-label">GL Account (prefix)</label>
              <input className="form-input" placeholder="e.g. 4, 601" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
            </div>
            <div className="form-group mb-12">
              <label className="form-label">Department</label>
              <input className="form-input" placeholder="e.g. ADMIN" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="form-group mb-12">
              <label className="form-label">Date From</label>
              <input className="form-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group mb-16">
              <label className="form-label">Date To</label>
              <input className="form-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching…' : 'Search GL'}
            </button>
          </div>

          <div className="card">
            {!searched && !searching && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
                Set filters and click Search GL to query gl_unified.
              </div>
            )}
            {searching && <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>Querying…</div>}
            {searched && !searching && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {rows.length} rows · Net: <strong>{fmtUSD(totalAmount)}</strong>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    const csv = [
                      ['Date','Subsidiary','Account','Description','Department','Amount','Doc No'].join(','),
                      ...rows.map((r) => [r.posting_date?.slice(0,10), r.subsidiary_code, r.gl_account_no,
                        `"${(r.description ?? '').replace(/"/g,'""')}"`, r.department_code ?? '', r.amount, r.document_no ?? ''].join(','))
                    ].join('\n');
                    const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'gl_export.csv'; a.click();
                  }}>Export CSV</button>
                </div>
                <div className="table-wrap" style={{ maxHeight: 550, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr><th>Date</th><th>Entity</th><th>Account</th><th>Account Name</th><th>Description</th><th>Dept</th><th>Doc Type</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>No results.</td></tr>
                      ) : rows.map((r) => (
                        <tr key={r.id}>
                          <td className="table-mono">{r.posting_date?.slice(0,10) ?? '—'}</td>
                          <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{r.subsidiary_code}</span></td>
                          <td className="table-mono">{r.gl_account_no}</td>
                          <td style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{r.gl_account_name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description ?? r.customer_or_vendor_name ?? '—'}</td>
                          <td style={{ fontSize: 11 }}>{r.department_code ?? '—'}</td>
                          <td style={{ fontSize: 11 }}>{r.document_type ?? '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: r.amount >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{fmtUSD(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — LOAD STATS                                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'stats' && (
        <div className="card">
          <div className="card-title">GL Load Statistics — per Subsidiary</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Subsidiary</th><th style={{ textAlign: 'right' }}>Entries</th><th>Date From</th><th>Date To</th><th style={{ textAlign: 'right' }}>Net Amount</th></tr>
              </thead>
              <tbody>
                {searching ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                ) : stats.map((s) => (
                  <tr key={s.code}>
                    <td><span className="badge badge-muted">{s.code}</span></td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ textAlign: 'right' }}>{s.total_entries.toLocaleString()}</td>
                    <td className="table-mono" style={{ fontSize: 12 }}>{s.date_from?.slice(0,10) ?? '—'}</td>
                    <td className="table-mono" style={{ fontSize: 12 }}>{s.date_to?.slice(0,10) ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtUSD(s.net_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
