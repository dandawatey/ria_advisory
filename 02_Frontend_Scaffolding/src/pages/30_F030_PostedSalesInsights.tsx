/**
 * F030 — Posted Sales Insights
 * Source: fact_posted_sales — 3,094 entries: Invoice, Payment, Refund, Credit Memo
 * Note: amount values may be zero (data loading issue) — banner shown if total_amount = 0.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const PIE_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9',
];

const DOC_TYPE_COLORS: Record<string, string> = {
  Invoice: '#3b82f6',
  Payment: '#22c55e',
  Refund: '#f97316',
  'Credit Memo': '#8b5cf6',
};

const fmt = (n: number) =>
  Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
  : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
  : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K`
  : `$${n.toFixed(2)}`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company { company_id: number; company_name: string; }

interface SalesSummary {
  total_entries: number;
  total_amount: number;
  unique_customers: number;
  entity_count: number;
  invoice_count: number;
  payment_count: number;
}

interface PeriodRow {
  month: number;
  month_name: string;
  invoice_amount: number;
  payment_amount: number;
  refund_amount: number;
  net_amount: number;
  entry_count: number;
  invoice_count?: number;
  payment_count?: number;
}

interface CustomerRow {
  customer_vendor_name: string;
  entity_count: number;
  invoice_count: number;
  total_invoiced: number;
  total_paid: number;
  net_amount: number;
}

interface TypeRow {
  document_type: string;
  entry_count: number;
  total_amount: number;
  pct: number;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, loading, error, height = 300, children }: {
  title: string; loading: boolean; error: boolean; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>Failed to load</div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}

function CountTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)' }}>{p.name}: {Number(p.value).toLocaleString()}</div>
      ))}
    </div>
  );
}

type Tab = 'period' | 'customer' | 'type' | 'drill';

// ── Main Component ────────────────────────────────────────────────────────────

export default function PostedSalesInsights() {
  const [tab, setTab] = useState<Tab>('period');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [drill, setDrill] = useState<{ label: string; filter: Record<string, string> } | null>(null);

  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [periodData, setPeriodData] = useState<PeriodRow[]>([]);
  const [customerData, setCustomerData] = useState<CustomerRow[]>([]);
  const [typeData, setTypeData] = useState<TypeRow[]>([]);

  const [loadFilters, setLoadFilters] = useState(true);
  const [loadSum, setLoadSum] = useState(true);
  const [loadPeriod, setLoadPeriod] = useState(true);
  const [loadCust, setLoadCust] = useState(true);
  const [loadType, setLoadType] = useState(true);
  const [errSum, setErrSum] = useState(false);
  const [errPeriod, setErrPeriod] = useState(false);
  const [errCust, setErrCust] = useState(false);
  const [errType, setErrType] = useState(false);

  // Load filter options once
  useEffect(() => {
    fetch(`${BASE}/api/analytics/filters`)
      .then((r) => r.json())
      .then((data: { companies: Company[]; years: number[] }) => {
        setCompanies(data.companies ?? []);
        setYears(data.years ?? []);
      })
      .catch(() => null)
      .finally(() => setLoadFilters(false));
  }, []);

  const buildQS = useCallback(() => {
    const qs = new URLSearchParams();
    selectedCompanies.forEach((id) => qs.append('company_id', String(id)));
    if (year) qs.set('year', String(year));
    return qs;
  }, [selectedCompanies, year]);

  // Summary
  useEffect(() => {
    setLoadSum(true); setErrSum(false);
    const qs = buildQS();
    fetch(`${BASE}/api/insights/posted-sales/summary?${qs}`)
      .then((r) => r.json()).then(setSummary).catch(() => setErrSum(true)).finally(() => setLoadSum(false));
  }, [buildQS]);

  // Period data
  useEffect(() => {
    setLoadPeriod(true); setErrPeriod(false);
    const qs = buildQS();
    fetch(`${BASE}/api/insights/posted-sales/by-period?${qs}`)
      .then((r) => r.json()).then(setPeriodData).catch(() => setErrPeriod(true)).finally(() => setLoadPeriod(false));
  }, [buildQS]);

  // Customer data
  useEffect(() => {
    setLoadCust(true); setErrCust(false);
    const qs = buildQS();
    if (docTypeFilter) qs.set('doc_type', docTypeFilter);
    qs.set('limit', '20');
    fetch(`${BASE}/api/insights/posted-sales/by-customer?${qs}`)
      .then((r) => r.json()).then(setCustomerData).catch(() => setErrCust(true)).finally(() => setLoadCust(false));
  }, [buildQS, docTypeFilter]);

  // Type data
  useEffect(() => {
    setLoadType(true); setErrType(false);
    const qs = buildQS();
    fetch(`${BASE}/api/insights/posted-sales/by-type?${qs}`)
      .then((r) => r.json()).then(setTypeData).catch(() => setErrType(true)).finally(() => setLoadType(false));
  }, [buildQS]);

  const amountsAvailable = (summary?.total_amount ?? 0) !== 0;

  const toggleCompany = (id: number) =>
    setSelectedCompanies((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const top15Customers = [...customerData].slice(0, 15);

  const TABS: [Tab, string][] = [
    ['period', 'By Period'],
    ['customer', 'By Customer'],
    ['type', 'By Type'],
    ['drill', 'Drill Detail'],
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Posted Sales Insights</h1>
        <p className="page-subtitle">
          fact_posted_sales — 3,094 entries across Invoice, Payment, Refund, Credit Memo types
        </p>
      </div>

      {/* Zero-amount banner */}
      {!loadSum && !errSum && !amountsAvailable && (
        <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
          <strong>Sales amounts not yet populated</strong> — showing entry counts only. Amount fields are zero in the current data load.
        </div>
      )}

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <Tile label="Total Entries" value={loadSum ? '…' : (summary?.total_entries ?? 0).toLocaleString()} sub="All doc types" />
        <Tile label="Invoices" value={loadSum ? '…' : (summary?.invoice_count ?? 0).toLocaleString()} sub="Invoice type" />
        <Tile label="Payments" value={loadSum ? '…' : (summary?.payment_count ?? 0).toLocaleString()} sub="Payment type" />
        <Tile label="Unique Customers" value={loadSum ? '…' : (summary?.unique_customers ?? 0).toLocaleString()} sub="Distinct customers" />
        <Tile label="Entities" value={loadSum ? '…' : (summary?.entity_count ?? 0).toLocaleString()} sub="Companies with data" />
      </div>

      {/* Layout */}
      <div style={{ display: 'flex', gap: 16 }}>

        {/* Filter panel */}
        <div style={{ width: 240, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>

            {/* Companies */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Companies</div>
              {loadFilters ? (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Loading…</div>
              ) : (
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {companies.map((c) => (
                    <label key={c.company_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0' }}>
                      <input
                        type="checkbox"
                        checked={selectedCompanies.includes(c.company_id)}
                        onChange={() => toggleCompany(c.company_id)}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Year chips */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button
                  className={`btn btn-sm ${year === null ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setYear(null)}
                >All</button>
                {years.map((y) => (
                  <button
                    key={y}
                    className={`btn btn-sm ${year === y ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setYear(year === y ? null : y)}
                  >{y}</button>
                ))}
              </div>
            </div>

            {/* Document type */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>Document Type</label>
              <select
                className="form-select"
                style={{ fontSize: 11 }}
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="Invoice">Invoice</option>
                <option value="Payment">Payment</option>
                <option value="Refund">Refund</option>
                <option value="Credit Memo">Credit Memo</option>
              </select>
            </div>

            {/* Drill indicator */}
            {drill && (
              <div style={{ marginTop: 12, padding: '6px 10px', background: 'var(--color-primary-light)', borderRadius: 6, fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Drill: {drill.label}</span>
                <button
                  onClick={() => setDrill(null)}
                  style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700 }}
                >×</button>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Breadcrumb */}
          {drill && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setDrill(null)}>All Periods</button>
              <span style={{ color: 'var(--color-text-muted)' }}>→</span>
              <span style={{ fontWeight: 600 }}>{drill.label}</span>
              <button
                onClick={() => setDrill(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700, marginLeft: 4 }}
              >×</button>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {TABS.map(([key, label]) => (
              <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab: By Period ── */}
          {tab === 'period' && (
            <>
              <ChartCard title="Entries by Period — Invoice vs Payment Count" loading={loadPeriod} error={errPeriod} height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={periodData} margin={{ top: 8, right: 60, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip content={<CountTip />} />
                    <Legend />
                    <Bar
                      yAxisId="l"
                      dataKey="invoice_count"
                      name="Invoices"
                      fill="#3b82f6"
                      onClick={(data) => setDrill({ label: String(data.month_name), filter: { month: String(data.month) } })}
                      style={{ cursor: 'pointer' }}
                    />
                    <Bar
                      yAxisId="l"
                      dataKey="payment_count"
                      name="Payments"
                      fill="#22c55e"
                      onClick={(data) => setDrill({ label: String(data.month_name), filter: { month: String(data.month) } })}
                      style={{ cursor: 'pointer' }}
                    />
                    <Line yAxisId="r" dataKey="entry_count" name="Total Entries" stroke="#f97316" strokeWidth={2} dot={false} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Monthly Detail</div>
                <div className="table-wrap">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Total Entries</th>
                        <th style={{ textAlign: 'right' }}>Invoices</th>
                        <th style={{ textAlign: 'right' }}>Payments</th>
                        {amountsAvailable && <th style={{ textAlign: 'right' }}>Net Amount</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loadPeriod ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : periodData.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data for selected filters</td></tr>
                      ) : periodData.map((p) => (
                        <tr key={`${p.month}-${p.month_name}`}>
                          <td style={{ fontWeight: 500 }}>{p.month_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{p.entry_count.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(p.invoice_count ?? 0).toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(p.payment_count ?? 0).toLocaleString()}</td>
                          {amountsAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.net_amount)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Tab: By Customer ── */}
          {tab === 'customer' && (
            <>
              <ChartCard title="Top 15 Customers by Invoice Count" loading={loadCust} error={errCust} height={340}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top15Customers} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 160 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="customer_vendor_name"
                      tick={{ fontSize: 10 }}
                      width={160}
                      tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + '…' : v}
                    />
                    <Tooltip content={<CountTip />} />
                    <Bar
                      dataKey="invoice_count"
                      name="Invoice Count"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => setDrill({ label: String(data.customer_vendor_name), filter: { customer: String(data.customer_vendor_name) } })}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Customer Sales Detail</div>
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th style={{ textAlign: 'right' }}>Entities</th>
                        <th style={{ textAlign: 'right' }}>Invoices</th>
                        {amountsAvailable && <th style={{ textAlign: 'right' }}>Total Invoiced</th>}
                        {amountsAvailable && <th style={{ textAlign: 'right' }}>Total Paid</th>}
                        {amountsAvailable && <th style={{ textAlign: 'right' }}>Net</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loadCust ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : customerData.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No results</td></tr>
                      ) : customerData.map((c) => (
                        <tr key={c.customer_vendor_name}>
                          <td style={{ fontWeight: 500 }}>{c.customer_vendor_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{c.entity_count}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{c.invoice_count.toLocaleString()}</td>
                          {amountsAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.total_invoiced)}</td>}
                          {amountsAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.total_paid)}</td>}
                          {amountsAvailable && (
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: c.net_amount >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                              {fmt(c.net_amount)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Tab: By Type ── */}
          {tab === 'type' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ChartCard title="Entry Count by Document Type (Donut)" loading={loadType} error={errType} height={320}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeData}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={110}
                        dataKey="entry_count"
                        nameKey="document_type"
                        label={({ document_type, pct: p }: { document_type: string; pct: number }) =>
                          `${document_type} ${Number(p ?? 0).toFixed(1)}%`
                        }
                        labelLine={false}
                      >
                        {typeData.map((row, i) => (
                          <Cell key={i} fill={DOC_TYPE_COLORS[row.document_type] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Entries']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Entry Count by Type — Bar" loading={loadType} error={errType} height={320}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeData} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="document_type" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CountTip />} />
                      <Bar dataKey="entry_count" name="Entries" radius={[4, 4, 0, 0]}>
                        {typeData.map((row, i) => (
                          <Cell key={i} fill={DOC_TYPE_COLORS[row.document_type] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="card" style={{ marginTop: 0 }}>
                <div className="card-title">Document Type Summary</div>
                <div className="table-wrap">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Count</th>
                        {amountsAvailable && <th style={{ textAlign: 'right' }}>Amount</th>}
                        <th style={{ textAlign: 'right' }}>% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadType ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : typeData.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data</td></tr>
                      ) : typeData.map((t) => (
                        <tr key={t.document_type}>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: DOC_TYPE_COLORS[t.document_type] ? `${DOC_TYPE_COLORS[t.document_type]}18` : undefined,
                                color: DOC_TYPE_COLORS[t.document_type] ?? 'var(--color-text)',
                                fontSize: 11,
                              }}
                            >
                              {t.document_type}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{t.entry_count.toLocaleString()}</td>
                          {amountsAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(t.total_amount)}</td>}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(t.pct ?? 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Tab: Drill Detail ── */}
          {tab === 'drill' && (
            <>
              {!drill ? (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--color-text-muted)' }}>
                  <div style={{ fontSize: 16, marginBottom: 8 }}>No drill active</div>
                  <div style={{ fontSize: 13 }}>Click any bar or chart element in By Period or By Customer tabs to drill through.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 16px', background: 'var(--color-primary-light)', borderRadius: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Drilled into: {drill.label}</span>
                    {Object.entries(drill.filter).map(([k, v]) => (
                      <span key={k} className="badge badge-muted" style={{ fontSize: 11 }}>{k}: {v}</span>
                    ))}
                    <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setDrill(null)}>Clear ×</button>
                  </div>

                  {drill.filter.month && (
                    <ChartCard title={`Top Customers in ${drill.label}`} loading={loadCust} error={errCust} height={300}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={customerData.slice(0, 15)} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 160 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis
                            type="category"
                            dataKey="customer_vendor_name"
                            tick={{ fontSize: 10 }}
                            width={160}
                            tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + '…' : v}
                          />
                          <Tooltip content={<CountTip />} />
                          <Bar dataKey="invoice_count" name="Invoices" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}

                  {drill.filter.customer && (
                    <ChartCard title={`Monthly Activity — ${drill.label}`} loading={loadPeriod} error={errPeriod} height={260}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={periodData} margin={{ top: 8, right: 40, bottom: 4, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip content={<CountTip />} />
                          <Legend />
                          <Bar dataKey="entry_count" name="Entries" fill="#3b82f6" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}

                  <div className="card" style={{ marginTop: 8 }}>
                    <div className="card-title">Drill Context</div>
                    <table style={{ fontSize: 13, width: '100%' }}>
                      <tbody>
                        {Object.entries(drill.filter).map(([k, v]) => (
                          <tr key={k}>
                            <td style={{ padding: '6px 0', color: 'var(--color-text-muted)', width: 120 }}>{k}</td>
                            <td style={{ fontWeight: 600 }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
