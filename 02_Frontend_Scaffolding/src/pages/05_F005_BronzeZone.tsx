/**
 * F005 — Bronze Zone Data Landing
 * Ops page: storage stats, partition browser, WORM/immutability status.
 */
import React, { useState } from 'react';

const storageStats = {
  totalSizeGB: 2847,
  tableCount: 204,
  oldestPartition: '2019-01-01',
  latestPartition: '2026-04-23',
  wormEnabled: true,
  retentionYears: 7,
  encryptionType: 'CMK (Key Vault)',
  accessTier: 'Hot/Cool/Archive (lifecycle)',
};

interface Partition {
  subsidiary: string;
  entity: string;
  date: string;
  sizeGB: number;
  rows: number;
  tier: 'Hot' | 'Cool' | 'Archive';
}

const mockPartitions: Partition[] = [
  { subsidiary: 'SUB01', entity: 'GeneralLedgerEntries', date: '2026-04-23', sizeGB: 0.82, rows: 48321, tier: 'Hot' },
  { subsidiary: 'SUB01', entity: 'GeneralLedgerEntries', date: '2026-04-22', sizeGB: 0.79, rows: 47103, tier: 'Hot' },
  { subsidiary: 'SUB02', entity: 'GeneralLedgerEntries', date: '2026-04-23', sizeGB: 0.61, rows: 36102, tier: 'Hot' },
  { subsidiary: 'SUB01', entity: 'SalesInvoices',        date: '2026-04-23', sizeGB: 0.14, rows: 2301,  tier: 'Hot' },
  { subsidiary: 'SUB01', entity: 'Customers',            date: '2026-04-23', sizeGB: 0.05, rows: 5420,  tier: 'Hot' },
  { subsidiary: 'SUB01', entity: 'GeneralLedgerEntries', date: '2023-12-31', sizeGB: 0.91, rows: 51200, tier: 'Cool' },
  { subsidiary: 'SUB01', entity: 'GeneralLedgerEntries', date: '2021-12-31', sizeGB: 0.88, rows: 49800, tier: 'Archive' },
];

export default function BronzeZone() {
  const [filterSub, setFilterSub] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const filtered = mockPartitions.filter((p) =>
    (!filterSub    || p.subsidiary.includes(filterSub.toUpperCase())) &&
    (!filterEntity || p.entity.toLowerCase().includes(filterEntity.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Bronze Zone — Raw Data Landing</h1>
        <p className="page-subtitle">
          ADLS Gen2 Delta Lake tables: raw extracts, WORM immutability, partition browser. (F005)
        </p>
      </div>

      {/* Storage overview */}
      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile">
          <div className="kpi-label">Total Storage</div>
          <div className="kpi-value">{storageStats.totalSizeGB.toLocaleString()} GB</div>
          <div className="kpi-meta text-muted">Across all subsidiaries</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Delta Tables</div>
          <div className="kpi-value">{storageStats.tableCount}</div>
          <div className="kpi-meta text-muted">17 subs × 12 entities</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Date Range</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{storageStats.oldestPartition}</div>
          <div className="kpi-meta text-muted">→ {storageStats.latestPartition}</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">WORM / Retention</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)', fontSize: 20 }}>
            {storageStats.wormEnabled ? '✓ Active' : '✗ Off'}
          </div>
          <div className="kpi-meta text-muted">{storageStats.retentionYears}-year retention lock</div>
        </div>
      </div>

      {/* Security posture */}
      <div className="card mb-16">
        <div className="card-title">Storage Security Posture</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { label: 'Encryption', value: storageStats.encryptionType, ok: true },
            { label: 'Public Access', value: 'Disabled — Private Endpoint only', ok: true },
            { label: 'Access Tier Management', value: storageStats.accessTier, ok: true },
            { label: 'WORM Lock', value: '7-year immutable blob policy', ok: true },
            { label: 'Managed Identity Access', value: 'Pipeline MSI only', ok: true },
            { label: 'Diagnostic Logs', value: 'Log Analytics — 7yr retention', ok: true },
          ].map((item) => (
            <div key={item.label} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: item.ok ? 'var(--color-success)' : 'var(--color-error)', fontSize: 16, marginTop: 1 }}>
                {item.ok ? '✓' : '✗'}
              </span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Partition browser */}
      <div className="card">
        <div className="card-title">Partition Browser</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input className="form-input" placeholder="Filter by subsidiary…" style={{ width: 200 }}
            value={filterSub} onChange={(e) => setFilterSub(e.target.value)} />
          <input className="form-input" placeholder="Filter by entity…" style={{ width: 240 }}
            value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Subsidiary</th><th>Entity</th><th>Partition Date</th><th>Size</th><th>Rows</th><th>Tier</th></tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={i}>
                  <td><span className="badge badge-muted">{p.subsidiary}</span></td>
                  <td style={{ fontSize: 12 }}>{p.entity}</td>
                  <td className="table-mono">{p.date}</td>
                  <td>{p.sizeGB.toFixed(2)} GB</td>
                  <td>{p.rows.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${p.tier === 'Hot' ? 'badge-info' : p.tier === 'Cool' ? 'badge-muted' : 'badge-warning'}`}>
                      {p.tier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
