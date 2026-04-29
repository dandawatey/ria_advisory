/**
 * F009 — Gold Layer Conformed Data Model
 * Ops page: Gold table browser, row counts, Z-order config, DQ gate status.
 */
import { useState } from 'react';

interface GoldTable {
  name: string;
  type: 'Fact' | 'Dimension';
  grain: string;
  rowCount: number;
  sizeGB: number;
  lastPromoted: string;
  dqGate: 'passed' | 'warning' | 'blocked';
  zorderColumns: string;
}

const mockTables: GoldTable[] = [
  { name: 'fact_gl_entry',        type: 'Fact',      grain: 'One row per GL posting line',     rowCount: 4_821_334, sizeGB: 18.4, lastPromoted: '2026-04-23 14:22', dqGate: 'passed',  zorderColumns: 'subsidiary_code, posting_date, canonical_account_id' },
  { name: 'fact_ar_invoice_line', type: 'Fact',      grain: 'One row per AR invoice line',     rowCount: 189_421,   sizeGB: 1.2,  lastPromoted: '2026-04-23 14:22', dqGate: 'passed',  zorderColumns: 'subsidiary_code, invoice_date' },
  { name: 'fact_ap_invoice_line', type: 'Fact',      grain: 'One row per AP invoice line',     rowCount: 142_892,   sizeGB: 0.9,  lastPromoted: '2026-04-23 14:22', dqGate: 'passed',  zorderColumns: 'subsidiary_code, invoice_date' },
  { name: 'fact_bank_ledger',     type: 'Fact',      grain: 'One row per bank ledger entry',   rowCount: 98_203,    sizeGB: 0.4,  lastPromoted: '2026-04-23 14:22', dqGate: 'warning', zorderColumns: 'subsidiary_code, posting_date' },
  { name: 'fact_fx_rate',         type: 'Fact',      grain: 'One row per currency/date/type',  rowCount: 42_190,    sizeGB: 0.1,  lastPromoted: '2026-04-23 14:22', dqGate: 'passed',  zorderColumns: 'currency_code, rate_date' },
  { name: 'dim_entity',           type: 'Dimension', grain: 'Legal entity (SCD-2)',            rowCount: 34,        sizeGB: 0.01, lastPromoted: '2026-04-23 14:22', dqGate: 'passed',  zorderColumns: 'subsidiary_code' },
  { name: 'dim_account_canonical',type: 'Dimension', grain: 'Canonical CoA node (SCD-2)',      rowCount: 128,       sizeGB: 0.01, lastPromoted: '2026-04-23 14:22', dqGate: 'passed',  zorderColumns: 'canonical_account_id' },
  { name: 'dim_account_local',    type: 'Dimension', grain: 'Subsidiary native account (SCD-2)', rowCount: 3_412,   sizeGB: 0.02, lastPromoted: '2026-04-23 14:22', dqGate: 'warning', zorderColumns: 'subsidiary_code, account_no' },
  { name: 'dim_customer',         type: 'Dimension', grain: 'Harmonised customer (SCD-2)',     rowCount: 12_302,    sizeGB: 0.08, lastPromoted: '2026-04-23 14:22', dqGate: 'passed',  zorderColumns: 'customer_key' },
  { name: 'dim_vendor',           type: 'Dimension', grain: 'Harmonised vendor (SCD-2)',       rowCount: 4_201,     sizeGB: 0.03, lastPromoted: '2026-04-23 14:22', dqGate: 'passed',  zorderColumns: 'vendor_key' },
  { name: 'dim_date',             type: 'Dimension', grain: 'Calendar + fiscal dates (static)', rowCount: 7_305,   sizeGB: 0.01, lastPromoted: '2026-01-01 00:00', dqGate: 'passed',  zorderColumns: 'date_key' },
  { name: 'dim_currency',         type: 'Dimension', grain: 'ISO currencies (static)',         rowCount: 180,       sizeGB: 0.01, lastPromoted: '2026-01-01 00:00', dqGate: 'passed',  zorderColumns: 'currency_code' },
];

const dqBadge = (g: GoldTable['dqGate']) => {
  const m = { passed: 'badge-success', warning: 'badge-warning', blocked: 'badge-error' };
  return <span className={`badge ${m[g]}`}>{g}</span>;
};

export default function GoldLayer() {
  const [selected, setSelected] = useState<GoldTable | null>(null);
  const facts = mockTables.filter((t) => t.type === 'Fact');
  const dims = mockTables.filter((t) => t.type === 'Dimension');

  const totalRows = mockTables.reduce((s, t) => s + t.rowCount, 0);
  const totalGB = mockTables.reduce((s, t) => s + t.sizeGB, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Gold Layer — Conformed Data Model</h1>
        <p className="page-subtitle">
          Star-schema fact and dimension tables optimised for consumption. Unity Catalog registered. (F009)
        </p>
      </div>

      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile"><div className="kpi-label">Total Rows</div><div className="kpi-value">{(totalRows / 1_000_000).toFixed(1)}M</div></div>
        <div className="kpi-tile"><div className="kpi-label">Storage</div><div className="kpi-value">{totalGB.toFixed(1)} GB</div></div>
        <div className="kpi-tile"><div className="kpi-label">Fact Tables</div><div className="kpi-value">{facts.length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Dimension Tables</div><div className="kpi-value">{dims.length}</div></div>
      </div>

      {['Fact', 'Dimension'].map((type) => (
        <div className="card mb-16" key={type}>
          <div className="card-title">{type} Tables</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Table</th><th>Grain</th><th>Row Count</th><th>Size</th><th>Last Promoted</th><th>DQ Gate</th><th>Z-Order</th></tr>
              </thead>
              <tbody>
                {mockTables.filter((t) => t.type === type).map((t) => (
                  <tr key={t.name} onClick={() => setSelected(t)} style={{ cursor: 'pointer' }}>
                    <td className="table-mono" style={{ fontWeight: 600 }}>{t.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{t.grain}</td>
                    <td>{t.rowCount.toLocaleString()}</td>
                    <td>{t.sizeGB.toFixed(2)} GB</td>
                    <td style={{ fontSize: 12 }} className="text-muted">{t.lastPromoted}</td>
                    <td>{dqBadge(t.dqGate)}</td>
                    <td className="table-mono" style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.zorderColumns}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {selected && (
        <div className="card">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ margin: 0 }}>{selected.name}</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group"><label className="form-label">Z-Order Columns</label><input className="form-input table-mono" defaultValue={selected.zorderColumns} /></div>
            <div className="form-group"><label className="form-label">DQ Gate Status</label><input className="form-input" readOnly value={selected.dqGate} /></div>
          </div>
          <div className="mt-16 flex gap-8">
            <button className="btn btn-primary btn-sm">Run OPTIMIZE</button>
            <button className="btn btn-secondary btn-sm">View in Unity Catalog</button>
            <button className="btn btn-secondary btn-sm">Sample 100 Rows</button>
          </div>
        </div>
      )}
    </div>
  );
}
