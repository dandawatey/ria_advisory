/**
 * F007 — Canonical Chart of Accounts
 * Shows all GL accounts from the real data, grouped by category.
 * Source: /api/gl/accounts
 */
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

interface AccountRow {
  gl_account_no: string;
  gl_account_name: string | null;
  entity_count: number;
  total_amount: number;
  category: string;
}

function categorize(acct: string): string {
  if (acct.startsWith('1')) return 'Assets';
  if (acct.startsWith('2')) return 'Liabilities';
  if (acct.startsWith('3')) return 'Equity';
  if (acct.startsWith('4')) return 'Revenue';
  if (acct.startsWith('5')) return 'Cost of Sales';
  if (acct.startsWith('6')) return 'Operating Expenses';
  if (acct.startsWith('7')) return 'Other Income';
  if (acct.startsWith('8')) return 'Tax';
  if (acct.startsWith('9')) return 'Suspense / System';
  return 'Other';
}

function fmtUSD(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

const CATEGORIES = ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Cost of Sales', 'Operating Expenses', 'Other Income', 'Tax', 'Suspense / System', 'Other'];

export default function CanonicalCoA() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');

  useEffect(() => {
    api.gl.accounts()
      .then((rows) => setAccounts(rows.map((r) => ({ ...r, category: categorize(r.gl_account_no) }))))
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = accounts.filter((a) => {
    const matchCat = catFilter === 'All' || a.category === catFilter;
    const matchSearch = !search ||
      a.gl_account_no.includes(search) ||
      (a.gl_account_name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const byCategory = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = accounts.filter((a) => a.category === cat).length;
    return acc;
  }, {});

  return (
    <div>
      <PageExplainer
        icon="📋"
        title="What is the Canonical Chart of Accounts?"
        description="This page shows the <strong>unified Chart of Accounts (CoA)</strong> derived from all GL transactions across 17 subsidiaries. Each account is classified into a standard category (Assets, Liabilities, Revenue, etc.) so reports work consistently across entities regardless of local ERP account numbering. CFOs and finance teams use this to understand the account structure, validate mappings, and confirm data completeness."
        concepts={[
          { icon: '1', color: '#2563eb',  label: 'Assets (1xx)',    desc: 'Balance sheet — what the group owns' },
          { icon: '4', color: '#16a34a',  label: 'Revenue (4xx)',   desc: 'P&L income — client fees, interest, other income' },
          { icon: '6', color: '#dc2626',  label: 'OpEx (6xx)',      desc: 'P&L expenses — salaries, rent, overheads' },
          { icon: '2', color: '#d97706',  label: 'Liabilities (2xx)', desc: 'Balance sheet — what the group owes' },
        ]}
        glossary={[
          { term: 'Account No', def: 'ERP-native account code — may differ per subsidiary (normalised in Gold layer)' },
          { term: 'Entity Count', def: 'Number of subsidiaries using this account — low count may indicate mapping gap' },
          { term: 'Total Amount', def: 'Net balance across all entities — negative = credit balance (normal for revenue)' },
        ]}
      />
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Chart of Accounts</h1>
            <p className="page-subtitle">
              {accounts.length} distinct GL accounts across all 17 subsidiaries
              {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚠ API offline</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" style={{ width: 200 }} placeholder="Search account…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-select" style={{ width: 180 }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="All">All categories</option>
              {CATEGORIES.filter((c) => (byCategory[c] ?? 0) > 0).map((c) => (
                <option key={c} value={c}>{c} ({byCategory[c]})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <PageExplainer
        icon="📋"
        title="What is the Chart of Accounts?"
        description="This page shows all <strong>distinct GL account codes and names across all 17 subsidiaries</strong>, sourced from live data. The Chart of Accounts (CoA) is the master list of every account used to record financial transactions. Finance teams use it to understand what accounts exist, how they are categorized, how many entities use each account, and what the net balance is. Clicking a category tile filters the list."
        concepts={[
          { icon: '1', color: '#2563eb', label: 'Assets (1xx)', desc: 'Cash, receivables, fixed assets' },
          { icon: '4', color: '#16a34a', label: 'Revenue (4xx)', desc: 'All income and revenue accounts' },
          { icon: '6', color: '#dc2626', label: 'OpEx (6xx)', desc: 'Operating expenses including salaries, rent, marketing' },
          { icon: '5', color: '#d97706', label: 'COGS (5xx)', desc: 'Cost of goods/services sold' },
        ]}
        glossary={[
          { term: 'Net Balance', def: 'Sum of all debit and credit amounts for this account across all entities' },
          { term: 'Entity Count', def: 'Number of subsidiaries that have transactions in this GL account' },
        ]}
      />

      {/* Category summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {['Assets', 'Liabilities', 'Revenue', 'Operating Expenses', 'Cost of Sales'].map((cat) => (
          <div
            key={cat}
            className="card"
            style={{ padding: '10px 14px', cursor: 'pointer', border: catFilter === cat ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}
            onClick={() => setCatFilter(catFilter === cat ? 'All' : cat)}
          >
            <div style={{ fontSize: 22, fontWeight: 800 }}>{loading ? '…' : byCategory[cat] ?? 0}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{cat}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-12">
          <div className="card-title" style={{ margin: 0 }}>
            GL Accounts {catFilter !== 'All' ? `— ${catFilter}` : ''} ({filtered.length})
          </div>
          {catFilter !== 'All' && <button className="btn btn-secondary btn-sm" onClick={() => setCatFilter('All')}>Clear filter</button>}
        </div>
        <div className="table-wrap" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Account No</th><th>Account Name</th><th>Category</th>
                <th style={{ textAlign: 'right' }}>Entities</th>
                <th style={{ textAlign: 'right' }}>Net Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.gl_account_no}>
                  <td className="table-mono" style={{ fontWeight: 600 }}>{a.gl_account_no}</td>
                  <td>{a.gl_account_name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                  <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{a.category}</span></td>
                  <td style={{ textAlign: 'right' }}>{a.entity_count}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500, color: a.total_amount < 0 ? 'var(--color-error)' : 'inherit' }}>
                    {fmtUSD(a.total_amount)}
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
