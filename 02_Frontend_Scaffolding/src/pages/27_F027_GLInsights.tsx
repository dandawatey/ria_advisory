/**
 * F027 — GL Insights (Enhanced, Drill-Through Edition)
 * Left filter panel (240px) + 4 tabbed content area with click-through drill state.
 *
 * Tab 1 — P&L Overview   : ComposedChart waterfall + KPI tiles
 * Tab 2 — By Account     : Horizontal bar top-30 + account category pie
 * Tab 3 — By Department  : Dept spend bar + detail table
 * Tab 4 — Anomalies      : Suspense table + completeness indicators
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, BarChart, PieChart,
  Bar, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  api,
  type GLFilters,
  type FilterOptions,
  type KPISummary,
  type PLWaterfallRow,
  type TopAccountRow,
  type AccountSummaryRow,
  type DeptHeatmapRow,
  type SuspenseRow,
  type CompletenessSummary,
  type EntityContributionRow,
  type DocTypeMixRow,
  type VerticalPLRow,
} from '../api/client';
import { GLFilterBar } from '../components/GLFilterBar';

// ── Palettes ───────────────────────────────────────────────────────────────────
const PIE_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9',
];
const CAT_COLORS: Record<string, string> = {
  Assets: '#3b82f6', Liabilities: '#ef4444', Equity: '#8b5cf6',
  Income: '#22c55e', Revenue: '#22c55e', Expense: '#f97316',
  COGS: '#f97316', OpEx: '#a855f7', Other: '#94a3b8',
};

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toFixed(0)}`;
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function USDTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 6, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)', marginBottom: 2 }}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, loading, error, height = 300, children, onClear }: {
  title: string; loading?: boolean; error?: boolean; height?: number;
  children: React.ReactNode; onClear?: () => void;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>{title}</div>
        {onClear && (
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={onClear}>
            Clear drill
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Loading data…
        </div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)', fontSize: 13 }}>
          API unavailable — start the backend server
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}

function KPITile({ label, value, sub, color = 'var(--color-primary)' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'pl' | 'entity' | 'accounts' | 'dept' | 'doctype' | 'anomalies';

interface DrillState {
  dim: 'month' | 'company' | 'category' | 'account';
  value: string | number;
  label: string;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function GLInsights() {
  // Filter panel state
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    companies: [], years: [], months: [], currencies: [],
  });
  const [filters, setFilters] = useState<GLFilters>({});
  const [sectionOpen, setSectionOpen] = useState({ companies: true, year: true, period: true });
  const [accountPrefix, setAccountPrefix] = useState('');
  const [genPostType, setGenPostType] = useState('');

  // Drill-through
  const [drill, setDrill] = useState<DrillState | null>(null);

  // Tab
  const [tab, setTab] = useState<Tab>('pl');

  // Data
  const [kpi,        setKpi]        = useState<KPISummary | null>(null);
  const [waterfall,  setWaterfall]  = useState<PLWaterfallRow[]>([]);
  const [topAccts,   setTopAccts]   = useState<TopAccountRow[]>([]);
  const [acctSummary, setAcctSummary] = useState<AccountSummaryRow[]>([]);
  const [deptHeat,   setDeptHeat]   = useState<DeptHeatmapRow[]>([]);
  const [suspense,   setSuspense]   = useState<SuspenseRow[]>([]);
  const [completeness, setCompleteness] = useState<CompletenessSummary | null>(null);
  const [entityContrib, setEntityContrib] = useState<EntityContributionRow[]>([]);
  const [docTypeMix, setDocTypeMix] = useState<DocTypeMixRow[]>([]);
  const [vertPL, setVertPL] = useState<VerticalPLRow[]>([]);

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors,  setErrors]  = useState<Record<string, boolean>>({});
  const L = (k: string, v: boolean) => setLoading((p) => ({ ...p, [k]: v }));
  const E = (k: string, v: boolean) => setErrors((p) => ({ ...p, [k]: v }));

  // Effective filters — merge drill into filters where applicable
  const effectiveFilters = useCallback((): GLFilters => {
    if (!drill) return filters;
    if (drill.dim === 'month') {
      const m = String(drill.value);
      return { ...filters, month_from: m, month_to: m };
    }
    if (drill.dim === 'company') {
      return { ...filters, company_ids: [Number(drill.value)] };
    }
    return filters;
  }, [filters, drill]);

  // Sync GLFilterBar → filters
  useEffect(() => {
    setFilters((f) => ({
      ...f,
      account_prefix: accountPrefix || undefined,
      gen_post_type: genPostType || undefined,
    }));
  }, [accountPrefix, genPostType]);

  // Load filter options once
  useEffect(() => {
    api.analytics.filters().then(setFilterOpts).catch(() => null);
    api.analytics.suspenseMonitor().then(setSuspense).catch(() => null);
    api.analytics.completenessSummary().then(setCompleteness).catch(() => null);
  }, []);

  // KPI always-visible row — refresh on filters + drill
  useEffect(() => {
    L('kpi', true);
    api.analytics.kpiSummary(effectiveFilters())
      .then(setKpi).catch(() => E('kpi', true)).finally(() => L('kpi', false));
  }, [filters, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tab: P&L
  useEffect(() => {
    if (tab !== 'pl') return;
    L('wf', true);
    api.analytics.plWaterfall(effectiveFilters())
      .then(setWaterfall).catch(() => E('wf', true)).finally(() => L('wf', false));
  }, [tab, filters, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tab: By Account
  useEffect(() => {
    if (tab !== 'accounts') return;
    L('top', true); L('acctSum', true);
    api.analytics.topAccounts(effectiveFilters(), '', 30)
      .then(setTopAccts).catch(() => E('top', true)).finally(() => L('top', false));
    api.analytics.accountSummary(effectiveFilters())
      .then(setAcctSummary).catch(() => E('acctSum', true)).finally(() => L('acctSum', false));
  }, [tab, filters, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tab: By Department
  useEffect(() => {
    if (tab !== 'dept') return;
    L('dept', true);
    api.analytics.deptHeatmap(effectiveFilters())
      .then(setDeptHeat).catch(() => E('dept', true)).finally(() => L('dept', false));
  }, [tab, filters, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tab: By Entity
  useEffect(() => {
    if (tab !== 'entity') return;
    L('entity', true);
    api.analytics.entityContribution(effectiveFilters())
      .then(setEntityContrib).catch(() => E('entity', true)).finally(() => L('entity', false));
  }, [tab, filters, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tab: By Type
  useEffect(() => {
    if (tab !== 'doctype') return;
    L('dtype', true); L('vpl', true);
    api.analytics.docTypeMix(effectiveFilters())
      .then(setDocTypeMix).catch(() => E('dtype', true)).finally(() => L('dtype', false));
    api.analytics.verticalPL(effectiveFilters())
      .then(setVertPL).catch(() => E('vpl', true)).finally(() => L('vpl', false));
  }, [tab, filters, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter helpers ─────────────────────────────────────────────────────────
  function toggleCompany(id: number) {
    const cur = filters.company_ids ?? [];
    setFilters((f) => ({
      ...f,
      company_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    }));
    setDrill(null);
  }

  function setYear(y: number | undefined) {
    setFilters((f) => ({ ...f, year: y }));
    setDrill(null);
  }

  function clearAll() {
    setFilters({});
    setDrill(null);
  }

  // Active filter chips
  const activeChips: string[] = [];
  if ((filters.company_ids ?? []).length > 0)
    activeChips.push(`${filters.company_ids!.length} entit${filters.company_ids!.length === 1 ? 'y' : 'ies'}`);
  if (filters.year) activeChips.push(`FY ${filters.year}`);
  if (filters.month_from || filters.month_to)
    activeChips.push(`${filters.month_from ?? '…'} → ${filters.month_to ?? '…'}`);
  if (drill) activeChips.push(`Drill: ${drill.label}`);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Page header */}
      <div className="page-header" style={{ paddingBottom: 12 }}>
        <h1 className="page-title">GL Insights</h1>
        <p className="page-subtitle">Drill-through analytics · filter by entity, year and period</p>
      </div>

      {/* KPI row — always visible */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, paddingBottom: 16 }}>
        <KPITile label="Revenue"      value={loading.kpi ? '…' : fmt(kpi?.revenue ?? 0)}    color="#22c55e" />
        <KPITile label="COGS + OpEx"  value={loading.kpi ? '…' : fmt((kpi?.cogs ?? 0) + (kpi?.opex ?? 0))} color="#f97316" />
        <KPITile label="Net Income"   value={loading.kpi ? '…' : fmt(kpi?.net_income ?? 0)}
          color={(kpi?.net_income ?? 0) >= 0 ? '#22c55e' : '#ef4444'} />
        <KPITile label="Total Entries" value={loading.kpi ? '…' : (kpi?.entry_count ?? 0).toLocaleString()} color="#8b5cf6" />
      </div>

      {/* Drill breadcrumb */}
      {drill && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          background: 'rgba(59,130,246,0.08)', borderRadius: 6, marginBottom: 12,
          border: '1px solid rgba(59,130,246,0.2)', fontSize: 13,
        }}>
          <span style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }} onClick={clearAll}>
            All GL Data
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>→</span>
          <span style={{ fontWeight: 600, color: '#3b82f6' }}>{drill.label}</span>
          <button
            style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontWeight: 700, fontSize: 14 }}
            onClick={clearAll}
          >×</button>
        </div>
      )}

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Active:</span>
          {activeChips.map((c) => (
            <span key={c} style={{
              background: 'var(--color-primary)', color: '#fff',
              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
            }}>{c}</span>
          ))}
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={clearAll}>
            Clear All
          </button>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Filter panel ────────────────────────────────────────────────── */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 0 }}>

            {/* Header */}
            <div style={{
              padding: '10px 14px', background: 'var(--color-primary)', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Filters</span>
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 11 }}
                onClick={clearAll}>Reset</button>
            </div>

            {/* Entities section */}
            <div style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => setSectionOpen((p) => ({ ...p, companies: !p.companies }))}>
                Entities <span>{sectionOpen.companies ? '▲' : '▼'}</span>
              </button>
              {sectionOpen.companies && (
                <div style={{ padding: '0 10px 10px', maxHeight: 220, overflowY: 'auto' }}>
                  {filterOpts.companies.map((c) => (
                    <label key={c.company_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0' }}>
                      <input type="checkbox"
                        checked={(filters.company_ids ?? []).includes(c.company_id)}
                        onChange={() => toggleCompany(c.company_id)}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.company_name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Year section */}
            <div style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => setSectionOpen((p) => ({ ...p, year: !p.year }))}>
                Year <span>{sectionOpen.year ? '▲' : '▼'}</span>
              </button>
              {sectionOpen.year && (
                <div style={{ padding: '0 10px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button
                    className={`btn btn-sm ${!filters.year ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setYear(undefined)}
                  >All</button>
                  {filterOpts.years.map((y) => (
                    <button key={y}
                      className={`btn btn-sm ${filters.year === y ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={() => setYear(filters.year === y ? undefined : y)}
                    >{y}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Period section */}
            <div>
              <button style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => setSectionOpen((p) => ({ ...p, period: !p.period }))}>
                Period <span>{sectionOpen.period ? '▲' : '▼'}</span>
              </button>
              {sectionOpen.period && (
                <div style={{ padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <select className="form-select" style={{ fontSize: 11 }}
                    value={filters.month_from ?? ''}
                    onChange={(e) => { setFilters((f) => ({ ...f, month_from: e.target.value || undefined })); setDrill(null); }}>
                    <option value="">From (all)</option>
                    {filterOpts.months.map((m) => (
                      <option key={m.month_key} value={m.month_key}>{m.month_key} {m.month_name}</option>
                    ))}
                  </select>
                  <select className="form-select" style={{ fontSize: 11 }}
                    value={filters.month_to ?? ''}
                    onChange={(e) => { setFilters((f) => ({ ...f, month_to: e.target.value || undefined })); setDrill(null); }}>
                    <option value="">To (all)</option>
                    {filterOpts.months.map((m) => (
                      <option key={m.month_key} value={m.month_key}>{m.month_key} {m.month_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* GL Account + Gen Post Type */}
            <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 14px' }}>
              <GLFilterBar
                accountPrefix={accountPrefix}
                onAccountPrefix={setAccountPrefix}
                genPostType={genPostType}
                onGenPostType={setGenPostType}
              />
            </div>
          </div>
        </div>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>

          {/* Tab bar */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {([
              ['pl',        'By Period'],
              ['entity',    'By Entity'],
              ['accounts',  'By Account'],
              ['dept',      'By Department'],
              ['doctype',   'By Type'],
              ['anomalies', 'Anomalies'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {label}
              </button>
            ))}
          </div>

          {/* ══ Tab: P&L Overview ════════════════════════════════════════════ */}
          {tab === 'pl' && (
            <>
              <ChartCard
                title="Monthly P&L — Revenue vs Costs vs Net Income"
                loading={!!loading.wf} error={!!errors.wf} height={320}
                onClear={drill ? clearAll : undefined}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={waterfall}
                    margin={{ top: 8, right: 60, bottom: 0, left: 10 }}
                    onClick={(data) => {
                      if (!data?.activeLabel) return;
                      const label = String(data.activeLabel);
                      setDrill({ dim: 'month', value: label, label: `Month: ${label}` });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} style={{ cursor: 'pointer' }} />
                    <YAxis yAxisId="l" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="r" orientation="right" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <Tooltip content={<USDTooltip />} />
                    <Legend />
                    <Bar yAxisId="l" dataKey="cogs"      name="COGS"       fill="#f97316" stackId="cost" style={{ cursor: 'pointer' }} />
                    <Bar yAxisId="l" dataKey="opex"      name="OpEx"       fill="#a855f7" stackId="cost" radius={[3,3,0,0]} style={{ cursor: 'pointer' }} />
                    <Line yAxisId="r" type="monotone" dataKey="revenue"    name="Revenue"    stroke="#22c55e" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="r" type="monotone" dataKey="net_income" name="Net Income" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                    <ReferenceLine yAxisId="r" y={0} stroke="var(--color-border)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* KPI detail tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                <KPITile label="Revenue"     value={loading.kpi ? '…' : fmt(kpi?.revenue ?? 0)}    color="#22c55e" sub="4xx accounts" />
                <KPITile label="COGS"        value={loading.kpi ? '…' : fmt(kpi?.cogs ?? 0)}       color="#f97316" sub="5xx accounts" />
                <KPITile label="OpEx"        value={loading.kpi ? '…' : fmt(kpi?.opex ?? 0)}       color="#a855f7" sub="6xx accounts" />
                <KPITile label="Net Income"  value={loading.kpi ? '…' : fmt(kpi?.net_income ?? 0)}
                  color={(kpi?.net_income ?? 0) >= 0 ? '#22c55e' : '#ef4444'} sub="Rev − COGS − OpEx" />
                <KPITile label="GL Entries"  value={loading.kpi ? '…' : (kpi?.entry_count ?? 0).toLocaleString()} color="#8b5cf6" sub="Filtered total" />
              </div>
            </>
          )}

          {/* ══ Tab: By Account ══════════════════════════════════════════════ */}
          {tab === 'accounts' && (
            <>
              <ChartCard
                title="Top 30 GL Accounts by Volume"
                loading={!!loading.top} error={!!errors.top} height={480}
                onClear={drill ? clearAll : undefined}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topAccts}
                    margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
                    onClick={(data) => {
                      if (!data?.activeLabel) return;
                      const row = topAccts.find((r) => r.gl_account_no === data.activeLabel);
                      if (row) setDrill({ dim: 'account', value: row.gl_account_no, label: `Account: ${row.gl_account_no}` });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="gl_account_no" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip
                      content={<USDTooltip />}
                      labelFormatter={(label: string) => {
                        const a = topAccts.find((r) => r.gl_account_no === label);
                        return a?.gl_account_name ?? label;
                      }}
                    />
                    <Bar dataKey="abs_amount" name="Volume" style={{ cursor: 'pointer' }}>
                      {topAccts.map((row, i) => (
                        <Cell key={i} fill={
                          row.gl_account_no.startsWith('4') ? '#22c55e'
                          : row.gl_account_no.startsWith('5') ? '#f97316'
                          : row.gl_account_no.startsWith('6') ? '#a855f7'
                          : row.gl_account_no.startsWith('1') ? '#3b82f6'
                          : row.gl_account_no.startsWith('2') ? '#ef4444'
                          : '#94a3b8'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
                {/* Account category table */}
                <div className="card">
                  <div className="card-title">Account Category Summary</div>
                  <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th style={{ textAlign: 'right' }}>Accounts</th>
                          <th style={{ textAlign: 'right' }}>Entries</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading.acctSum ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                        ) : acctSummary.map((r) => (
                          <tr key={r.category}>
                            <td>
                              <span className="badge" style={{
                                background: `${CAT_COLORS[r.category] ?? '#94a3b8'}22`,
                                color: CAT_COLORS[r.category] ?? '#94a3b8', fontSize: 10,
                              }}>{r.category}</span>
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.account_count}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entry_count.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.display_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Category Pie */}
                <ChartCard title="Category Distribution" loading={!!loading.acctSum} error={!!errors.acctSum} height={280}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={acctSummary.map((r) => ({ name: r.category, value: Math.abs(r.display_amount) }))}
                        dataKey="value" nameKey="name"
                        cx="50%" cy="46%" outerRadius={95} innerRadius={48}
                      >
                        {acctSummary.map((r, i) => (
                          <Cell key={i} fill={CAT_COLORS[r.category] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmt(v), 'Amount']} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </>
          )}

          {/* ══ Tab: By Department ═══════════════════════════════════════════ */}
          {tab === 'dept' && (
            <>
              <ChartCard
                title="Department Spend (Top 20)"
                loading={!!loading.dept} error={!!errors.dept} height={420}
                onClear={drill ? clearAll : undefined}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={deptHeat.slice(0, 20)}
                    margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
                    onClick={(data) => {
                      if (!data?.activeLabel) return;
                      setDrill({ dim: 'category', value: String(data.activeLabel), label: `Dept: ${data.activeLabel}` });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="department_code" tick={{ fontSize: 10 }} width={120}
                      tickFormatter={(v: string) => v?.length > 16 ? v.slice(0, 14) + '…' : v} />
                    <Tooltip content={<USDTooltip />} />
                    <Legend />
                    <Bar dataKey="cogs" name="COGS" fill="#f97316" stackId="s" style={{ cursor: 'pointer' }} />
                    <Bar dataKey="opex" name="OpEx" fill="#a855f7" stackId="s" radius={[0,3,3,0]} style={{ cursor: 'pointer' }} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Department Detail Table</div>
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Vertical</th>
                        <th style={{ textAlign: 'right' }}>COGS</th>
                        <th style={{ textAlign: 'right' }}>OpEx</th>
                        <th style={{ textAlign: 'right' }}>Total Spend</th>
                        <th style={{ textAlign: 'right' }}>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.dept ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : deptHeat.map((r, i) => (
                        <tr key={i} style={{ cursor: 'pointer' }}
                          onClick={() => setDrill({ dim: 'category', value: r.department_code, label: `Dept: ${r.department_code}` })}>
                          <td style={{ fontWeight: 500 }}>{r.department_code}</td>
                          <td style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{r.vertical_code ?? '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.cogs)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.opex)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(r.total_spend)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entry_count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ Tab: By Entity ══════════════════════════════════════════════ */}
          {tab === 'entity' && (
            <>
              <ChartCard
                title="Revenue & Cost by Organisation / Entity"
                loading={!!loading.entity} error={!!errors.entity} height={420}
                onClear={drill ? clearAll : undefined}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={entityContrib}
                    margin={{ top: 4, right: 80, bottom: 4, left: 10 }}
                    onClick={(data) => {
                      if (!data?.activeLabel) return;
                      const row = entityContrib.find((r) => r.company_name === data.activeLabel);
                      if (row) setDrill({ dim: 'company', value: row.company_id, label: `Entity: ${row.company_name}` });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="company_name"
                      tick={{ fontSize: 10 }}
                      width={170}
                      tickFormatter={(v: string) => v?.length > 24 ? v.slice(0, 22) + '…' : v}
                    />
                    <Tooltip content={<USDTooltip />} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#22c55e" style={{ cursor: 'pointer' }} />
                    <Bar dataKey="cogs"    name="COGS"    fill="#f97316" />
                    <Bar dataKey="opex"    name="OpEx"    fill="#a855f7" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Entity Contribution Detail</div>
                <div className="table-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Entity</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>COGS</th>
                        <th style={{ textAlign: 'right' }}>OpEx</th>
                        <th style={{ textAlign: 'right' }}>Gross Margin %</th>
                        <th style={{ textAlign: 'right' }}>Revenue Share %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.entity ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : entityContrib.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data</td></tr>
                      ) : entityContrib.map((r) => (
                        <tr
                          key={r.company_id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDrill({ dim: 'company', value: r.company_id, label: `Entity: ${r.company_name}` })}
                        >
                          <td style={{ fontWeight: 500 }}>{r.company_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#22c55e' }}>{fmt(r.revenue)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.cogs)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.opex)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {r.gross_margin_pct != null ? `${r.gross_margin_pct.toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {r.revenue_share_pct != null ? `${r.revenue_share_pct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ Tab: By Type ═════════════════════════════════════════════════ */}
          {tab === 'doctype' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ChartCard title="Document Type Mix — Entry Count" loading={!!loading.dtype} error={!!errors.dtype} height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={docTypeMix} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="document_type" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<USDTooltip />} />
                      <Bar dataKey="entry_count" name="Entries" radius={[4, 4, 0, 0]}>
                        {docTypeMix.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Vertical P&L — Revenue vs OpEx" loading={!!loading.vpl} error={!!errors.vpl} height={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={vertPL}
                      margin={{ top: 4, right: 40, bottom: 4, left: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                      <YAxis
                        type="category"
                        dataKey="vertical_code"
                        tick={{ fontSize: 10 }}
                        width={80}
                        tickFormatter={(v: string) => v?.length > 12 ? v.slice(0, 10) + '…' : (v || '(none)')}
                      />
                      <Tooltip content={<USDTooltip />} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[0,3,3,0]} />
                      <Bar dataKey="opex"    name="OpEx"    fill="#a855f7" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="card">
                <div className="card-title">Document Type Summary</div>
                <div className="table-wrap">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Document Type</th>
                        <th style={{ textAlign: 'right' }}>Entry Count</th>
                        <th style={{ textAlign: 'right' }}>Total Value</th>
                        <th style={{ textAlign: 'right' }}>% of Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.dtype ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : docTypeMix.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data</td></tr>
                      ) : docTypeMix.map((r, i) => (
                        <tr key={r.document_type}>
                          <td>
                            <span className="badge" style={{ background: `${PIE_COLORS[i % PIE_COLORS.length]}18`, color: PIE_COLORS[i % PIE_COLORS.length], fontSize: 11 }}>
                              {r.document_type || '(none)'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entry_count.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.total_absolute_value)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(r.pct_of_entries ?? 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-title">Vertical / Business Line P&L</div>
                <div className="table-wrap">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Vertical</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>COGS</th>
                        <th style={{ textAlign: 'right' }}>OpEx</th>
                        <th style={{ textAlign: 'right' }}>Entries</th>
                        <th style={{ textAlign: 'right' }}>Entities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.vpl ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : vertPL.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data</td></tr>
                      ) : vertPL.map((r) => (
                        <tr key={r.vertical_code ?? 'none'}>
                          <td style={{ fontWeight: 500 }}>{r.vertical_code || '(unassigned)'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#22c55e' }}>{fmt(r.revenue)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.cogs)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.opex)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entry_count.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entity_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ Tab: Anomalies ═══════════════════════════════════════════════ */}
          {tab === 'anomalies' && (
            <>
              {/* Completeness scorecard */}
              {completeness && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-title">Data Completeness Indicators</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      {
                        label: 'Total Entries',
                        value: completeness.total_entries.toLocaleString(),
                        color: '#3b82f6',
                        note: 'All GL entries',
                      },
                      {
                        label: 'Unnamed Accounts',
                        value: `${((completeness.unnamed_account_entries / completeness.total_entries) * 100).toFixed(1)}%`,
                        color: completeness.unnamed_account_entries > 0 ? '#f97316' : '#22c55e',
                        note: `${completeness.unnamed_account_entries.toLocaleString()} entries`,
                      },
                      {
                        label: 'No Dept Code',
                        value: `${((completeness.no_dept_entries / completeness.total_entries) * 100).toFixed(1)}%`,
                        color: completeness.no_dept_entries > 0 ? '#f59e0b' : '#22c55e',
                        note: `${completeness.no_dept_entries.toLocaleString()} entries`,
                      },
                      {
                        label: 'Suspense Balance',
                        value: fmt(completeness.suspense_net),
                        color: Math.abs(completeness.suspense_net) > 1000 ? '#ef4444' : '#22c55e',
                        note: `${completeness.suspense_entries.toLocaleString()} entries`,
                      },
                    ].map((t) => (
                      <div key={t.label} style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 8, borderLeft: `3px solid ${t.color}` }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{t.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: t.color }}>{t.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{t.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suspense table */}
              <div className="card">
                <div className="card-title">
                  Suspense Account (999999) — Entity Detail
                  {suspense.length > 0 && (
                    <span className="badge badge-error" style={{ marginLeft: 8, fontSize: 11 }}>
                      {suspense.length} entities
                    </span>
                  )}
                </div>
                {suspense.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                    No suspense entries found — ledger is clean.
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Entity</th>
                          <th style={{ textAlign: 'right' }}>Entries</th>
                          <th style={{ textAlign: 'right' }}>Net Balance</th>
                          <th>Earliest</th>
                          <th>Latest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suspense.map((r) => (
                          <tr key={r.company_id}>
                            <td style={{ fontWeight: 500 }}>{r.company_name}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entry_count.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: Math.abs(r.net_balance) > 1000 ? 'var(--color-error)' : 'var(--color-text)' }}>
                              {fmt(r.net_balance)}
                            </td>
                            <td style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{r.earliest?.toString().slice(0, 10)}</td>
                            <td style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{r.latest?.toString().slice(0, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Summary banner */}
                {suspense.length > 0 && (
                  <div style={{
                    marginTop: 12, padding: '8px 12px',
                    background: 'rgba(239,68,68,0.07)', borderRadius: 6,
                    border: '1px solid rgba(239,68,68,0.2)', fontSize: 12,
                    display: 'flex', gap: 16, alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-error)' }}>Suspense 999999</span>
                    <span>Total entries: <strong>{suspense.reduce((s, r) => s + r.entry_count, 0).toLocaleString()}</strong></span>
                    <span>Net balance: <strong style={{ color: 'var(--color-error)' }}>
                      {fmt(suspense.reduce((s, r) => s + r.net_balance, 0))}
                    </strong></span>
                    <span style={{ color: 'var(--color-text-muted)' }}>Review and reclassify in BC</span>
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
