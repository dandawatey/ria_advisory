/**
 * F015 — Executive Dashboard (Visual)
 * All-chart layout: KPI tiles + P&L composed chart + revenue pie + entity bar chart.
 * No tables. Data from FastAPI analytics endpoints.
 */
import { useState, useEffect } from 'react';
import { KPITile } from '../components/shared/KPITile';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ReferenceLine, PieChart, Pie,
} from 'recharts';
import type { KPIMetric } from '../types';
import { api } from '../api/client';
import type { KPISummary, EntityContributionRow } from '../api/client';

/* ── helpers ── */
function fmtUSD(n: number) {
  if (!n) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function toKPIMetrics(kpis: KPISummary): KPIMetric[] {
  const revenue = kpis.revenue ?? 0;
  const opex    = Math.abs(kpis.opex ?? 0);
  const cogs    = Math.abs(kpis.cogs ?? 0);
  const ebitda  = revenue - opex - cogs;
  const margin  = revenue !== 0 ? (ebitda / revenue) * 100 : 0;
  return [
    { label: 'Consolidated Revenue', value: revenue,              unit: 'usd', trend: 'up',                         positiveDirection: 'up'   },
    { label: 'Total COGS',           value: cogs,                 unit: 'usd', trend: 'neutral',                    positiveDirection: 'down' },
    { label: 'Total OpEx',           value: opex,                 unit: 'usd', trend: 'neutral',                    positiveDirection: 'down' },
    { label: 'EBITDA (est.)',        value: ebitda,               unit: 'usd', trend: ebitda >= 0 ? 'up' : 'down',  positiveDirection: 'up'   },
    { label: 'EBITDA Margin',        value: margin,               unit: 'pct', trend: margin >= 20 ? 'up' : 'down', positiveDirection: 'up'   },
    { label: 'Net Income',           value: kpis.net_income ?? 0, unit: 'usd', trend: (kpis.net_income ?? 0) >= 0 ? 'up' : 'down', positiveDirection: 'up' },
  ];
}

/* ── chart colors ── */
const C = {
  rev:  '#22c55e',
  cogs: '#f97316',
  opex: '#a855f7',
  ebit: '#3b82f6',
  net:  '#06b6d4',
};

const PIE_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9',
  '#a855f7','#fb923c','#22d3ee','#fbbf24','#4ade80',
  '#f43f5e','#818cf8',
];

