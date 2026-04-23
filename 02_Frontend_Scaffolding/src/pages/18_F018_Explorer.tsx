/**
 * F018 — Explorer & Ad-Hoc Analytics
 * FP&A page: pivot grid, dimension filters, saved views, CSV/Parquet export.
 */
import React, { useState } from 'react';
import { PowerBIEmbed } from '../components/shared/PowerBIEmbed';

type RowDim = 'canonical_account' | 'entity' | 'region' | 'client_segment' | 'service_line';
type Measure = 'amount_usd' | 'debit_amount' | 'credit_amount' | 'row_count';

const periods = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026'];

const mockData: Record<string, Record<string, number>> = {
  'Advisory Fees':        { 'Jan 2026': 22_100_000, 'Feb 2026': 23_400_000, 'Mar 2026': 23_900_000, 'Apr 2026': 24_820_000 },
  'Management Fees':      { 'Jan 2026': 6_200_000,  'Feb 2026': 6_350_000,  'Mar 2026': 6_480_000,  'Apr 2026': 6_620_000 },
  'Compensation':         { 'Jan 2026': 9_100_000,  'Feb 2026': 9_350_000,  'Mar 2026': 9_680_000,  'Apr 2026': 9_800_000 },
  'Technology':           { 'Jan 2026': 1_310_000,  'Feb 2026': 1_380_000,  'Mar 2026': 1_400_000,  'Apr 2026': 1_420_000 },
  'EBITDA':              { 'Jan 2026': 8_400_000,  'Feb 2026': 8_720_000,  'Mar 2026': 8_900_000,  'Apr 2026': 9_134_000 },
};

const savedViews = [
  { id: 'v1', name: 'Monthly Revenue by Entity', owner: 'Ravi Mehta', visibility: 'shared' as const },
  { id: 'v2', name: 'EBITDA Trend Q1-Q2 2026',  owner: 'Elena Marchetti', visibility: 'shared' as const },
  { id: 'v3', name: 'NE Region Profitability',   owner: 'Ravi Mehta', visibility: 'private' as const },
];

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function Explorer() {
  const [rowDim, setRowDim] = useState<RowDim>('canonical_account');
  const [measure, setMeasure] = useState<Measure>('amount_usd');
  const [viewMode, setViewMode] = useState<'grid' | 'pbi'>('grid');
  const [exporting, setExporting] = useState(false);

  const handleExport = (fmt: 'csv' | 'parquet') => {
    setExporting(true);
    setTimeout(() => setExporting(false), 2000);
    alert(`${fmt.toUpperCase()} export queued. Download link will be sent to your email.`);
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Explorer — Ad-Hoc Analytics</h1>
            <p className="page-subtitle">Self-service pivot grid over Gold fact tables. Saved views, CSV/Parquet export. (F018)</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}>⊞ Grid</button>
            <button className={`btn btn-sm ${viewMode === 'pbi' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('pbi')}>Power BI</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Filter panel */}
        <div>
          <div className="card mb-16">
            <div className="card-title">Dimensions & Filters</div>
            <div className="form-group mb-16">
              <label className="form-label">Rows</label>
              <select className="form-select" value={rowDim} onChange={(e) => setRowDim(e.target.value as RowDim)}>
                <option value="canonical_account">Canonical Account</option>
                <option value="entity">Entity</option>
                <option value="region">Region</option>
                <option value="client_segment">Client Segment</option>
                <option value="service_line">Service Line</option>
              </select>
            </div>
            <div className="form-group mb-16">
              <label className="form-label">Measure</label>
              <select className="form-select" value={measure} onChange={(e) => setMeasure(e.target.value as Measure)}>
                <option value="amount_usd">Amount USD</option>
                <option value="debit_amount">Debit Amount</option>
                <option value="credit_amount">Credit Amount</option>
                <option value="row_count">Row Count</option>
              </select>
            </div>
            <div className="form-group mb-16">
              <label className="form-label">Entity Filter</label>
              <select className="form-select"><option>All Entities</option><option>SUB01</option><option>SUB02</option></select>
            </div>
            <div className="form-group mb-16">
              <label className="form-label">View</label>
              <select className="form-select"><option>IC Eliminated</option><option>Gross</option></select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}>Apply</button>
          </div>

          {/* Saved views */}
          <div className="card">
            <div className="card-title">Saved Views</div>
            {savedViews.map((v) => (
              <div key={v.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer' }}
                onClick={() => {}}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{v.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', gap: 6, marginTop: 2 }}>
                  <span>{v.owner}</span>
                  <span className={`badge ${v.visibility === 'shared' ? 'badge-info' : 'badge-muted'}`}>{v.visibility}</span>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm mt-16" style={{ width: '100%' }}>+ Save Current View</button>
          </div>
        </div>

        {/* Grid / PBI */}
        <div>
          {viewMode === 'grid' ? (
            <div className="card">
              <div className="flex items-center justify-between mb-16">
                <div className="card-title" style={{ margin: 0 }}>
                  {rowDim.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} × Period · {measure.replace('_', ' ')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')} disabled={exporting}>
                    ↓ CSV
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleExport('parquet')} disabled={exporting}>
                    ↓ Parquet
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{rowDim.replace(/_/g, ' ')}</th>
                      {periods.map((p) => <th key={p} style={{ textAlign: 'right' }}>{p}</th>)}
                      <th style={{ textAlign: 'right' }}>YTD Total</th>
                      <th style={{ textAlign: 'right' }}>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(mockData).map(([row, vals]) => {
                      const ytd = Object.values(vals).reduce((s, v) => s + v, 0);
                      const trend = ((vals['Apr 2026'] - vals['Jan 2026']) / vals['Jan 2026'] * 100).toFixed(1);
                      return (
                        <tr key={row}>
                          <td style={{ fontWeight: 500 }}>{row}</td>
                          {periods.map((p) => (
                            <td key={p} style={{ textAlign: 'right' }}>{fmtUSD(vals[p])}</td>
                          ))}
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtUSD(ytd)}</td>
                          <td style={{ textAlign: 'right', color: Number(trend) >= 0 ? 'var(--color-success)' : 'var(--color-error)', fontSize: 12 }}>
                            {Number(trend) >= 0 ? '↑' : '↓'} {Math.abs(Number(trend))}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: 'var(--color-bg)' }}>
                      <td>Total</td>
                      {periods.map((p) => (
                        <td key={p} style={{ textAlign: 'right' }}>
                          {fmtUSD(Object.values(mockData).reduce((s, r) => s + r[p], 0))}
                        </td>
                      ))}
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-title">Power BI — Analytical Report</div>
              <PowerBIEmbed title="Group FP&A Explorer — Power BI" height={520} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
