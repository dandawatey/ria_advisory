/**
 * F002 — BC Data Extraction Engine
 * Admin page: entity catalog, extraction config, watermark status.
 */
import { useState } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import PageExplainer from '../components/common/PageExplainer';

interface EntityConfig {
  entity: string;
  bcEndpoint: string;
  loadStrategy: 'delta_token' | 'last_modified' | 'full_only';
  pageSize: number;
  selectFields: string;
  lastWatermark: string | null;
  lastStatus: 'success' | 'error' | 'pending' | 'idle';
  rowsLastRun: number;
}

const mockEntities: EntityConfig[] = [
  { entity: 'GeneralLedgerEntries',     bcEndpoint: '/api/v2.0/companies/{id}/generalLedgerEntries',     loadStrategy: 'delta_token',   pageSize: 1000, selectFields: 'id,postingDate,accountNo,amount,...', lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 48321 },
  { entity: 'ChartOfAccounts',          bcEndpoint: '/api/v2.0/companies/{id}/accounts',                  loadStrategy: 'last_modified', pageSize: 500,  selectFields: 'id,number,name,accountType,...',    lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 412 },
  { entity: 'Dimensions',               bcEndpoint: '/api/v2.0/companies/{id}/dimensions',                loadStrategy: 'last_modified', pageSize: 500,  selectFields: 'id,code,name,...',                  lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 87 },
  { entity: 'DimensionValues',          bcEndpoint: '/api/v2.0/companies/{id}/dimensionValues',           loadStrategy: 'last_modified', pageSize: 500,  selectFields: 'id,code,dimensionCode,name,...',    lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 1203 },
  { entity: 'Customers',                bcEndpoint: '/api/v2.0/companies/{id}/customers',                 loadStrategy: 'delta_token',   pageSize: 1000, selectFields: 'id,number,displayName,city,...',    lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 5420 },
  { entity: 'Vendors',                  bcEndpoint: '/api/v2.0/companies/{id}/vendors',                   loadStrategy: 'delta_token',   pageSize: 1000, selectFields: 'id,number,displayName,...',          lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 892 },
  { entity: 'SalesInvoices',            bcEndpoint: '/api/v2.0/companies/{id}/salesInvoices',             loadStrategy: 'delta_token',   pageSize: 1000, selectFields: 'id,number,postingDate,totalAmount,...', lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 2301 },
  { entity: 'PurchaseInvoices',         bcEndpoint: '/api/v2.0/companies/{id}/purchaseInvoices',          loadStrategy: 'delta_token',   pageSize: 1000, selectFields: 'id,number,postingDate,totalAmount,...', lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 1845 },
  { entity: 'BankAccounts',             bcEndpoint: '/api/v2.0/companies/{id}/bankAccounts',              loadStrategy: 'last_modified', pageSize: 200,  selectFields: 'id,code,name,currencyCode,...',     lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 34 },
  { entity: 'BankAccountLedgerEntries', bcEndpoint: '/api/v2.0/companies/{id}/bankAccountLedgerEntries', loadStrategy: 'delta_token',   pageSize: 1000, selectFields: 'id,bankAccountNo,postingDate,...',  lastWatermark: '2026-04-23T14:02:00Z', lastStatus: 'success', rowsLastRun: 12043 },
  { entity: 'FixedAssets',              bcEndpoint: '/api/v2.0/companies/{id}/fixedAssets',              loadStrategy: 'last_modified', pageSize: 500,  selectFields: 'id,no,description,acquisitionDate,...', lastWatermark: '2026-04-22T14:02:00Z', lastStatus: 'success', rowsLastRun: 217 },
  { entity: 'CurrencyExchangeRates',    bcEndpoint: '/api/v2.0/companies/{id}/currencyExchangeRates',    loadStrategy: 'full_only',     pageSize: 1000, selectFields: 'currencyCode,startingDate,relationalExchangeRate,...', lastWatermark: null, lastStatus: 'success', rowsLastRun: 2890 },
];

const strategyLabel: Record<EntityConfig['loadStrategy'], string> = {
  delta_token: 'Δ Delta Token',
  last_modified: '⏱ Last-Modified',
  full_only: '⟳ Full Load',
};

