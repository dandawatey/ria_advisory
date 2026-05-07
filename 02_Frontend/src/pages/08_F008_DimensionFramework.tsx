/**
 * F008 — Canonical Dimension Framework
 * Admin page: dimension value mapping, coverage stats.
 */
import { useState } from 'react';
import PageExplainer from '../components/common/PageExplainer';

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
      <PageExplainer
        icon="🧩"
        title="What is the Canonical Dimension Framework?"
        description="This page manages <strong>cross-entity dimension mappings</strong> — translating each subsidiary's local codes (Region, Client Segment, Service Line, Entity) into a canonical group-wide standard. Without this mapping, consolidation is impossible: SUB01 calls it 'NE' while SUB02 calls it 'REGION-NE' — both mean NORTHEAST. Finance ops admins use this page to review coverage and approve pending mappings."
        concepts={[
          { icon: '✓', color: '#16a34a', label: 'Mapped', desc: 'Local code resolved to canonical group code' },
          { icon: '⏳', color: '#d97706', label: 'Pending Approval', desc: 'Suggested mapping awaiting admin sign-off' },
          { icon: '✗', color: '#dc2626', label: 'Unmapped', desc: 'No canonical equivalent found — reports show raw local code' },
        ]}
        glossary={[
          { term: 'Canonical Code', def: 'Standardised group-level code used in all consolidated reports' },
          { term: 'Local Code', def: 'Subsidiary-specific dimension value as stored in BC ERP' },
          { term: 'Coverage %', def: 'Mapped ÷ Total — how complete the dimension translation is for a given type' },
        ]}
      />
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

      <PageExplainer
        icon="🗺️"
        title="What is the Canonical Dimension Framework?"
        description="Each subsidiary uses its own local dimension codes (e.g. 'NE', 'REGION-NE', 'EAST') that all mean the same canonical value ('NORTHEAST'). This page is where <strong>data engineers map local subsidiary dimension values to canonical group-wide values</strong> for Entity, Region, Client Segment, and Service Line. Without complete mapping, consolidated reports will have fragmented dimensions. Coverage % shows how many local values are mapped."
        concepts={[
          { icon: '✓', color: '#16a34a', label: 'Mapped', desc: 'Local value confirmed mapped to a canonical value' },
          { icon: '⏳', color: '#d97706', label: 'Pending Approval', desc: 'Mapping proposed — awaiting reviewer sign-off' },
          { icon: '✗', color: '#dc2626', label: 'Unmapped', desc: 'No canonical match yet — reports will show raw local code' },
        ]}
        glossary={[
          { term: 'Canonical Value', def: 'The standardised group-wide value (e.g. NORTHEAST) that all subsidiaries map to' },
          { term: 'Local Code', def: 'The subsidiary-specific dimension code from their BC environment' },
          { term: 'Coverage %', def: 'Percentage of known local values that have been mapped to a canonical value' },
        ]}
      />

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
