/**
 * F026 — GL Data Insights
 * Four tabbed sections of charts and data quality insights.
 *
 * Tab 0 — GL Overview        : P&L trend, entity revenue share, account categories, doc-type mix
 * Tab 1 — Completeness       : gap chart, monthly volume, entity entry volume, coverage table
 * Tab 2 — Expense Intelligence : COGS/OpEx split donut, monthly expense trend, top-30 accounts
 * Tab 3 — Account Naming     : named vs unnamed breakdown, remediation list
 */
import { useState, useEffect } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
  PieChart, Pie,
} from 'recharts';
import {
  api,
  type PLWaterfallRow,
  type EntityContributionRow,
  type DocTypeMixRow,
  type CompletenessSummary,
  type EntityCoverageRow,
  type MonthlyVolumeRow,
  type ExpenseAccountRow,
  type AccountSummaryRow,
} from '../api/client';

// ── colour palettes ───────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Assets: '#3b82f6', Liabilities: '#ef4444', Equity: '#8b5cf6',
  Revenue: '#22c55e', COGS: '#f97316', OpEx: '#a855f7',
  'Other Income': '#06b6d4', Tax: '#f59e0b', Other: '#94a3b8',
};
const PIE_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#84cc16','#94a3b8',
];
const ENTITY_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9',
  '#d946ef','#10b981','#f43f5e','#8b5cf6','#14b8a6',
  '#fb923c','#a3e635',
];

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  Math.abs(n) >= 1e9
    ? `$${(n / 1e9).toFixed(2)}B`
    : Math.abs(n) >= 1e6
    ? `$${(n / 1e6).toFixed(1)}M`
    : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const pct = (num: number, den: number) =>
  den === 0 ? '0%' : `${((num / den) * 100).toFixed(1)}%`;

const PARTIAL_MONTHS = new Set(['2025-05', '2026-03', '2026-04']);

const ACCOUNT_PREFIX_COLOR: Record<string, string> = {
  '5': '#f97316',
  '6': '#8b5cf6',
};
function accountColor(no: string) {
  return ACCOUNT_PREFIX_COLOR[no[0]] ?? '#94a3b8';
}

// ── shared sub-components ─────────────────────────────────────────────────────

interface ChartCardProps {
  title: string; subtitle?: string;
  loading: boolean; error: boolean;
  height?: number; children: React.ReactNode;
}
function ChartCard({ title, subtitle, loading, error, height = 280, children }: ChartCardProps) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{subtitle}</div>
      )}
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
          Loading…
        </div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>
          Failed to load
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}

function USDTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)' }}>{p.name}: {fmt(p.value)}</div>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name}>{p.name}: {Number(p.value).toLocaleString()}</div>
      ))}
    </div>
  );
}

interface TileProps { label: string; value: string; sub?: string; severity?: 'ok' | 'warn' | 'error'; }
function Tile({ label, value, sub, severity = 'ok' }: TileProps) {
  const colors = { ok: 'var(--color-success)', warn: 'var(--color-warning)', error: 'var(--color-error)' };
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: colors[severity] }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'completeness' | 'expenses' | 'naming';