export default function DataExtraction() {
  const [selected, setSelected] = useState<EntityConfig | null>(null);

  return (
    <div>
      <PageExplainer
        icon="⚙️"
        title="What is the Data Extraction Engine?"
        description="This page controls <strong>how and when data is pulled from Business Central</strong> into the platform. Each BC entity (GL entries, customers, invoices, etc.) has its own extraction config: endpoint URL, load strategy, page size, and last watermark. Finance ops teams use it to monitor extraction health, review row counts per run, and adjust incremental sync parameters."
        concepts={[
          { icon: '⟳', color: '#2563eb', label: 'Delta Token', desc: 'Incremental pull using BC change token — only new/changed rows fetched' },
          { icon: '📅', color: '#7c3aed', label: 'Last Modified', desc: 'Pulls rows where modifiedAt > last watermark timestamp' },
          { icon: '⬇', color: '#6b7280', label: 'Full Load', desc: 'Complete table reload — used for small reference tables' },
        ]}
        glossary={[
          { term: 'Watermark', def: 'Last successful sync timestamp or delta token — used to determine what to pull next' },
          { term: 'Page Size', def: 'Number of records per OData API request — affects speed vs memory tradeoff' },
          { term: 'Rows Last Run', def: 'Count of records extracted in the most recent sync job' },
        ]}
      />
      <div className="page-header">
        <h1 className="page-title">Data Extraction Engine</h1>
        <p className="page-subtitle">
          Entity catalog — OData extraction config, load strategy, watermarks, and field projections per BC entity. (F002)
        </p>
        <div className="page-actions">
          <button className="btn btn-primary">+ Add Custom Entity</button>
          <button className="btn btn-secondary">Export Catalog</button>
        </div>
      </div>

      <PageExplainer
        icon="⚙️"
        title="What is the Data Extraction Engine?"
        description="This page configures <strong>how each Business Central entity is extracted</strong> via OData API. Finance ops and data engineers use it to set load strategy, page size, watermark timestamps, and field projections per entity. The extraction runs on schedule and feeds the Bronze Zone. Clicking a row opens the config panel to tune the extraction for that entity."
        concepts={[
          { icon: 'Δ', color: '#2563eb', label: 'Delta Token', desc: 'Incremental — only new/changed records since last run' },
          { icon: '⏱', color: '#0891b2', label: 'Last-Modified', desc: 'Pulls records changed since last watermark timestamp' },
          { icon: '⟳', color: '#6b7280', label: 'Full Load', desc: 'Always reloads all rows — used for small lookup tables' },
        ]}
        glossary={[
          { term: 'Watermark', def: 'Timestamp of last successful extract — used as starting point for next delta pull' },
          { term: 'Page Size', def: 'Number of records fetched per OData API call ($top parameter)' },
          { term: '$select', def: 'Field projection — limits which columns are pulled from BC to reduce payload size' },
        ]}
      />

      <div className="card">
        <div className="card-title">Entity Catalog ({mockEntities.length} entities)</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Load Strategy</th>
                <th>Page Size</th>
                <th>Last Watermark</th>
                <th>Rows (Last Run)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockEntities.map((e) => (
                <tr key={e.entity} onClick={() => setSelected(e)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{e.entity}</td>
                  <td>
                    <span className={`badge ${e.loadStrategy === 'full_only' ? 'badge-muted' : 'badge-info'}`}>
                      {strategyLabel[e.loadStrategy]}
                    </span>
                  </td>
                  <td>{e.pageSize.toLocaleString()}</td>
                  <td className="table-mono text-muted" style={{ fontSize: 11 }}>
                    {e.lastWatermark ? e.lastWatermark.replace('T', ' ').replace('Z', '') : '—'}
                  </td>
                  <td style={{ fontWeight: 500 }}>{e.rowsLastRun.toLocaleString()}</td>
                  <td><StatusBadge status={e.lastStatus} /></td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={(ev) => { ev.stopPropagation(); setSelected(e); }}>
                      Configure
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="card mt-16">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ margin: 0 }}>{selected.entity} — Extraction Config</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">BC OData Endpoint</label>
              <input className="form-input table-mono" readOnly value={selected.bcEndpoint} />
            </div>
            <div className="form-group">
              <label className="form-label">Load Strategy</label>
              <select className="form-select" defaultValue={selected.loadStrategy}>
                <option value="delta_token">Delta Token (@odata.deltaLink)</option>
                <option value="last_modified">Last-Modified Filter</option>
                <option value="full_only">Full Load Only</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Page Size ($top)</label>
              <input className="form-input" type="number" defaultValue={selected.pageSize} />
            </div>
            <div className="form-group">
              <label className="form-label">Overlap Window (minutes)</label>
              <input className="form-input" type="number" defaultValue={15} />
            </div>
          </div>
          <div className="form-group mt-16">
            <label className="form-label">$select Field Projection</label>
            <textarea className="form-input table-mono" rows={3} defaultValue={selected.selectFields} />
          </div>
          <div className="mt-16 flex gap-8">
            <button className="btn btn-primary btn-sm">Save Config</button>
            <button className="btn btn-secondary btn-sm">Reset Watermark</button>
          </div>
        </div>
      )}
    </div>
  );
}
