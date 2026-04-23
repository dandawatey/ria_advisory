/**
 * F016 — Close Cockpit
 * Finance ops page: close status board, IC review, sign-off workflow.
 */
import React, { useState } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { ClosePeriodStatus } from '../types';

const mockStatus: ClosePeriodStatus[] = [
  { subsidiaryCode: 'SUB01', subsidiaryName: 'Apex Capital Advisors',     pipelineStatus: 'success', lastRunAt: '2026-04-23 14:02', dqStatus: 'success', dqExceptionCount: 0,  mappingCoverage: 100, icStatus: 'matched',   closeStatus: 'signed_off',  signedOffBy: 'Marcus Chen',  signedOffAt: '2026-04-23 09:00' },
  { subsidiaryCode: 'SUB02', subsidiaryName: 'Blue Ridge Wealth Mgmt',    pipelineStatus: 'success', lastRunAt: '2026-04-23 14:02', dqStatus: 'warning', dqExceptionCount: 97, mappingCoverage: 97.6, icStatus: 'matched',   closeStatus: 'reviewed',    signedOffBy: 'Marcus Chen',  signedOffAt: null },
  { subsidiaryCode: 'SUB03', subsidiaryName: 'Clearwater Financial',      pipelineStatus: 'success', lastRunAt: '2026-04-23 14:02', dqStatus: 'success', dqExceptionCount: 0,  mappingCoverage: 100, icStatus: 'matched',   closeStatus: 'reviewed',    signedOffBy: 'Priya Nair',   signedOffAt: null },
  { subsidiaryCode: 'SUB04', subsidiaryName: 'Dune Capital Partners',     pipelineStatus: 'success', lastRunAt: '2026-04-23 14:02', dqStatus: 'success', dqExceptionCount: 0,  mappingCoverage: 100, icStatus: 'unmatched', closeStatus: 'pending',     signedOffBy: null,           signedOffAt: null },
  { subsidiaryCode: 'SUB05', subsidiaryName: 'Evergreen Invest. Counsel', pipelineStatus: 'error',   lastRunAt: '2026-04-23 09:15', dqStatus: 'error',   dqExceptionCount: 41, mappingCoverage: 100, icStatus: 'no_ic',     closeStatus: 'pending',     signedOffBy: null,           signedOffAt: null },
  { subsidiaryCode: 'SUB06', subsidiaryName: 'Franklin Street Advisors',  pipelineStatus: 'success', lastRunAt: '2026-04-23 14:02', dqStatus: 'success', dqExceptionCount: 0,  mappingCoverage: 100, icStatus: 'matched',   closeStatus: 'pending',     signedOffBy: null,           signedOffAt: null },
];

const closeColor: Record<ClosePeriodStatus['closeStatus'], string> = {
  pending:    'badge-muted', reviewed: 'badge-warning', signed_off: 'badge-success',
};

const icColor: Record<ClosePeriodStatus['icStatus'], string> = {
  matched: 'badge-success', unmatched: 'badge-error', no_ic: 'badge-muted',
};

