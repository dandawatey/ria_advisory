/**
 * F024 — Security, Privacy & Compliance Controls
 * Admin/compliance page: security posture, audit log, access review.
 */
import React, { useState } from 'react';
import type { AuditLogEntry } from '../types';

const securityControls = [
  { category: 'Encryption',         control: 'Data at rest — CMK (Key Vault)',        status: 'pass' as const, detail: 'All ADLS, SQL Warehouse encrypted with CMK' },
  { category: 'Encryption',         control: 'Data in transit — TLS 1.2+',             status: 'pass' as const, detail: 'TLS 1.0/1.1 disabled at Front Door and API layer' },
  { category: 'Network',            control: 'No public storage access',               status: 'pass' as const, detail: 'Private Endpoints only — ADLS, Databricks, API' },
  { category: 'Network',            control: 'WAF policy on Azure Front Door',         status: 'pass' as const, detail: 'OWASP CRS enabled, custom rules active' },
  { category: 'Access Control',     control: 'Row-level security (SQL Warehouse)',     status: 'pass' as const, detail: 'Unity Catalog dynamic views enforce entity scoping' },
  { category: 'Access Control',     control: 'Column-level masking (PII fields)',      status: 'pass' as const, detail: 'customer.id, bank_account_no masked for non-steward roles' },
  { category: 'Access Control',     control: 'Managed identity — Azure-to-Azure',     status: 'pass' as const, detail: 'No storage keys in code or config' },
  { category: 'Immutability',       control: 'WORM policy (Bronze, 7yr)',              status: 'pass' as const, detail: 'Immutable blob policy locked on Bronze container' },
  { category: 'Immutability',       control: 'Audit log WORM retention (7yr)',         status: 'pass' as const, detail: 'Log Analytics + cold storage, WORM-locked' },
  { category: 'Vulnerability Mgmt', control: 'SAST in CI/CD',                         status: 'pass' as const, detail: 'Semgrep + dependency scan on every PR build' },
  { category: 'Vulnerability Mgmt', control: 'Secrets scanning',                       status: 'pass' as const, detail: 'gitleaks pre-commit hook + CI check' },
  { category: 'Compliance',         control: 'Data residency (US Azure only)',         status: 'pass' as const, detail: 'East US + West US (DR). No cross-border transfer.' },
  { category: 'Compliance',         control: 'SOC 2 Type II readiness',               status: 'warning' as const, detail: 'Readiness assessment in progress (Year 1). Full audit Year 2.' },
  { category: 'Compliance',         control: 'Annual penetration test',               status: 'pass' as const, detail: 'Last test: 2026-01-15. Next: 2027-01-15.' },
];

const mockAuditLog: AuditLogEntry[] = [
  { id: 'al-001', userId: 'u-001', userEmail: 'elena.marchetti@ria.com', action: 'GET /api/v1/dashboard/summary', resource: 'dashboard', entityScope: 'ALL',   timestamp: '2026-04-23 15:42:11', sourceIp: '10.0.2.14', statusCode: 200 },
  { id: 'al-002', userId: 'u-002', userEmail: 'marcus.chen@ria.com',    action: 'POST /api/v1/close/sign-off',   resource: 'close',     entityScope: 'ALL',   timestamp: '2026-04-23 15:40:02', sourceIp: '10.0.2.18', statusCode: 200 },
  { id: 'al-003', userId: 'u-003', userEmail: 'priya.nair@sub04.ria.com', action: 'GET /api/v1/entities/SUB04/trial-balance', resource: 'entity', entityScope: 'SUB04', timestamp: '2026-04-23 15:35:44', sourceIp: '10.0.3.22', statusCode: 200 },
  { id: 'al-004', userId: 'u-004', userEmail: 'ravi.mehta@ria.com',     action: 'POST /api/v1/explorer/query',   resource: 'explorer',  entityScope: 'ALL',   timestamp: '2026-04-23 15:30:19', sourceIp: '10.0.2.31', statusCode: 200 },
  { id: 'al-005', userId: 'u-005', userEmail: 'unknown@external.com',   action: 'GET /api/v1/dashboard/summary', resource: 'dashboard', entityScope: 'NONE',  timestamp: '2026-04-23 15:28:00', sourceIp: '203.0.113.55', statusCode: 401 },
];

