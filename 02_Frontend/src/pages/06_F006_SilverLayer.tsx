/**
 * F006 — Silver Layer Transformation
 * Ops page: transform job status, SCD-2 history, schema viewer.
 */
import { useState } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';

interface SilverJob {
  entity: string;
  subsidiary: string;
  status: 'success' | 'warning' | 'error' | 'running';
  duration: string;
  rowsIn: number;
  rowsOut: number;
  duplicatesRemoved: number;
  scd2Updates: number;
  lastRun: string;
}

const mockJobs: SilverJob[] = [
  { entity: 'GeneralLedgerEntries', subsidiary: 'ALL', status: 'success', duration: '6m 18s', rowsIn: 74231, rowsOut: 73541, duplicatesRemoved: 690, scd2Updates: 0,  lastRun: '2026-04-23 14:08' },
  { entity: 'Customers',            subsidiary: 'ALL', status: 'success', duration: '1m 42s', rowsIn: 5420,  rowsOut: 5420,  duplicatesRemoved: 0,   scd2Updates: 47, lastRun: '2026-04-23 14:08' },
  { entity: 'Vendors',              subsidiary: 'ALL', status: 'success', duration: '0m 55s', rowsIn: 892,   rowsOut: 892,   duplicatesRemoved: 0,   scd2Updates: 12, lastRun: '2026-04-23 14:08' },
  { entity: 'ChartOfAccounts',      subsidiary: 'ALL', status: 'warning', duration: '0m 38s', rowsIn: 412,   rowsOut: 408,   duplicatesRemoved: 4,   scd2Updates: 6,  lastRun: '2026-04-23 14:08' },
  { entity: 'SalesInvoices',        subsidiary: 'ALL', status: 'success', duration: '2m 11s', rowsIn: 2301,  rowsOut: 2301,  duplicatesRemoved: 0,   scd2Updates: 0,  lastRun: '2026-04-23 14:08' },
];

const schemaFields = [
  { name: 'sk_gl_entry',        type: 'STRING',     nullable: false, scd: false, description: 'Surrogate key SHA256(sub_code|native_id)' },
  { name: 'subsidiary_code',    type: 'STRING',     nullable: false, scd: false, description: 'Subsidiary identifier' },
  { name: 'entry_no',          type: 'INTEGER',    nullable: false, scd: false, description: 'BC native entry number' },
  { name: 'posting_date',      type: 'DATE',       nullable: false, scd: false, description: 'GL posting date' },
  { name: 'account_no',        type: 'STRING',     nullable: false, scd: false, description: 'Local account number' },
  { name: 'amount_lcy',        type: 'DECIMAL(18,4)', nullable: false, scd: false, description: 'Amount in local currency' },
  { name: 'currency_code',     type: 'STRING',     nullable: true,  scd: false, description: 'ISO currency code' },
  { name: 'description',       type: 'STRING',     nullable: true,  scd: false, description: 'Posting description' },
  { name: '_silver_processed_at', type: 'TIMESTAMP', nullable: false, scd: false, description: 'Silver promotion timestamp' },
  { name: '_source_run_id',    type: 'STRING',     nullable: false, scd: false, description: 'Pipeline run ID' },
];

export default function SilverLayer() {
  const [activeEntity, setActiveEntity] = useState<string | null>(null);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Silver Layer — Transformation</h1>
        <p className="page-subtitle">
          Type-cast, deduplicated, SCD-2 history-tracked conformed tables per entity. (F006)
        </p>
      </div>

      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile"><div className="kpi-label">Total Rows (Silver)</div><div className="kpi-value">1.2M</div><div className="kpi-meta text-muted">All entities, all tenants</div></div>
        <div className="kpi-tile"><div className="kpi-label">SCD-2 Updates Today</div><div className="kpi-value" style={{ color: 'var(--color-info)' }}>65</div><div className="kpi-meta text-muted">Dim attribute changes</div></div>
        <div className="kpi-tile"><div className="kpi-label">Duplicates Removed</div><div className="kpi-value">694</div><div className="kpi-meta text-muted">CDC overlap dedup</div></div>
        <div className="kpi-tile"><div className="kpi-label">Schema Violations</div><div className="kpi-value" style={{ color: 'var(--color-warning)' }}>2</div><div className="kpi-meta text-muted">ChartOfAccounts drift</div></div>
      </div>

      {/* Job status */}
      <div className="card mb-16">
        <div className="card-title">Transformation Job Status (Last Run)</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Entity</th><th>Scope</th><th>Duration</th><th>Rows In</th><th>Rows Out</th><th>Dedup</th><th>SCD-2 Updates</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {mockJobs.map((j) => (
                <tr key={j.entity}>
                  <td style={{ fontWeight: 500 }}>{j.entity}</td>
                  <td><span className="badge badge-muted">{j.subsidiary}</span></td>
                  <td>{j.duration}</td>
                  <td>{j.rowsIn.toLocaleString()}</td>
                  <td>{j.rowsOut.toLocaleString()}</td>
                  <td style={{ color: j.duplicatesRemoved > 0 ? 'var(--color-warning)' : 'inherit' }}>{j.duplicatesRemoved}</td>
                  <td style={{ color: j.scd2Updates > 0 ? 'var(--color-info)' : 'inherit' }}>{j.scd2Updates}</td>
                  <td><StatusBadge status={j.status} /></td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => setActiveEntity(j.entity)}>Schema</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schema panel */}
      {activeEntity && (
        <div className="card">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ margin: 0 }}>Silver Schema — {activeEntity}</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveEntity(null)}>✕</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Column</th><th>Type</th><th>Nullable</th><th>Description</th></tr>
              </thead>
              <tbody>
                {schemaFields.map((f) => (
                  <tr key={f.name}>
                    <td className="table-mono" style={{ fontWeight: 600 }}>{f.name}</td>
                    <td><span className="badge badge-info">{f.type}</span></td>
                    <td><span className={`badge ${f.nullable ? 'badge-muted' : 'badge-success'}`}>{f.nullable ? 'Yes' : 'No'}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
