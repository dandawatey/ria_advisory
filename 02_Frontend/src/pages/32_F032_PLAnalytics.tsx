/**
 * F032 — Profit & Loss Analytics
 * Tabs: Waterfall · Monthly Trend · Income Statement · By Entity · YoY Comparison
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  api,
  type GLFilters,
  type FilterOptions,
  type KPISummary,
  type PLWaterfallRow,
  type EntityContributionRow,
  type MoMChangeRow,
  type PLYoYRow,
} from '../api/client';
import PageExplainer from '../components/common/PageExplainer';
// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, compact = false): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (compact) {
    if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
    return `${s}$${abs.toFixed(0)}`;
  }
  return `${s}$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function pct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}
function delta(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + fmt(n, true);
}
function deltaColor(n: number | null | undefined, inverse = false): string {
  if (n == null) return 'var(--color-text-muted)';
  const pos = inverse ? n < 0 : n >= 0;
  return pos ? '#22c55e' : '#ef4444';
}

const COLORS = { rev: '#22c55e', cogs: '#f97316', opex: '#a855f7', ebit: '#3b82f6', net: '#06b6d4', other: '#f59e0b', tax: '#ef4444' };
const PIE_COLORS = ['#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4','#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9'];

// ── Sub-components ─────────────────────────────────────────────────────────────
function KPITile({ label, value, sub, color = '#3b82f6', loading }: { label: string; value: string; sub?: string; color?: string; loading?: boolean }) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{loading ? '…' : value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, loading, error, height = 320, children }: {
  title: string; subtitle?: string; loading: boolean; error: boolean; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -8, marginBottom: 8 }}>{subtitle}</div>}
      {loading
        ? <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        : error
          ? <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>Failed to load</div>
          : <div style={{ height }}>{children}</div>
      }
    </div>
  );
}

function USDTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.filter((p) => p.name !== 'base').map((p) => (
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)', marginBottom: 2 }}>
          {p.name}: <strong>{fmt(p.value, true)}</strong>
        </div>
      ))}
    </div>
  );
}

type Tab = 'waterfall' | 'trend' | 'statement' | 'entity' | 'yoy';

// ── Waterfall data builder ────────────────────────────────────────────────────
function buildWaterfall(kpi: KPISummary) {
  const { revenue, cogs, opex, net_income } = kpi;
  const grossProfit = revenue - cogs;
  const ebit = grossProfit - opex;
  // Using recharts stacked bar trick: "base" is invisible, "value" is the bar
  return [
    { name: 'Revenue',       base: 0,          value: revenue,     fill: COLORS.rev,  isTotal: false },
    { name: '− COGS',        base: grossProfit, value: cogs,        fill: COLORS.cogs, isTotal: false },
    { name: 'Gross Profit',  base: 0,          value: grossProfit, fill: COLORS.ebit, isTotal: true  },
    { name: '− OpEx',        base: ebit,        value: opex,        fill: COLORS.opex, isTotal: false },
    { name: 'EBIT',          base: 0,          value: ebit,        fill: COLORS.ebit, isTotal: true  },
    { name: 'Net Income',    base: 0,          value: net_income,  fill: net_income >= 0 ? COLORS.rev : COLORS.tax, isTotal: true },
  ];
}

// ── Income Statement builder ──────────────────────────────────────────────────
function buildStatement(rows: PLWaterfallRow[]) {
  const quarters: Record<string, { rev: number; cogs: number; opex: number; other: number; tax: number; net: number }> = {};
  let totRev = 0, totCogs = 0, totOpex = 0, totOther = 0, totTax = 0, totNet = 0;

  rows.forEach((r) => {
    const q = r.month ? `Q${Math.ceil(parseInt(r.month.split('-')[1]) / 3)}` : 'Q1';
    if (!quarters[q]) quarters[q] = { rev: 0, cogs: 0, opex: 0, other: 0, tax: 0, net: 0 };
    quarters[q].rev   += r.revenue;
    quarters[q].cogs  += r.cogs;
    quarters[q].opex  += r.opex;
    quarters[q].other += r.other_income;
    quarters[q].tax   += r.tax;
    quarters[q].net   += r.net_income;
    totRev   += r.revenue; totCogs  += r.cogs; totOpex  += r.opex;
    totOther += r.other_income; totTax += r.tax; totNet   += r.net_income;
  });

  return { quarters, totals: { rev: totRev, cogs: totCogs, opex: totOpex, other: totOther, tax: totTax, net: totNet } };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PLAnalytics() {
  const [tab, setTab] = useState<Tab>('waterfall');
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ companies: [], years: [], months: [], currencies: [], account_categories: [] });
  const [filters, setFilters] = useState<GLFilters>({});
  const [drill, setDrill] = useState<{ label: string; id?: number } | null>(null);
  const [kpi,      setKpi]      = useState<KPISummary | null>(null);
  const [waterfall, setWaterfall] = useState<PLWaterfallRow[]>([]);
  const [entity,   setEntity]   = useState<EntityContributionRow[]>([]);
  const [momData,  setMomData]  = useState<MoMChangeRow[]>([]);
  const [yoy,      setYoy]      = useState<PLYoYRow[]>([]);

  const [loadKpi,  setLoadKpi]  = useState(true);
  const [loadWf,   setLoadWf]   = useState(true);
  const [loadEnt,  setLoadEnt]  = useState(false);
  const [loadMom,  setLoadMom]  = useState(false);
  const [loadYoy,  setLoadYoy]  = useState(false);
  const [errKpi,   setErrKpi]   = useState(false);
  const [errWf,    setErrWf]    = useState(false);
  const [errEnt,   setErrEnt]   = useState(false);
  const [errMom,   setErrMom]   = useState(false);
  const [errYoy,   setErrYoy]   = useState(false);

  const ef = useCallback((): GLFilters => {
    if (drill?.id) return { ...filters, company_ids: [drill.id] };
    return filters;
  }, [filters, drill]);

  // Filter options once
  useEffect(() => { api.analytics.filters().then(setFilterOpts).catch(() => null); }, []);

  // KPI — always load
  useEffect(() => {
    setLoadKpi(true); setErrKpi(false);
    api.analytics.kpiSummary(ef())
      .then(setKpi).catch(() => setErrKpi(true)).finally(() => setLoadKpi(false));
  }, [filters, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Waterfall + Statement (shared data)
  useEffect(() => {
    if (tab !== 'waterfall' && tab !== 'trend' && tab !== 'statement') return;
    setLoadWf(true); setErrWf(false);
    api.analytics.plWaterfall(ef())
      .then(setWaterfall).catch(() => setErrWf(true)).finally(() => setLoadWf(false));
  }, [tab, filters, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entity tab
  useEffect(() => {
    if (tab !== 'entity') return;
    setLoadEnt(true); setErrEnt(false);
    api.analytics.entityContribution(ef())
      .then(setEntity).catch(() => setErrEnt(true)).finally(() => setLoadEnt(false));
  }, [tab, filters, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // YoY tab
  useEffect(() => {
    if (tab !== 'yoy') return;
    setLoadYoy(true); setErrYoy(false);
    api.analytics.plYoY(filters)
      .then(setYoy).catch(() => setErrYoy(true)).finally(() => setLoadYoy(false));
  }, [tab, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // MoM variance (load on statement tab too)
  useEffect(() => {
    if (tab !== 'statement') return;
    setLoadMom(true); setErrMom(false);
    api.analytics.momChange()
      .then(setMomData).catch(() => setErrMom(true)).finally(() => setLoadMom(false));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCompany = (id: number) => {
    const cur = filters.company_ids ?? [];
    setFilters((f) => ({ ...f, company_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }));
    setDrill(null);
  };

  // Derived KPI values
  const revenue     = kpi?.revenue ?? 0;
  const cogs        = kpi?.cogs ?? 0;
  const opex        = kpi?.opex ?? 0;
  const netIncome   = kpi?.net_income ?? 0;
  const grossProfit = revenue - cogs;
  const ebit        = grossProfit - opex;
  const grossMargin = revenue !== 0 ? (grossProfit / revenue) * 100 : null;
  const netMargin   = revenue !== 0 ? (netIncome   / revenue) * 100 : null;

  // Waterfall data
  const wfData = kpi ? buildWaterfall(kpi) : [];

  // Statement data
  const stmt = buildStatement(waterfall);
  const qKeys = Object.keys(stmt.quarters).sort();

  const TABS: [Tab, string][] = [
    ['waterfall', 'P&L Waterfall'],
    ['trend',     'Monthly Trend'],
    ['statement', 'Income Statement'],
    ['entity',    'By Entity'],
    ['yoy',       'Year-over-Year'],
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Profit & Loss Analytics</h1>
        <p className="page-subtitle">Consolidated P&L · drill by entity, period, and business line</p>
      </div>

      <PageExplainer
        icon="📊"
        title="What is Profit & Loss Analytics?"
        description="This page provides <strong>comprehensive P&L analysis across five tabs</strong>: Waterfall (monthly revenue, cost, and net income bars), Monthly Trend (MoM change analysis), Income Statement (traditional P&L format by line), By Entity (revenue and margin comparison across subsidiaries), and YoY Comparison (year-over-year variance). Use the filter panel to scope by entity, fiscal year, and date range. All data sourced from the GL gold layer."
        concepts={[
          { icon: '$', color: '#22c55e', label: 'Gross Profit', desc: 'Revenue minus COGS — profit before operating expenses' },
          { icon: '%', color: '#3b82f6', label: 'EBIT', desc: 'Earnings Before Interest and Taxes — operating profit' },
          { icon: '↕', color: '#f97316', label: 'YoY', desc: 'Year-over-year change — current year vs. prior year same period' },
        ]}
        glossary={[
          { term: 'Waterfall Chart', def: 'Bar chart showing how revenue flows through COGS and OpEx to arrive at net income' },
          { term: 'Gross Margin %', def: 'Gross Profit ÷ Revenue × 100 — measures how efficiently services are delivered' },
          { term: 'MoM Change', def: 'Month-over-month variance — positive = improvement, negative = decline' },
        ]}
      />

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label="Revenue"       value={fmt(revenue)}     color={COLORS.rev}  loading={loadKpi} sub="4xx accounts" />
        <KPITile label="COGS"          value={fmt(cogs)}        color={COLORS.cogs} loading={loadKpi} sub="5xx accounts" />
        <KPITile label="Gross Profit"  value={fmt(grossProfit)} color={COLORS.ebit} loading={loadKpi} sub={grossMargin != null ? `${grossMargin.toFixed(1)}% margin` : undefined} />
        <KPITile label="OpEx"          value={fmt(opex)}        color={COLORS.opex} loading={loadKpi} sub="6xx accounts" />
        <KPITile label="EBIT"          value={fmt(ebit)}        color={ebit >= 0 ? COLORS.ebit : COLORS.tax} loading={loadKpi} />
        <KPITile label="Net Income"    value={fmt(netIncome)}   color={netIncome >= 0 ? COLORS.rev : COLORS.tax} loading={loadKpi} sub={netMargin != null ? `${netMargin.toFixed(1)}% margin` : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Filter Panel */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button
                  className={`btn btn-sm ${!filters.year ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setFilters((f) => ({ ...f, year: undefined }))}
                >All</button>
                {filterOpts.years.map((y) => (
                  <button
                    key={y}
                    className={`btn btn-sm ${filters.year === y ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setFilters((f) => ({ ...f, year: f.year === y ? undefined : y }))}
                  >{y}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Entities
                {(filters.company_ids ?? []).length > 0 && (
                  <button
                    style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 11 }}
                    onClick={() => setFilters((f) => ({ ...f, company_ids: [] }))}
                  >Clear</button>
                )}
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {filterOpts.companies.map((c) => (
                  <label key={c.company_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0' }}>
                    <input
                      type="checkbox"
                      checked={(filters.company_ids ?? []).includes(c.company_id)}
                      onChange={() => toggleCompany(c.company_id)}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</span>
                  </label>
                ))}
              </div>
            </div>

            {filterOpts.account_categories?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>GL Group</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button
                    className={`btn btn-sm ${!filters.account_category ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setFilters((f) => ({ ...f, account_category: undefined }))}
                  >All</button>
                  {filterOpts.account_categories.map((cat) => (
                    <button
                      key={cat}
                      className={`btn btn-sm ${filters.account_category === cat ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={() => setFilters((f) => ({ ...f, account_category: f.account_category === cat ? undefined : cat }))}
                    >{cat}</button>
                  ))}
                </div>
              </div>
            )}

            {drill && (
              <div style={{ marginTop: 12, padding: '6px 10px', background: 'rgba(59,130,246,0.08)', borderRadius: 6, fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Drill: {drill.label}</span>
                <button onClick={() => setDrill(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700 }}>×</button>
              </div>
            )}

          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Drill breadcrumb */}
          {drill && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, padding: '6px 12px', background: 'rgba(59,130,246,0.06)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.2)' }}>
              <span style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }} onClick={() => setDrill(null)}>All Entities</span>
              <span style={{ color: 'var(--color-text-muted)' }}>→</span>
              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{drill.label}</span>
              <button onClick={() => setDrill(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontWeight: 700 }}>×</button>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {TABS.map(([key, label]) => (
              <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {/* ══ WATERFALL TAB ══ */}
          {tab === 'waterfall' && (
            <>
              <ChartCard
                title="P&L Bridge — Revenue to Net Income"
                subtitle="Stacked waterfall: green = positive contribution, orange/purple = deductions, blue = subtotals"
                loading={loadKpi} error={errKpi} height={360}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={wfData} margin={{ top: 16, right: 24, bottom: 4, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 10 }} />
                    <Tooltip content={<USDTip />} />
                    {/* invisible spacer bar lifts the value bar to the right Y position */}
                    <Bar dataKey="base"  stackId="wf" fill="transparent" legendType="none" />
                    <Bar dataKey="value" stackId="wf" name="Amount" radius={[4, 4, 0, 0]}>
                      {wfData.map((d, i) => (
                        <Cell key={i} fill={d.fill} fillOpacity={d.isTotal ? 1 : 0.85} />
                      ))}
                    </Bar>
                    <ReferenceLine y={0} stroke="var(--color-border)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Summary table */}
              <div className="card">
                <div className="card-title">P&L Summary</div>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <tbody>
                    {[
                      { label: 'Revenue',       value: revenue,     color: COLORS.rev,  indent: 0 },
                      { label: 'Less: COGS',    value: -cogs,       color: COLORS.cogs, indent: 1 },
                      { label: 'Gross Profit',  value: grossProfit, color: COLORS.ebit, indent: 0, bold: true, border: true },
                      { label: 'Gross Margin',  value: null,        color: 'var(--color-text-muted)', indent: 1, text: grossMargin != null ? pct(grossMargin) : '—' },
                      { label: 'Less: OpEx',    value: -opex,       color: COLORS.opex, indent: 1 },
                      { label: 'EBIT',          value: ebit,        color: ebit >= 0 ? COLORS.ebit : COLORS.tax, indent: 0, bold: true, border: true },
                      { label: 'Net Income',    value: netIncome,   color: netIncome >= 0 ? COLORS.rev : COLORS.tax, indent: 0, bold: true, border: true },
                      { label: 'Net Margin',    value: null,        color: 'var(--color-text-muted)', indent: 1, text: netMargin != null ? pct(netMargin) : '—' },
                    ].map((row) => (
                      <tr key={row.label} style={{ borderTop: row.border ? '2px solid var(--color-border)' : undefined }}>
                        <td style={{ padding: '7px 0', paddingLeft: row.indent * 16, color: 'var(--color-text-muted)', fontSize: 12 }}>{row.label}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: row.bold ? 700 : 400, color: row.color, fontSize: 13 }}>
                          {loadKpi ? '…' : row.text ?? fmt(row.value!)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ══ TREND TAB ══ */}
          {tab === 'trend' && (
            <>
              <ChartCard title="Monthly P&L Trend — Revenue · Gross Profit · Net Income" loading={loadWf} error={errWf} height={340}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={waterfall} margin={{ top: 8, right: 60, bottom: 4, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="l" tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 10 }} />
                    <Tooltip content={<USDTip />} />
                    <Legend />
                    <Bar yAxisId="l" dataKey="cogs" name="COGS"  fill={COLORS.cogs} stackId="cost" />
                    <Bar yAxisId="l" dataKey="opex" name="OpEx"  fill={COLORS.opex} stackId="cost" radius={[3,3,0,0]} />
                    <Line yAxisId="r" type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.rev} strokeWidth={2.5} dot={false} />
                    <Line yAxisId="r" type="monotone" dataKey="net_income" name="Net Income"  stroke={COLORS.net}  strokeWidth={2} strokeDasharray="5 3" dot={false} />
                    <ReferenceLine yAxisId="r" y={0} stroke="var(--color-border)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Monthly Detail</div>
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>COGS</th>
                        <th style={{ textAlign: 'right' }}>Gross Profit</th>
                        <th style={{ textAlign: 'right' }}>GP%</th>
                        <th style={{ textAlign: 'right' }}>OpEx</th>
                        <th style={{ textAlign: 'right' }}>Net Income</th>
                        <th style={{ textAlign: 'right' }}>NI%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadWf ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : waterfall.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data</td></tr>
                      ) : waterfall.map((r) => {
                        const gp = r.revenue - r.cogs;
                        const gpm = r.revenue !== 0 ? (gp / r.revenue) * 100 : null;
                        const nim = r.revenue !== 0 ? (r.net_income / r.revenue) * 100 : null;
                        return (
                          <tr key={r.month}>
                            <td style={{ fontWeight: 500 }}>{r.month_name}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: COLORS.rev }}>{fmt(r.revenue, true)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.cogs, true)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(gp, true)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: gpm != null && gpm < 0 ? COLORS.tax : 'var(--color-text)' }}>{pct(gpm)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.opex, true)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: r.net_income >= 0 ? COLORS.rev : COLORS.tax }}>{fmt(r.net_income, true)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: nim != null && nim < 0 ? COLORS.tax : 'var(--color-text)' }}>{pct(nim)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ INCOME STATEMENT TAB ══ */}
          {tab === 'statement' && (
            <>
              <div className="card">
                <div className="card-title">Formal Income Statement — Quarterly View</div>
                {loadWf ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
                ) : (
                  <div className="table-wrap">
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 180 }}>Line Item</th>
                          {qKeys.map((q) => <th key={q} style={{ textAlign: 'right' }}>{q}</th>)}
                          <th style={{ textAlign: 'right', fontWeight: 700 }}>FY Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: 'rev',  label: 'Revenue',              sign: 1,  bold: false, indent: 0 },
                          { key: 'cogs', label: '  Less: COGS',         sign: -1, bold: false, indent: 1 },
                          { key: 'GP',   label: 'Gross Profit',         sign: 1,  bold: true,  indent: 0, computed: (q: typeof stmt.quarters[string]) => q.rev - q.cogs },
                          { key: 'GPM',  label: '  Gross Margin %',     sign: 1,  bold: false, indent: 1, pctOf: 'GP_rev' },
                          { key: 'opex', label: '  Less: Operating Exp',sign: -1, bold: false, indent: 1 },
                          { key: 'EBIT', label: 'EBIT',                 sign: 1,  bold: true,  indent: 0, computed: (q: typeof stmt.quarters[string]) => q.rev - q.cogs - q.opex },
                          { key: 'other',label: '  + Other Income',     sign: 1,  bold: false, indent: 1 },
                          { key: 'tax',  label: '  − Tax',              sign: -1, bold: false, indent: 1 },
                          { key: 'net',  label: 'Net Income',           sign: 1,  bold: true,  indent: 0, border: true },
                          { key: 'NIM',  label: '  Net Margin %',       sign: 1,  bold: false, indent: 1, pctOf: 'NI_rev' },
                        ].map((row) => {
                          const getValue = (q: typeof stmt.quarters[string]) => {
                            if (row.computed) return row.computed(q);
                            if (row.pctOf === 'GP_rev')  return q.rev !== 0 ? ((q.rev - q.cogs) / q.rev) * 100 : null;
                            if (row.pctOf === 'NI_rev')  return q.rev !== 0 ? (q.net / q.rev) * 100 : null;
                            return q[row.key as keyof typeof q] as number ?? 0;
                          };
                          const getTot = () => {
                            if (row.computed) return row.computed(stmt.totals as typeof stmt.quarters[string]);
                            if (row.pctOf === 'GP_rev') return stmt.totals.rev !== 0 ? ((stmt.totals.rev - stmt.totals.cogs) / stmt.totals.rev) * 100 : null;
                            if (row.pctOf === 'NI_rev') return stmt.totals.rev !== 0 ? (stmt.totals.net / stmt.totals.rev) * 100 : null;
                            return stmt.totals[row.key as keyof typeof stmt.totals] as number ?? 0;
                          };
                          const isPercent = !!row.pctOf;
                          const fmtCell = (v: number | null) => v == null ? '—' : isPercent ? pct(v) : fmt(v * row.sign, true);
                          const totVal = getTot();
                          const totColor = !isPercent && totVal != null ? (totVal * row.sign >= 0 ? 'inherit' : COLORS.tax) : 'inherit';

                          return (
                            <tr key={row.key} style={{ borderTop: row.border ? '2px solid var(--color-border)' : undefined }}>
                              <td style={{ fontWeight: row.bold ? 700 : 400, color: row.indent > 0 ? 'var(--color-text-muted)' : 'var(--color-text)', padding: '6px 0', paddingLeft: row.indent * 12 }}>
                                {row.label}
                              </td>
                              {qKeys.map((q) => {
                                const v = getValue(stmt.quarters[q] ?? { rev: 0, cogs: 0, opex: 0, other: 0, tax: 0, net: 0 });
                                const c = !isPercent && v != null ? (v * row.sign >= 0 ? 'inherit' : COLORS.tax) : 'inherit';
                                return <td key={q} style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: row.bold ? 700 : 400, color: c, padding: '6px 4px' }}>{fmtCell(v)}</td>;
                              })}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: totColor, padding: '6px 4px' }}>{fmtCell(totVal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* MoM Variance table */}
              <div className="card">
                <div className="card-title">Month-over-Month Revenue Variance by Entity</div>
                {loadMom
                  ? <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
                  : errMom
                    ? <div style={{ padding: 16, color: 'var(--color-error)', fontSize: 13 }}>Failed to load</div>
                    : (
                      <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
                        <table style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>Entity</th>
                              <th style={{ textAlign: 'right' }}>Current Rev</th>
                              <th style={{ textAlign: 'right' }}>Prior Rev</th>
                              <th style={{ textAlign: 'right' }}>Δ Revenue</th>
                              <th style={{ textAlign: 'right' }}>Δ %</th>
                              <th style={{ textAlign: 'right' }}>Δ OpEx</th>
                            </tr>
                          </thead>
                          <tbody>
                            {momData.map((r) => (
                              <tr key={r.company_id}>
                                <td style={{ fontWeight: 500 }}>{r.company_name}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.current_revenue, true)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{fmt(r.prior_revenue, true)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: deltaColor(r.revenue_delta) }}>{delta(r.revenue_delta)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: deltaColor(r.revenue_delta_pct) }}>
                                  {r.revenue_delta_pct != null ? `${r.revenue_delta_pct > 0 ? '+' : ''}${r.revenue_delta_pct.toFixed(1)}%` : '—'}
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: deltaColor(r.opex_delta, true) }}>{delta(r.opex_delta)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
              </div>
            </>
          )}

          {/* ══ BY ENTITY TAB ══ */}
          {tab === 'entity' && (
            <>
              <ChartCard title="Revenue by Entity — Contribution View" subtitle="Click a bar to drill into that entity" loading={loadEnt} error={errEnt} height={400}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={entity}
                    margin={{ top: 4, right: 80, bottom: 4, left: 10 }}
                    onClick={(d) => {
                      if (!d?.activeLabel) return;
                      const row = entity.find((r) => r.company_name === d.activeLabel);
                      if (row) setDrill({ label: row.company_name, id: row.company_id });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="company_name" tick={{ fontSize: 10 }} width={170}
                      tickFormatter={(v: string) => v?.length > 24 ? v.slice(0, 22) + '…' : v} />
                    <Tooltip content={<USDTip />} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue"     fill={COLORS.rev}  style={{ cursor: 'pointer' }} />
                    <Bar dataKey="cogs"    name="COGS"        fill={COLORS.cogs} />
                    <Bar dataKey="opex"    name="OpEx"        fill={COLORS.opex} radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Entity P&L Contribution</div>
                <div className="table-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Entity</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>COGS</th>
                        <th style={{ textAlign: 'right' }}>Gross Profit</th>
                        <th style={{ textAlign: 'right' }}>GP%</th>
                        <th style={{ textAlign: 'right' }}>OpEx</th>
                        <th style={{ textAlign: 'right' }}>Rev Share%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadEnt ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : entity.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data</td></tr>
                      ) : entity.map((r) => {
                        const gp = r.revenue - r.cogs;
                        return (
                          <tr key={r.company_id} style={{ cursor: 'pointer' }} onClick={() => setDrill({ label: r.company_name, id: r.company_id })}>
                            <td style={{ fontWeight: 500 }}>{r.company_name}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: COLORS.rev }}>{fmt(r.revenue, true)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.cogs, true)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(gp, true)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: r.gross_margin_pct != null && r.gross_margin_pct < 0 ? COLORS.tax : 'var(--color-text)' }}>
                              {pct(r.gross_margin_pct)}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.opex, true)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                              <span style={{ background: `${PIE_COLORS[entity.indexOf(r) % PIE_COLORS.length]}22`, color: PIE_COLORS[entity.indexOf(r) % PIE_COLORS.length], borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
                                {pct(r.revenue_share_pct)}
                              </span>
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

          {/* ══ YEAR-OVER-YEAR TAB ══ */}
          {tab === 'yoy' && (
            <>
              <ChartCard title="Year-over-Year Revenue & Net Income" loading={loadYoy} error={errYoy} height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={yoy} margin={{ top: 8, right: 60, bottom: 4, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="l" tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 10 }} />
                    <Tooltip content={<USDTip />} />
                    <Legend />
                    <Bar yAxisId="l" dataKey="cogs"  name="COGS"  fill={COLORS.cogs} stackId="cost" />
                    <Bar yAxisId="l" dataKey="opex"  name="OpEx"  fill={COLORS.opex} stackId="cost" radius={[3,3,0,0]} />
                    <Line yAxisId="r" type="monotone" dataKey="revenue"    name="Revenue"    stroke={COLORS.rev} strokeWidth={3} dot={{ r: 5, fill: COLORS.rev }} />
                    <Line yAxisId="r" type="monotone" dataKey="net_income" name="Net Income" stroke={COLORS.net} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 4, fill: COLORS.net }} />
                    <ReferenceLine yAxisId="r" y={0} stroke="var(--color-border)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Year-over-Year P&L Comparison</div>
                {loadYoy ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
                ) : (
                  <div className="table-wrap">
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th style={{ textAlign: 'right' }}>Revenue</th>
                          <th style={{ textAlign: 'right' }}>COGS</th>
                          <th style={{ textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ textAlign: 'right' }}>GP%</th>
                          <th style={{ textAlign: 'right' }}>OpEx</th>
                          <th style={{ textAlign: 'right' }}>Net Income</th>
                          <th style={{ textAlign: 'right' }}>NI%</th>
                          <th style={{ textAlign: 'right' }}>YoY Rev Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yoy.map((r, i) => {
                          const gp  = r.revenue - r.cogs;
                          const gpm = r.revenue !== 0 ? (gp / r.revenue) * 100 : null;
                          const nim = r.revenue !== 0 ? (r.net_income / r.revenue) * 100 : null;
                          const prev = yoy[i - 1];
                          const revDelta = prev ? r.revenue - prev.revenue : null;
                          return (
                            <tr key={r.year}>
                              <td style={{ fontWeight: 700 }}>{r.year}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: COLORS.rev }}>{fmt(r.revenue, true)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.cogs, true)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(gp, true)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{pct(gpm)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.opex, true)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: r.net_income >= 0 ? COLORS.rev : COLORS.tax }}>{fmt(r.net_income, true)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{pct(nim)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: deltaColor(revDelta) }}>{revDelta != null ? delta(revDelta) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
