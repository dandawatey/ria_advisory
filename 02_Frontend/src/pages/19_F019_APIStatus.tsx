/**
 * F019 — API Status
 * Shows health of the UFIP FastAPI backend and real data stats.
 */
import { useState, useEffect } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { Status } from '../types';
import { api } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

interface EndpointRow {
  method: string;
  path: string;
  description: string;
  status: Status;
  latencyMs: number | null;
}

export default function APIStatus() {
  const [health, setHealth] = useState<'ok' | 'error' | 'checking'>('checking');
  const [kpiData, setKpiData] = useState<{ total_entries: number; entity_count: number } | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);

  useEffect(() => {
    const BASE = 'http://localhost:8000';
    const checks: { method: string; path: string; desc: string }[] = [
      { method: 'GET', path: '/health',                    desc: 'API health check' },
      { method: 'GET', path: '/api/dashboard/kpis',       desc: 'Dashboard KPIs' },
      { method: 'GET', path: '/api/dashboard/entities',   desc: 'Entity summary' },
      { method: 'GET', path: '/api/dashboard/pl-trend',   desc: 'P&L trend' },
      { method: 'GET', path: '/api/entities/',            desc: 'Entity list' },
      { method: 'GET', path: '/api/gl/stats',             desc: 'GL statistics' },
      { method: 'GET', path: '/api/gl/accounts',          desc: 'GL accounts' },
      { method: 'GET', path: '/api/gl/entries',           desc: 'GL entries (search)' },
    ];

    Promise.allSettled(
      checks.map(async (c) => {
        const start = Date.now();
        const res = await fetch(`${BASE}${c.path}`);
        const latency = Date.now() - start;
        return { ...c, ok: res.ok, latency };
      })
    ).then((results) => {
      const rows: EndpointRow[] = results.map((r, i) => {
        if (r.status === 'fulfilled') {
          return {
            method: checks[i].method,
            path: checks[i].path,
            description: checks[i].desc,
            status: (r.value.ok ? 'success' : 'error') as Status,
            latencyMs: r.value.latency,
          };
        }
        return {
          method: checks[i].method,
          path: checks[i].path,
          description: checks[i].desc,
          status: 'error' as Status,
          latencyMs: null,
        };
      });
      setEndpoints(rows);
      setHealth(rows.every((r) => r.status === 'success') ? 'ok' : 'error');
    });

    // Also load KPI for summary
    api.dashboard.kpis().then((k) => setKpiData(k)).catch(() => null);
  }, []);

  const successCount = endpoints.filter((e) => e.status === 'success').length;
  const avgLatency = endpoints.filter((e) => e.latencyMs !== null).reduce((s, e) => s + (e.latencyMs ?? 0), 0) / Math.max(1, endpoints.filter((e) => e.latencyMs !== null).length);

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">API Status</h1>
            <p className="page-subtitle">UFIP FastAPI backend · http://localhost:8000</p>
          </div>
          <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            Open API Docs ↗
          </a>
        </div>
      </div>

      <PageExplainer
        icon="🩺"
        title="What is API Status?"
        description="This page performs <strong>live health checks against every FastAPI backend endpoint</strong> and displays latency and status. DevOps engineers and developers use it to verify the backend is running, all endpoints respond correctly, and the database connection is active. The endpoint list shows response time in milliseconds — useful for identifying slow queries or broken routes."
        concepts={[
          { icon: '✓', color: '#16a34a', label: 'Healthy', desc: 'All endpoints returning 2xx — system operational' },
          { icon: '⚠', color: '#d97706', label: 'Degraded', desc: 'Some endpoints failing — check individual rows' },
          { icon: '✗', color: '#dc2626', label: 'Down', desc: 'Backend not reachable — start uvicorn server' },
        ]}
        glossary={[
          { term: 'Latency (ms)', def: 'Time in milliseconds for the endpoint to respond to a GET request' },
          { term: '401', def: 'Unauthorized — endpoint requires a valid auth token' },
          { term: '5xx', def: 'Server error — backend threw an exception' },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: health === 'ok' ? 'var(--color-success)' : health === 'error' ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
            {health === 'checking' ? '…' : health === 'ok' ? 'Healthy' : 'Degraded'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Overall Status</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{endpoints.length > 0 ? `${successCount}/${endpoints.length}` : '…'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Endpoints OK</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{avgLatency > 0 ? `${Math.round(avgLatency)}ms` : '…'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Avg Latency</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{kpiData ? kpiData.total_entries.toLocaleString() : '…'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>GL Entries in DB</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Endpoint Health</div>
        <div className="table-wrap">
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Method</th><th>Endpoint</th><th>Description</th>
                <th style={{ textAlign: 'right' }}>Latency</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>Checking endpoints…</td></tr>
              ) : endpoints.map((e) => (
                <tr key={e.path}>
                  <td><span className="badge badge-info" style={{ fontSize: 10 }}>{e.method}</span></td>
                  <td className="table-mono" style={{ fontSize: 12 }}>{e.path}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{e.description}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                    {e.latencyMs !== null ? `${e.latencyMs}ms` : '—'}
                  </td>
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
