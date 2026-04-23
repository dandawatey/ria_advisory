/**
 * F007 — Canonical Chart of Accounts Mapping
 * Admin page: CoA hierarchy tree, mapping workbench, unmapped account queue.
 */
import React, { useState } from 'react';

interface CoANode {
  id: string;
  name: string;
  type: 'Revenue' | 'Expense' | 'Asset' | 'Liability' | 'Equity';
  fsLine: 'P&L' | 'Balance Sheet';
  isIC: boolean;
  level: number;
  childCount: number;
}

const mockCoA: CoANode[] = [
  { id: '1000', name: 'Revenue',              type: 'Revenue',   fsLine: 'P&L',           isIC: false, level: 1, childCount: 5 },
  { id: '1100', name: 'Advisory Fees',        type: 'Revenue',   fsLine: 'P&L',           isIC: false, level: 2, childCount: 3 },
  { id: '1200', name: 'Management Fees',      type: 'Revenue',   fsLine: 'P&L',           isIC: false, level: 2, childCount: 2 },
  { id: '1900', name: 'IC Management Fees',   type: 'Revenue',   fsLine: 'P&L',           isIC: true,  level: 2, childCount: 0 },
  { id: '2000', name: 'Operating Expenses',   type: 'Expense',   fsLine: 'P&L',           isIC: false, level: 1, childCount: 8 },
  { id: '2100', name: 'Compensation',         type: 'Expense',   fsLine: 'P&L',           isIC: false, level: 2, childCount: 4 },
  { id: '2200', name: 'Technology',           type: 'Expense',   fsLine: 'P&L',           isIC: false, level: 2, childCount: 3 },
  { id: '3000', name: 'Cash & Equivalents',   type: 'Asset',     fsLine: 'Balance Sheet', isIC: false, level: 1, childCount: 2 },
  { id: '4000', name: 'Accounts Receivable',  type: 'Asset',     fsLine: 'Balance Sheet', isIC: false, level: 1, childCount: 3 },
  { id: '5000', name: 'Accounts Payable',     type: 'Liability', fsLine: 'Balance Sheet', isIC: false, level: 1, childCount: 2 },
  { id: '5900', name: 'IC Payable',           type: 'Liability', fsLine: 'Balance Sheet', isIC: true,  level: 1, childCount: 0 },
  { id: '6000', name: 'Equity',               type: 'Equity',    fsLine: 'Balance Sheet', isIC: false, level: 1, childCount: 3 },
];

const unmappedAccounts = [
  { sub: 'SUB02', localNo: '44020', localName: 'Digital Marketing', mappingSuggestion: '2200 — Technology', glRows: 312 },
  { sub: 'SUB05', localNo: '91001', localName: 'Interco Loan Recv', mappingSuggestion: '4000 — Accounts Receivable', glRows: 8 },
  { sub: 'SUB08', localNo: '10500', localName: 'Petty Cash Reserve', mappingSuggestion: '3000 — Cash & Equivalents', glRows: 2 },
];

const typeColor: Record<CoANode['type'], string> = {
  Revenue: 'badge-success', Expense: 'badge-error', Asset: 'badge-info', Liability: 'badge-warning', Equity: 'badge-muted',
};

export default function CanonicalCoA() {
  const [search, setSearch] = useState('');
  const filtered = mockCoA.filter((n) =>
    n.name.toLowerCase().includes(search.toLowerCase()) || n.id.includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Canonical Chart of Accounts</h1>
        <p className="page-subtitle">
          Group-level canonical CoA hierarchy and subsidiary account mapping workbench. (F007)
        </p>
        <div className="page-actions">
          <button className="btn btn-primary">+ Add Canonical Account</button>
          <button className="btn btn-secondary">Export CoA</button>
          <button className="btn btn-secondary">Import Mappings CSV</button>
        </div>
      </div>

      {unmappedAccounts.length > 0 && (
        <div className="alert alert-warning mb-24">
          ⚠ <strong>{unmappedAccounts.length} unmapped accounts</strong> are blocking Gold promotion for their subsidiaries.
          Assign canonical mappings below or in the mapping workbench.
        </div>
      )}

      <div className="card-grid card-grid-2">
        {/* CoA hierarchy */}
        <div className="card">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ margin: 0 }}>Canonical CoA ({mockCoA.length} nodes)</div>
            <input className="form-input" placeholder="Search…" style={{ width: 180 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Account Name</th><th>Type</th><th>F/S</th><th>IC</th></tr>
              </thead>
              <tbody>
                {filtered.map((n) => (
                  <tr key={n.id}>
                    <td className="table-mono">{n.id}</td>
                    <td style={{ paddingLeft: n.level === 2 ? 24 : 0, fontWeight: n.level === 1 ? 700 : 400 }}>
                      {n.level === 2 && <span style={{ color: 'var(--color-text-muted)' }}>└ </span>}
                      {n.name}
                    </td>
                    <td><span className={`badge ${typeColor[n.type]}`}>{n.type}</span></td>
                    <td><span className="badge badge-muted">{n.fsLine}</span></td>
                    <td>{n.isIC && <span className="badge badge-warning">IC</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unmapped queue */}
        <div className="card">
          <div className="card-title">
            Unmapped Accounts Queue
            <span className="badge badge-error" style={{ marginLeft: 8 }}>{unmappedAccounts.length}</span>
          </div>
          {unmappedAccounts.map((u) => (
            <div key={`${u.sub}-${u.localNo}`} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 10 }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="badge badge-muted">{u.sub}</span>
                  <span className="table-mono" style={{ marginLeft: 8, fontWeight: 600 }}>{u.localNo}</span>
                  <span style={{ marginLeft: 8, fontSize: 13 }}>{u.localName}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{u.glRows} GL rows affected</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="form-select" style={{ flex: 1, fontSize: 12 }}>
                  <option>— Select canonical account —</option>
                  {mockCoA.map((n) => (
                    <option key={n.id} value={n.id} selected={`${n.id} — ${n.name}` === u.mappingSuggestion}>
                      {n.id} — {n.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm">Propose Mapping</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Suggested: <strong>{u.mappingSuggestion}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
