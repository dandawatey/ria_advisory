/**
 * F019 — API Layer Status
 * Admin page: endpoint registry, health, rate limits, API version status.
 */
import React from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';

interface Endpoint {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  description: string;
  version: string;
  p95Ms: number;
  callsPerHour: number;
  status: 'success' | 'warning' | 'error';
  auth: string;
}

const endpoints: Endpoint[] = [
  { method: 'GET',  path: '/api/v1/dashboard/summary',          description: 'Executive dashboard KPI tiles',        version: 'v1', p95Ms: 980,  callsPerHour: 1240, status: 'success', auth: 'Bearer JWT' },
  { method: 'GET',  path: '/api/v1/dashboard/pl',               description: 'Consolidated P&L table',              version: 'v1', p95Ms: 1820, callsPerHour: 890,  status: 'success', auth: 'Bearer JWT' },
  { method: 'GET',  path: '/api/v1/entities/{id}/trial-balance', description: 'Entity trial balance',               version: 'v1', p95Ms: 1240, callsPerHour: 340,  status: 'success', auth: 'Bearer JWT + entity scope' },
  { method: 'GET',  path: '/api/v1/close/{period}/status',      description: 'Close cockpit period status',         version: 'v1', p95Ms: 640,  callsPerHour: 210,  status: 'success', auth: 'Bearer JWT' },
  { method: 'POST', path: '/api/v1/explorer/query',             description: 'Ad-hoc Gold query (GraphQL)',         version: 'v1', p95Ms: 4820, callsPerHour: 180,  status: 'warning', auth: 'Bearer JWT' },
  { method: 'GET',  path: '/api/v1/pipeline/runs',              description: 'Pipeline run history',               version: 'v1', p95Ms: 420,  callsPerHour: 120,  status: 'success', auth: 'Bearer JWT' },
  { method: 'POST', path: '/api/v1/pipeline/trigger',           description: 'On-demand pipeline trigger (admin)', version: 'v1', p95Ms: 1100, callsPerHour: 8,    status: 'success', auth: 'Bearer JWT + admin role' },
  { method: 'GET',  path: '/api/v1/mappings/accounts',          description: 'Account mapping table',              version: 'v1', p95Ms: 380,  callsPerHour: 420,  status: 'success', auth: 'Bearer JWT' },
  { method: 'POST', path: '/api/v1/mappings/accounts',          description: 'Propose account mapping',            version: 'v1', p95Ms: 290,  callsPerHour: 18,   status: 'success', auth: 'Bearer JWT + finance role' },
  { method: 'GET',  path: '/api/v1/powerbi/embed-token',        description: 'Fetch Power BI embed token',         version: 'v1', p95Ms: 1800, callsPerHour: 310,  status: 'success', auth: 'Bearer JWT' },
];

const methodColor: Record<Endpoint['method'], string> = {
  GET: 'badge-success', POST: 'badge-info', DELETE: 'badge-error',
};

export default function APIStatus() {
  const avgP95 = Math.round(endpoints.reduce((s, e) => s + e.p95Ms, 0) / endpoints.length);
  const totalCalls = endpoints.reduce((s, e) => s + e.callsPerHour, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">API Layer Status</h1>
        <p className="page-subtitle">
          Versioned REST + GraphQL API — FastAPI backend, Databricks SQL Warehouse. (F019)
        </p>
        <div className="page-actions">
          <a className="btn btn-secondary" href="/api/v1/docs" target="_blank">OpenAPI Docs ↗</a>
        </div>
      </div>

      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile"><div className="kpi-label">Endpoints</div><div className="kpi-value">{endpoints.length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Avg P95 Latency</div><div className="kpi-value">{avgP95}ms</div><div className="kpi-meta text-muted">Dashboard target &lt; 2500ms</div></div>
        <div className="kpi-tile"><div className="kpi-label">Calls / Hour</div><div className="kpi-value">{totalCalls.toLocaleString()}</div></div>
        <div className="kpi-tile"><div className="kpi-label">API Availability</div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>99.97%</div><div className="kpi-meta text-muted">Target 99.9%</div></div>
      </div>

      {/* Rate limits */}
      <div className="card mb-16">
        <div className="card-title">Rate Limits</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
          <div style={{ padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 6 }}>
            <div style={{ fontWeight: 600 }}>Per User</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>100 requests / minute</div>
          </div>
          <div style={{ padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 6 }}>
            <div style={{ fontWeight: 600 }}>Per Group</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>1,000 requests / minute</div>
          </div>
          <div style={{ padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 6 }}>
            <div style={{ fontWeight: 600 }}>Query Timeout (REST)</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>30 seconds → HTTP 503 + Retry-After</div>
          </div>
          <div style={{ padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 6 }}>
            <div style={{ fontWeight: 600 }}>Query Timeout (GraphQL/Explorer)</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>60 seconds → HTTP 503 + Retry-After</div>
          </div>
        </div>
      </div>

      {/* Endpoint table */}
      <div className="card">
        <div className="card-title">Endpoint Registry — v1</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Method</th><th>Path</th><th>Description</th><th>P95</th><th>Calls/hr</th><th>Auth</th><th>Status</th></tr>
            </thead>
            <tbody>
              {endpoints.map((e) => (
                <tr key={e.path}>
                  <td><span className={`badge ${methodColor[e.method]}`}>{e.method}</span></td>
                  <td className="table-mono" style={{ fontSize: 12 }}>{e.path}</td>
                  <td style={{ fontSize: 12 }}>{e.description}</td>
                  <td style={{ fontWeight: e.p95Ms > 2500 ? 700 : 400, color: e.p95Ms > 2500 ? 'var(--color-error)' : e.p95Ms > 1500 ? 'var(--color-warning)' : 'inherit' }}>
                    {e.p95Ms}ms
                  </td>
                  <td>{e.callsPerHour.toLocaleString()}</td>
                  <td style={{ fontSize: 11 }} className="text-muted">{e.auth}</td>
                  <td><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
