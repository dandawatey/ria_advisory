/**
 * F015 — Executive Dashboard
 * Primary view for Group CFO: consolidated P&L, KPIs, subsidiary grid, Power BI embed.
 */
import React, { useState } from 'react';
import { KPITile } from '../components/shared/KPITile';
import { PowerBIEmbed } from '../components/shared/PowerBIEmbed';
import { useNavigate } from 'react-router-dom';
import type { KPIMetric } from '../types';

const kpis: KPIMetric[] = [
  { label: 'Consolidated Revenue (MTD)', value: 24_820_000, previousValue: 23_410_000, unit: 'usd', trend: 'up', positiveDirection: 'up' },
  { label: 'EBITDA (MTD)',               value: 9_134_000,  previousValue: 8_901_000,  unit: 'usd', trend: 'up', positiveDirection: 'up' },
  { label: 'EBITDA Margin',              value: 36.8,       previousValue: 38.0,       unit: 'pct', trend: 'down', positiveDirection: 'up' },
  { label: 'Net Cash Position',          value: 47_200_000, previousValue: 44_100_000, unit: 'usd', trend: 'up', positiveDirection: 'up' },
  { label: 'Total AR Outstanding',       value: 8_320_000,  previousValue: 7_940_000,  unit: 'usd', trend: 'up', positiveDirection: 'down' },
  { label: 'Total AP Outstanding',       value: 3_210_000,  previousValue: 3_580_000,  unit: 'usd', trend: 'down', positiveDirection: 'down' },
];

const plLines = [
  { account: 'Advisory Fees',        mtd: 18_200_000, ytd: 71_400_000, plan: 70_000_000, level: 2 },
  { account: 'Management Fees',      mtd: 6_620_000,  ytd: 25_800_000, plan: 26_000_000, level: 2 },
  { account: 'Total Revenue',        mtd: 24_820_000, ytd: 97_200_000, plan: 96_000_000, level: 1 },
  { account: 'Compensation',         mtd: 9_800_000,  ytd: 38_200_000, plan: 38_000_000, level: 2 },
  { account: 'Technology',           mtd: 1_420_000,  ytd: 5_600_000,  plan: 5_400_000,  level: 2 },
  { account: 'Occupancy & Other',    mtd: 810_000,    ytd: 3_100_000,  plan: 3_200_000,  level: 2 },
  { account: 'Total OpEx',           mtd: 12_030_000, ytd: 46_900_000, plan: 46_600_000, level: 1 },
  { account: 'EBITDA',               mtd: 9_134_000,  ytd: 35_800_000, plan: 35_200_000, level: 1 },
  { account: 'D&A',                  mtd: 310_000,    ytd: 1_210_000,  plan: 1_200_000,  level: 2 },
  { account: 'EBIT',                 mtd: 8_824_000,  ytd: 34_590_000, plan: 34_000_000, level: 1 },
];

const subsidiaries = [
  { code: 'SUB01', name: 'Apex Capital Advisors',     revMTD: 4_820_000, ebitdaMTD: 1_821_000, revYTD: 18_900_000, planVar: +2.1 },
  { code: 'SUB02', name: 'Blue Ridge Wealth',         revMTD: 3_210_000, ebitdaMTD: 1_102_000, revYTD: 12_400_000, planVar: -1.3 },
  { code: 'SUB03', name: 'Clearwater Financial',      revMTD: 2_890_000, ebitdaMTD: 1_048_000, revYTD: 11_200_000, planVar: +0.8 },
  { code: 'SUB04', name: 'Dune Capital Partners',     revMTD: 2_410_000, ebitdaMTD: 892_000,   revYTD: 9_400_000,  planVar: -3.1 },
  { code: 'SUB05', name: 'Evergreen Invest. Counsel', revMTD: 1_980_000, ebitdaMTD: 712_000,   revYTD: 7_800_000,  planVar: +5.2 },
];