export default function CloseCockpit() {
  const [period, setPeriod] = useState('Apr 2026');
  const [activeTab, setActiveTab] = useState<'status' | 'exceptions' | 'ic'>('status');
  const [signing, setSigning] = useState(false);

  const ready = mockStatus.filter((s) => s.closeStatus === 'reviewed' || s.closeStatus === 'signed_off').length;
  const signedOff = mockStatus.filter((s) => s.closeStatus === 'signed_off').length;
  const criticalBlocked = mockStatus.filter((s) => s.dqStatus === 'error').length;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Close Cockpit</h1>
            <p className="page-subtitle">Period close management, IC reconciliation, and sign-off workflow. (F016)</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="form-select" style={{ width: 160 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option>Apr 2026</option><option>Mar 2026</option><option>Feb 2026</option>
            </select>
            <button className="btn btn-secondary" onClick={() => {}}>⟳ Refresh All</button>
            <button
              className="btn btn-primary"
              disabled={criticalBlocked > 0 || ready < mockStatus.length}
              onClick={() => setSigning(true)}
            >
              ✓ Sign Off Consolidation
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile"><div className="kpi-label">Entities Ready</div><div className="kpi-value">{ready}/{mockStatus.length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Signed Off</div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>{signedOff}</div></div>
        <div className="kpi-tile"><div className="kpi-label">DQ Blocked</div><div className="kpi-value" style={{ color: criticalBlocked > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{criticalBlocked}</div></div>
        <div className="kpi-tile"><div className="kpi-label">IC Unmatched</div><div className="kpi-value" style={{ color: 'var(--color-warning)' }}>1</div></div>
      </div>

      {criticalBlocked > 0 && (
        <div className="alert alert-error mb-24">
          ✗ <strong>{criticalBlocked} entity(s) have critical DQ failures</strong> blocking Gold promotion.
          Resolve in the Data Quality panel before sign-off is possible.
        </div>
      )}

      {signing && (
        <div className="alert alert-success mb-24">
          ✓ Consolidation sign-off recorded for <strong>{period}</strong> by Marcus Chen at 2026-04-23 15:42 ET.
          Audit log entry created (ID: audit-20260423-001).
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }} onClick={() => setSigning(false)}>Dismiss</button>
        </div>
      )}

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>Close Status Board</div>
          <div className={`tab ${activeTab === 'exceptions' ? 'active' : ''}`} onClick={() => setActiveTab('exceptions')}>DQ Exceptions</div>
          <div className={`tab ${activeTab === 'ic' ? 'active' : ''}`} onClick={() => setActiveTab('ic')}>IC Reconciliation</div>
        </div>

        {activeTab === 'status' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Subsidiary</th><th>Pipeline</th><th>DQ Status</th><th>Mapping</th><th>IC Status</th><th>Close Status</th><th>Signed Off By</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {mockStatus.map((s) => (
                  <tr key={s.subsidiaryCode}>
                    <td><span className="badge badge-muted">{s.subsidiaryCode}</span></td>
                    <td style={{ fontWeight: 500 }}>{s.subsidiaryName}</td>
                    <td><StatusBadge status={s.pipelineStatus} /></td>
                    <td>
                      <StatusBadge status={s.dqStatus} />
                      {s.dqExceptionCount > 0 && <span className="badge badge-error" style={{ marginLeft: 4 }}>{s.dqExceptionCount}</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="progress-bar" style={{ width: 50 }}>
                          <div className={`progress-fill ${s.mappingCoverage === 100 ? 'progress-fill-success' : 'progress-fill-warning'}`}
                            style={{ width: `${s.mappingCoverage}%` }} />
                        </div>
                        <span style={{ fontSize: 12 }}>{s.mappingCoverage.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${icColor[s.icStatus]}`}>{s.icStatus}</span></td>
                    <td><span className={`badge ${closeColor[s.closeStatus]}`}>{s.closeStatus.replace('_', ' ')}</span></td>
                    <td style={{ fontSize: 12 }} className="text-muted">{s.signedOffBy ?? '—'}</td>
                    <td>
                      {s.closeStatus === 'pending' && (
                        <button className="btn btn-secondary btn-sm" disabled={s.dqStatus === 'error'}>
                          Mark Reviewed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'exceptions' && (
          <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
            DQ exception detail — see F012 Data Quality page for full rule suite.
            {mockStatus.filter((s) => s.dqExceptionCount > 0).map((s) => (
              <div key={s.subsidiaryCode} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 8, marginTop: 12 }}>
                <span className="badge badge-muted">{s.subsidiaryCode}</span>
                <span style={{ marginLeft: 8, fontWeight: 500 }}>{s.subsidiaryName}</span>
                <span className="badge badge-error" style={{ marginLeft: 8 }}>{s.dqExceptionCount} exceptions</span>
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }}>View Details</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ic' && (
          <div style={{ padding: 16, fontSize: 13 }}>
            <div className="alert alert-warning mb-16">
              SUB04 ↔ SUB07 · IC Payable (5900) · Apr 2026 · Variance: <strong>$1,800</strong> — Unmatched
            </div>
            <p className="text-secondary">Full IC matrix available on the IC Elimination page (F010).</p>
          </div>
        )}
      </div>
    </div>
  );
}
