/**
 * F008 — Canonical Dimension Framework
 * Admin page: dimension value mapping, coverage stats.
 */
import React, { useState } from 'react';

const dimensions = ['Entity', 'Region', 'Client Segment', 'Service Line'];

const mockMappings = [
  { sub: 'SUB01', dimType: 'Region',         localCode: 'NE',           canonicalCode: 'NORTHEAST',       status: 'mapped' as const },
  { sub: 'SUB01', dimType: 'Region',         localCode: 'SE',           canonicalCode: 'SOUTHEAST',       status: 'mapped' as const },
  { sub: 'SUB02', dimType: 'Region',         localCode: 'REGION-NE',    canonicalCode: 'NORTHEAST',       status: 'mapped' as const },
  { sub: 'SUB03', dimType: 'Region',         localCode: 'EAST',         canonicalCode: 'NORTHEAST',       status: 'pending_approval' as const },
  { sub: 'SUB05', dimType: 'Client Segment', localCode: 'INST',         canonicalCode: 'INSTITUTIONAL',   status: 'mapped' as const },
  { sub: 'SUB05', dimType: 'Client Segment', localCode: 'RET',          canonicalCode: 'RETAIL_HNW',      status: 'mapped' as const },
  { sub: 'SUB07', dimType: 'Service Line',   localCode: 'PM',           canonicalCode: 'PORTFOLIO_MGMT',  status: 'mapped' as const },
  { sub: 'SUB07', dimType: 'Service Line',   localCode: 'FP',           canonicalCode: 'FIN_PLANNING',    status: 'mapped' as const },
  { sub: 'SUB08', dimType: 'Region',         localCode: 'UNKNOWN',      canonicalCode: null,              status: 'unmapped' as const },
  { sub: 'SUB08', dimType: 'Client Segment', localCode: 'CORP',         canonicalCode: null,              status: 'unmapped' as const },
];

const coverageByDim: Record<string, { mapped: number; total: number }> = {
  'Entity':         { mapped: 17, total: 17 },
  'Region':         { mapped: 52, total: 54 },
  'Client Segment': { mapped: 38, total: 41 },
  'Service Line':   { mapped: 29, total: 32 },
};

const statusBadge = (s: typeof mockMappings[0]['status']) => {
  const map = { mapped: 'badge-success', pending_approval: 'badge-warning', unmapped: 'badge-error' };
  const labels = { mapped: 'Mapped', pending_approval: 'Pending Approval', unmapped: 'Unmapped' };
  return <span className={`badge ${map[s]}`}>{labels[s]}</span>;
};

export default function DimensionFramework() {
  const [activeDim, setActiveDim] = useState('Region');
  const filtered = mockMappings.filter((m) => m.dimType === activeDim);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Canonical Dimension Framework</h1>
        <p className="page-subtitle">
          Map subsidiary dimension codes to canonical Entity / Region / Client Segment / Service Line values. (F008)
        </p>
        <div className="page-actions">
          <button className="btn btn-primary">+ Add Canonical Value</button>
          <button className="btn btn-secondary">Import Mappings CSV</button>
        </div>
      </div>

      {/* Coverage summary */}
      <div className="card-grid card-grid-4 mb-24">
        {dimensions.map((dim) => {
          const cov = coverageByDim[dim];
          const pct = Math.round((cov.mapped / cov.total) * 100);
          return (
            <div className="card" key={dim} style={{ cursor: 'pointer', borderColor: activeDim === dim ? 'var(--color-primary)' : undefined }}
              onClick={() => setActiveDim(dim)}>
              <div className="kpi-label">{dim}</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>{pct}%</div>
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className={`progress-fill ${pct === 100 ? 'progress-fill-success' : pct > 85 ? '' : 'progress-fill-warning'}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <div className="kpi-meta text-muted" style={{ marginTop: 6 }}>{cov.mapped}/{cov.total} values mapped</div>
            </div>
          );
        })}
      </div>

      {/* Mapping workbench */}
      <div className="card">
        <div className="tabs">
          {dimensions.map((d) => (
            <div key={d} className={`tab ${activeDim === d ? 'active' : ''}`} onClick={() => setActiveDim(d)}>{d}</div>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Subsidiary</th><th>Local Code</th><th>Canonical Value</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={i}>
                  <td><span className="badge badge-muted">{m.sub}</span></td>
                  <td className="table-mono">{m.localCode}</td>
                  <td>
                    {m.status === 'unmapped' ? (
                      <select className="form-select" style={{ fontSize: 12, padding: '4px 8px' }}>
                        <option>— Select —</option>
                        <option>NORTHEAST</option>
                        <option>SOUTHEAST</option>
                        <option>MIDWEST</option>
                        <option>WEST</option>
                        <option>INTERNATIONAL</option>
                      </select>
                    ) : (
                      <span className="table-mono" style={{ fontWeight: 600 }}>{m.canonicalCode}</span>
                    )}
                  </td>
                  <td>{statusBadge(m.status)}</td>
                  <td>
                    {m.status === 'unmapped'
                      ? <button className="btn btn-primary btn-sm">Propose</button>
                      : <button className="btn btn-secondary btn-sm">Edit</button>
                    }
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