const agingBuckets = [
  { label: 'Current',    ar: 4_120_000, ap: 1_820_000 },
  { label: '1–30 days', ar: 2_210_000, ap: 980_000 },
  { label: '31–60 days', ar: 1_100_000, ap: 310_000 },
  { label: '61–90 days', ar: 620_000,  ap: 100_000 },
  { label: '90+ days',   ar: 270_000,  ap: 0 },
];

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function ExecutiveDashboard() {
  const [view, setView] = useState<'eliminated' | 'gross'>('eliminated');
  const [period, setPeriod] = useState('Apr 2026');
  const [showPBI, setShowPBI] = useState(false);
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Executive Dashboard</h1>
            <p className="page-subtitle">Consolidated group financials · All 17 subsidiaries · {period}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-select" style={{ width: 160 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option>Apr 2026</option><option>Mar 2026</option><option>Feb 2026</option><option>YTD 2026</option>
            </select>
            <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
              <button className={`btn btn-sm ${view === 'eliminated' ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: 0 }} onClick={() => setView('eliminated')}>Eliminated</button>
              <button className={`btn btn-sm ${view === 'gross' ? 'btn-primary' : 'btn-secondary'}`}    style={{ borderRadius: 0 }} onClick={() => setView('gross')}>Gross</button>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPBI(!showPBI)}>
              {showPBI ? 'Hide' : 'Show'} Power BI
            </button>
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="card-grid card-grid-3 mb-24" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {kpis.map((k) => <KPITile key={k.label} metric={k} />)}
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
            <div className="card-title" style={{ margin: 0 }}>Consolidated P&L · {period}</div>
            <span className="badge badge-muted">{view === 'eliminated' ? 'IC Eliminated' : 'Gross'}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th><th style={{ textAlign: 'right' }}>MTD</th><th style={{ textAlign: 'right' }}>YTD</th><th style={{ textAlign: 'right' }}>Plan YTD</th><th style={{ textAlign: 'right' }}>Var</th>
                </tr>
              </thead>
              <tbody>
                {plLines.map((l) => {
                  const var_ = l.ytd - l.plan;
                  return (
                    <tr key={l.account}>
                      <td style={{ paddingLeft: l.level === 2 ? 24 : 0, fontWeight: l.level === 1 ? 700 : 400 }}>
                        {l.level === 2 && <span className="text-muted">└ </span>}{l.account}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: l.level === 1 ? 600 : 400 }}>{fmtUSD(l.mtd)}</td>
                      <td style={{ textAlign: 'right', fontWeight: l.level === 1 ? 600 : 400 }}>{fmtUSD(l.ytd)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{fmtUSD(l.plan)}</td>
                      <td style={{ textAlign: 'right', color: var_ >= 0 ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
                        {var_ >= 0 ? '+' : ''}{fmtUSD(var_)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* AR/AP aging */}
        <div className="card">
          <div className="card-title">AR / AP Aging</div>
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
        <div className="card-title">Subsidiary Performance — {period} (click to drill through)</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Code</th><th>Subsidiary</th><th style={{ textAlign: 'right' }}>Rev MTD</th><th style={{ textAlign: 'right' }}>EBITDA MTD</th><th style={{ textAlign: 'right' }}>Rev YTD</th><th style={{ textAlign: 'right' }}>vs Plan %</th></tr>
            </thead>
            <tbody>
              {subsidiaries.map((s) => (
                <tr key={s.code} onClick={() => navigate(`/entities/${s.code}`)} style={{ cursor: 'pointer' }}>
                  <td><span className="badge badge-muted">{s.code}</span></td>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td style={{ textAlign: 'right' }}>{fmtUSD(s.revMTD)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtUSD(s.ebitdaMTD)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtUSD(s.revYTD)}</td>
                  <td style={{ textAlign: 'right', color: s.planVar >= 0 ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
                    {s.planVar >= 0 ? '+' : ''}{s.planVar.toFixed(1)}%
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--color-bg)', fontWeight: 700 }}>
                <td colSpan={2}>Group Total (showing 5 of 17)</td>
                <td style={{ textAlign: 'right' }}>{fmtUSD(subsidiaries.reduce((s, r) => s + r.revMTD, 0))}</td>
                <td style={{ textAlign: 'right' }}>{fmtUSD(subsidiaries.reduce((s, r) => s + r.ebitdaMTD, 0))}</td>
                <td style={{ textAlign: 'right' }}>{fmtUSD(subsidiaries.reduce((s, r) => s + r.revYTD, 0))}</td>
                <td style={{ textAlign: 'right' }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
