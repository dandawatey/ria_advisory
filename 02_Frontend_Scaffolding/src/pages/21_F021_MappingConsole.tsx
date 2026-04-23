/**
 * F021 — Mapping Management Console & Approval Workflow
 * Admin page: account/dimension mapping workbench, pending approval queue.
 */
import React, { useState } from 'react';

const pendingChanges = [
  { id: 'chg-001', type: 'Account Mapping', subsidiary: 'SUB03', localCode: 'EAST', canonical: 'NORTHEAST', proposedBy: 'Priya Nair', proposedAt: '2026-04-22 14:30', entity: 'Clearwater Financial', oldValue: null, newValue: '1100 — NORTHEAST' },
  { id: 'chg-002', type: 'Account Mapping', subsidiary: 'SUB08', localCode: 'CORP', canonical: 'INSTITUTIONAL', proposedBy: 'James Park', proposedAt: '2026-04-23 09:00', entity: 'Harbor Light Wealth', oldValue: null, newValue: 'CLIENT_SEGMENT — INSTITUTIONAL' },
  { id: 'chg-003', type: 'Canonical Node',  subsidiary: 'GROUP', localCode: 'N/A',  canonical: 'DIGITAL_ADVISORY', proposedBy: 'Ravi Mehta', proposedAt: '2026-04-23 11:15', entity: 'Group Level', oldValue: null, newValue: 'New canonical service line' },
];

const auditLog = [
  { changeId: 'chg-098', type: 'Account Mapping', subsidiary: 'SUB01', description: '44020 → 2200 Technology', proposedBy: 'Sarah Gonzalez', approvedBy: 'Marcus Chen', approvedAt: '2026-04-20 16:30', effectiveFrom: '2026-04-21' },
  { changeId: 'chg-097', type: 'Account Mapping', subsidiary: 'SUB05', description: '91001 → 4000 AR', proposedBy: 'Elena Marchetti', approvedBy: 'Marcus Chen', approvedAt: '2026-04-18 10:12', effectiveFrom: '2026-04-19' },
  { changeId: 'chg-096', type: 'Dimension Mapping', subsidiary: 'SUB07', description: 'PM → PORTFOLIO_MGMT', proposedBy: 'Priya Nair', approvedBy: 'Marcus Chen', approvedAt: '2026-04-15 09:45', effectiveFrom: '2026-04-16' },
];

export default function MappingConsole() {
  const [activeTab, setActiveTab] = useState<'approvals' | 'accounts' | 'dimensions' | 'audit'>('approvals');
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Mapping Management Console</h1>
        <p className="page-subtitle">
          Self-service canonical mapping workbench with two-person approval workflow. (F021)
        </p>
        <div className="page-actions">
          <button className="btn btn-primary">+ Propose Mapping</button>
          <button className="btn btn-secondary">Import CSV</button>
          <button className="btn btn-secondary">Export Mapping Report</button>
        </div>
      </div>

      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile"><div className="kpi-label">Pending Approvals</div><div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{pendingChanges.length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Account Mappings</div><div className="kpi-value">3,409</div><div className="kpi-meta" style={{ color: 'var(--color-success)' }}>3 unmapped</div></div>
        <div className="kpi-tile"><div className="kpi-label">Dimension Mappings</div><div className="kpi-value">119</div><div className="kpi-meta" style={{ color: 'var(--color-warning)' }}>2 unmapped</div></div>
        <div className="kpi-tile"><div className="kpi-label">Changes (30d)</div><div className="kpi-value">28</div></div>
      </div>

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>
            Approval Queue <span className="badge badge-warning" style={{ marginLeft: 4 }}>{pendingChanges.length}</span>
          </div>
          <div className={`tab ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')}>Account Mappings</div>
          <div className={`tab ${activeTab === 'dimensions' ? 'active' : ''}`} onClick={() => setActiveTab('dimensions')}>Dimension Mappings</div>
          <div className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audit Log</div>
        </div>

        {activeTab === 'approvals' && (
          <>
            <div className="alert alert-info mb-16" style={{ fontSize: 12 }}>
              Two-person rule enforced server-side — you cannot approve changes you proposed.
              Approved changes take effect at the next pipeline run.
            </div>
            {pendingChanges.map((c) => (
              <div key={c.id} style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 12 }}>
                <div className="flex items-center justify-between mb-16">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${c.type === 'Canonical Node' ? 'badge-error' : 'badge-info'}`}>{c.type}</span>
                    {c.type === 'Canonical Node' && <span className="badge badge-warning">Executive Approval Required</span>}
                    <span className="badge badge-muted">{c.subsidiary}</span>
                    <strong>{c.entity}</strong>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Proposed {c.proposedAt} by {c.proposedBy}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={{ padding: '10px 14px', background: 'var(--color-error-bg)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-error)', marginBottom: 4 }}>Before</div>
                    <div style={{ fontSize: 13 }}>{c.oldValue ?? '(no mapping)'}</div>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'var(--color-success-bg)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)', marginBottom: 4 }}>After</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.newValue}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setApproving(c.id)}>✓ Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setRejecting(c.id)}>✗ Reject</button>
                  <button className="btn btn-secondary btn-sm">View Impact</button>
                </div>
                {approving === c.id && (
                  <div className="alert alert-success" style={{ marginTop: 8 }}>
                    ✓ Approved by Marcus Chen at 2026-04-23 15:50. Takes effect at next pipeline run.
                  </div>
                )}
                {rejecting === c.id && (
                  <div style={{ marginTop: 8 }}>
                    <input className="form-input" placeholder="Rejection reason (required)…" />
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      <button className="btn btn-danger btn-sm">Confirm Reject</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setRejecting(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {activeTab === 'accounts' && (
          <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Full account mapping workbench — see F007 Canonical CoA page for the complete mapping table.
            <br />Filters: subsidiary, canonical account type, mapping status (mapped/unmapped/pending).
          </div>
        )}

        {activeTab === 'dimensions' && (
          <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Full dimension mapping workbench — see F008 Dimension Framework page.
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Change ID</th><th>Type</th><th>Subsidiary</th><th>Description</th><th>Proposed By</th><th>Approved By</th><th>Approved At</th><th>Effective From</th></tr>
              </thead>
              <tbody>
                {auditLog.map((a) => (
                  <tr key={a.changeId}>
                    <td className="table-mono">{a.changeId}</td>
                    <td><span className="badge badge-info">{a.type}</span></td>
                    <td><span className="badge badge-muted">{a.subsidiary}</span></td>
                    <td style={{ fontSize: 12 }}>{a.description}</td>
                    <td style={{ fontSize: 12 }}>{a.proposedBy}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-success)' }}>{a.approvedBy}</td>
                    <td style={{ fontSize: 12 }} className="text-muted">{a.approvedAt}</td>
                    <td className="table-mono" style={{ fontSize: 12 }}>{a.effectiveFrom}</td>
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
