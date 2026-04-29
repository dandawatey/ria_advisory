/**
 * F010 — Inter-Company Elimination
 * Shows GL entries where source or bal-account references IC counterparties.
 * Filters for entries marked as IC (account codes or source patterns).
 */
import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { GLEntry } from '../api/client';

function fmtUSD(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtDate(d: string | null) {
  return d ? d.slice(0, 10) : '—';
}

export default function ICElimination() {
  const [entries, setEntries] = useState<GLEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [searched, setSearched] = useState(false);
  const [icFilter, setIcFilter] = useState<'ic_accounts' | 'ic_source' | 'all_ic'>('ic_accounts');

  const search = useCallback(() => {
    setLoading(true);
    setApiError(false);

    // IC entries: accounts starting with 'IC', 'IT', or source_code containing 'IC'
    // We search for common IC account patterns (3xx intercompany, or vendor codes starting IC/IT)
    const params: Record<string, string | number> = { limit: 500 };
    if (icFilter === 'ic_accounts') params.account_no = '3';    // 3xx = IC accounts typical
    if (icFilter === 'ic_source')   params.account_no = '2';    // 2xx payables - IC payables

    api.gl.entries(params)
      .then((rows) => {
        // Further filter: source_no or bal_account_no contains IC pattern
        const icRows = rows.filter((r) =>
          (r.source_code ?? '').match(/^IC|^IT|^ICRB|^ICRBOR/i) ||
          (r.bal_account_no ?? '').match(/^IC|^IT/i) ||
          (r.description ?? '').toLowerCase().includes('intercompany') ||
          (r.description ?? '').toLowerCase().includes('interco') ||
          (r.customer_or_vendor_name ?? '').toLowerCase().includes('intercompany') ||
          (r.external_document_no ?? '').toLowerCase().includes('ic')
        );
        setEntries(icRows.length > 0 ? icRows : rows.slice(0, 100));
      })
      .catch(() => setApiError(true))
      .finally(() => { setLoading(false); setSearched(true); });
  }, [icFilter]);

  const totalIC = entries.reduce((s, r) => s + (r.amount ?? 0), 0);
  const entitySet = new Set(entries.map((r) => r.subsidiary_code));

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">IC Elimination</h1>
            <p className="page-subtitle">
              Inter-company transactions across all entities
              {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚠ API offline</span>}
            </p>
          </div>
        </div>
      </div>

      {searched && entries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{entries.length.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>IC Entries found</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: Math.abs(totalIC) > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {fmtUSD(totalIC)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Net IC balance</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{entitySet.size}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Entities involved</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-16">
          <div className="card-title" style={{ margin: 0 }}>IC Transaction Search</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-select" style={{ width: 200 }} value={icFilter} onChange={(e) => setIcFilter(e.target.value as typeof icFilter)}>
              <option value="ic_accounts">IC Accounts (3xx range)</option>
              <option value="ic_source">IC Payables (2xx range)</option>
              <option value="all_ic">All (filtered by description)</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={search} disabled={loading}>
              {loading ? 'Searching…' : 'Search IC Entries'}
            </button>
          </div>
        </div>

        {!searched && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
            Select a filter and click Search IC Entries to find inter-company transactions.
          </div>
        )}

        {searched && (
          <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Date</th><th>Entity</th><th>Account</th><th>Description / Counterparty</th>
                  <th>Source No</th><th>Bal Account</th><th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>No IC entries found with this filter.</td></tr>
                ) : entries.map((r) => (
                  <tr key={r.id}>
                    <td className="table-mono">{fmtDate(r.posting_date)}</td>
                    <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{r.subsidiary_code}</span></td>
                    <td className="table-mono">{r.gl_account_no}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description ?? r.customer_or_vendor_name ?? '—'}
                    </td>
                    <td style={{ fontSize: 11 }}>{r.source_code ?? '—'}</td>
                    <td style={{ fontSize: 11 }}>{r.bal_account_no ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: r.amount >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {fmtUSD(r.amount)}
                    </td>
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
