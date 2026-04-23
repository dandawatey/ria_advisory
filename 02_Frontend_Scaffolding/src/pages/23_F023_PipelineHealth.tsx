/**
 * F023 — Pipeline Health Dashboard
 * Ops page: run history, entity freshness grid, DQ metrics, alerts.
 */
import React, { useState } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { PipelineRun } from '../types';

const mockRuns: PipelineRun[] = [
  { runId: 'run-20260423-1402', subsidiaryCode: 'ALL',   entity: 'ALL',                    startTime: '2026-04-23 14:00', endTime: '2026-04-23 14:18', duration: 1080, status: 'success', loadType: 'incremental', rowsExtracted: 74231, rowsWritten: 73541, watermark: '2026-04-23T14:00Z', errorMessage: null },
  { runId: 'run-20260423-0600', subsidiaryCode: 'ALL',   entity: 'ALL',                    startTime: '2026-04-23 06:00', endTime: '2026-04-23 06:17', duration: 1020, status: 'success', loadType: 'incremental', rowsExtracted: 68120, rowsWritten: 67890, watermark: '2026-04-23T06:00Z', errorMessage: null },
  { runId: 'run-20260423-0915', subsidiaryCode: 'SUB05', entity: 'GeneralLedgerEntries',   startTime: '2026-04-23 09:15', endTime: '2026-04-23 09:16', duration: 62,   status: 'error',   loadType: 'incremental', rowsExtracted: 0,     rowsWritten: 0,     watermark: null,              errorMessage: 'HTTP 401 Unauthorized — certificate expired for SUB05 (cert expiry 2025-06-05). Circuit breaker opened after 3 consecutive failures.' },
  { runId: 'run-20260422-1402', subsidiaryCode: 'ALL',   entity: 'ALL',                    startTime: '2026-04-22 14:00', endTime: '2026-04-22 14:19', duration: 1140, status: 'success', loadType: 'incremental', rowsExtracted: 71002, rowsWritten: 70441, watermark: '2026-04-22T14:00Z', errorMessage: null },
];

const freshnessGrid = [
  { code: 'SUB01', name: 'Apex Capital',      lastSuccess: '2026-04-23 14:18', hoursSince: 1.4, status: 'success' as const },
  { code: 'SUB02', name: 'Blue Ridge Wealth', lastSuccess: '2026-04-23 14:18', hoursSince: 1.4, status: 'success' as const },
  { code: 'SUB03', name: 'Clearwater Fin.',   lastSuccess: '2026-04-23 14:18', hoursSince: 1.4, status: 'success' as const },
  { code: 'SUB04', name: 'Dune Capital',      lastSuccess: '2026-04-23 14:18', hoursSince: 1.4, status: 'success' as const },
  { code: 'SUB05', name: 'Evergreen',         lastSuccess: '2026-04-23 06:17', hoursSince: 9.6, status: 'warning' as const },
  { code: 'SUB06', name: 'Franklin Street',   lastSuccess: '2026-04-23 14:18', hoursSince: 1.4, status: 'success' as const },
];

const freshnessColor = (h: number) => h <= 6 ? 'var(--color-success)' : h <= 12 ? 'var(--color-warning)' : 'var(--color-error)';

export default function PipelineHealth() {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const successRate = (mockRuns.filter((r) => r.status === 'success').length / mockRuns.length * 100).toFixed(1);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pipeline Health Dashboard</h1>
        <p className="page-subtitle">
          Run history, entity freshness, DQ metrics, SLA adherence — real-time ops view. (F023)
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile">
          <div className="kpi-label">SLA Adherence (30d)</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{successRate}%</div>
          <div className="kpi-meta text-muted">Target ≥ 99.5%</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">DQ Pass Rate (critical)</div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>99.3%</div>
          <div className="kpi-meta text-muted">Target ≥ 99.5%</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Circuit Breakers Open</div>
          <div className="kpi-value" style={{ color: 'var(--color-error)' }}>1</div>
          <div className="kpi-meta text-muted">SUB05 GL entries</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Last Successful Run</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>14:18 ET</div>
          <div className="kpi-meta text-muted">All 17 tenants · Today</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 16 }}>
        {/* Run history */}
        <div className="card">
          <div className="card-title">Run History</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Run ID</th><th>Scope</th><th>Start</th><th>Duration</th><th>Type</th><th>Rows</th><th>Status</th></tr>
              </thead>
              <tbody>
                {mockRuns.map((r) => (
                  <React.Fragment key={r.runId}>
                    <tr onClick={() => setExpandedRun(expandedRun === r.runId ? null : r.runId)} style={{ cursor: 'pointer' }}>
                      <td className="table-mono" style={{ fontSize: 11 }}>{r.runId.slice(-12)}</td>
                      <td><span className="badge badge-muted">{r.subsidiaryCode}</span></td>
                      <td style={{ fontSize: 12 }}>{r.startTime}</td>
                      <td>{r.duration ? `${Math.floor(r.duration / 60)}m ${r.duration % 60}s` : '—'}</td>
                      <td><span className="badge badge-muted">{r.loadType}</span></td>
                      <td>{r.rowsExtracted.toLocaleString()}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                    {expandedRun === r.runId && (
                      <tr>
                        <td colSpan={7} style={{ background: r.status === 'error' ? 'var(--color-error-bg)' : 'var(--color-bg)', padding: '12px 16px' }}>
                          {r.errorMessage
                            ? <><strong>Error:</strong> <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.errorMessage}</span></>
                            : <span className="text-muted" style={{ fontSize: 12 }}>
                                Rows extracted: {r.rowsExtracted.toLocaleString()} · Written: {r.rowsWritten.toLocaleString()} · Watermark: {r.watermark}
                              </span>
                          }
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Freshness grid */}
        <div className="card">
          <div className="card-title">Entity Freshness</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {freshnessGrid.map((f) => (
              <div key={f.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: freshnessColor(f.hoursSince), flexShrink: 0 }} />
                <span className="badge badge-muted">{f.code}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{f.name}</span>
                <span style={{ fontSize: 11, color: freshnessColor(f.hoursSince), fontWeight: 600 }}>
                  {f.hoursSince.toFixed(1)}h ago
                </span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, padding: '0 4px' }}>
              ● &lt;6h green · ● 6–24h amber · ● &gt;24h red · Target: ≤6h
            </div>
          </div>
        </div>
      </div>

      {/* Alert config reminder */}
      <div className="card">
        <div className="card-title">Active Alert Rules</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { condition: 'Pipeline failure', target: 'platform-ops + PagerDuty', sla: 'within 5 min', active: true },
            { condition: 'Circuit breaker open', target: 'platform-ops + PagerDuty', sla: 'within 5 min', active: true },
            { condition: 'Critical DQ fail rate > 1%', target: 'platform-ops + group-finance', sla: 'within 15 min', active: true },
            { condition: 'Data freshness > 12h', target: 'platform-ops', sla: 'within 30 min', active: true },
          ].map((a) => (
            <div key={a.condition} style={{ padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--color-success)', marginTop: 1 }}>✓</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.condition}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>→ {a.target}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.sla}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
          All alert rules managed in Terraform (IaC). No manual Azure Monitor changes in production.
        </div>
      </div>
    </div>
  );
}
