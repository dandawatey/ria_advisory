/**
 * F012 — Data Quality Framework
 * Ops page: DQ rule suite, pass rates, exception queue.
 */
import { useState } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { DQException } from '../types';

interface DQRule {
  ruleId: string;
  ruleName: string;
  entity: string;
  severity: 'critical' | 'warning';
  description: string;
  passRate: number;
  lastRunRows: number;
  lastRunFailed: number;
  status: 'success' | 'warning' | 'error';
}

const mockRules: DQRule[] = [
  { ruleId: 'DQ-001', ruleName: 'GL Account Canonical Mapping Required', entity: 'fact_gl_entry',        severity: 'critical', description: 'Every GL row must map to a canonical account (F007).', passRate: 99.8, lastRunRows: 48321, lastRunFailed: 97,  status: 'warning' },
  { ruleId: 'DQ-002', ruleName: 'Posting Date Not Null & Valid Range',   entity: 'fact_gl_entry',        severity: 'critical', description: 'posting_date not null, ≥ 2000-01-01, ≤ close_date + 30d.', passRate: 100,  lastRunRows: 48321, lastRunFailed: 0,   status: 'success' },
  { ruleId: 'DQ-003', ruleName: 'Journal Entry Balance Check',           entity: 'fact_gl_entry',        severity: 'critical', description: 'Debit + Credit = 0 per document number.', passRate: 100,  lastRunRows: 48321, lastRunFailed: 0,   status: 'success' },
  { ruleId: 'DQ-004', ruleName: 'FX Rate Available for Non-USD',        entity: 'fact_gl_entry',        severity: 'critical', description: 'FX rate must exist for all non-USD posting date/currency combos.', passRate: 99.5, lastRunRows: 8230,  lastRunFailed: 41,  status: 'warning' },
  { ruleId: 'DQ-005', ruleName: 'Dimension Values Mapped',              entity: 'fact_gl_entry',        severity: 'warning',  description: 'All dimension values should have canonical mappings.', passRate: 96.2, lastRunRows: 48321, lastRunFailed: 1831, status: 'warning' },
  { ruleId: 'DQ-006', ruleName: 'Customer Record Completeness',          entity: 'dim_customer',         severity: 'warning',  description: 'displayName not null; city populated for >90% of records.', passRate: 98.1, lastRunRows: 5420,  lastRunFailed: 103, status: 'warning' },
  { ruleId: 'DQ-007', ruleName: 'Invoice Amount Not Zero',               entity: 'fact_ar_invoice_line', severity: 'warning',  description: 'line_amount should not be 0 — potential data entry error.', passRate: 99.9, lastRunRows: 2301,  lastRunFailed: 2,   status: 'success' },
  { ruleId: 'DQ-008', ruleName: 'Row Count Anomaly Detection',           entity: 'fact_gl_entry',        severity: 'warning',  description: 'Row count ≤ ±20% of prior period for same subsidiary.', passRate: 94.1, lastRunRows: 17,    lastRunFailed: 1,   status: 'warning' },
];

const mockExceptions: DQException[] = [
  { id: 'exc-001', runId: 'run-20260423-1402', entity: 'fact_gl_entry', subsidiaryCode: 'SUB02', ruleId: 'DQ-001', ruleName: 'GL Account Canonical Mapping Required', severity: 'critical', rowsChecked: 36102, rowsFailed: 97, passRate: 99.7, timestamp: '2026-04-23 14:22', status: 'open' },
  { id: 'exc-002', runId: 'run-20260423-1402', entity: 'fact_gl_entry', subsidiaryCode: 'SUB12', ruleId: 'DQ-004', ruleName: 'FX Rate Available for Non-USD',          severity: 'critical', rowsChecked: 8230,  rowsFailed: 41, passRate: 99.5, timestamp: '2026-04-23 14:22', status: 'open' },
];

export default function DataQuality() {
  const [activeTab, setActiveTab] = useState<'rules' | 'exceptions'>('rules');
  const criticalFail = mockRules.filter((r) => r.severity === 'critical' && r.passRate < 99.5).length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Data Quality Framework</h1>
        <p className="page-subtitle">
          Great Expectations rule suites — critical rules block Silver→Gold promotion. (F012)
        </p>
        <div className="page-actions">
          <button className="btn btn-primary">+ Add Rule</button>
          <button className="btn btn-secondary">Run DQ Suite Now</button>
        </div>
      </div>

      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile"><div className="kpi-label">Total Rules</div><div className="kpi-value">{mockRules.length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Critical Rules</div><div className="kpi-value">{mockRules.filter((r) => r.severity === 'critical').length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Critical Failing</div><div className="kpi-value" style={{ color: criticalFail > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{criticalFail}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Open Exceptions</div><div className="kpi-value" style={{ color: 'var(--color-error)' }}>{mockExceptions.filter((e) => e.status === 'open').length}</div></div>
      </div>

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>Rule Suite</div>
          <div className={`tab ${activeTab === 'exceptions' ? 'active' : ''}`} onClick={() => setActiveTab('exceptions')}>
            Open Exceptions <span className="badge badge-error" style={{ marginLeft: 6 }}>{mockExceptions.filter((e) => e.status === 'open').length}</span>
          </div>
        </div>

        {activeTab === 'rules' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Rule ID</th><th>Rule</th><th>Entity</th><th>Severity</th><th>Pass Rate</th><th>Failed Rows</th><th>Status</th></tr>
              </thead>
              <tbody>
                {mockRules.map((r) => (
                  <tr key={r.ruleId}>
                    <td className="table-mono">{r.ruleId}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.ruleName}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.description}</div>
                    </td>
                    <td className="table-mono" style={{ fontSize: 11 }}>{r.entity}</td>
                    <td>
                      <span className={`badge ${r.severity === 'critical' ? 'badge-error' : 'badge-warning'}`}>
                        {r.severity}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 60 }}>
                          <div className={`progress-fill ${r.passRate >= 99.5 ? 'progress-fill-success' : 'progress-fill-warning'}`}
                            style={{ width: `${r.passRate}%` }} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{r.passRate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{ color: r.lastRunFailed > 0 ? 'var(--color-error)' : 'inherit', fontWeight: r.lastRunFailed > 0 ? 700 : 400 }}>
                      {r.lastRunFailed.toLocaleString()}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'exceptions' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Subsidiary</th><th>Entity</th><th>Rule</th><th>Severity</th><th>Rows Failed</th><th>Timestamp</th><th>Status</th></tr>
              </thead>
              <tbody>
                {mockExceptions.map((e) => (
                  <tr key={e.id}>
                    <td><span className="badge badge-muted">{e.subsidiaryCode}</span></td>
                    <td className="table-mono" style={{ fontSize: 11 }}>{e.entity}</td>
                    <td style={{ fontSize: 12 }}>{e.ruleName}</td>
                    <td><span className={`badge ${e.severity === 'critical' ? 'badge-error' : 'badge-warning'}`}>{e.severity}</span></td>
                    <td style={{ color: 'var(--color-error)', fontWeight: 700 }}>{e.rowsFailed}</td>
                    <td style={{ fontSize: 12 }} className="text-muted">{e.timestamp}</td>
                    <td><span className={`badge ${e.status === 'open' ? 'badge-error' : 'badge-success'}`}>{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