export default function DataInsights() {
  const [tab, setTab] = useState<Tab>('overview');

  // data state
  const [plWaterfall,  setPLWaterfall]  = useState<PLWaterfallRow[]>([]);
  const [entityContrib, setEntityContrib] = useState<EntityContributionRow[]>([]);
  const [docTypeMix,   setDocTypeMix]   = useState<DocTypeMixRow[]>([]);
  const [summary,      setSummary]      = useState<CompletenessSummary | null>(null);
  const [coverage,     setCoverage]     = useState<EntityCoverageRow[]>([]);
  const [volume,       setVolume]       = useState<MonthlyVolumeRow[]>([]);
  const [expenses,     setExpenses]     = useState<ExpenseAccountRow[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummaryRow[]>([]);

  // loading / error flags
  const [loading, setLoading] = useState({
    pl: true, contrib: true, doctype: true,
    summary: true, coverage: true, volume: true, expenses: true, acct: true,
  });
  const [errors, setErrors] = useState({
    pl: false, contrib: false, doctype: false,
    summary: false, coverage: false, volume: false, expenses: false, acct: false,
  });

  useEffect(() => {
    api.analytics.plWaterfall()
      .then(setPLWaterfall)
      .catch(() => setErrors((e) => ({ ...e, pl: true })))
      .finally(() => setLoading((l) => ({ ...l, pl: false })));

    api.analytics.entityContribution()
      .then(setEntityContrib)
      .catch(() => setErrors((e) => ({ ...e, contrib: true })))
      .finally(() => setLoading((l) => ({ ...l, contrib: false })));

    api.analytics.docTypeMix()
      .then(setDocTypeMix)
      .catch(() => setErrors((e) => ({ ...e, doctype: true })))
      .finally(() => setLoading((l) => ({ ...l, doctype: false })));

    api.analytics.completenessSummary()
      .then(setSummary)
      .catch(() => setErrors((e) => ({ ...e, summary: true })))
      .finally(() => setLoading((l) => ({ ...l, summary: false })));

    api.analytics.entityCoverage()
      .then(setCoverage)
      .catch(() => setErrors((e) => ({ ...e, coverage: true })))
      .finally(() => setLoading((l) => ({ ...l, coverage: false })));

    api.analytics.monthlyVolume()
      .then(setVolume)
      .catch(() => setErrors((e) => ({ ...e, volume: true })))
      .finally(() => setLoading((l) => ({ ...l, volume: false })));

    api.analytics.expenseAccounts()
      .then(setExpenses)
      .catch(() => setErrors((e) => ({ ...e, expenses: true })))
      .finally(() => setLoading((l) => ({ ...l, expenses: false })));

    api.analytics.accountSummary()
      .then(setAccountSummary)
      .catch(() => setErrors((e) => ({ ...e, acct: true })))
      .finally(() => setLoading((l) => ({ ...l, acct: false })));
  }, []);

  // ── derived ────────────────────────────────────────────────────────────────

  const total    = summary?.total_entries ?? 0;
  const cogsRow  = accountSummary.find((r) => r.category === 'COGS');
  const opexRow  = accountSummary.find((r) => r.category === 'OpEx');
  const revenueRow = accountSummary.find((r) => r.category === 'Revenue');

  const netIncome = plWaterfall.reduce((s, r) => s + r.net_income, 0);

  // Entity revenue share pie — top 10 + Others
  const entityPieData = (() => {
    const top10 = entityContrib.slice(0, 10);
    const othersShare = entityContrib.slice(10).reduce((s, r) => s + (r.revenue_share_pct ?? 0), 0);
    const data = top10.map((r) => ({ name: r.subsidiary_name, value: +(r.revenue_share_pct ?? 0) }));
    if (othersShare > 0.01) data.push({ name: 'Others', value: +othersShare.toFixed(2) });
    return data;
  })();

  // Account category totals for horizontal bar
  const catBarData = accountSummary.map((r) => ({
    name: r.category,
    amount: Math.abs(r.display_amount),
  }));

  // Completeness gap data
  const gapChartData = summary
    ? [
        { name: 'Unnamed GL Account', affected: +((summary.unnamed_account_entries / total) * 100).toFixed(1) },
        { name: 'No Department Code', affected: +((summary.no_dept_entries / total) * 100).toFixed(1) },
        { name: 'No Vertical Code',   affected: +((summary.no_vertical_entries / total) * 100).toFixed(1) },
        { name: 'Suspense (999999)',   affected: +((summary.suspense_entries / total) * 100).toFixed(1) },
      ]
    : [];

  // COGS vs OpEx donut data
  const cogsOpexPie = [
    { name: 'COGS (5xx)', value: cogsRow ? Math.abs(cogsRow.display_amount) : 0 },
    { name: 'OpEx (6xx)', value: opexRow ? Math.abs(opexRow.display_amount) : 0 },
  ];

  // Expense accounts split
  const unnamedExpenses = expenses.filter((e) => !e.gl_account_name);
  const namedExpenses   = expenses.filter((e) =>  e.gl_account_name);
  const namingData = [
    { category: 'COGS (5xx)', named: namedExpenses.filter(e => e.gl_account_no[0] === '5').length, unnamed: unnamedExpenses.filter(e => e.gl_account_no[0] === '5').length },
    { category: 'OpEx (6xx)', named: namedExpenses.filter(e => e.gl_account_no[0] === '6').length, unnamed: unnamedExpenses.filter(e => e.gl_account_no[0] === '6').length },
  ];

  const incomeTaxInOpex = expenses.find((e) => e.gl_account_no === '601201');
  const maxVolume = Math.max(...volume.map((v) => v.entry_count), 1);

  // Entity entry volume data (for coverage bar)
  const coverageBarData = [...coverage]
    .sort((a, b) => b.total_entries - a.total_entries)
    .map((r) => ({ name: r.subsidiary_code, entries: r.total_entries, coverage_pct: Number(r.coverage_pct) }));

  const TABS: [Tab, string][] = [
    ['overview',     'GL Overview'],
    ['completeness', 'Completeness & Coverage'],
    ['expenses',     'Expense Intelligence'],
    ['naming',       'Account Naming Quality'],
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">GL Data Insights</h1>
          <p className="page-subtitle">
            {total > 0
              ? `${total.toLocaleString()} GL entries · ${coverage.length} subsidiaries · May 2025 – Apr 2026`
              : 'Loading…'}
          </p>
        </div>
      </div>

      {/* ── Always-visible KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <Tile label="Total GL Entries"         value={total > 0 ? total.toLocaleString() : '…'} sub="17 subsidiaries" />
        <Tile label="Total Revenue"            value={revenueRow ? fmt(revenueRow.display_amount) : '…'} sub="4xx accounts" severity="ok" />
        <Tile label="Total Expenses"           value={cogsRow && opexRow ? fmt(cogsRow.display_amount + opexRow.display_amount) : '…'} sub="5xx + 6xx" severity="warn" />
        <Tile label="Cumulative Net Income"    value={plWaterfall.length ? fmt(netIncome) : '…'} sub="Revenue – Expenses" severity={netIncome >= 0 ? 'ok' : 'error'} />
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={`tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 0 — GL OVERVIEW                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {/* Chart 1 — Monthly P&L Trend */}
          <ChartCard
            title="Monthly P&L Trend"
            subtitle="Revenue (line) vs COGS + OpEx (bars) vs Net Income (line) · May 2025 – Apr 2026"
            loading={loading.pl}
            error={errors.pl}
            height={320}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={plWaterfall} margin={{ top: 8, right: 16, bottom: 4, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                <Tooltip content={<USDTooltip />} />
                <Legend />
                <Bar dataKey="cogs"      name="COGS"       fill="#f97316" stackId="cost" />
                <Bar dataKey="opex"      name="OpEx"       fill="#8b5cf6" stackId="cost" radius={[3,3,0,0]} />
                <Line dataKey="revenue"   name="Revenue"    stroke="#22c55e" strokeWidth={2} dot={false} type="monotone" />
                <Line dataKey="net_income" name="Net Income" stroke="#3b82f6" strokeWidth={2} dot={false} type="monotone" strokeDasharray="5 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Row: Entity Revenue Share + Account Category Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Chart 2 — Entity Revenue Share Donut */}
            <ChartCard
              title="Entity Revenue Share"
              subtitle="% of consolidated revenue by subsidiary (top 10 shown)"
              loading={loading.contrib}
              error={errors.contrib}
              height={300}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={entityPieData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={110}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name.split(' ')[0]} ${value}%`}
                    labelLine={false}
                  >
                    {entityPieData.map((_, i) => (
                      <Cell key={i} fill={ENTITY_COLORS[i % ENTITY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}%`, 'Revenue Share']} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Chart 3 — Account Category Totals */}
            <ChartCard
              title="Account Category Totals"
              subtitle="Absolute display amount by GL account category"
              loading={loading.acct}
              error={errors.acct}
              height={300}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catBarData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 90 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v) => [fmt(Number(v)), 'Amount']} />
                  <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                    {catBarData.map((row) => (
                      <Cell key={row.name} fill={CAT_COLORS[row.name] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart 4 — Document / Transaction Type Mix */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ChartCard
              title="Transaction Type Mix"
              subtitle="Entry count by document type — how GL postings are classified"
              loading={loading.doctype}
              error={errors.doctype}
              height={300}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={docTypeMix}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={105}
                    dataKey="entry_count"
                    nameKey="document_type"
                    label={({ document_type, pct_of_entries }) => `${document_type} ${pct_of_entries}%`}
                    labelLine={false}
                  >
                    {docTypeMix.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, _n, props) => [`${Number(v).toLocaleString()} entries (${props.payload.pct_of_entries}%)`, props.payload.document_type]} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Entity contribution table summary */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Entity Revenue Ranking</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Top 10 by revenue contribution</div>
              <div className="table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>#</th><th>Subsidiary</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Share</th>
                      <th style={{ textAlign: 'right' }}>Gross Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading.contrib ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                    ) : entityContrib.slice(0, 10).map((r, i) => (
                      <tr key={r.subsidiary_code}>
                        <td style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{i + 1}</td>
                        <td>{r.subsidiary_name}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.revenue)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.revenue_share_pct}%</td>
                        <td style={{ textAlign: 'right' }}>
                          {r.gross_margin_pct !== null ? (
                            <span className={`badge ${Number(r.gross_margin_pct) >= 0 ? 'badge-success' : 'badge-error'}`} style={{ fontSize: 10 }}>
                              {r.gross_margin_pct}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — COMPLETENESS & COVERAGE                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'completeness' && (
        <>
          {/* Completeness gap bar chart */}
          <ChartCard
            title="Data Completeness Gaps"
            subtitle="% of total GL entries affected by each quality issue"
            loading={loading.summary}
            error={errors.summary}
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gapChartData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 140 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
                <Tooltip formatter={(v) => [`${v}%`, 'Affected']} />
                <Bar dataKey="affected" name="% Affected" radius={[0, 4, 4, 0]}>
                  {gapChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.affected > 50 ? 'var(--color-error)' : entry.affected > 10 ? 'var(--color-warning)' : 'var(--color-success)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart 7 — Entity Entry Volume (ranked, coloured by coverage) */}
          <ChartCard
            title="GL Entry Volume by Entity"
            subtitle="Total entries per subsidiary — bar colour = coverage quality (green ≥90%, amber ≥60%, red <60%)"
            loading={loading.coverage}
            error={errors.coverage}
            height={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverageBarData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={50} />
                <Tooltip content={<CountTooltip />} formatter={(v) => [Number(v).toLocaleString(), 'Entries']} />
                <Bar dataKey="entries" name="Entries" radius={[0, 4, 4, 0]}>
                  {coverageBarData.map((row) => (
                    <Cell
                      key={row.name}
                      fill={row.coverage_pct >= 90 ? '#22c55e' : row.coverage_pct >= 60 ? '#f59e0b' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Monthly volume bar chart */}
          <ChartCard
            title="Monthly Entry Volume"
            subtitle="Partial months highlighted — May 2025 (period open), Mar–Apr 2026 (recent/open)"
            loading={loading.volume}
            error={errors.volume}
            height={240}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volume} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10 }} />
                <Tooltip content={<CountTooltip />} />
                <ReferenceLine
                  y={maxVolume * 0.5}
                  stroke="var(--color-warning)"
                  strokeDasharray="4 4"
                  label={{ value: 'Partial threshold', position: 'insideTopRight', fontSize: 10, fill: 'var(--color-warning)' }}
                />
                <Bar dataKey="entry_count" name="Entries" radius={[3, 3, 0, 0]}>
                  {volume.map((row) => (
                    <Cell key={row.month} fill={PARTIAL_MONTHS.has(row.month) ? 'var(--color-warning)' : 'var(--color-primary)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Entity coverage table */}
          <div className="card">
            <div className="card-title">Entity Coverage Matrix</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Coverage % = months with data out of 12 possible
            </div>
            <div className="table-wrap">
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Code</th><th>Subsidiary</th>
                    <th style={{ textAlign: 'center' }}>Months</th>
                    <th>Date Range</th>
                    <th style={{ textAlign: 'right' }}>Entries</th>
                    <th style={{ minWidth: 160 }}>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {loading.coverage ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                  ) : coverage.map((row) => {
                    const cpct = Number(row.coverage_pct);
                    const fillClass = cpct >= 90 ? 'progress-fill-success' : cpct >= 60 ? 'progress-fill-warning' : 'progress-fill-error';
                    const badgeClass = cpct >= 90 ? 'badge-success' : cpct >= 60 ? 'badge-warning' : 'badge-error';
                    return (
                      <tr key={row.subsidiary_code}>
                        <td className="table-mono" style={{ fontSize: 11 }}>{row.subsidiary_code}</td>
                        <td>{row.subsidiary_name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${badgeClass}`}>{row.months_present} / 12</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {row.from_date?.slice(0, 10)} → {row.to_date?.slice(0, 10)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                          {Number(row.total_entries).toLocaleString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ flex: 1 }}>
                              <div className={`progress-fill ${fillClass}`} style={{ width: `${cpct}%` }} />
                            </div>
                            <span style={{ fontSize: 11, fontFamily: 'monospace', minWidth: 36 }}>{cpct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — EXPENSE INTELLIGENCE                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'expenses' && (
        <>
          {/* COGS / OpEx tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <Tile label="COGS (5xx)" value={cogsRow ? fmt(cogsRow.display_amount) : '…'} sub={cogsRow ? `${cogsRow.entry_count.toLocaleString()} entries · ${cogsRow.account_count} accounts` : undefined} severity="warn" />
            <Tile label="OpEx (6xx)" value={opexRow ? fmt(opexRow.display_amount) : '…'} sub={opexRow ? `${opexRow.entry_count.toLocaleString()} entries · ${opexRow.account_count} accounts` : undefined} severity="warn" />
            <Tile label="COGS % of Total Expenses" value={cogsRow && opexRow ? pct(cogsRow.display_amount, cogsRow.display_amount + opexRow.display_amount) : '…'} sub="5xx ÷ (5xx + 6xx)" />
          </div>

          {/* Misclassification alert */}
          {incomeTaxInOpex && (
            <div className="alert alert-warning" style={{ marginBottom: 16, fontSize: 13 }}>
              <strong>Classification Flag — Account 601201 (Income Tax Expense):</strong>{' '}
              {fmt(incomeTaxInOpex.total_amount)} sitting in 6xx OpEx. Should be 8xx Tax. Distorts OpEx totals — reclassify in BC.
            </div>
          )}

          {/* Chart 5 + 6 side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
            {/* Chart 5 — COGS vs OpEx Donut */}
            <ChartCard
              title="COGS vs OpEx Split"
              subtitle="Proportion of total expense"
              loading={loading.acct}
              error={errors.acct}
              height={260}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cogsOpexPie}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name.split(' ')[0]} ${fmt(value)}`}
                    labelLine={false}
                  >
                    <Cell fill="#f97316" />
                    <Cell fill="#8b5cf6" />
                  </Pie>
                  <Tooltip formatter={(v) => [fmt(Number(v)), 'Amount']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Chart 6 — Monthly Expense Trend */}
            <ChartCard
              title="Monthly Expense Trend"
              subtitle="COGS vs OpEx over time — shows cost trajectory"
              loading={loading.pl}
              error={errors.pl}
              height={260}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={plWaterfall} margin={{ top: 8, right: 16, bottom: 4, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                  <Tooltip content={<USDTooltip />} />
                  <Legend />
                  <Line dataKey="cogs" name="COGS" stroke="#f97316" strokeWidth={2} dot={false} type="monotone" />
                  <Line dataKey="opex" name="OpEx" stroke="#8b5cf6" strokeWidth={2} dot={false} type="monotone" />
                  <Line dataKey="revenue" name="Revenue" stroke="#22c55e" strokeWidth={1.5} dot={false} type="monotone" strokeDasharray="4 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Top 30 expense accounts chart */}
          <ChartCard
            title="Top 30 Expense GL Accounts by Total Spend"
            subtitle="Orange = COGS (5xx)  ·  Purple = OpEx (6xx)  ·  Unnamed shown as account number only"
            loading={loading.expenses}
            error={errors.expenses}
            height={520}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={expenses.map((e) => ({
                  name: e.gl_account_name ? `${e.gl_account_no} ${e.gl_account_name}` : e.gl_account_no,
                  amount: Math.abs(e.total_amount),
                }))}
                layout="vertical"
                margin={{ top: 4, right: 80, bottom: 4, left: 220 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={220} />
                <Tooltip formatter={(v) => [fmt(Number(v)), 'Total Spend']} />
                <Bar dataKey="amount" name="Total Spend" radius={[0, 4, 4, 0]}>
                  {expenses.map((e) => (
                    <Cell key={e.gl_account_no} fill={accountColor(e.gl_account_no)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Expense detail table */}
          <div className="card">
            <div className="card-title">Expense Account Detail</div>
            <div className="table-wrap">
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>GL Account</th><th>Name</th><th>Category</th>
                    <th style={{ textAlign: 'right' }}>Total Spend</th>
                    <th style={{ textAlign: 'right' }}>Entries</th>
                    <th style={{ textAlign: 'right' }}>Entities</th>
                  </tr>
                </thead>
                <tbody>
                  {loading.expenses ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                  ) : expenses.map((e) => (
                    <tr key={e.gl_account_no}>
                      <td className="table-mono">{e.gl_account_no}</td>
                      <td>{e.gl_account_name ?? <span className="badge badge-warning" style={{ fontSize: 10 }}>Unnamed</span>}</td>
                      <td>
                        <span className="badge" style={{ background: e.gl_account_no[0] === '5' ? '#fff7ed' : '#f5f3ff', color: e.gl_account_no[0] === '5' ? '#c2410c' : '#6d28d9', fontSize: 10 }}>
                          {e.gl_account_no[0] === '5' ? 'COGS' : 'OpEx'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(Math.abs(e.total_amount))}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{e.entry_count.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{e.entity_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — ACCOUNT NAMING QUALITY                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'naming' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <Tile label="Unnamed Accounts (top 30 expenses)" value={unnamedExpenses.length.toString()} sub={`of ${expenses.length} top expense accounts`} severity={unnamedExpenses.length > 5 ? 'error' : 'warn'} />
            <Tile label="Entries on Unnamed Accounts" value={summary ? pct(summary.unnamed_account_entries, total) : '…'} sub={summary ? `${summary.unnamed_account_entries.toLocaleString()} entries` : undefined} severity="error" />
            <Tile label="Action" value="Map in BC" sub="Add G/L Account Name in Business Central export" severity="warn" />
          </div>

          <div className="alert alert-error" style={{ marginBottom: 16, fontSize: 13 }}>
            <strong>91% of GL entries have no account name.</strong> GL account names are not exported from Business Central into the GL extract.
            Add the <em>G/L Account Name</em> field to the BC data export template to fix this.
          </div>

          <ChartCard
            title="Named vs Unnamed — Top 30 Expense Accounts"
            subtitle="Count of GL accounts with and without names by category"
            loading={loading.expenses} error={errors.expenses} height={200}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={namingData} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="named"   name="Named"   fill="var(--color-success)" radius={[3,3,0,0]} />
                <Bar dataKey="unnamed" name="Unnamed" fill="var(--color-error)"   radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="card">
            <div className="card-title">Unnamed Expense Accounts — Remediation List</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Add names in Business Central. Sorted by total spend descending.
            </div>
            {loading.expenses ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
            ) : unnamedExpenses.length === 0 ? (
              <div className="alert alert-success">All top expense accounts are named.</div>
            ) : (
              <div className="table-wrap">
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>#</th><th>GL Account</th><th>Category</th>
                      <th style={{ textAlign: 'right' }}>Total Spend</th>
                      <th style={{ textAlign: 'right' }}>Entries</th>
                      <th style={{ textAlign: 'right' }}>Entities</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unnamedExpenses.map((e, i) => (
                      <tr key={e.gl_account_no}>
                        <td style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td className="table-mono" style={{ fontWeight: 700 }}>{e.gl_account_no}</td>
                        <td>
                          <span className="badge" style={{ background: e.gl_account_no[0] === '5' ? '#fff7ed' : '#f5f3ff', color: e.gl_account_no[0] === '5' ? '#c2410c' : '#6d28d9', fontSize: 10 }}>
                            {e.gl_account_no[0] === '5' ? 'COGS (5xx)' : 'OpEx (6xx)'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(Math.abs(e.total_amount))}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{e.entry_count.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{e.entity_count}</td>
                        <td><span className="badge badge-warning" style={{ fontSize: 10 }}>Add name in BC</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Account Category Summary</div>
            <div className="table-wrap">
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Accounts</th>
                    <th style={{ textAlign: 'right' }}>Entries</th>
                    <th style={{ textAlign: 'right' }}>Display Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading.acct ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                  ) : accountSummary.map((r) => (
                    <tr key={r.category}>
                      <td><span className="badge badge-info" style={{ fontSize: 10 }}>{r.category}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.account_count.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entry_count.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.display_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
