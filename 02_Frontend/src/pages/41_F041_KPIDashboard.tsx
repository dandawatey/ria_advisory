/**
 * F041 — Financial Ratios & KPI Dashboard
 * Source: fact_gl_entries (P&L) + fact_coa_balances (B/S)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { get, type FilterOptions } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ratios {
  revenue: number; cogs: number; opex: number; net_income: number;
  gross_margin_pct: number | null; net_margin_pct: number | null;
  ebitda_margin_pct: number | null; opex_ratio_pct: number | null;
  current_ratio: number | null; debt_equity: number | null;
  revenue_per_entity: number | null; expense_per_entity: number | null;
  entity_count: number;
}
interface TrendRow {
  year: number; month: number; month_name: string; month_key: string;
  revenue: number; cogs: number; opex: number; net_income: number;
}
interface EntityRow {
  company_name: string; revenue: number; cogs: number; opex: number; net_income: number;
  gross_margin_pct: number | null; net_margin_pct: number | null; opex_ratio_pct: number | null;
}

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
function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}
function fmtX(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(2)}×`;
}

// Threshold-based colour: higher_is_better thresholds [green, amber]
type ColourRule = { green: number; amber: number; higherIsBetter: boolean };
const THRESHOLDS: Record<string, ColourRule> = {
  gross_margin_pct:  { green: 40,   amber: 20,  higherIsBetter: true  },
  net_margin_pct:    { green: 15,   amber: 5,   higherIsBetter: true  },
  ebitda_margin_pct: { green: 20,   amber: 10,  higherIsBetter: true  },
  opex_ratio_pct:    { green: 10,   amber: 25,  higherIsBetter: false },
  current_ratio:     { green: 2.0,  amber: 1.0, higherIsBetter: true  },
  debt_equity:       { green: 0.5,  amber: 2.0, higherIsBetter: false },
};

function ratioColor(key: string, value: number | null): string {
  if (value == null) return '#94a3b8';
  const t = THRESHOLDS[key];
  if (!t) return '#3b82f6';
  const { green, amber, higherIsBetter } = t;
  if (higherIsBetter) return value >= green ? '#10b981' : value >= amber ? '#f59e0b' : '#ef4444';
  return value <= green ? '#10b981' : value <= amber ? '#f59e0b' : '#ef4444';
}

// ── Sub-components ────────────────────────────────────────────────────────────
function RatioTile({ label, value, colorKey, raw }: {
  label: string; value: string; colorKey: string; raw: number | null;
}) {
  const color = ratioColor(colorKey, raw);
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, marginTop: 4, color }}>
        {color === '#10b981' ? '▲ Healthy' : color === '#f59e0b' ? '~ Watch' : '▼ Below target'}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function KPIDashboard() {
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ companies: [], years: [], months: [], currencies: [], account_categories: [] });
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [accountCategory, setAccountCategory] = useState<string>('');
  const [tab, setTab] = useState<'overview' | 'trend' | 'entity'>('overview');

  const [ratios, setRatios]     = useState<Ratios | null>(null);
  const [trend, setTrend]       = useState<TrendRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loadR, setLoadR] = useState(true);
  const [loadT, setLoadT] = useState(false);
  const [loadE, setLoadE] = useState(false);

  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilterOpts).catch(() => {});
  }, []);

  const buildQS = useCallback(() => {
    const qs = new URLSearchParams();
    selectedCompanies.forEach((id) => qs.append('company_id', String(id)));
    if (year)            qs.set('year',             String(year));
    if (accountCategory) qs.set('account_category', accountCategory);
    return qs;
  }, [selectedCompanies, year, accountCategory]);

  useEffect(() => {
    setLoadR(true);
    get<Ratios>(`/api/reports/kpi-ratios?${buildQS()}`)
      .then(setRatios).catch(() => setRatios(null)).finally(() => setLoadR(false));
  }, [buildQS]);

  useEffect(() => {
    if (tab !== 'trend') return;
    setLoadT(true);
    const qs = new URLSearchParams();
    selectedCompanies.forEach((id) => qs.append('company_id', String(id)));
    get<TrendRow[]>(`/api/reports/kpi-ratios/trend?${qs}`)
      .then(setTrend).catch(() => setTrend([])).finally(() => setLoadT(false));
  }, [tab, selectedCompanies]);

  useEffect(() => {
    if (tab !== 'entity') return;
    setLoadE(true);
    get<EntityRow[]>(`/api/reports/kpi-ratios/by-entity?${buildQS()}`)
      .then(setEntities).catch(() => setEntities([])).finally(() => setLoadE(false));
  }, [tab, buildQS]);

  const chip = (active: boolean) => ({
    padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#3b82f6' : 'var(--color-border)',
    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: active ? '#3b82f6' : 'inherit', fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  });

  const tabStyle = (t: string) => ({
    padding: '6px 16px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
    border: '1px solid', borderColor: tab === t ? '#3b82f6' : 'var(--color-border)',
    background: tab === t ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: tab === t ? '#3b82f6' : 'inherit', fontWeight: tab === t ? 600 : 400,
  });

  // Compute trend with margin %
  const trendWithRatios = trend.map((r) => ({
    ...r,
    gross_margin_pct: r.revenue > 0 ? +((r.revenue - r.cogs) / r.revenue * 100).toFixed(1) : null,
    net_margin_pct:   r.revenue > 0 ? +(r.net_income / r.revenue * 100).toFixed(1) : null,
  }));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Financial KPI Dashboard</h1>
        <p className="page-subtitle">Profitability · Liquidity · Leverage ratios across entities</p>
      </div>

      {/* KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <RatioTile label="Gross Margin"  value={fmtPct(ratios?.gross_margin_pct)}  colorKey="gross_margin_pct"  raw={ratios?.gross_margin_pct ?? null} />
        <RatioTile label="Net Margin"    value={fmtPct(ratios?.net_margin_pct)}    colorKey="net_margin_pct"    raw={ratios?.net_margin_pct ?? null} />
        <RatioTile label="EBITDA Margin" value={fmtPct(ratios?.ebitda_margin_pct)} colorKey="ebitda_margin_pct" raw={ratios?.ebitda_margin_pct ?? null} />
        <RatioTile label="OpEx Ratio"    value={fmtPct(ratios?.opex_ratio_pct)}    colorKey="opex_ratio_pct"    raw={ratios?.opex_ratio_pct ?? null} />
        <RatioTile label="Current Ratio" value={fmtX(ratios?.current_ratio)}       colorKey="current_ratio"     raw={ratios?.current_ratio ?? null} />
        <RatioTile label="Debt / Equity" value={fmtX(ratios?.debt_equity)}          colorKey="debt_equity"       raw={ratios?.debt_equity ?? null} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Filter Sidebar */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entity</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setSelectedCompanies([])} style={chip(selectedCompanies.length === 0)}>All</button>
                {filterOpts.companies.map((c) => (
                  <button key={c.company_id} onClick={() => setSelectedCompanies((p) => p.includes(c.company_id) ? p.filter((x) => x !== c.company_id) : [...p, c.company_id])} style={chip(selectedCompanies.includes(c.company_id))}>{c.company_name}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setYear(null)} style={chip(year === null)}>All</button>
                {filterOpts.years.map((y) => <button key={y} onClick={() => setYear(y === year ? null : y)} style={chip(year === y)}>{y}</button>)}
              </div>
            </div>

            {filterOpts.account_categories?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>GL Group</div>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button style={tabStyle('overview')} onClick={() => setTab('overview')}>Overview</button>
            <button style={tabStyle('trend')}    onClick={() => setTab('trend')}>Margin Trend</button>
            <button style={tabStyle('entity')}   onClick={() => setTab('entity')}>By Entity</button>
          </div>

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <>
              {/* Liquidity & Leverage */}
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Liquidity & Leverage</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
                <RatioTile label="Revenue / Entity"  value={fmt(ratios?.revenue_per_entity)}   colorKey="" raw={null} />
                <RatioTile label="Expense / Entity"  value={fmt(ratios?.expense_per_entity)}   colorKey="" raw={null} />
              </div>
              {/* Raw numbers */}
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Absolutes</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
                {[
                  { label: 'Revenue',    value: fmt(ratios?.revenue),    color: '#10b981' },
                  { label: 'COGS',       value: fmt(ratios?.cogs),       color: '#ef4444' },
                  { label: 'OpEx',       value: fmt(ratios?.opex),       color: '#f59e0b' },
                  { label: 'Net Income', value: fmt(ratios?.net_income), color: '#3b82f6' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card" style={{ padding: '12px 14px', borderTop: `3px solid ${color}` }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color }}>{loadR ? '…' : value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Margin Trend ── */}
          {tab === 'trend' && (
            <div className="card">
              <div className="card-title">Gross Margin % &amp; Net Margin % — Monthly</div>
              {loadT ? (
                <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
              ) : (
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendWithRatios} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Legend />
                      <Line dataKey="gross_margin_pct" name="Gross Margin %" stroke="#10b981" dot={false} strokeWidth={2} />
                      <Line dataKey="net_margin_pct"   name="Net Margin %"   stroke="#3b82f6" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Month</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Revenue</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Net Income</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Gross Margin %</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Net Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendWithRatios.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '5px 10px' }}>{row.month_key}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(row.revenue)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(row.net_income)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{row.gross_margin_pct != null ? row.gross_margin_pct.toFixed(1) + '%' : '—'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{row.net_margin_pct != null ? row.net_margin_pct.toFixed(1) + '%' : '—'}</td>
                      </tr>
                    ))}
                    {trendWithRatios.length === 0 && !loadT && (
                      <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── By Entity ── */}
          {tab === 'entity' && (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">Revenue &amp; Net Income by Entity</div>
                {loadE ? (
                  <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
                ) : (
                  <div style={{ height: Math.max(240, entities.length * 28 + 50) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={entities} layout="vertical" margin={{ left: 130, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="company_name" width={125} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Legend />
                        <Bar dataKey="revenue"    name="Revenue"    fill="#10b981" />
                        <Bar dataKey="net_income" name="Net Income" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Entity</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Revenue</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Net Income</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Gross Margin</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Net Margin</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>OpEx Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entities.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '5px 12px', fontWeight: 500 }}>{r.company_name}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right' }}>{fmt(r.revenue)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', color: (r.net_income ?? 0) < 0 ? '#ef4444' : '#10b981' }}>{fmt(r.net_income)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', color: ratioColor('gross_margin_pct', r.gross_margin_pct ?? null) }}>{fmtPct(r.gross_margin_pct)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', color: ratioColor('net_margin_pct', r.net_margin_pct ?? null) }}>{fmtPct(r.net_margin_pct)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', color: ratioColor('opex_ratio_pct', r.opex_ratio_pct ?? null) }}>{fmtPct(r.opex_ratio_pct)}</td>
                        </tr>
                      ))}
                      {entities.length === 0 && !loadE && (
                        <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
                      )}
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
