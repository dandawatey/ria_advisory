/**
 * F018 — Explorer & Ad-Hoc Analytics
 * GL search across all 17 subsidiaries. Real data from /api/gl/entries.
 */
import { useState, useCallback } from 'react';
import { PowerBIEmbed } from '../components/shared/PowerBIEmbed';
import { api } from '../api/client';
import type { GLEntry, GLStats } from '../api/client';

function fmtUSD(n: number) {
  const abs = Math.abs(n ?? 0);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

const SUBSIDIARIES = [
  { code: 'PHILS', name: 'RIA Advisory Philippines' },
  { code: 'MXN',   name: 'RIA Advisory Mexico' },
  { code: 'AGG',   name: 'RIA Advisory Aggregator LLC' },
  { code: 'BOR',   name: 'RIA Advisory Borrower LLC' },
  { code: 'CAN',   name: 'RIA Advisory Canada Ltd' },
  { code: 'GUA',   name: 'RIA Advisory Guarantor LLC' },
  { code: 'PTY',   name: 'RIA Advisory Pty Ltd (AUS)' },
  { code: 'USA',   name: 'RIA Advisory LLC (USA)' },
  { code: 'IND',   name: 'RIA Advisory LLP India' },
  { code: 'GBP',   name: 'RIA Advisory Ltd (UK)' },
  { code: 'ZAF',   name: 'RIA Advisory SA (ZAF)' },
  { code: 'SYN',   name: 'Synersys Global Inc' },
  { code: 'TBID',  name: 'TMG Bidco Inc' },
  { code: 'TSUB',  name: 'TMG Bidco Sub Inc' },
  { code: 'TCAN',  name: 'TMG Consulting Canada Inc' },
  { code: 'TOFF',  name: 'TMG Offshore Synersys Global' },
  { code: 'TUAS',  name: 'TMG Utility Advisory Services' },
];

export default function Explorer() {
  const [viewMode, setViewMode] = useState<'gl' | 'stats' | 'pbi'>('gl');

  // GL search filters
  const [subsidiary, setSubsidiary] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [department, setDepartment] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [rows, setRows] = useState<GLEntry[]>([]);
  const [stats, setStats] = useState<GLStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [apiError, setApiError] = useState(false);

  const handleSearch = useCallback(() => {
    setLoading(true);
    setApiError(false);
    const params: Record<string, string | number> = { limit: 300 };
    if (subsidiary) params.subsidiary = subsidiary;
    if (accountNo) params.account_no = accountNo;
    if (department) params.department = department;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    api.gl.entries(params)
      .then(setRows)
      .catch(() => setApiError(true))
      .finally(() => { setLoading(false); setSearched(true); });
  }, [subsidiary, accountNo, department, dateFrom, dateTo]);

  const handleLoadStats = useCallback(() => {
    setLoading(true);
    setApiError(false);
    api.gl.stats()
      .then(setStats)
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, []);

  const totalAmount = rows.reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Explorer — GL Analytics</h1>
            <p className="page-subtitle">
              Search across all 17 subsidiaries · {rows.length > 0 && `${rows.length.toLocaleString()} rows · Net: ${fmtUSD(totalAmount)}`}
              {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚠ API offline</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${viewMode === 'gl' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('gl')}>GL Search</button>
            <button className={`btn btn-sm ${viewMode === 'stats' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setViewMode('stats'); handleLoadStats(); }}>Stats</button>
            <button className={`btn btn-sm ${viewMode === 'pbi' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('pbi')}>Power BI</button>
          </div>
        </div>
      </div>

      {viewMode === 'gl' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Filter panel */}
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card-title">Filters</div>

            <div className="form-group mb-12">
              <label className="form-label">Subsidiary</label>
              <select className="form-select" value={subsidiary} onChange={(e) => setSubsidiary(e.target.value)}>
                <option value="">All subsidiaries</option>
                {SUBSIDIARIES.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group mb-12">
              <label className="form-label">GL Account (prefix)</label>
              <input className="form-input" placeholder="e.g. 4, 601" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
            </div>

            <div className="form-group mb-12">
              <label className="form-label">Department</label>
              <input className="form-input" placeholder="e.g. ADMIN" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>

            <div className="form-group mb-12">
              <label className="form-label">Posting Date From</label>
              <input className="form-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="form-group mb-16">
              <label className="form-label">Posting Date To</label>
              <input className="form-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching…' : 'Search GL'}
            </button>
          </div>

          {/* Results */}
          <div className="card">
            {!searched && !loading && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
                Set filters and click Search GL to query the unified ledger.
                {apiError && (
                  <div style={{ marginTop: 16, fontSize: 12 }}>
                    Start the backend: <code style={{ background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4 }}>cd 03_Backend && uvicorn main:app --reload</code>
                  </div>
                )}
              </div>
            )}
            {loading && <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>Querying…</div>}
            {searched && !loading && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {rows.length} rows · Net amount: <strong>{fmtUSD(totalAmount)}</strong>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    const csv = [
                      ['Date','Subsidiary','Account','Description','Department','Amount','Doc No'].join(','),
                      ...rows.map((r) => [
                        r.posting_date?.slice(0,10),
                        r.subsidiary_code,
                        r.gl_account_no,
                        `"${(r.description ?? '').replace(/"/g, '""')}"`,
                        r.department_code ?? '',
                        r.amount,
                        r.document_no ?? '',
                      ].join(','))
                    ].join('\n');
                    const a = document.createElement('a');
                    a.href = 'data:text/csv,' + encodeURIComponent(csv);
                    a.download = 'gl_export.csv';
                    a.click();
                  }}>Export CSV</button>
                </div>
                <div className="table-wrap" style={{ maxHeight: 550, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Date</th><th>Entity</th><th>Account</th><th>Description</th>
                        <th>Dept</th><th>Doc Type</th><th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                          No results for these filters.
                        </td></tr>
                      ) : rows.map((r) => (
                        <tr key={r.id}>
                          <td className="table-mono">{r.posting_date?.slice(0, 10) ?? '—'}</td>
                          <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{r.subsidiary_code}</span></td>
                          <td className="table-mono">{r.gl_account_no}</td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.description ?? r.customer_or_vendor_name ?? '—'}
                          </td>
                          <td style={{ fontSize: 11 }}>{r.department_code ?? '—'}</td>
                          <td style={{ fontSize: 11 }}>{r.document_type ?? '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: r.amount >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                            {fmtUSD(r.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stats view */}
      {viewMode === 'stats' && (
        <div className="card">
          <div className="card-title">GL Load Statistics — per Subsidiary</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Subsidiary</th><th style={{ textAlign: 'right' }}>Entries</th>
                  <th>Date From</th><th>Date To</th><th style={{ textAlign: 'right' }}>Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                ) : stats.length > 0 ? stats.map((s) => (
                  <tr key={s.code}>
                    <td><span className="badge badge-muted">{s.code}</span></td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ textAlign: 'right' }}>{s.total_entries.toLocaleString()}</td>
                    <td className="table-mono" style={{ fontSize: 12 }}>{s.date_from?.slice(0, 10) ?? '—'}</td>
                    <td className="table-mono" style={{ fontSize: 12 }}>{s.date_to?.slice(0, 10) ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtUSD(s.net_amount)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                    {apiError ? 'API offline — start 03_Backend' : 'No data loaded yet. Run the ETL.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Power BI */}
      {viewMode === 'pbi' && (
        <div className="card">
          <div className="card-title">Group Analytics — Power BI Embedded</div>
          <PowerBIEmbed title="UFIP Group Analytics Dashboard" height={520} />
        </div>
      )}
    </div>
  );
}