const groupAccess = [
  { group: 'group-exec',             members: 3, lastReviewed: '2026-04-01', reviewedBy: 'CISO' },
  { group: 'group-group-finance',    members: 8, lastReviewed: '2026-04-01', reviewedBy: 'CISO' },
  { group: 'group-subsidiary-sub01', members: 2, lastReviewed: '2026-04-01', reviewedBy: 'CISO' },
  { group: 'group-fpa',              members: 4, lastReviewed: '2026-04-01', reviewedBy: 'CISO' },
  { group: 'group-admin',            members: 2, lastReviewed: '2026-04-01', reviewedBy: 'CISO' },
];

const categories = [...new Set(securityControls.map((c) => c.category))];

export default function SecurityCompliance() {
  const [activeTab, setActiveTab] = useState<'posture' | 'audit' | 'access'>('posture');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const filtered = selectedCategory === 'All'
    ? securityControls
    : securityControls.filter((c) => c.category === selectedCategory);

  const passing = securityControls.filter((c) => c.status === 'pass').length;
  const warnings = securityControls.filter((c) => c.status === 'warning').length;
  const failing = securityControls.filter((c) => c.status === 'fail').length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Security & Compliance</h1>
        <p className="page-subtitle">
          Security posture, audit log access, and Entra ID group access review. SEC Rule 204-2 · Reg S-P compliant. (F024)
        </p>
        <div className="page-actions">
          <button className="btn btn-secondary">Download Audit Evidence Pack</button>
          <button className="btn btn-secondary">Run Access Review</button>
        </div>
      </div>

      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile"><div className="kpi-label">Controls Passing</div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>{passing}/{securityControls.length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Warnings</div><div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{warnings}</div><div className="kpi-meta text-muted">SOC 2 readiness</div></div>
        <div className="kpi-tile"><div className="kpi-label">Critical Fails</div><div className="kpi-value" style={{ color: failing > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{failing}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Next Pen Test</div><div className="kpi-value" style={{ fontSize: 18 }}>2027-01</div><div className="kpi-meta text-muted">Annual schedule</div></div>
      </div>

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'posture' ? 'active' : ''}`} onClick={() => setActiveTab('posture')}>Security Posture</div>
          <div className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audit Log</div>
          <div className={`tab ${activeTab === 'access' ? 'active' : ''}`} onClick={() => setActiveTab('access')}>Access Review</div>
        </div>

        {activeTab === 'posture' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['All', ...categories].map((cat) => (
                <button key={cat} className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedCategory(cat)}>{cat}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {filtered.map((c, i) => (
                <div key={i} style={{
                  padding: '12px 16px', border: `1px solid ${c.status === 'pass' ? 'var(--color-border)' : c.status === 'warning' ? '#fde68a' : '#fca5a5'}`,
                  borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: c.status === 'warning' ? 'var(--color-warning-bg)' : c.status === 'fail' ? 'var(--color-error-bg)' : 'var(--color-surface)',
                }}>
                  <span style={{ fontSize: 18, marginTop: 2 }}>{c.status === 'pass' ? '✓' : c.status === 'warning' ? '⚠' : '✗'}</span>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.category}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{c.control}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'audit' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="form-input" placeholder="Search by user, action, resource…" style={{ flex: 1 }} />
              <input className="form-input" type="date" style={{ width: 160 }} />
              <button className="btn btn-secondary">Export 7yr Log</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity Scope</th><th>Source IP</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {mockAuditLog.map((e) => (
                    <tr key={e.id}>
                      <td className="table-mono" style={{ fontSize: 11 }}>{e.timestamp}</td>
                      <td style={{ fontSize: 12 }}>{e.userEmail}</td>
                      <td className="table-mono" style={{ fontSize: 11 }}>{e.action}</td>
                      <td><span className="badge badge-muted">{e.entityScope}</span></td>
                      <td className="table-mono" style={{ fontSize: 11 }}>{e.sourceIp}</td>
                      <td>
                        <span className={`badge ${e.statusCode < 400 ? 'badge-success' : e.statusCode < 500 ? 'badge-warning' : 'badge-error'}`}>
                          {e.statusCode}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'access' && (
          <div>
            <div className="alert alert-info mb-16" style={{ fontSize: 12 }}>
              Quarterly access review required by CISO policy. Last review: 2026-04-01. Next: 2026-07-01.
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Entra ID Group</th><th>Members</th><th>Last Reviewed</th><th>Reviewed By</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {groupAccess.map((g) => (
                    <tr key={g.group}>
                      <td className="table-mono">{g.group}</td>
                      <td>{g.members}</td>
                      <td style={{ fontSize: 12 }}>{g.lastReviewed}</td>
                      <td style={{ fontSize: 12 }}>{g.reviewedBy}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm">View Members</button>
                          <button className="btn btn-secondary btn-sm">Review</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
