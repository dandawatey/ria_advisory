/**
 * F015 — Executive Dashboard
 * Consolidated P&L, KPIs, subsidiary grid, Power BI embed.
 * Data sourced from FastAPI (03_Backend); falls back to mock if API unreachable.
 */
import { useState, useEffect } from 'react';
import { KPITile } from '../components/shared/KPITile';
import { PowerBIEmbed } from '../components/shared/PowerBIEmbed';
import { useNavigate } from 'react-router-dom';
import type { KPIMetric } from '../types';
import { api } from '../api/client';
import type { KPIs, EntitySummary, PLTrend } from '../api/client';
import { GLFilterBar } from '../components/GLFilterBar';

function fmtUSD(n: number) {
  if (!n) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function toKPIMetrics(kpis: KPIs): KPIMetric[] {
  const revenue = kpis.total_revenue ?? 0;
  const opex = Math.abs(kpis.total_opex ?? 0);
  const ebitda = revenue - opex;
  const margin = revenue !== 0 ? (ebitda / revenue) * 100 : 0;

  return [
    { label: 'Consolidated Revenue', value: revenue, unit: 'usd', trend: 'up', positiveDirection: 'up' },
    { label: 'Total OpEx',           value: opex,    unit: 'usd', trend: 'neutral', positiveDirection: 'down' },
    { label: 'EBITDA (est.)',        value: ebitda,  unit: 'usd', trend: ebitda >= 0 ? 'up' : 'down', positiveDirection: 'up' },
    { label: 'EBITDA Margin',        value: margin,  unit: 'pct', trend: margin >= 20 ? 'up' : 'down', positiveDirection: 'up' },
    { label: 'Total Assets',         value: Math.abs(kpis.total_assets ?? 0), unit: 'usd', trend: 'up', positiveDirection: 'up' },
    { label: 'Total Liabilities',    value: Math.abs(kpis.total_liabilities ?? 0), unit: 'usd', trend: 'neutral', positiveDirection: 'down' },
  ];
}

const agingBuckets = [
  { label: 'Current',    ar: 4_120_000, ap: 1_820_000 },
  { label: '1–30 days', ar: 2_210_000, ap: 980_000 },
  { label: '31–60 days', ar: 1_100_000, ap: 310_000 },
  { label: '61–90 days', ar: 620_000,  ap: 100_000 },
  { label: '90+ days',   ar: 270_000,  ap: 0 },
];

export default function ExecutiveDashboard() {
  const [view, setView] = useState<'eliminated' | 'gross'>('eliminated');
  const [showPBI, setShowPBI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<KPIs | null>(null);
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [trend, setTrend] = useState<PLTrend[]>([]);
  const [apiError, setApiError] = useState(false);
  const [accountPrefix, setAccountPrefix] = useState('');
  const [genPostType, setGenPostType] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.dashboard.kpis(),
      api.dashboard.entities(),
      api.dashboard.plTrend(),
    ])
      .then(([k, e, t]) => {
        setKpiData(k);
        setEntities(e);
        setTrend(t);
      })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, []);

  const kpiMetrics: KPIMetric[] = kpiData ? toKPIMetrics(kpiData) : [
    { label: 'Consolidated Revenue (MTD)', value: 24_820_000, unit: 'usd', trend: 'up',      positiveDirection: 'up' },
    { label: 'EBITDA (MTD)',               value: 9_134_000,  unit: 'usd', trend: 'up',      positiveDirection: 'up' },
    { label: 'EBITDA Margin',              value: 36.8,       unit: 'pct', trend: 'down',    positiveDirection: 'up' },
    { label: 'Net Cash Position',          value: 47_200_000, unit: 'usd', trend: 'up',      positiveDirection: 'up' },
    { label: 'Total AR Outstanding',       value: 8_320_000,  unit: 'usd', trend: 'up',      positiveDirection: 'down' },
    { label: 'Total AP Outstanding',       value: 3_210_000,  unit: 'usd', trend: 'down',    positiveDirection: 'down' },
  ];

  // Build P&L summary rows from trend or from entity data
  const latestTrend = trend.length > 0 ? trend[trend.length - 1] : null;
  const totalRevenue = kpiData?.total_revenue ?? latestTrend?.revenue ?? 0;
  const totalOpex = Math.abs(kpiData?.total_opex ?? 0);
  const totalCogs = Math.abs(kpiData?.total_cogs ?? 0);

  const plLines = [
    { account: 'Revenue',         mtd: totalRevenue,           ytd: totalRevenue * 12,         plan: totalRevenue * 12 * 1.05,  level: 1 },
    { account: '  COGS',          mtd: totalCogs,              ytd: totalCogs * 12,             plan: totalCogs * 12 * 0.95,     level: 2 },
    { account: '  Operating Exp', mtd: totalOpex,              ytd: totalOpex * 12,             plan: totalOpex * 12 * 0.95,     level: 2 },
    { account: 'EBITDA (est.)',    mtd: totalRevenue - totalOpex - totalCogs,
                                    ytd: (totalRevenue - totalOpex - totalCogs) * 12,
                                    plan: (totalRevenue - totalOpex - totalCogs) * 12 * 1.1,   level: 1 },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Executive Dashboard</h1>
            <p className="page-subtitle">
              Consolidated group financials · All subsidiaries
              {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}> ⚠ API offline — showing mock data</span>}
              {loading && <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}> Loading…</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
              <button className={`btn btn-sm ${view === 'eliminated' ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: 0 }} onClick={() => setView('eliminated')}>Eliminated</button>
              <button className={`btn btn-sm ${view === 'gross' ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: 0 }} onClick={() => setView('gross')}>Gross</button>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPBI(!showPBI)}>
              {showPBI ? 'Hide' : 'Show'} Power BI
            </button>
          </div>
        </div>
      </div>

      {/* GL Filters */}
      <div className="card mb-24" style={{ padding: '12px 16px' }}>
        <GLFilterBar
          accountPrefix={accountPrefix}
          onAccountPrefix={setAccountPrefix}
          genPostType={genPostType}
          onGenPostType={setGenPostType}
        />
      </div>

      {/* KPI tiles */}
      <div className="card-grid card-grid-3 mb-24" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {kpiMetrics.map((k) => <KPITile key={k.label} metric={k} />)}
      </div>

      {/* Power BI embed */}
      {showPBI && (
        <div className="card mb-24">
          <div className="card-title">Consolidated P&L — Power BI Report</div>
          <PowerBIEmbed title="Group Consolidated P&L Dashboard" height={480} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* P&L table */}
        <div className="card">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ margin: 0 }}>Consolidated P&L</div>
            <span className="badge badge-muted">{view === 'eliminated' ? 'IC Eliminated' : 'Gross'}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th><th style={{ textAlign: 'right' }}>MTD</th><th style={{ textAlign: 'right' }}>YTD (est.)</th><th style={{ textAlign: 'right' }}>Plan YTD</th><th style={{ textAlign: 'right' }}>Var</th>
                </tr>
              </thead>
              <tbody>
                {plLines.map((l) => {
                  const varAmt = l.ytd - l.plan;
                  return (
                    <tr key={l.account}>
                      <td style={{ paddingLeft: l.level === 2 ? 24 : 0, fontWeight: l.level === 1 ? 700 : 400 }}>
                        {l.account}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: l.level === 1 ? 600 : 400 }}>{fmtUSD(l.mtd)}</td>
                      <td style={{ textAlign: 'right', fontWeight: l.level === 1 ? 600 : 400 }}>{fmtUSD(l.ytd)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{fmtUSD(l.plan)}</td>
                      <td style={{ textAlign: 'right', color: varAmt >= 0 ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
                        {varAmt >= 0 ? '+' : ''}{fmtUSD(varAmt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* AR/AP aging (static — needs AR/AP module) */}
        <div className="card">
          <div className="card-title">AR / AP Aging (mock)</div>
          <table style={{ fontSize: 13 }}>
            <thead><tr><th>Bucket</th><th style={{ textAlign: 'right' }}>AR</th><th style={{ textAlign: 'right' }}>AP</th></tr></thead>
            <tbody>
              {agingBuckets.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td style={{ textAlign: 'right', color: b.label !== 'Current' && b.ar > 0 ? 'var(--color-warning)' : 'inherit' }}>{fmtUSD(b.ar)}</td>
                  <td style={{ textAlign: 'right' }}>{b.ap > 0 ? fmtUSD(b.ap) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subsidiary grid */}
      <div className="card">
        <div className="card-title">
          Subsidiary Performance — click to drill through
          {entities.length > 0 && <span className="badge badge-muted" style={{ marginLeft: 8 }}>{entities.length} entities</span>}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Subsidiary</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Expenses</th>
                <th style={{ textAlign: 'right' }}>Net Income</th>
                <th style={{ textAlign: 'right' }}>Entries</th>
              </tr>
            </thead>
            <tbody>
              {entities.length > 0
                ? entities.map((s) => (
                  <tr key={s.code} onClick={() => navigate(`/entities/${s.code}`)} style={{ cursor: 'pointer' }}>
                    <td><span className="badge badge-muted">{s.code}</span></td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ textAlign: 'right' }}>{fmtUSD(s.revenue)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtUSD(Math.abs(s.expenses))}</td>
                    <td style={{ textAlign: 'right', color: s.net_income >= 0 ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
                      {fmtUSD(s.net_income)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{s.entry_count.toLocaleString()}</td>
                  </tr>
                ))
                : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '32px 0' }}>
                      {loading ? 'Loading subsidiaries…' : apiError ? 'API offline — start the backend (03_Backend) to see real data' : 'No data'}
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
