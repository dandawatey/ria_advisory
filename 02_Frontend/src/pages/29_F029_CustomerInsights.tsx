/**
 * F029 — Customer Insights
 * Source: dim_customer — 154 customers, 17 entities, Business Central master data.
 * Note: customer master is not filtered by company_id/year — it is a dimension table.
 */
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import PageExplainer from '../components/common/PageExplainer';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const PIE_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#84cc16','#0ea5e9',
];

const fmt = (n: number) =>
  Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
  : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
  : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K`
  : `$${n.toFixed(2)}`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerSummary {
  total_customers: number;
  total_balance: number;
  total_balance_due: number;
  total_sales: number;
  avg_balance: number;
}

interface TopCustomer {
  customer_name: string;
  company: string;
  city: string;
  state: string;
  balance: number;
  balance_due: number;
  total_sales: number;
  total_payments: number;
}

interface EntityRow {
  company_name: string;
  customer_count: number;
  total_balance: number;
  total_sales: number;
}

interface GeoRow {
  city: string;
  state: string;
  customer_count: number;
  total_balance: number;
  total_sales: number;
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

function ChartCard({ title, loading, error, height = 280, children }: {
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

function MoneyTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)' }}>{p.name}: {fmt(p.value)}</div>
      ))}
    </div>
  );
}

type Tab = 'top' | 'entity' | 'geo' | 'balance';

// ── Main Component ────────────────────────────────────────────────────────────

export default function CustomerInsights() {
  const [tab, setTab] = useState<Tab>('top');
  const [sortBy, setSortBy] = useState<'sales' | 'balance'>('sales');
  const [search, setSearch] = useState('');
  const [drill, setDrill] = useState<{ label: string; filter: Record<string, string> } | null>(null);

  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [geoData, setGeoData] = useState<GeoRow[]>([]);

  const [loadSum, setLoadSum] = useState(true);
  const [loadTop, setLoadTop] = useState(true);
  const [loadEnt, setLoadEnt] = useState(true);
  const [loadGeo, setLoadGeo] = useState(true);
  const [, setErrSum] = useState(false);
  const [errTop, setErrTop] = useState(false);
  const [errEnt, setErrEnt] = useState(false);
  const [errGeo, setErrGeo] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/insights/customers/summary`)
      .then((r) => r.json()).then(setSummary).catch(() => setErrSum(true)).finally(() => setLoadSum(false));
    fetch(`${BASE}/api/insights/customers/by-entity`)
      .then((r) => r.json()).then(setEntities).catch(() => setErrEnt(true)).finally(() => setLoadEnt(false));
    fetch(`${BASE}/api/insights/customers/geographic`)
      .then((r) => r.json()).then(setGeoData).catch(() => setErrGeo(true)).finally(() => setLoadGeo(false));
  }, []);

  useEffect(() => {
    setLoadTop(true);
    setErrTop(false);
    fetch(`${BASE}/api/insights/customers/top?limit=20&sort_by=${sortBy}`)
      .then((r) => r.json()).then(setTopCustomers).catch(() => setErrTop(true)).finally(() => setLoadTop(false));
  }, [sortBy]);

  const filteredCustomers = topCustomers.filter((c) => {
    if (drill?.filter.customer && c.customer_name !== drill.filter.customer) return false;
    if (search && !c.customer_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredByDrillEntity = drill?.filter.entity
    ? topCustomers.filter((c) => c.company === drill.filter.entity)
    : topCustomers;

  const top15Sales = [...topCustomers].sort((a, b) => b.total_sales - a.total_sales).slice(0, 15);
  const top15Balance = [...topCustomers].sort((a, b) => b.balance - a.balance).slice(0, 15);

  const TABS: [Tab, string][] = [
    ['top', 'Top Customers'],
    ['entity', 'By Entity'],
    ['geo', 'Geographic'],
    ['balance', 'Balance Analysis'],
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Customer Insights</h1>
        <p className="page-subtitle">
          Customer master data from Business Central — 154 customers across 17 entities
        </p>
      </div>

      <PageExplainer
        icon="👥"
        title="What is Customer Insights?"
        description="This page analyses <strong>154 customer records from the Business Central customer master</strong> across 17 entities. The Top Customers tab ranks by total sales or AR balance and supports drill-through by entity. By Entity shows customer count and revenue contribution per subsidiary. Geographic breaks down customers by city and state. Balance Analysis highlights AR balance concentration and days-sales-outstanding risk. Use the filter panel to search customers or drill into a specific entity."
        concepts={[
          { icon: '$', color: '#22c55e', label: 'Total Sales', desc: 'Lifetime cumulative invoiced amount for this customer across all entities' },
          { icon: '!', color: '#dc2626', label: 'Balance Due', desc: 'Past-due portion of the AR balance — amounts overdue beyond payment terms' },
          { icon: '→', color: '#3b82f6', label: 'Drill', desc: 'Click an entity bar to filter the customer table to that entity only' },
        ]}
        glossary={[
          { term: 'AR Balance', def: 'Accounts Receivable balance — total outstanding amount owed by this customer' },
          { term: 'dim_customer', def: 'Business Central customer dimension table — not filtered by fiscal year or period' },
          { term: 'Total Payments', def: 'Cumulative payments received from this customer against invoices' },
        ]}
      />

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <Tile label="Total Customers" value={loadSum ? '…' : String(summary?.total_customers ?? 0)} sub="Active in BC" />
        <Tile label="Total AR Balance" value={loadSum ? '…' : fmt(summary?.total_balance ?? 0)} sub="Outstanding receivables" />
        <Tile label="Total Balance Due" value={loadSum ? '…' : fmt(summary?.total_balance_due ?? 0)} sub="Past due" />
        <Tile label="Total Sales (Lifetime)" value={loadSum ? '…' : fmt(summary?.total_sales ?? 0)} sub="Cumulative invoiced" />
        <Tile label="Avg Balance / Customer" value={loadSum ? '…' : fmt(summary?.avg_balance ?? 0)} sub="Per active customer" />
      </div>

      {/* Layout: filter panel + content */}
      <div style={{ display: 'flex', gap: 16 }}>

        {/* Filter panel */}
        <div style={{ width: 240, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Sort By</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`btn btn-sm ${sortBy === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: 11 }}
                  onClick={() => setSortBy('sales')}
                >Sales</button>
                <button
                  className={`btn btn-sm ${sortBy === 'balance' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: 11 }}
                  onClick={() => setSortBy('balance')}
                >Balance</button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>Search Customer</label>
              <input
                className="form-input"
                style={{ fontSize: 12 }}
                placeholder="Filter table…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

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
              <button className="btn btn-secondary btn-sm" onClick={() => setDrill(null)}>All</button>
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

          {/* ── Tab: Top Customers ── */}
          {tab === 'top' && (
            <>
              <ChartCard title="Top 15 Customers by Sales" loading={loadTop} error={errTop} height={360}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top15Sales} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 160 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="customer_name"
                      tick={{ fontSize: 10 }}
                      width={160}
                      tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + '…' : v}
                    />
                    <Tooltip content={<MoneyTip />} />
                    <Bar
                      dataKey="total_sales"
                      name="Total Sales"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => setDrill({ label: data.customer_name, filter: { customer: data.customer_name } })}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Customer Detail Table</div>
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Customer Name</th>
                        <th>Entity</th>
                        <th>City</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th style={{ textAlign: 'right' }}>Balance Due</th>
                        <th style={{ textAlign: 'right' }}>Total Sales</th>
                        <th style={{ textAlign: 'right' }}>Total Payments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadTop ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : filteredCustomers.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No results</td></tr>
                      ) : filteredCustomers.map((c) => (
                        <tr key={`${c.customer_name}-${c.company}`}>
                          <td style={{ fontWeight: 500 }}>{c.customer_name}</td>
                          <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.company || '—'}</td>
                          <td style={{ fontSize: 11 }}>{c.city || '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: c.balance >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                            {fmt(c.balance)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: c.balance_due > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                            {fmt(c.balance_due)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.total_sales)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.total_payments)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Tab: By Entity ── */}
          {tab === 'entity' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 0 }}>
                <ChartCard title="Sales & Balance by Entity" loading={loadEnt} error={errEnt} height={320}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={entities} margin={{ top: 8, right: 20, bottom: 60, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="company_name"
                        tick={{ fontSize: 9 } as React.SVGProps<SVGTextElement>}
                        angle={-35}
                        textAnchor="end"
                        tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 14) + '…' : v}
                      />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                      <Tooltip content={<MoneyTip />} />
                      <Legend />
                      <Bar
                        dataKey="total_sales"
                        name="Total Sales"
                        fill="#3b82f6"
                        onClick={(data) => setDrill({ label: data.company_name, filter: { entity: data.company_name } })}
                        style={{ cursor: 'pointer' }}
                      />
                      <Bar dataKey="total_balance" name="Total Balance" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Customer Count by Entity" loading={loadEnt} error={errEnt} height={320}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={entities}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={100}
                        dataKey="customer_count"
                        nameKey="company_name"
                        labelLine={false}
                      >
                        {entities.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, 'Customers']} />
                      <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-title">Entity Summary Table</div>
                <div className="table-wrap">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Entity</th>
                        <th style={{ textAlign: 'right' }}>Customers</th>
                        <th style={{ textAlign: 'right' }}>Total Balance</th>
                        <th style={{ textAlign: 'right' }}>Total Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadEnt ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : (drill?.filter.entity
                        ? entities.filter((e) => e.company_name === drill.filter.entity)
                        : entities
                      ).map((e) => (
                        <tr key={e.company_name}>
                          <td style={{ fontWeight: 500 }}>{e.company_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{e.customer_count}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(e.total_balance)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(e.total_sales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {drill?.filter.entity && (
                <div className="card" style={{ marginTop: 16 }}>
                  <div className="card-title">Customers in {drill.label}</div>
                  <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Customer Name</th><th>City</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                          <th style={{ textAlign: 'right' }}>Total Sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredByDrillEntity.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: 12, color: 'var(--color-text-muted)' }}>No customers found</td></tr>
                        ) : filteredByDrillEntity.map((c) => (
                          <tr key={c.customer_name}>
                            <td>{c.customer_name}</td>
                            <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.city || '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: c.balance >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{fmt(c.balance)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.total_sales)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab: Geographic ── */}
          {tab === 'geo' && (
            <>
              {geoData.some((g) => !g.city) && (
                <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 6, padding: '8px 14px', marginBottom: 12, fontSize: 12 }}>
                  Note: {geoData.filter((g) => !g.city).reduce((s, g) => s + g.customer_count, 0)} customers have no city data.
                </div>
              )}

              <ChartCard title="Top Cities by Total Sales" loading={loadGeo} error={errGeo} height={340}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...geoData].filter((g) => g.city).sort((a, b) => b.total_sales - a.total_sales).slice(0, 15)}
                    layout="vertical"
                    margin={{ top: 4, right: 60, bottom: 4, left: 120 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="city" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip content={<MoneyTip />} />
                    <Bar dataKey="total_sales" name="Total Sales" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-title">Geographic Detail</div>
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>City</th>
                        <th>State</th>
                        <th style={{ textAlign: 'right' }}>Customer Count</th>
                        <th style={{ textAlign: 'right' }}>Total Balance</th>
                        <th style={{ textAlign: 'right' }}>Total Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadGeo ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : geoData.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No geographic data</td></tr>
                      ) : geoData.map((g, i) => (
                        <tr key={`${g.city}-${g.state}-${i}`}>
                          <td>{g.city || <span className="badge badge-muted" style={{ fontSize: 10 }}>Unknown</span>}</td>
                          <td style={{ color: 'var(--color-text-muted)' }}>{g.state || '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{g.customer_count}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(g.total_balance)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(g.total_sales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Tab: Balance Analysis ── */}
          {tab === 'balance' && (
            <>
              <ChartCard title="Top 15 by Balance — Balance vs Balance Due" loading={loadTop} error={errTop} height={360}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={top15Balance} layout="vertical" margin={{ top: 4, right: 80, bottom: 4, left: 160 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="customer_name"
                      tick={{ fontSize: 10 }}
                      width={160}
                      tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + '…' : v}
                    />
                    <Tooltip content={<MoneyTip />} />
                    <Legend />
                    <Bar dataKey="balance" name="Balance" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Line dataKey="balance_due" name="Balance Due" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-title">Balance vs Sales Comparison</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  Red flag: balance due &gt; 50% of total sales — potential collection risk
                </div>
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Entity</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th style={{ textAlign: 'right' }}>Balance Due</th>
                        <th style={{ textAlign: 'right' }}>Total Sales</th>
                        <th style={{ textAlign: 'center' }}>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadTop ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : top15Balance.map((c) => {
                        const isRisk = c.total_sales > 0 && c.balance_due > 0.5 * c.total_sales;
                        return (
                          <tr key={`${c.customer_name}-bal`} style={{ background: isRisk ? 'rgba(239,68,68,0.04)' : undefined }}>
                            <td style={{ fontWeight: 500 }}>{c.customer_name}</td>
                            <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.company || '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-success)' }}>{fmt(c.balance)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: c.balance_due > 0 ? 'var(--color-error)' : 'var(--color-text)' }}>{fmt(c.balance_due)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.total_sales)}</td>
                            <td style={{ textAlign: 'center' }}>
                              {isRisk
                                ? <span className="badge badge-error" style={{ fontSize: 10 }}>Collection Risk</span>
                                : <span className="badge badge-success" style={{ fontSize: 10 }}>OK</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
