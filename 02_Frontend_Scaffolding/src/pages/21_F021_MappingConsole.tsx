/**
 * F021 — Mapping Console
 * Maps GL accounts from real subsidiaries to canonical categories.
 * Source: /api/gl/accounts (real data).
 */
import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface MappingRow {
  gl_account_no: string;
  gl_account_name: string | null;
  entity_count: number;
  total_amount: number;
  suggestedCanonical: string;
  mappingStatus: 'mapped' | 'unmapped' | 'pending';
}

function suggestCanonical(acct: string, name: string | null): string {
  const n = (name ?? '').toLowerCase();
  if (acct.startsWith('1')) return n.includes('cash') ? '1000 — Cash & Cash Equivalents' : n.includes('receiv') ? '1100 — Accounts Receivable' : '1xxx — Asset';
  if (acct.startsWith('2')) return n.includes('payable') ? '2000 — Accounts Payable' : '2xxx — Liability';
  if (acct.startsWith('3')) return '3xxx — Equity';
  if (acct.startsWith('4')) return n.includes('advisory') ? '4100 — Advisory Fee Revenue' : n.includes('management') ? '4200 — Management Fee Revenue' : '4xxx — Revenue';
  if (acct.startsWith('5')) return '5xxx — Cost of Sales';
  if (acct.startsWith('6')) {
    if (n.includes('salary') || n.includes('salaries') || n.includes('payroll')) return '6100 — Compensation & Benefits';
    if (n.includes('tech') || n.includes('software')) return '6200 — Technology';
    if (n.includes('rent') || n.includes('occupancy')) return '6300 — Occupancy';
    return '6xxx — Operating Expenses';
  }
  if (acct.startsWith('7')) return '7xxx — Other Income';
  if (acct.startsWith('8')) return '8xxx — Income Tax';
  if (acct === '999999') return 'SUSPENSE — Opening Balance Upload';
  return 'UNMAPPED';
}

function fmtUSD(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export default function MappingConsole() {
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'mapped' | 'unmapped' | 'pending'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.gl.accounts()
      .then((accounts) => {
        const mapped: MappingRow[] = accounts.map((a) => {
          const canonical = suggestCanonical(a.gl_account_no, a.gl_account_name);
          return {
            ...a,
            suggestedCanonical: canonical,
            mappingStatus: canonical === 'UNMAPPED' ? 'unmapped'
              : a.entity_count >= 3 ? 'mapped'
              : 'pending',
          };
        });
        setRows(mapped);
      })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.mappingStatus === statusFilter;
    const matchSearch = !search ||
      r.gl_account_no.includes(search) ||
      (r.gl_account_name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const mappedCount  = rows.filter((r) => r.mappingStatus === 'mapped').length;
  const pendingCount = rows.filter((r) => r.mappingStatus === 'pending').length;
  const unmappedCount = rows.filter((r) => r.mappingStatus === 'unmapped').length;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Mapping Console</h1>
            <p className="page-subtitle">
              GL account → canonical category mapping · {rows.length} accounts
              {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚠ API offline</span>}
            </p>
          </div>
          <input className="form-input" style={{ width: 220 }} placeholder="Search account…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Auto-mapped', count: mappedCount,   color: 'var(--color-success)', status: 'mapped' as const },
          { label: 'Pending Review', count: pendingCount, color: 'var(--color-warning)', status: 'pending' as const },
          { label: 'Unmapped',    count: unmappedCount, color: 'var(--color-error)',   status: 'unmapped' as const },
        ].map(({ label, count, color, status }) => (
          <div
            key={label}
            className="card"
            style={{ padding: '14px 16px', cursor: 'pointer', border: statusFilter === status ? `2px solid ${color}` : '1px solid var(--color-border)' }}
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{loading ? '…' : count}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-12">
          <div className="card-title" style={{ margin: 0 }}>Account Mappings ({filtered.length})</div>
          {statusFilter !== 'all' && <button className="btn btn-secondary btn-sm" onClick={() => setStatusFilter('all')}>Show All</button>}
        </div>
        <div className="table-wrap" style={{ maxHeight: 540, overflowY: 'auto' }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Account No</th><th>BC Account Name</th><th>Entities</th>
                <th>Suggested Canonical</th><th style={{ textAlign: 'right' }}>Net Balance</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.gl_account_no}>
                  <td className="table-mono" style={{ fontWeight: 600 }}>{r.gl_account_no}</td>
                  <td>{r.gl_account_name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                  <td style={{ textAlign: 'center' }}>{r.entity_count}</td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{r.suggestedCanonical}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtUSD(r.total_amount)}</td>
                  <td>
                    <span className={`badge ${r.mappingStatus === 'mapped' ? 'badge-success' : r.mappingStatus === 'pending' ? 'badge-warning' : 'badge-error'}`}>
                      {r.mappingStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
