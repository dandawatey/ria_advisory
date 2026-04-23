/**
 * F013 — Column-Level Data Lineage
 * Compliance page: lineage graph, column trace, Unity Catalog integration.
 */
import React, { useState } from 'react';

interface LineageNode {
  layer: 'Bronze' | 'Silver' | 'Gold' | 'Mapping' | 'UI';
  table: string;
  column: string;
  transformation?: string;
}

const sampleTraces: Record<string, LineageNode[]> = {
  'fact_gl_entry.amount_usd': [
    { layer: 'Bronze', table: 'bronze.sub01.gl_entry', column: 'amount', transformation: 'Raw BC API field' },
    { layer: 'Silver', table: 'silver.sub01.gl_entry', column: 'amount_lcy', transformation: 'CAST(amount AS DECIMAL(18,4))' },
    { layer: 'Mapping', table: 'mapping.fx_rate', column: 'rate_value', transformation: 'JOIN on currency_code + rate_date + rate_type' },
    { layer: 'Gold', table: 'gold.fact_gl_entry', column: 'amount_usd', transformation: 'amount_lcy * exchange_rate_used' },
  ],
  'fact_gl_entry.canonical_account_id': [
    { layer: 'Bronze', table: 'bronze.sub01.gl_entry', column: 'accountNo', transformation: 'Raw BC API field' },
    { layer: 'Silver', table: 'silver.sub01.gl_entry', column: 'account_no', transformation: 'TRIM(accountNo)' },
    { layer: 'Mapping', table: 'mapping.account_canonical', column: 'canonical_account_id', transformation: 'JOIN on subsidiary_code + local_account_no' },
    { layer: 'Gold', table: 'gold.fact_gl_entry', column: 'canonical_account_id', transformation: 'Direct from mapping join' },
  ],
};

const coverageStats = [
  { layer: 'Bronze → Silver', coverage: 98, columns: 142 },
  { layer: 'Silver → Gold',   coverage: 96, columns: 89 },
  { layer: 'Mapping joins',   coverage: 100, columns: 24 },
];

const layerColors: Record<LineageNode['layer'], string> = {
  Bronze: '#92400e', Silver: '#64748b', Gold: '#854d0e', Mapping: '#1e40af', UI: '#065f46',
};

export default function DataLineage() {
  const [selectedTrace, setSelectedTrace] = useState<string>(Object.keys(sampleTraces)[0]);
  const trace = sampleTraces[selectedTrace];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Column-Level Data Lineage</h1>
        <p className="page-subtitle">
          End-to-end column lineage from Bronze source to Gold consumption via Unity Catalog. (F013)
        </p>
        <div className="page-actions">
          <button className="btn btn-secondary">Open Unity Catalog</button>
          <button className="btn btn-secondary">Export Lineage Report</button>
        </div>
      </div>

      {/* Coverage */}
      <div className="card mb-16">
        <div className="card-title">Lineage Coverage</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {coverageStats.map((s) => (
            <div key={s.layer} style={{ padding: 16, border: '1px solid var(--color-border)', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.layer}</div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0' }}>
                {s.coverage}%
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${s.coverage >= 95 ? 'progress-fill-success' : 'progress-fill-warning'}`}
                  style={{ width: `${s.coverage}%` }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                {s.columns} columns traced
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Column trace */}
      <div className="card">
        <div className="card-title">Column Lineage Trace</div>
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Trace column:</label>
          <select className="form-select" style={{ maxWidth: 380 }} value={selectedTrace}
            onChange={(e) => setSelectedTrace(e.target.value)}>
            {Object.keys(sampleTraces).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {/* Visual lineage graph */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', overflowX: 'auto', padding: '8px 0' }}>
          {trace.map((node, idx) => (
            <React.Fragment key={idx}>
              <div style={{
                minWidth: 200,
                background: `${layerColors[node.layer]}18`,
                border: `2px solid ${layerColors[node.layer]}`,
                borderRadius: 8,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: layerColors[node.layer], textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {node.layer}
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }} className="table-mono">
                  {node.column}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  {node.table}
                </div>
                {node.transformation && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, fontStyle: 'italic', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                    {node.transformation}
                  </div>
                )}
              </div>
              {idx < trace.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: 'var(--color-text-muted)', fontSize: 20 }}>
                  →
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="divider" />
        <div className="alert alert-info" style={{ fontSize: 12 }}>
          Full lineage registered in Unity Catalog. Access via Databricks workspace → Data tab → {trace[trace.length - 1].table} → Column lineage.
        </div>
      </div>
    </div>
  );
}
