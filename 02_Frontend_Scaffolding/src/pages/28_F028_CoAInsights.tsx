/**
 * F028 — Chart of Accounts Insights
 * Left filter panel (240px) + 4 tabbed content area.
 * Direct fetch to /api/insights/coa/* endpoints (not yet in client.ts).
 *
 * Tab 1 — By Category        : ComposedChart (balance bars + net_change line) + summary table
 * Tab 2 — Account Detail     : Paginated (50 rows) searchable accounts table
 * Tab 3 — Coverage Map       : Grouped BarChart top-5 companies + filterable table
 * Tab 4 — Balance Distribution : Donut (abs balance by category) + net_change bar chart
 */
import { useState, useEffect } from 'react';
import {
  ComposedChart, BarChart, PieChart,
  Bar, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api, type FilterOptions } from '../api/client';
import { GLFilterBar } from '../components/GLFilterBar';

// ── Env ────────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Palettes ───────────────────────────────────────────────────────────────────
const PIE_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9',
];
const CAT_COLORS: Record<string, string> = {
  Assets: '#3b82f6', Liabilities: '#ef4444', Equity: '#8b5cf6',
  Income: '#22c55e', Revenue: '#22c55e', Expense: '#f97316',
  COGS: '#f97316', OpEx: '#a855f7', Other: '#94a3b8',
};
const COMPANY_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9',
];

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toFixed(0)}`;
}

// ── Inline API types ───────────────────────────────────────────────────────────
interface CoASummary {
  total_accounts: number;
  active_accounts: number;
  balance_total_abs: number;
  income_accounts: number;
  expense_accounts: number;
}
interface CoACategoryRow {
  account_category: string;
  account_count: number;
  balance: number;
  net_change: number;
  entry_count: number;
}
interface CoAAccountRow {
  account_no: string;
  account_name: string | null;
  account_category: string | null;
  account_subcategory: string | null;
  company_count: number;
  balance_total: number;
  net_change_total: number;
  entry_count: number;
}
interface CoACoverageRow {
  account_category: string;
  company_name: string;
  account_count: number;
  balance: number;
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function USDTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 6, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)', marginBottom: 2 }}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, loading, error, height = 300, children }: {
  title: string; subtitle?: string; loading?: boolean; error?: boolean;
  height?: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title" style={{ marginBottom: subtitle ? 4 : 12 }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>{subtitle}</div>
      )}
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Loading data…
        </div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)', fontSize: 13 }}>
          API unavailable — start the backend server
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}

function KPITile({ label, value, sub, color = 'var(--color-primary)' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────
type Tab = 'category' | 'detail' | 'coverage' | 'distribution';
const PAGE_SIZE = 50;

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CoAInsights() {
  // Filter panel
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    companies: [], years: [], months: [], currencies: [],
  });
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [selectedYear,    setSelectedYear]    = useState<number | null>(null);
  const [sectionOpen, setSectionOpen] = useState({ companies: true, year: true });
  const [accountPrefix, setAccountPrefix] = useState('');
  const [genPostType, setGenPostType] = useState('');

  // Drill-through
  const [drillCat, setDrillCat] = useState<string | null>(null);

  // Tab
  const [tab, setTab] = useState<Tab>('category');

  // Data
  const [coaSummary,     setCoaSummary]     = useState<CoASummary | null>(null);
  const [categories,     setCategories]     = useState<CoACategoryRow[]>([]);
  const [accounts,       setAccounts]       = useState<CoAAccountRow[]>([]);
  const [coverage,       setCoverage]       = useState<CoACoverageRow[]>([]);
  const [coverageLoaded, setCoverageLoaded] = useState(false);

  // Pagination + search for Account Detail tab
  const [searchQ, setSearchQ] = useState('');
  const [page,    setPage]    = useState(1);

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors,  setErrors]  = useState<Record<string, boolean>>({});
  const L = (k: string, v: boolean) => setLoading((p) => ({ ...p, [k]: v }));
  const E = (k: string, v: boolean) => setErrors((p) => ({ ...p, [k]: v }));

  // ── Load filter options once ───────────────────────────────────────────────
  useEffect(() => {
    api.analytics.filters().then(setFilterOpts).catch(() => null);
  }, []);

  // ── CoA summary (no filter params) ────────────────────────────────────────
  useEffect(() => {
    L('summary', true);
    fetch(`${BASE}/api/insights/coa/summary`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: CoASummary) => setCoaSummary(d))
      .catch(() => E('summary', true))
      .finally(() => L('summary', false));
  }, []);

  // ── By-category: refresh when company or year changes ─────────────────────
  useEffect(() => {
    L('cat', true);
    const qs = new URLSearchParams();
    if (selectedCompany != null) qs.set('company_id', String(selectedCompany));
    if (selectedYear    != null) qs.set('year',       String(selectedYear));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    fetch(`${BASE}/api/insights/coa/by-category${q}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: CoACategoryRow[]) => setCategories(d))
      .catch(() => E('cat', true))
      .finally(() => L('cat', false));
  }, [selectedCompany, selectedYear]);

  // ── Accounts: load when tab=detail, or when drillCat/company changes ──────
  useEffect(() => {
    if (tab !== 'detail') return;
    L('accounts', true);
    const qs = new URLSearchParams();
    if (selectedCompany != null) qs.set('company_id', String(selectedCompany));
    if (drillCat)                qs.set('category',   drillCat);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    fetch(`${BASE}/api/insights/coa/accounts${q}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: CoAAccountRow[]) => { setAccounts(d); setPage(1); })
      .catch(() => E('accounts', true))
      .finally(() => L('accounts', false));
  }, [tab, selectedCompany, drillCat]);

  // ── Coverage: load once when tab becomes active ────────────────────────────
  useEffect(() => {
    if (tab !== 'coverage' || coverageLoaded) return;
    L('coverage', true);
    fetch(`${BASE}/api/insights/coa/coverage`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: CoACoverageRow[]) => { setCoverage(d); setCoverageLoaded(true); })
      .catch(() => E('coverage', true))
      .finally(() => L('coverage', false));
  }, [tab, coverageLoaded]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredAccounts = accounts.filter((a) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return a.account_no.toLowerCase().includes(q) || (a.account_name ?? '').toLowerCase().includes(q);
  });
  const totalPages   = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const pageAccounts = filteredAccounts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Top-5 companies in coverage by total account count
  const coverageCompanies = (() => {
    const counts: Record<string, number> = {};
    coverage.forEach((r) => { counts[r.company_name] = (counts[r.company_name] ?? 0) + r.account_count; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
  })();
  const coverageCats = [...new Set(coverage.map((r) => r.account_category))];
  const coverageChartData = coverageCats.map((cat) => {
    const row: Record<string, string | number> = { category: cat };
    coverageCompanies.forEach((co) => {
      const found = coverage.find((r) => r.account_category === cat && r.company_name === co);
      row[co] = found?.account_count ?? 0;
    });
    return row;
  });

  const donutTotal = categories.reduce((s, r) => s + Math.abs(r.balance), 0);

  // Active chips
  const activeChips: string[] = [];
  if (selectedCompany != null) {
    const co = filterOpts.companies.find((c) => c.company_id === selectedCompany);
    if (co) activeChips.push(co.company_name);
  }
  if (selectedYear != null) activeChips.push(`FY ${selectedYear}`);
  if (drillCat)             activeChips.push(`Category: ${drillCat}`);

  function clearAll() {
    setSelectedCompany(null);
    setSelectedYear(null);
    setDrillCat(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Page header */}
      <div className="page-header" style={{ paddingBottom: 12 }}>
        <h1 className="page-title">Chart of Accounts Insights</h1>
        <p className="page-subtitle">
          {coaSummary
            ? `${coaSummary.total_accounts.toLocaleString()} accounts · ${coaSummary.active_accounts.toLocaleString()} active · balance distribution & entity coverage`
            : 'CoA structure · balance distribution · entity coverage'}
        </p>
      </div>

      {/* KPI row — always visible */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, paddingBottom: 16 }}>
        <KPITile
          label="Total Accounts"
          value={loading.summary ? '…' : (coaSummary?.total_accounts ?? 0).toLocaleString()}
          color="#3b82f6" sub="All categories"
        />
        <KPITile
          label="Active Accounts"
          value={loading.summary ? '…' : (coaSummary?.active_accounts ?? 0).toLocaleString()}
          color="#22c55e" sub="With GL activity"
        />
        <KPITile
          label="Total Balance (abs)"
          value={loading.summary ? '…' : fmt(coaSummary?.balance_total_abs ?? 0)}
          color="#8b5cf6" sub="Absolute sum all accounts"
        />
        <KPITile
          label="Income / Expense"
          value={loading.summary ? '…' : `${coaSummary?.income_accounts ?? 0} / ${coaSummary?.expense_accounts ?? 0}`}
          color="#f97316" sub="Income accts / Expense accts"
        />
      </div>

      {/* Drill breadcrumb */}
      {drillCat && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          background: 'rgba(59,130,246,0.08)', borderRadius: 6, marginBottom: 12,
          border: '1px solid rgba(59,130,246,0.2)', fontSize: 13,
        }}>
          <span style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }} onClick={() => setDrillCat(null)}>
            All Categories
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>→</span>
          <span style={{ fontWeight: 600, color: '#3b82f6' }}>{drillCat}</span>
          <button
            style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontWeight: 700, fontSize: 14 }}
            onClick={() => setDrillCat(null)}
          >×</button>
        </div>
      )}

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Active:</span>
          {activeChips.map((c) => (
            <span key={c} style={{
              background: 'var(--color-primary)', color: '#fff',
              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
            }}>{c}</span>
          ))}
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={clearAll}>Clear All</button>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Filter panel ────────────────────────────────────────────────── */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 0 }}>
            <div style={{
              padding: '10px 14px', background: 'var(--color-primary)', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Filters</span>
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 11 }}
                onClick={clearAll}>Reset</button>
            </div>

            {/* Company — radio single-select */}
            <div style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => setSectionOpen((p) => ({ ...p, companies: !p.companies }))}>
                Company <span>{sectionOpen.companies ? '▲' : '▼'}</span>
              </button>
              {sectionOpen.companies && (
                <div style={{ padding: '0 10px 10px', maxHeight: 220, overflowY: 'auto' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0', fontWeight: 600 }}>
                    <input type="radio" name="coa_co" checked={selectedCompany === null}
                      onChange={() => { setSelectedCompany(null); setDrillCat(null); }}
                      style={{ accentColor: 'var(--color-primary)' }} />
                    All companies
                  </label>
                  {filterOpts.companies.map((c) => (
                    <label key={c.company_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0' }}>
                      <input type="radio" name="coa_co"
                        checked={selectedCompany === c.company_id}
                        onChange={() => { setSelectedCompany(c.company_id); setDrillCat(null); }}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Year chips */}
            <div style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => setSectionOpen((p) => ({ ...p, year: !p.year }))}>
                Year <span>{sectionOpen.year ? '▲' : '▼'}</span>
              </button>
              {sectionOpen.year && (
                <div style={{ padding: '0 10px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button className={`btn btn-sm ${selectedYear === null ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setSelectedYear(null)}>All</button>
                  {filterOpts.years.map((y) => (
                    <button key={y}
                      className={`btn btn-sm ${selectedYear === y ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={() => setSelectedYear(selectedYear === y ? null : y)}>{y}</button>
                  ))}
                </div>
              )}
            </div>

            {/* GL Account + Gen Post Type */}
            <div style={{ padding: '10px 14px' }}>
              <GLFilterBar
                accountPrefix={accountPrefix}
                onAccountPrefix={setAccountPrefix}
                genPostType={genPostType}
                onGenPostType={setGenPostType}
              />
            </div>
          </div>
        </div>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>

          {/* Tab bar */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {([
              ['category',     'By Category'],
              ['detail',       'Account Detail'],
              ['coverage',     'Coverage Map'],
              ['distribution', 'Balance Distribution'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>

          {/* ══ Tab: By Category ═════════════════════════════════════════════ */}
          {tab === 'category' && (
            <>
              <ChartCard
                title="Balance & Net Change by Account Category"
                subtitle="Click a bar to drill into that category's accounts"
                loading={!!loading.cat} error={!!errors.cat} height={320}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    layout="vertical" data={categories}
                    margin={{ top: 8, right: 60, bottom: 8, left: 10 }}
                    onClick={(data) => {
                      if (!data?.activeLabel) return;
                      setDrillCat(String(data.activeLabel));
                      setTab('detail');
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="account_category" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip content={<USDTooltip />} />
                    <Legend />
                    <Bar dataKey="balance" name="Balance" style={{ cursor: 'pointer' }}>
                      {categories.map((r, i) => (
                        <Cell key={i} fill={CAT_COLORS[r.account_category] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                    <Line dataKey="net_change" name="Net Change" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Category Summary Table</div>
                <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Accounts</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th style={{ textAlign: 'right' }}>Net Change</th>
                        <th style={{ textAlign: 'right' }}>Entries</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.cat ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : categories.map((r) => (
                        <tr key={r.account_category} style={{ cursor: 'pointer' }}
                          onClick={() => { setDrillCat(r.account_category); setTab('detail'); }}>
                          <td>
                            <span className="badge" style={{
                              background: `${CAT_COLORS[r.account_category] ?? '#94a3b8'}22`,
                              color: CAT_COLORS[r.account_category] ?? '#94a3b8', fontSize: 10,
                            }}>{r.account_category}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.account_count.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(r.balance)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: r.net_change >= 0 ? '#22c55e' : '#ef4444' }}>
                            {r.net_change >= 0 ? '+' : ''}{fmt(r.net_change)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entry_count.toLocaleString()}</td>
                          <td>
                            <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '2px 7px' }}
                              onClick={(e) => { e.stopPropagation(); setDrillCat(r.account_category); setTab('detail'); }}>
                              Detail →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ Tab: Account Detail ══════════════════════════════════════════ */}
          {tab === 'detail' && (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <input
                  className="form-input"
                  placeholder="Search account no or name…"
                  value={searchQ}
                  onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
                  style={{ flex: 1, maxWidth: 320, fontSize: 12 }}
                />
                {drillCat && (
                  <span style={{
                    background: `${CAT_COLORS[drillCat] ?? '#94a3b8'}22`,
                    color: CAT_COLORS[drillCat] ?? '#94a3b8',
                    borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                  }}>
                    {drillCat}
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, color: 'inherit', fontWeight: 700 }}
                      onClick={() => setDrillCat(null)}>×</button>
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {filteredAccounts.length.toLocaleString()} accounts
                </span>
              </div>

              <div className="card">
                <div className="table-wrap" style={{ maxHeight: 500, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Account No</th><th>Account Name</th><th>Category</th><th>Subcategory</th>
                        <th style={{ textAlign: 'right' }}>Companies</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th style={{ textAlign: 'right' }}>Net Change</th>
                        <th style={{ textAlign: 'right' }}>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.accounts ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : pageAccounts.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>No accounts found</td></tr>
                      ) : pageAccounts.map((a) => (
                        <tr key={a.account_no}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11 }}>{a.account_no}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.account_name ?? <span className="badge badge-muted" style={{ fontSize: 10 }}>Unnamed</span>}
                          </td>
                          <td>
                            {a.account_category && (
                              <span className="badge" style={{
                                background: `${CAT_COLORS[a.account_category] ?? '#94a3b8'}22`,
                                color: CAT_COLORS[a.account_category] ?? '#94a3b8', fontSize: 10,
                              }}>{a.account_category}</span>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.account_subcategory ?? '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{a.company_count}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: a.balance_total >= 0 ? '#22c55e' : '#ef4444' }}>
                            {fmt(a.balance_total)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: a.net_change_total >= 0 ? '#22c55e' : '#ef4444' }}>
                            {a.net_change_total >= 0 ? '+' : ''}{fmt(a.net_change_total)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{a.entry_count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0 4px', alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                    <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Page {page} of {totalPages}</span>
                    <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
                    <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══ Tab: Coverage Map ════════════════════════════════════════════ */}
          {tab === 'coverage' && (
            <>
              <ChartCard
                title="Account Coverage by Category — Top 5 Companies"
                subtitle="Number of GL accounts per category for each major entity"
                loading={!!loading.coverage} error={!!errors.coverage} height={340}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coverageChartData} margin={{ top: 8, right: 20, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="category"
                      tick={{ fontSize: 10 } as React.SVGProps<SVGTextElement>}
                      angle={-30} textAnchor="end"
                      tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 12) + '…' : v} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {coverageCompanies.map((co, i) => (
                      <Bar key={co} dataKey={co}
                        name={co.length > 20 ? co.slice(0, 18) + '…' : co}
                        fill={COMPANY_COLORS[i % COMPANY_COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Coverage Detail Table</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  {coverageCats.map((cat) => (
                    <button key={cat}
                      className={`btn btn-sm ${drillCat === cat ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={() => setDrillCat(drillCat === cat ? null : cat)}>
                      {cat}
                    </button>
                  ))}
                  {drillCat && (
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }}
                      onClick={() => setDrillCat(null)}>All</button>
                  )}
                </div>
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Category</th><th>Company</th>
                        <th style={{ textAlign: 'right' }}>Accounts</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.coverage ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : coverage
                          .filter((r) => !drillCat || r.account_category === drillCat)
                          .map((r, i) => (
                        <tr key={i}>
                          <td>
                            <span className="badge" style={{
                              background: `${CAT_COLORS[r.account_category] ?? '#94a3b8'}22`,
                              color: CAT_COLORS[r.account_category] ?? '#94a3b8', fontSize: 10,
                            }}>{r.account_category}</span>
                          </td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.company_name}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{r.account_count}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ Tab: Balance Distribution ════════════════════════════════════ */}
          {tab === 'distribution' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Donut with centre label */}
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-title" style={{ marginBottom: 4 }}>Balance by Category (Donut)</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                    Click a slice → drill Account Detail
                  </div>
                  {loading.cat ? (
                    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
                  ) : (
                    <div style={{ height: 300, position: 'relative' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categories.map((r) => ({ name: r.account_category, value: Math.abs(r.balance) }))}
                            dataKey="value" nameKey="name"
                            cx="50%" cy="46%" outerRadius={110} innerRadius={55}
                            onClick={(data) => {
                              if (data?.name) { setDrillCat(String(data.name)); setTab('detail'); }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {categories.map((r, i) => (
                              <Cell key={i} fill={CAT_COLORS[r.account_category] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => [fmt(v), 'Balance (abs)']} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{
                        position: 'absolute', top: '44%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center', pointerEvents: 'none',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{fmt(donutTotal)}</div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>total</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Net Change bar */}
                <ChartCard
                  title="Net Change per Category"
                  subtitle="Positive = increase (blue) · Negative = decrease (red)"
                  loading={!!loading.cat} error={!!errors.cat} height={300}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={categories} margin={{ top: 8, right: 20, bottom: 8, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="account_category" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip content={<USDTooltip />} />
                      <ReferenceLine x={0} stroke="var(--color-border)" />
                      <Bar dataKey="net_change" name="Net Change" radius={[0, 3, 3, 0]}>
                        {categories.map((r, i) => (
                          <Cell key={i} fill={r.net_change >= 0 ? '#3b82f6' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Category mini cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 4 }}>
                {categories.slice(0, 6).map((r, i) => (
                  <div key={r.account_category} className="card"
                    style={{ padding: '12px 14px', borderLeft: `3px solid ${CAT_COLORS[r.account_category] ?? PIE_COLORS[i % PIE_COLORS.length]}`, cursor: 'pointer' }}
                    onClick={() => { setDrillCat(r.account_category); setTab('detail'); }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4 }}>{r.account_category}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: CAT_COLORS[r.account_category] ?? '#94a3b8' }}>{fmt(r.balance)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {r.account_count} accounts · {r.entry_count.toLocaleString()} entries
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, color: r.net_change >= 0 ? '#22c55e' : '#ef4444' }}>
                      Net: {r.net_change >= 0 ? '+' : ''}{fmt(r.net_change)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
