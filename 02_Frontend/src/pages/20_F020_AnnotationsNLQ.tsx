/**
 * F020 — Natural Language GL Query
 * Type a question, get GL entries back. Translates common finance questions
 * into API calls against the real GL data.
 */
import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { GLEntry } from '../api/client';
import { GLFilterBar } from '../components/GLFilterBar';
import PageExplainer from '../components/common/PageExplainer';

interface Suggestion {
  label: string;
  params: Record<string, string | number>;
}

const SUGGESTIONS: Suggestion[] = [
  { label: 'All revenue entries (account 4xx)',       params: { account_no: '4', limit: 200 } },
  { label: 'Operating expenses (account 6xx)',        params: { account_no: '6', limit: 200 } },
  { label: 'India entity GL entries',                 params: { subsidiary: 'IND', limit: 200 } },
  { label: 'USA entity GL entries',                   params: { subsidiary: 'USA', limit: 200 } },
  { label: 'Philippines entity GL entries',           params: { subsidiary: 'PHILS', limit: 200 } },
  { label: 'Invoices only',                           params: { doc_type: 'Invoice', limit: 200 } },
  { label: 'Credit memos',                            params: { doc_type: 'Credit Memo', limit: 200 } },
  { label: 'All assets (account 1xx)',                params: { account_no: '1', limit: 200 } },
  { label: 'All liabilities (account 2xx)',           params: { account_no: '2', limit: 200 } },
];

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

export default function AnnotationsNLQ() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GLEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [activeLabel, setActiveLabel] = useState('');
  const [accountPrefix, setAccountPrefix] = useState('');
  const [genPostType, setGenPostType] = useState('');

  const runQuery = useCallback((params: Record<string, string | number>, label: string) => {
    setLoading(true);
    setApiError(false);
    setActiveLabel(label);
    api.gl.entries(params)
      .then(setResults)
      .catch(() => setApiError(true))
      .finally(() => { setLoading(false); setSearched(true); });
  }, []);

  const handleNLQ = () => {
    const q = query.toLowerCase();
    // Simple NLQ → params translation
    const params: Record<string, string | number> = { limit: 200 };
    if (q.includes('revenue') || q.includes('income'))     params.account_no = '4';
    else if (q.includes('expense') || q.includes('cost'))  params.account_no = '6';
    else if (q.includes('asset'))                           params.account_no = '1';
    else if (q.includes('liabilit'))                        params.account_no = '2';
    if (q.includes('india') || q.includes('llp'))          params.subsidiary = 'IND';
    else if (q.includes('usa') || q.includes('united state')) params.subsidiary = 'USA';
    else if (q.includes('philippine') || q.includes('phils')) params.subsidiary = 'PHILS';
    else if (q.includes('uk') || q.includes('british'))    params.subsidiary = 'GBP';
    else if (q.includes('australia') || q.includes('pty')) params.subsidiary = 'PTY';
    else if (q.includes('canada') || q.includes('tmg can')) params.subsidiary = 'TCAN';
    if (q.includes('invoice'))                             params.doc_type = 'Invoice';
    else if (q.includes('credit memo'))                    params.doc_type = 'Credit Memo';
    // Apply GLFilterBar selections (override NLQ where set)
    if (accountPrefix) params.account_no = accountPrefix;
    if (genPostType)   params.document_type = genPostType;
    runQuery(params, query);
  };

  const totalAmount = results.reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">GL Query</h1>
        <p className="page-subtitle">
          Natural language GL search · {searched && `${results.length} results · Net: ${fmtUSD(totalAmount)}`}
          {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚠ API offline</span>}
        </p>
      </div>

      <PageExplainer
        icon="💬"
        title="What is GL Query?"
        description="This page provides <strong>natural language and preset-button access to the GL dataset</strong>. Type a question like 'Show me revenue entries for India' and the system translates it into a database query. Finance analysts use it for ad-hoc investigation without needing to know SQL or account codes. Results can be exported as CSV. Use the suggestion buttons for common queries or combine with the filter bar for precise results."
        concepts={[
          { icon: '4', color: '#16a34a', label: 'Revenue (4xx)', desc: 'All income accounts — fees, advisory revenue' },
          { icon: '6', color: '#dc2626', label: 'Expenses (6xx)', desc: 'Operating expenses — salaries, rent, technology' },
          { icon: '1', color: '#2563eb', label: 'Assets (1xx)', desc: 'Balance sheet assets — cash, receivables, investments' },
        ]}
        glossary={[
          { term: 'NLQ', def: 'Natural Language Query — plain English question translated into a structured database query' },
          { term: 'Net Amount', def: 'Sum of all amounts in the result set — positive = net debit, negative = net credit' },
        ]}
      />

      <div className="card mb-16">
        <div className="card-title">Ask a question about the GL data</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder='e.g. "Show me revenue entries for India" or "All invoices for Philippines"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNLQ()}
          />
          <button className="btn btn-primary" onClick={handleNLQ} disabled={loading || !query}>
            {loading ? 'Querying…' : 'Query'}
          </button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <GLFilterBar
            accountPrefix={accountPrefix}
            onAccountPrefix={setAccountPrefix}
            genPostType={genPostType}
            onGenPostType={setGenPostType}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              className={`btn btn-sm ${activeLabel === s.label ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setQuery(s.label); runQuery(s.params, s.label); }}
              disabled={loading}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {searched && (
        <div className="card">
          <div className="flex items-center justify-between mb-12">
            <div className="card-title" style={{ margin: 0 }}>
              {activeLabel || query} — {results.length} entries · Net {fmtUSD(totalAmount)}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const csv = ['Date,Entity,Account,Description,Amount'].concat(
                results.map((r) => `${fmtDate(r.posting_date)},${r.subsidiary_code},${r.gl_account_no},"${(r.description ?? '').replace(/"/g, '""')}",${r.amount}`)
              ).join('\n');
              const a = document.createElement('a');
              a.href = 'data:text/csv,' + encodeURIComponent(csv);
              a.download = 'gl_query.csv';
              a.click();
            }}>Export CSV</button>
          </div>
          <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr><th>Date</th><th>Entity</th><th>Account</th><th>Doc Type</th><th>Description</th><th>Dept</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>No results. Try a different query.</td></tr>
                ) : results.map((r) => (
                  <tr key={r.id}>
                    <td className="table-mono">{fmtDate(r.posting_date)}</td>
                    <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{r.subsidiary_code}</span></td>
                    <td className="table-mono">{r.gl_account_no}</td>
                    <td style={{ fontSize: 11 }}>{r.document_type ?? '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description ?? r.customer_or_vendor_name ?? '—'}
                    </td>
                    <td style={{ fontSize: 11 }}>{r.department_code ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: r.amount >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {fmtUSD(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
