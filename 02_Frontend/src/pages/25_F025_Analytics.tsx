/**
 * F025 — Analytics & Insights (Star Schema Edition)
 * PowerBI-style filter panel + 5 content tabs, all powered by PostgreSQL star schema.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, AreaChart, BarChart, LineChart, PieChart,
  Bar, Area, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api, type GLFilters, type FilterOptions, type KPISummary } from '../api/client';
import type {
  PLWaterfallRow, EntityContributionRow, RollingTrendRow,
  DeptHeatmapRow, TopAccountRow, DocTypeMixRow, SuspenseRow,
  MoMChangeRow, EntityCoverageRow, CurrencySplitRow,
} from '../api/client';

// ── Colour palette ─────────────────────────────────────────────────────────────
const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
  '#a855f7','#fb923c','#22d3ee','#fbbf24','#4ade80',
  '#f43f5e','#818cf8',
];
const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtM(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n), s = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toFixed(0)}`;
}
function pct(n: number | null | undefined, dp = 1): string {
  if (n == null) return '—';
  return `${n >= 0 ? '' : ''}${n.toFixed(dp)}%`;
}
// ── Sub-components ─────────────────────────────────────────────────────────────

function ChartCard({ title, loading, error, height = 300, children, actions }: {
  title: string; loading?: boolean; error?: boolean; height?: number;
  children: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>{title}</div>
        {actions}
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

function USDTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{fmtM(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function KPITile({ label, value, sub, color = 'var(--color-primary)' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'pl' | 'trends' | 'costs' | 'entities' | 'insights';

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Analytics() {
  // Filter panel state
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ companies: [], years: [], months: [], currencies: [], account_categories: [] });
  const [filters, setFilters] = useState<GLFilters>({});
  const [companySearch, setCompanySearch] = useState('');
  const [filterOpen, setFilterOpen] = useState({ company: true, period: true, currency: false, glgroup: false });

  // Tab
  const [tab, setTab] = useState<Tab>('pl');

  // KPI summary
  const [kpi, setKpi] = useState<KPISummary | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Data per tab
  const [waterfall, setWaterfall]       = useState<PLWaterfallRow[]>([]);
  const [contribution, setContribution] = useState<EntityContributionRow[]>([]);
  const [rolling, setRolling]           = useState<RollingTrendRow[]>([]);
  const [mom, setMom]                   = useState<MoMChangeRow[]>([]);
  const [deptHeat, setDeptHeat]         = useState<DeptHeatmapRow[]>([]);
  const [topAccts, setTopAccts]         = useState<TopAccountRow[]>([]);
  const [acctPrefix, setAcctPrefix]     = useState('');
  const [docMix, setDocMix]             = useState<DocTypeMixRow[]>([]);
  const [coverage, setCoverage]         = useState<EntityCoverageRow[]>([]);
  const [suspense, setSuspense]         = useState<SuspenseRow[]>([]);
  const [currSplit, setCurrSplit]       = useState<CurrencySplitRow[]>([]);

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors]   = useState<Record<string, boolean>>({});
  const L = (k: string, v: boolean) => setLoading((p) => ({ ...p, [k]: v }));
  const E = (k: string, v: boolean) => setErrors((p) => ({ ...p, [k]: v }));

  // Load filter options once
  useEffect(() => {
    api.analytics.filters().then(setFilterOpts).catch(() => null);
    api.analytics.suspenseMonitor().then(setSuspense).catch(() => null);
  }, []);

  // KPI tiles — reload on every filter change
  useEffect(() => {
    setKpiLoading(true);
    api.analytics.kpiSummary(filters)
      .then(setKpi).catch(() => null).finally(() => setKpiLoading(false));
  }, [filters]);

  // Per-tab data loads
  useEffect(() => {
    if (tab !== 'pl') return;
    L('wf', true); L('ec', true);
    api.analytics.plWaterfall(filters).then(setWaterfall).catch(() => E('wf', true)).finally(() => L('wf', false));
    api.analytics.entityContribution(filters).then(setContribution).catch(() => E('ec', true)).finally(() => L('ec', false));
  }, [tab, filters]);

  useEffect(() => {
    if (tab !== 'trends') return;
    L('roll', true); L('mom', true);
    api.analytics.rollingTrend(filters).then(setRolling).catch(() => E('roll', true)).finally(() => L('roll', false));
    api.analytics.momChange().then(setMom).catch(() => E('mom', true)).finally(() => L('mom', false));
  }, [tab, filters]);

  const loadCosts = useCallback(() => {
    L('dept', true); L('top', true); L('doc', true);
    api.analytics.deptHeatmap(filters).then(setDeptHeat).catch(() => E('dept', true)).finally(() => L('dept', false));
    api.analytics.topAccounts(filters, acctPrefix, 20).then(setTopAccts).catch(() => E('top', true)).finally(() => L('top', false));
    api.analytics.docTypeMix(filters).then(setDocMix).catch(() => E('doc', true)).finally(() => L('doc', false));
  }, [tab, filters, acctPrefix]);
  useEffect(() => { if (tab === 'costs') loadCosts(); }, [loadCosts]);

  useEffect(() => {
    if (tab !== 'entities') return;
    L('ec2', true);
    api.analytics.entityContribution(filters).then(setContribution).catch(() => E('ec2', true)).finally(() => L('ec2', false));
  }, [tab, filters]);

  useEffect(() => {
    if (tab !== 'insights') return;
    L('cov', true); L('cur', true);
    api.analytics.entityCoverage().then(setCoverage).catch(() => E('cov', true)).finally(() => L('cov', false));
    api.analytics.currencySplit(filters).then(setCurrSplit).catch(() => E('cur', true)).finally(() => L('cur', false));
  }, [tab, filters]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const allCodes  = [...new Set(rolling.map((r) => r.company_id))];
  const allMonths = [...new Set(rolling.map((r) => r.month))].sort();
  const pivoted   = allMonths.map((m) => {
    const row: Record<string, string | number> = { month: m };
    rolling.filter((r) => r.month === m).forEach((r) => { row[String(r.company_id)] = r.revenue; });
    return row;
  });
  const top5ids = [...contribution].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((c) => c.company_id);
  const companyById = Object.fromEntries(filterOpts.companies.map((c) => [c.company_id, c.company_name]));

  // Active filter count for badge
  const activeFilters: string[] = [];
  if ((filters.company_ids ?? []).length > 0) activeFilters.push(`${filters.company_ids!.length} compan${filters.company_ids!.length === 1 ? 'y' : 'ies'}`);
  if (filters.year) activeFilters.push(`FY ${filters.year}`);
  if (filters.month_from || filters.month_to) activeFilters.push(`${filters.month_from ?? '…'} → ${filters.month_to ?? '…'}`);
  if (filters.account_category) activeFilters.push(filters.account_category);

  function resetFilters() { setFilters({}); setCompanySearch(''); }

  function toggleCompany(id: number) {
    const cur = filters.company_ids ?? [];
    setFilters((f) => ({
      ...f,
      company_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    }));
  }
  function toggleAllCompanies() {
    const all = filterOpts.companies.map((c) => c.company_id);
    const cur = filters.company_ids ?? [];
    setFilters((f) => ({ ...f, company_ids: cur.length === all.length ? [] : all }));
  }

  const filteredCompanies = filterOpts.companies.filter((c) =>
    c.company_name.toLowerCase().includes(companySearch.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Page header */}
      <div className="page-header" style={{ paddingBottom: 12 }}>
        <h1 className="page-title">Analytics &amp; Insights</h1>
        <p className="page-subtitle">Star schema · 188,380 GL entries · 17 entities · powered by PostgreSQL</p>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, padding: '0 0 16px' }}>
        <KPITile label="Total Revenue"  value={kpiLoading ? '…' : fmtM(kpi?.revenue ?? 0)} sub="All 4xx accounts" color="#3b82f6" />
        <KPITile label="COGS"           value={kpiLoading ? '…' : fmtM(kpi?.cogs ?? 0)}    sub="5xx accounts"     color="#f97316" />
        <KPITile label="OpEx"           value={kpiLoading ? '…' : fmtM(kpi?.opex ?? 0)}    sub="6xx accounts"     color="#ef4444" />
        <KPITile label="Net Income"     value={kpiLoading ? '…' : fmtM(kpi?.net_income ?? 0)} sub="Rev − COGS − OpEx"
          color={(kpi?.net_income ?? 0) >= 0 ? '#10b981' : '#ef4444'} />
        <KPITile label="GL Entries"     value={kpiLoading ? '…' : (kpi?.entry_count ?? 0).toLocaleString()} sub="Matching filter" color="#8b5cf6" />
        <KPITile label="Entities"       value={kpiLoading ? '…' : String(kpi?.entity_count ?? 0)} sub="Active companies" color="#06b6d4" />
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Active filters:</span>
          {activeFilters.map((f) => (
            <span key={f} style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{f}</span>
          ))}
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={resetFilters}>Clear all</button>
        </div>
      )}

      {/* Suspense banner */}
      {suspense.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: 'var(--color-error)' }}>⚠ Suspense 999999</span>
          <span>Entries: <strong>{suspense.reduce((s, r) => s + r.entry_count, 0).toLocaleString()}</strong></span>
          <span>Net balance: <strong>{fmtM(suspense.reduce((s, r) => s + r.net_balance, 0))}</strong></span>
          <span style={{ color: 'var(--color-text-muted)' }}>{suspense.length} entities · review for reclassification</span>
        </div>
      )}

      {/* Main layout: filter panel + content */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Filter panel ─────────────────────────────────────────────────── */}
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 0 }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-primary)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Filters {activeFilters.length > 0 && <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '1px 7px', marginLeft: 4, fontSize: 11 }}>{activeFilters.length}</span>}</span>
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 11 }} onClick={resetFilters}>Reset</button>
            </div>

            {/* Company filter */}
            <div style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => setFilterOpen((p) => ({ ...p, company: !p.company }))}>
                Companies <span>{filterOpen.company ? '▲' : '▼'}</span>
              </button>
              {filterOpen.company && (
                <div style={{ padding: '0 10px 10px' }}>
                  <input
                    placeholder="Search…"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box', marginBottom: 6 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '2px 0', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: 6, marginBottom: 4 }}>
                    <input type="checkbox" checked={(filters.company_ids ?? []).length === filterOpts.companies.length && filterOpts.companies.length > 0}
                      onChange={toggleAllCompanies} style={{ accentColor: 'var(--color-primary)' }} />
                    All companies ({filterOpts.companies.length})
                  </label>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {filteredCompanies.map((c) => (
                      <label key={c.company_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0' }}>
                        <input type="checkbox" checked={(filters.company_ids ?? []).includes(c.company_id)}
                          onChange={() => toggleCompany(c.company_id)} style={{ accentColor: 'var(--color-primary)' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Period filter */}
            <div style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => setFilterOpen((p) => ({ ...p, period: !p.period }))}>
                Period <span>{filterOpen.period ? '▲' : '▼'}</span>
              </button>
              {filterOpen.period && (
                <div style={{ padding: '0 10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Year</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    <button className={`btn btn-sm ${!filters.year ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setFilters((f) => ({ ...f, year: undefined }))}>All</button>
                    {filterOpts.years.map((y) => (
                      <button key={y} className={`btn btn-sm ${filters.year === y ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => setFilters((f) => ({ ...f, year: f.year === y ? undefined : y }))}>
                        {y}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Month Range</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <select className="form-select" style={{ fontSize: 11 }} value={filters.month_from ?? ''}
                      onChange={(e) => setFilters((f) => ({ ...f, month_from: e.target.value || undefined }))}>
                      <option value="">From (all)</option>
                      {filterOpts.months.map((m) => <option key={m.month_key} value={m.month_key}>{m.month_key} {m.month_name}</option>)}
                    </select>
                    <select className="form-select" style={{ fontSize: 11 }} value={filters.month_to ?? ''}
                      onChange={(e) => setFilters((f) => ({ ...f, month_to: e.target.value || undefined }))}>
                      <option value="">To (all)</option>
                      {filterOpts.months.map((m) => <option key={m.month_key} value={m.month_key}>{m.month_key} {m.month_name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Currency filter */}
            <div style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => setFilterOpen((p) => ({ ...p, currency: !p.currency }))}>
                Currency <span>{filterOpen.currency ? '▲' : '▼'}</span>
              </button>
              {filterOpen.currency && (
                <div style={{ padding: '0 10px 10px', fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {filterOpts.currencies.map((c) => (
                    <div key={c.currency_code} style={{ padding: '2px 0' }}>{c.currency_code} — {c.currency_name}</div>
                  ))}
                  <div style={{ marginTop: 6, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Use Entity filter to isolate a currency</div>
                </div>
              )}
            </div>

            {/* GL Group filter */}
            {filterOpts.account_categories?.length > 0 && (
              <div>
                <button style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                  onClick={() => setFilterOpen((p) => ({ ...p, glgroup: !p.glgroup }))}>
                  GL Group <span>{filterOpen.glgroup ? '▲' : '▼'}</span>
                </button>
                {filterOpen.glgroup && (
                  <div style={{ padding: '0 10px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <button className={`btn btn-sm ${!filters.account_category ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => setFilters((f) => ({ ...f, account_category: undefined }))}>All</button>
                      {filterOpts.account_categories.map((cat) => (
                        <button key={cat}
                          className={`btn btn-sm ${filters.account_category === cat ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: 10, padding: '2px 8px' }}
                          onClick={() => setFilters((f) => ({ ...f, account_category: f.account_category === cat ? undefined : cat }))}
                        >{cat}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>

          {/* Tab bar */}
          <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
            <div className="tabs" style={{ margin: 0, borderBottom: '1px solid var(--color-border)' }}>
              {([
                ['pl',       'P&L Overview'],
                ['trends',   'Trends'],
                ['costs',    'Cost Anatomy'],
                ['entities', 'Entities'],
                ['insights', 'Insights'],
              ] as [Tab, string][]).map(([t, label]) => (
                <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{label}</div>
              ))}
            </div>
          </div>

          {/* ── Tab: P&L Overview ──────────────────────────────────────────── */}
          {tab === 'pl' && (
            <>
              <ChartCard title="Monthly Revenue vs Costs vs Net Income" loading={!!loading.wf} error={!!errors.wf} height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={waterfall} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="l" tickFormatter={fmtM} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="r" orientation="right" tickFormatter={fmtM} tick={{ fontSize: 10 }} />
                    <Tooltip content={<USDTip />} />
                    <Legend />
                    <Bar yAxisId="l" dataKey="cogs"      name="COGS"      fill="#f97316" stackId="cost" />
                    <Bar yAxisId="l" dataKey="opex"      name="OpEx"      fill="#ef4444" stackId="cost" />
                    <Bar yAxisId="l" dataKey="tax"       name="Tax"       fill="#94a3b8" stackId="cost" />
                    <Line yAxisId="r" type="monotone" dataKey="revenue"    name="Revenue"    stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="r" type="monotone" dataKey="net_income" name="Net Income" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                    <ReferenceLine yAxisId="r" y={0} stroke="var(--color-border)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              {waterfall.length > 0 && (
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Month</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Revenue</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>COGS</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>OpEx</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Net Income</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waterfall.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '5px 10px' }}>{row.month}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.revenue)}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.cogs)}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.opex)}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: (row.net_income ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{fmtM(row.net_income)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
                <ChartCard title="Entity Revenue Ranking" loading={!!loading.ec} error={!!errors.ec} height={380}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart layout="vertical" data={contribution.slice(0, 12)} margin={{ top: 0, right: 60, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="company_name" tick={{ fontSize: 9 }} width={130}
                        tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + '…' : v} />
                      <Tooltip content={<USDTip />} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" />
                      <Bar dataKey="opex"    name="OpEx"    fill="#ef4444" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  {contribution.length > 0 && (
                    <div style={{ overflowX: 'auto', marginTop: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Entity</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Revenue</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>OpEx</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contribution.slice(0, 12).map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '5px 10px' }}>{row.company_name}</td>
                              <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.revenue)}</td>
                              <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.opex)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ChartCard>

                <ChartCard title="Revenue Share" loading={!!loading.ec} error={!!errors.ec} height={380}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={contribution.filter((c) => c.revenue > 0).slice(0, 10)}
                        dataKey="revenue" nameKey="company_name"
                        cx="50%" cy="45%" outerRadius={110} innerRadius={55}>
                        {contribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmtM(v), 'Revenue']} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {contribution.length > 0 && (() => {
                    const totalRevenue = contribution.reduce((s, c) => s + c.revenue, 0);
                    return (
                      <div style={{ overflowX: 'auto', marginTop: 12 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Entity</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Revenue</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>% Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contribution.filter((c) => c.revenue > 0).slice(0, 10).map((row, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '5px 10px' }}>{row.company_name}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.revenue)}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{pct(totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </ChartCard>
              </div>

              {/* Insight tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {contribution.slice(0, 4).map((e, i) => (
                  <div key={e.company_id} className="card" style={{ padding: '12px 14px', borderLeft: `3px solid ${COLORS[i]}` }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.company_name}</div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{fmtM(e.revenue)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {pct(e.revenue_share_pct)} of group · GM {pct(e.gross_margin_pct)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Tab: Trends ─────────────────────────────────────────────────── */}
          {tab === 'trends' && (
            <>
              <ChartCard title="Monthly Revenue by Entity (Top 5)" loading={!!loading.roll} error={!!errors.roll} height={340}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pivoted} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} />
                    <Tooltip content={<USDTip />} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }}
                      formatter={(val: string) => companyById[Number(val)] ?? val} />
                    {top5ids.map((id, i) => (
                      <Line key={id} type="monotone" dataKey={String(id)}
                        name={String(id)}
                        stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              {pivoted.length > 0 && top5ids.length > 0 && (
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Month</th>
                        {top5ids.map((id) => (
                          <th key={id} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                            {companyById[id] ?? String(id)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pivoted.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '5px 10px' }}>{row.month}</td>
                          {top5ids.map((id) => (
                            <td key={id} style={{ padding: '5px 10px', textAlign: 'right' }}>
                              {row[String(id)] != null ? fmtM(row[String(id)] as number) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {allCodes.length > 5 && (
                <>
                  <ChartCard title="Monthly Revenue — All Entities" loading={!!loading.roll} error={!!errors.roll} height={320}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={pivoted} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} />
                        <Tooltip content={<USDTip />} />
                        {allCodes.map((id, i) => (
                          <Area key={id} type="monotone" dataKey={String(id)}
                            name={companyById[id] ?? String(id)}
                            stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
                            fillOpacity={0.08} strokeWidth={1.5} dot={false} connectNulls />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  {pivoted.length > 0 && (
                    <div style={{ overflowX: 'auto', marginTop: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Month</th>
                            {top5ids.map((id) => (
                              <th key={id} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                                {companyById[id] ?? String(id)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pivoted.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '5px 10px' }}>{row.month}</td>
                              {top5ids.map((id) => (
                                <td key={id} style={{ padding: '5px 10px', textAlign: 'right' }}>
                                  {row[String(id)] != null ? fmtM(row[String(id)] as number) : '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              <ChartCard title="Month-over-Month Revenue Change (Latest Period)" loading={!!loading.mom} error={!!errors.mom} height={360}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={mom} margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="company_name" tick={{ fontSize: 9 }} width={130}
                      tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + '…' : v} />
                    <Tooltip content={<USDTip />} />
                    <ReferenceLine x={0} stroke="var(--color-border)" />
                    <Bar dataKey="revenue_delta" name="Revenue Δ">
                      {mom.map((r, i) => <Cell key={i} fill={r.revenue_delta >= 0 ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {mom.length > 0 && (
                <div className="card">
                  <div className="card-title">MoM Detail Table</div>
                  <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Entity</th>
                          <th style={{ textAlign: 'right' }}>Current Rev</th>
                          <th style={{ textAlign: 'right' }}>Prior Rev</th>
                          <th style={{ textAlign: 'right' }}>Δ Revenue</th>
                          <th style={{ textAlign: 'right' }}>Δ %</th>
                          <th style={{ textAlign: 'right' }}>Current OpEx</th>
                          <th style={{ textAlign: 'right' }}>OpEx Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mom.map((r) => (
                          <tr key={r.company_id}>
                            <td style={{ fontWeight: 500 }}>{r.company_name}</td>
                            <td style={{ textAlign: 'right' }}>{fmtM(r.current_revenue)}</td>
                            <td style={{ textAlign: 'right' }}>{fmtM(r.prior_revenue)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: r.revenue_delta >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                              {r.revenue_delta >= 0 ? '+' : ''}{fmtM(r.revenue_delta)}
                            </td>
                            <td style={{ textAlign: 'right', color: (r.revenue_delta_pct ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                              {r.revenue_delta_pct != null ? `${r.revenue_delta_pct >= 0 ? '+' : ''}${r.revenue_delta_pct.toFixed(1)}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>{fmtM(r.current_opex)}</td>
                            <td style={{ textAlign: 'right', color: r.opex_delta >= 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                              {r.opex_delta >= 0 ? '+' : ''}{fmtM(r.opex_delta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab: Cost Anatomy ───────────────────────────────────────────── */}
          {tab === 'costs' && (
            <>
              <ChartCard title="Top GL Accounts by Absolute Volume"
                loading={!!loading.top} error={!!errors.top} height={450}
                actions={
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['', 'All'], ['4', 'Revenue'], ['5', 'COGS'], ['6', 'OpEx'], ['7', 'Other']].map(([prefix, label]) => (
                      <button key={label} className={`btn btn-sm ${acctPrefix === prefix ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setAcctPrefix(prefix)}>{label}</button>
                    ))}
                  </div>
                }>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topAccts} margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="gl_account_no" tick={{ fontSize: 10 }} width={80}
                      tickFormatter={(v: string) => v} />
                    <Tooltip content={<USDTip />}
                      labelFormatter={(label: string) => {
                        const acct = topAccts.find((a) => a.gl_account_no === label);
                        return acct?.gl_account_name ?? label;
                      }} />
                    <Bar dataKey="abs_amount" name="Volume">
                      {topAccts.map((row, i) => (
                        <Cell key={i} fill={
                          row.gl_account_no.startsWith('4') ? '#3b82f6'
                          : row.gl_account_no.startsWith('5') ? '#f97316'
                          : row.gl_account_no.startsWith('6') ? '#ef4444'
                          : row.gl_account_no.startsWith('1') ? '#10b981'
                          : row.gl_account_no.startsWith('2') ? '#f59e0b'
                          : '#94a3b8'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              {topAccts.length > 0 && (
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Account No</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Account Name</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAccts.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace' }}>{row.gl_account_no}</td>
                          <td style={{ padding: '5px 10px' }}>{row.gl_account_name}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.abs_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ChartCard title="Department Spend — COGS vs OpEx (Top 15)" loading={!!loading.dept} error={!!errors.dept} height={360}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={deptHeat.slice(0, 15)} margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="department_code" tick={{ fontSize: 10 }} width={110}
                        tickFormatter={(v: string) => v?.length > 15 ? v.slice(0, 13) + '…' : v} />
                      <Tooltip content={<USDTip />} />
                      <Legend />
                      <Bar dataKey="cogs" name="COGS" fill="#f97316" stackId="s" />
                      <Bar dataKey="opex" name="OpEx" fill="#ef4444" stackId="s" />
                    </BarChart>
                  </ResponsiveContainer>
                  {deptHeat.length > 0 && (
                    <div style={{ overflowX: 'auto', marginTop: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Department</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>COGS</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>OpEx</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deptHeat.slice(0, 15).map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '5px 10px' }}>{row.department_code}</td>
                              <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.cogs)}</td>
                              <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.opex)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ChartCard>

                <ChartCard title="Transaction Type Mix" loading={!!loading.doc} error={!!errors.doc} height={360}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={docMix} dataKey="entry_count" nameKey="document_type"
                        cx="50%" cy="42%" outerRadius={110} innerRadius={50}>
                        {docMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v.toLocaleString()} entries`]} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {docMix.length > 0 && (() => {
                    const totalEntries = docMix.reduce((s, r) => s + r.entry_count, 0);
                    return (
                      <div style={{ overflowX: 'auto', marginTop: 12 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Count</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {docMix.map((row, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '5px 10px' }}>{row.document_type}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{row.entry_count.toLocaleString()}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{pct(totalEntries > 0 ? (row.entry_count / totalEntries) * 100 : 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </ChartCard>
              </div>
            </>
          )}

          {/* ── Tab: Entities ───────────────────────────────────────────────── */}
          {tab === 'entities' && (
            <>
              <ChartCard title="Entity P&L Comparison" loading={!!loading.ec2} error={!!errors.ec2} height={380}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contribution} margin={{ top: 8, right: 20, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="company_name" tick={{ fontSize: 8 } as React.SVGProps<SVGTextElement>}
                      angle={-35} textAnchor="end"
                      tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 14) + '…' : v} />
                    <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} />
                    <Tooltip content={<USDTip />} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" />
                    <Bar dataKey="cogs"    name="COGS"    fill="#f97316" />
                    <Bar dataKey="opex"    name="OpEx"    fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Entity Contribution Table</div>
                <div className="table-wrap">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Entity</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                        <th style={{ textAlign: 'right' }}>COGS</th>
                        <th style={{ textAlign: 'right' }}>OpEx</th>
                        <th style={{ textAlign: 'right' }}>Net</th>
                        <th style={{ textAlign: 'right' }}>GM %</th>
                        <th style={{ textAlign: 'right' }}>Rev Share</th>
                        <th style={{ textAlign: 'right', width: 80 }}>Rev Bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contribution.map((e) => {
                        const net = e.revenue - e.cogs - e.opex;
                        const maxRev = Math.max(...contribution.map((x) => x.revenue));
                        const pctBar = maxRev > 0 ? (e.revenue / maxRev) * 100 : 0;
                        return (
                          <tr key={e.company_id}>
                            <td style={{ fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.company_name}</td>
                            <td style={{ textAlign: 'right' }}>{fmtM(e.revenue)}</td>
                            <td style={{ textAlign: 'right' }}>{fmtM(e.cogs)}</td>
                            <td style={{ textAlign: 'right' }}>{fmtM(e.opex)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: net >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{fmtM(net)}</td>
                            <td style={{ textAlign: 'right', color: (e.gross_margin_pct ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{pct(e.gross_margin_pct)}</td>
                            <td style={{ textAlign: 'right' }}>{pct(e.revenue_share_pct)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pctBar}%`, background: '#3b82f6', borderRadius: 4 }} />
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

          {/* ── Tab: Insights ───────────────────────────────────────────────── */}
          {tab === 'insights' && (
            <>
              {/* Data quality */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">Data Quality Scorecard</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Total GL Entries', value: (188380).toLocaleString(), color: '#3b82f6', note: 'All 17 entities' },
                    { label: 'No Department', value: (suspense.reduce((s, r) => s + r.entry_count, 0)).toLocaleString(), color: '#f59e0b', note: 'Missing dept code' },
                    { label: 'Suspense Balance', value: fmtM(suspense.reduce((s, r) => s + r.net_balance, 0)), color: Math.abs(suspense.reduce((s, r) => s + r.net_balance, 0)) > 1000 ? '#ef4444' : '#10b981', note: 'Account 999999 net' },
                  ].map((t) => (
                    <div key={t.label} style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 8, borderLeft: `3px solid ${t.color}` }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{t.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: t.color }}>{t.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{t.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ChartCard title="Entity Data Coverage (Months of Data)" loading={!!loading.cov} error={!!errors.cov} height={360}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={coverage} margin={{ top: 0, right: 60, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" domain={[0, 12]} tick={{ fontSize: 10 }} label={{ value: 'Months', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                      <YAxis type="category" dataKey="company_name" tick={{ fontSize: 9 }} width={130}
                        tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + '…' : v} />
                      <Tooltip formatter={(v: number, name: string) => [v, name]} />
                      <Bar dataKey="months_present" name="Months of data">
                        {coverage.map((row, i) => (
                          <Cell key={i} fill={row.months_present >= 10 ? '#10b981' : row.months_present >= 6 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {coverage.length > 0 && (
                    <div style={{ overflowX: 'auto', marginTop: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Entity</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Months Present</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coverage.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '5px 10px' }}>{row.company_name}</td>
                              <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: row.months_present >= 10 ? 'var(--color-success)' : row.months_present >= 6 ? '#f59e0b' : 'var(--color-error)' }}>
                                {row.months_present}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ChartCard>

                <ChartCard title="Currency Distribution" loading={!!loading.cur} error={!!errors.cur} height={360}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={currSplit} dataKey="total_volume" nameKey="currency_code"
                        cx="50%" cy="42%" outerRadius={110} innerRadius={50}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {currSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmtM(v), 'Volume']} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {currSplit.length > 0 && (() => {
                    const totalVolume = currSplit.reduce((s, r) => s + r.total_volume, 0);
                    return (
                      <div style={{ overflowX: 'auto', marginTop: 12 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Currency</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Volume</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currSplit.map((row, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '5px 10px', fontWeight: 600 }}>{row.currency_code}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtM(row.total_volume)}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{pct(totalVolume > 0 ? (row.total_volume / totalVolume) * 100 : 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </ChartCard>
              </div>

              {/* Suspense detail table */}
              {suspense.length > 0 && (
                <div className="card">
                  <div className="card-title">Suspense Account (999999) — Entity Detail</div>
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
                            <td style={{ textAlign: 'right' }}>{r.entry_count.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: Math.abs(r.net_balance) > 1000 ? 'var(--color-error)' : 'var(--color-text)', fontWeight: 600 }}>
                              {fmtM(r.net_balance)}
                            </td>
                            <td style={{ color: 'var(--color-text-muted)' }}>{r.earliest?.toString().slice(0, 10)}</td>
                            <td style={{ color: 'var(--color-text-muted)' }}>{r.latest?.toString().slice(0, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