/* ── custom tooltip ── */
function USDTip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.12)', minWidth: 140 }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--color-text)' }}>{label}</div>}
      {payload.filter(p => p.name !== 'base').map(p => (
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)', marginBottom: 2 }}>
          {p.name}: <strong>{fmtUSD(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function PieTip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { fill: string } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
      <div style={{ fontWeight: 700, color: p.payload.fill, marginBottom: 2 }}>{p.name}</div>
      <div style={{ color: 'var(--color-text)' }}>{fmtUSD(p.value)} revenue</div>
    </div>
  );
}

/* ── section label ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </div>
  );
}

/* ── main component ── */
export default function ExecutiveDashboard() {
  const [view, setView] = useState<'eliminated' | 'gross'>('eliminated');
  const [loading, setLoading]   = useState(true);
  const [kpiData, setKpiData]   = useState<KPISummary | null>(null);
  const [entities, setEntities] = useState<EntityContributionRow[]>([]);
  const [apiError, setApiError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.analytics.kpiSummary(),
      api.analytics.entityContribution(),
    ])
      .then(([k, e]) => { setKpiData(k); setEntities(e); })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, []);

  const kpiMetrics: KPIMetric[] = kpiData ? toKPIMetrics(kpiData) : [];

  /* ── P&L breakdown chart data ── */
  const revenue  = kpiData?.revenue ?? 0;
  const cogs     = Math.abs(kpiData?.cogs ?? 0);
  const opex     = Math.abs(kpiData?.opex ?? 0);
  const ebitda   = revenue - cogs - opex;
  const netInc   = kpiData?.net_income ?? 0;

  const plChartData = [
    { name: 'Revenue',    revenue,           cogs: 0,    opex: 0,    ebitda: 0,   net: 0     },
    { name: 'COGS',       revenue: 0,        cogs,       opex: 0,    ebitda: 0,   net: 0     },
    { name: 'OpEx',       revenue: 0,        cogs: 0,    opex,       ebitda: 0,   net: 0     },
    { name: 'EBITDA',     revenue: 0,        cogs: 0,    opex: 0,    ebitda,      net: 0     },
    { name: 'Net Income', revenue: 0,        cogs: 0,    opex: 0,    ebitda: 0,   net: netInc },
  ];

  /* ── entity revenue share pie data ── */
  const pieData = entities
    .filter(e => (e.revenue ?? 0) > 0)
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .slice(0, 12)
    .map((e, i) => ({
      name: e.company_name?.length > 22 ? e.company_name.slice(0, 20) + '…' : e.company_name,
      fullName: e.company_name,
      value: e.revenue ?? 0,
      fill: PIE_COLORS[i % PIE_COLORS.length],
      id: e.company_id,
    }));

  /* ── entity bar chart data ── */
  const entityBarData = [...entities]
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .map(e => ({
      ...e,
      company_name: e.company_name?.length > 26 ? e.company_name.slice(0, 24) + '…' : e.company_name,
    }));

  const isLoading = loading;
  const isEmpty   = !isLoading && entities.length === 0;

  return (
    <div>
      {/* ── header ── */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Executive Dashboard</h1>
            <p className="page-subtitle">
              Consolidated group financials · All subsidiaries
              {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚠ API error</span>}
              {isLoading && <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>Loading…</span>}
            </p>
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
            <button className={`btn btn-sm ${view === 'eliminated' ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: 0 }} onClick={() => setView('eliminated')}>Eliminated</button>
            <button className={`btn btn-sm ${view === 'gross' ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: 0 }} onClick={() => setView('gross')}>Gross</button>
          </div>
        </div>
      </div>

      {/* ── KPI tiles ── */}
      <div className="card-grid card-grid-3 mb-24" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {kpiMetrics.map(k => <KPITile key={k.label} metric={k} />)}
      </div>

      {/* ── P&L chart + Revenue pie ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* P&L Composed Chart */}
        <div className="card">
          <SectionLabel>P&L Breakdown — {view === 'eliminated' ? 'IC Eliminated' : 'Gross'}</SectionLabel>
          <div style={{ height: 300 }}>
            {isLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={plChartData} margin={{ top: 8, right: 20, bottom: 4, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmtUSD(v)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
                  <Tooltip content={<USDTip />} />
                  <ReferenceLine y={0} stroke="var(--color-border)" />
                  <Bar dataKey="revenue"  name="Revenue"    fill={C.rev}  radius={[4, 4, 0, 0]} maxBarSize={56} />
                  <Bar dataKey="cogs"     name="COGS"       fill={C.cogs} radius={[4, 4, 0, 0]} maxBarSize={56} />
                  <Bar dataKey="opex"     name="OpEx"       fill={C.opex} radius={[4, 4, 0, 0]} maxBarSize={56} />
                  <Bar dataKey="ebitda"   name="EBITDA">
                    {plChartData.map((d, i) => (
                      <Cell key={i} fill={d.ebitda >= 0 ? C.ebit : '#ef4444'} />
                    ))}
                  </Bar>
                  <Bar dataKey="net"      name="Net Income">
                    {plChartData.map((d, i) => (
                      <Cell key={i} fill={d.net >= 0 ? C.net : '#ef4444'} />
                    ))}
                  </Bar>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Revenue share donut */}
        <div className="card">
          <SectionLabel>Revenue Share by Subsidiary</SectionLabel>
          <div style={{ height: 300 }}>
            {isLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
            ) : isEmpty ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="42%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={102}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    onClick={d => navigate(`/entities/${d.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                  {/* centre label */}
                  <text x="42%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 20, fontWeight: 700, fill: 'var(--color-text)' }}>
                    {fmtUSD(revenue)}
                  </text>
                  <text x="42%" y="56%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fill: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Total Revenue
                  </text>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* mini legend */}
          {!isLoading && pieData.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 8 }}>
              {pieData.slice(0, 8).map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer' }} onClick={() => navigate(`/entities/${d.id}`)}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
                  {d.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Entity contribution horizontal bar chart ── */}
      <div className="card">
        <SectionLabel>
          Subsidiary Performance — click any bar to drill through
          {entities.length > 0 && (
            <span style={{ marginLeft: 8, background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0 }}>
              {entities.length} entities
            </span>
          )}
        </SectionLabel>

        {isLoading && (
          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
        )}
        {!isLoading && isEmpty && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            No subsidiaries — contact your administrator to configure access
          </div>
        )}
        {!isLoading && !isEmpty && (
          <div style={{ height: Math.max(260, entityBarData.length * 38 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={entityBarData}
                margin={{ top: 4, right: 100, bottom: 4, left: 8 }}
                onClick={d => {
                  const row = entities.find(e =>
                    (e.company_name?.slice(0, 24) + (e.company_name?.length > 26 ? '…' : '')) === d?.activeLabel ||
                    e.company_name === d?.activeLabel
                  );
                  if (row) navigate(`/entities/${row.company_id}`);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtUSD(v)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="company_name"
                  width={180}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<USDTip />} cursor={{ fill: 'var(--color-bg-subtle)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill={C.rev}  radius={[0, 3, 3, 0]} maxBarSize={20} style={{ cursor: 'pointer' }} />
                <Bar dataKey="cogs"    name="COGS"    fill={C.cogs} radius={[0, 3, 3, 0]} maxBarSize={20} style={{ cursor: 'pointer' }} />
                <Bar dataKey="opex"    name="OpEx"    fill={C.opex} radius={[0, 3, 3, 0]} maxBarSize={20} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* margin % sparkline row */}
        {!isLoading && !isEmpty && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            {entities.slice(0, 10).map(e => {
              const pct = e.gross_margin_pct ?? 0;
              const color = pct >= 30 ? '#22c55e' : pct >= 10 ? '#f59e0b' : '#ef4444';
              return (
                <div
                  key={e.company_id}
                  onClick={() => navigate(`/entities/${e.company_id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', flex: '0 0 auto' }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--color-text)', fontWeight: 500 }}>
                    {e.company_name?.split(' ').slice(0, 2).join(' ')}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color }}>
                    {pct != null ? `${pct}%` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
