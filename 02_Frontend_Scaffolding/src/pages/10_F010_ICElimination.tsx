/**
 * F010 — Inter-Company Elimination Engine
 * Finance admin page: elimination rules, results, unmatched entries.
 */
import { useState } from 'react';
import type { ICEntry } from '../types';

const mockICEntries: ICEntry[] = [
  { entityA: 'SUB01', entityB: 'SUB03', canonicalAccount: '1900 IC Mgmt Fees',  period: 'Apr-2026', debitAmount: 250000, creditAmount: 250000, variance: 0,    matched: true },
  { entityA: 'SUB02', entityB: 'SUB05', canonicalAccount: '1900 IC Mgmt Fees',  period: 'Apr-2026', debitAmount: 180000, creditAmount: 180000, variance: 0,    matched: true },
  { entityA: 'SUB04', entityB: 'SUB07', canonicalAccount: '5900 IC Payable',     period: 'Apr-2026', debitAmount: 95000,  creditAmount: 93200,  variance: 1800, matched: false },
  { entityA: 'SUB06', entityB: 'SUB09', canonicalAccount: '1900 IC Mgmt Fees',  period: 'Apr-2026', debitAmount: 120000, creditAmount: 0,      variance: 120000, matched: false },
];

const eliminationRules = [
  { id: 'RULE-001', name: 'IC Management Fees', accountId: '1900', type: 'bilateral', createdBy: 'Marcus Chen', approvedBy: 'Elena Marchetti', status: 'active' },
  { id: 'RULE-002', name: 'IC Payables',        accountId: '5900', type: 'bilateral', createdBy: 'Marcus Chen', approvedBy: 'Elena Marchetti', status: 'active' },
  { id: 'RULE-003', name: 'IC Loans',           accountId: '4900', type: 'bilateral', createdBy: 'Priya Nair',  approvedBy: null,             status: 'pending' },
];

export default function ICElimination() {
  const [activeTab, setActiveTab] = useState<'results' | 'rules'>('results');
  const unmatched = mockICEntries.filter((e) => !e.matched);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inter-Company Elimination Engine</h1>
        <p className="page-subtitle">
          Rule-based IC elimination — matched pairs, unmatched exceptions, and elimination configuration. (F010)
        </p>
        <div className="page-actions">
          <button className="btn btn-primary">+ Add Elimination Rule</button>
          <button className="btn btn-secondary">Export IC Report</button>
        </div>
      </div>

      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile"><div className="kpi-label">IC Pairs (Apr 2026)</div><div className="kpi-value">{mockICEntries.length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Matched & Eliminated</div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>{mockICEntries.filter((e) => e.matched).length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Unmatched</div><div className="kpi-value" style={{ color: 'var(--color-error)' }}>{unmatched.length}</div></div>
        <div className="kpi-tile"><div className="kpi-label">Total Eliminated (USD)</div><div className="kpi-value">$680K</div></div>
      </div>

      {unmatched.length > 0 && (
        <div className="alert alert-error mb-24">
          ⚠ <strong>{unmatched.length} unmatched IC entries</strong> require review before consolidation sign-off.
          Total variance: <strong>${unmatched.reduce((s, e) => s + e.variance, 0).toLocaleString()}</strong>
        </div>
      )}

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Elimination Results</div>
          <div className={`tab ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>Elimination Rules</div>
        </div>

        {activeTab === 'results' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Entity A</th><th>Entity B</th><th>Canonical Account</th><th>Period</th><th>Debit (USD)</th><th>Credit (USD)</th><th>Variance</th><th>Matched</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {mockICEntries.map((e, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-muted">{e.entityA}</span></td>
                    <td><span className="badge badge-muted">{e.entityB}</span></td>
                    <td style={{ fontSize: 12 }}>{e.canonicalAccount}</td>
                    <td>{e.period}</td>
                    <td>${e.debitAmount.toLocaleString()}</td>
                    <td>${e.creditAmount.toLocaleString()}</td>
                    <td style={{ color: e.variance > 0 ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 600 }}>
                      {e.variance > 0 ? `$${e.variance.toLocaleString()}` : '—'}
                    </td>
                    <td>
                      <span className={`badge ${e.matched ? 'badge-success' : 'badge-error'}`}>
                        {e.matched ? '✓ Matched' : '✗ Unmatched'}
                      </span>
                    </td>
                    <td>{!e.matched && <button className="btn btn-secondary btn-sm">Review</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Rule ID</th><th>Name</th><th>Account</th><th>Type</th><th>Created By</th><th>Approved By</th><th>Status</th></tr>
              </thead>
              <tbody>
                {eliminationRules.map((r) => (
                  <tr key={r.id}>
                    <td className="table-mono">{r.id}</td>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td className="table-mono">{r.accountId}</td>
                    <td><span className="badge badge-info">{r.type}</span></td>
                    <td>{r.createdBy}</td>
                    <td>{r.approvedBy ?? <span className="badge badge-warning">Pending</span>}</td>
                    <td><span className={`badge ${r.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span></td>
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
