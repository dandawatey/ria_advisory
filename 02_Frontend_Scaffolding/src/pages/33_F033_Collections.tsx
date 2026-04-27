/**
 * F033 — Monthly Collection Report
 * Tabs: Monthly Overview · By Customer · By Entity · Trend Analysis
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  api,
  type FilterOptions,
  type CollectionSummary,
  type CollectionMonthRow,
  type CollectionCustomerRow,
  type CollectionEntityRow,
} from '../api/client';
import { GLFilterBar } from '../components/GLFilterBar';

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toFixed(0)}`;
}

function rateColor(rate: number): string {
  if (rate >= 80) return '#22c55e';
  if (rate >= 60) return '#f59e0b';
  return '#ef4444';
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function KPITile({
  label, value, sub, color = '#3b82f6', loading,
}: {
  label: string; value: string; sub?: string; color?: string; loading?: boolean;
}) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{loading ? '…' : value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({
  title, subtitle, loading, error, height = 320, children,
}: {
  title: string; subtitle?: string; loading: boolean; error: boolean; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {subtitle && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -8, marginBottom: 8 }}>
          {subtitle}
        </div>
      )}
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
          Loading…
        </div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>
          Failed to load
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}

function CollectionTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,.12)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)', marginBottom: 2 }}>
          {p.name}:{' '}
          <strong>
            {p.name.toLowerCase().includes('rate') || p.name.toLowerCase().includes('%')
              ? `${p.value.toFixed(1)}%`
              : fmt(p.value)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function RateBadge({ rate }: { rate: number }) {
  const color = rateColor(rate);
  return (
    <span style={{
      background: `${color}22`,
      color,
      borderRadius: 4,
      padding: '2px 7px',
      fontSize: 11,
      fontWeight: 600,
    }}>
      {rate.toFixed(1)}%
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'monthly' | 'customer' | 'entity' | 'trend';

interface DrillState {
  label: string;
  type: 'month' | 'customer' | 'entity';
  value: string;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Collections() {
  const [tab, setTab] = useState<Tab>('monthly');
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    companies: [], years: [], months: [], currencies: [],
  });

  // Filter state
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [monthFrom, setMonthFrom] = useState<string>('');
  const [monthTo, setMonthTo] = useState<string>('');
  const [drill, setDrill] = useState<DrillState | null>(null);
  const [accountPrefix, setAccountPrefix] = useState('');
  const [genPostType, setGenPostType] = useState('');

  // Data state
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [monthly, setMonthly] = useState<CollectionMonthRow[]>([]);
  const [customers, setCustomers] = useState<CollectionCustomerRow[]>([]);
  const [entities, setEntities] = useState<CollectionEntityRow[]>([]);

  // Loading / error state
  const [loadSummary, setLoadSummary] = useState(true);
  const [loadMonthly, setLoadMonthly] = useState(false);
  const [loadCustomers, setLoadCustomers] = useState(false);
  const [loadEntities, setLoadEntities] = useState(false);
  const [_errSummary, setErrSummary] = useState(false);
  const [errMonthly, setErrMonthly] = useState(false);
  const [errCustomers, setErrCustomers] = useState(false);
  const [errEntities, setErrEntities] = useState(false);

  // Resolve effective month filters (drill by month narrows month_from/month_to)
  const mf = useCallback((): string | undefined => {
    if (drill?.type === 'month') return drill.value;
    return monthFrom || undefined;
  }, [drill, monthFrom]);

  const mt = useCallback((): string | undefined => {
    if (drill?.type === 'month') return drill.value;
    return monthTo || undefined;
  }, [drill, monthTo]);

  // Load filter options once
  useEffect(() => {
    api.analytics.filters().then(setFilterOpts).catch(() => null);
  }, []);

  // Summary KPIs — always load on filter change
  useEffect(() => {
    setLoadSummary(true);
    setErrSummary(false);
    api.collections
      .summary(selectedCompanies, year, mf(), mt())
      .then(setSummary)
      .catch(() => setErrSummary(true))
      .finally(() => setLoadSummary(false));
  }, [selectedCompanies, year, monthFrom, monthTo, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monthly tab data
  useEffect(() => {
    if (tab !== 'monthly' && tab !== 'trend') return;
    setLoadMonthly(true);
    setErrMonthly(false);
    api.collections
      .monthly(selectedCompanies, year, mf(), mt())
      .then(setMonthly)
      .catch(() => setErrMonthly(true))
      .finally(() => setLoadMonthly(false));
  }, [tab, selectedCompanies, year, monthFrom, monthTo, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Customer tab data
  useEffect(() => {
    if (tab !== 'customer') return;
    setLoadCustomers(true);
    setErrCustomers(false);
    const customerMonthFrom = drill?.type === 'month' ? drill.value : (monthFrom || undefined);
    const customerMonthTo = drill?.type === 'month' ? drill.value : (monthTo || undefined);
    api.collections
      .byCustomer(selectedCompanies, year, customerMonthFrom, customerMonthTo, 25)
      .then(setCustomers)
      .catch(() => setErrCustomers(true))
      .finally(() => setLoadCustomers(false));
  }, [tab, selectedCompanies, year, monthFrom, monthTo, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entity tab data
  useEffect(() => {
    if (tab !== 'entity') return;
    setLoadEntities(true);
    setErrEntities(false);
    api.collections
      .byEntity(selectedCompanies, year, mf(), mt())
      .then(setEntities)
      .catch(() => setErrEntities(true))
      .finally(() => setLoadEntities(false));
  }, [tab, selectedCompanies, year, monthFrom, monthTo, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCompany = (id: number) => {
    setSelectedCompanies((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setDrill(null);
  };

  const clearAll = () => {
    setSelectedCompanies([]);
    setYear(null);
    setMonthFrom('');
    setMonthTo('');
    setDrill(null);
  };

  // KPI derived values
  const totalInvoiced = summary?.total_invoiced ?? 0;
  const totalCollected = summary?.total_collected ?? 0;
  const outstanding = summary?.outstanding ?? 0;
  const collectionRate = summary?.collection_rate ?? 0;
  const invoiceCount = summary?.invoice_count ?? 0;
  const customerCount = summary?.customer_count ?? 0;

  const outstandingColor = outstanding > 0 ? '#f97316' : '#22c55e';

  // Trend analysis derived stats
  const bestMonth = monthly.length
    ? monthly.reduce((best, r) => (r.collection_rate > best.collection_rate ? r : best), monthly[0])
    : null;
  const worstMonth = monthly.length
    ? monthly.reduce((worst, r) => (r.collection_rate < worst.collection_rate ? r : worst), monthly[0])
    : null;
  const avgRate = monthly.length
    ? monthly.reduce((sum, r) => sum + r.collection_rate, 0) / monthly.length
    : 0;
  const totalOutstanding = monthly.reduce((sum, r) => sum + r.outstanding, 0);

  const TABS: [Tab, string][] = [
    ['monthly', 'Monthly Overview'],
    ['customer', 'By Customer'],
    ['entity', 'By Entity'],
    ['trend', 'Trend Analysis'],
  ];

  const monthOptions = filterOpts.months.map((m) => ({
    value: m.month_key,
    label: `${m.month_key} — ${m.month_name}`,
  }));

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Monthly Collection Report</h1>
        <p className="page-subtitle">Invoice issued vs payments collected — AR efficiency tracking</p>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile
          label="Total Invoiced"
          value={fmt(totalInvoiced)}
          color="#3b82f6"
          loading={loadSummary}
          sub={`${invoiceCount.toLocaleString()} invoices`}
        />
        <KPITile
          label="Total Collected"
          value={fmt(totalCollected)}
          color="#22c55e"
          loading={loadSummary}
          sub={`${summary?.payment_count ?? 0} payments`}
        />
        <KPITile
          label="Outstanding"
          value={fmt(outstanding)}
          color={outstandingColor}
          loading={loadSummary}
          sub="AR balance"
        />
        <KPITile
          label="Collection Rate"
          value={loadSummary ? '…' : `${collectionRate.toFixed(1)}%`}
          color={rateColor(collectionRate)}
          loading={false}
          sub={collectionRate >= 80 ? 'Excellent' : collectionRate >= 60 ? 'Fair' : 'Needs attention'}
        />
        <KPITile
          label="Invoice Count"
          value={invoiceCount.toLocaleString()}
          color="#8b5cf6"
          loading={loadSummary}
          sub={`${summary?.entity_count ?? 0} entities`}
        />
        <KPITile
          label="Active Customers"
          value={customerCount.toLocaleString()}
          color="#06b6d4"
          loading={loadSummary}
          sub="unique customers"
        />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Filter Panel */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="card-title" style={{ fontSize: 12, margin: 0 }}>Filters</div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 11 }}
                onClick={clearAll}
              >
                Clear All
              </button>
            </div>

            {/* Year chips */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button
                  className={`btn btn-sm ${year === null ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setYear(null)}
                >
                  All
                </button>
                {filterOpts.years.map((y) => (
                  <button
                    key={y}
                    className={`btn btn-sm ${year === y ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setYear((prev) => (prev === y ? null : y))}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Month From */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Month From</div>
              <select
                value={monthFrom}
                onChange={(e) => { setMonthFrom(e.target.value); setDrill(null); }}
                style={{
                  width: '100%', fontSize: 11, padding: '4px 6px',
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', borderRadius: 4,
                }}
              >
                <option value="">— All —</option>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Month To */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Month To</div>
              <select
                value={monthTo}
                onChange={(e) => { setMonthTo(e.target.value); setDrill(null); }}
                style={{
                  width: '100%', fontSize: 11, padding: '4px 6px',
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', borderRadius: 4,
                }}
              >
                <option value="">— All —</option>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Entity checkboxes */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Entities
                {selectedCompanies.length > 0 && (
                  <button
                    style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 11 }}
                    onClick={() => { setSelectedCompanies([]); setDrill(null); }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {filterOpts.companies.map((c) => (
                  <label
                    key={c.company_id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCompanies.includes(c.company_id)}
                      onChange={() => toggleCompany(c.company_id)}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.company_name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Active drill indicator */}
            {drill && (
              <div style={{
                marginTop: 12, padding: '6px 10px',
                background: 'rgba(59,130,246,0.08)', borderRadius: 6, fontSize: 11,
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                  Drill: {drill.label}
                </span>
                <button
                  onClick={() => setDrill(null)}
                  style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700 }}
                >
                  ×
                </button>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <GLFilterBar
                accountPrefix={accountPrefix}
                onAccountPrefix={setAccountPrefix}
                genPostType={genPostType}
                onGenPostType={setGenPostType}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Drill breadcrumb */}
          {drill && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              fontSize: 13, padding: '6px 12px',
              background: 'rgba(59,130,246,0.06)', borderRadius: 6,
              border: '1px solid rgba(59,130,246,0.2)',
            }}>
              <span
                style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}
                onClick={() => setDrill(null)}
              >
                All
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>→</span>
              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{drill.label}</span>
              <button
                onClick={() => setDrill(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontWeight: 700 }}
              >
                ×
              </button>
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

          {/* ══ MONTHLY OVERVIEW TAB ══ */}
          {tab === 'monthly' && (
            <>
              <ChartCard
                title="Monthly Collections — Invoiced vs Collected"
                subtitle="Bars: invoiced (blue) / collected (green) on left axis · Line: collection rate % on right axis · Click bar to drill"
                loading={loadMonthly}
                error={errMonthly}
                height={340}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthly}
                    margin={{ top: 8, right: 60, bottom: 4, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="l" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                    <YAxis
                      yAxisId="r"
                      orientation="right"
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fontSize: 10 }}
                      domain={[0, 100]}
                    />
                    <Tooltip content={<CollectionTooltip />} />
                    <Legend />
                    <Bar
                      yAxisId="l"
                      dataKey="invoiced"
                      name="Invoiced"
                      fill="#3b82f6"
                      radius={[3, 3, 0, 0]}
                      style={{ cursor: 'pointer' }}
                      onClick={(data: CollectionMonthRow) => {
                        if (data?.month) {
                          setDrill({ label: data.month_name, type: 'month', value: data.month });
                        }
                      }}
                    />
                    <Bar
                      yAxisId="l"
                      dataKey="collected"
                      name="Collected"
                      fill="#22c55e"
                      radius={[3, 3, 0, 0]}
                      style={{ cursor: 'pointer' }}
                      onClick={(data: CollectionMonthRow) => {
                        if (data?.month) {
                          setDrill({ label: data.month_name, type: 'month', value: data.month });
                        }
                      }}
                    />
                    <Line
                      yAxisId="r"
                      type="monotone"
                      dataKey="collection_rate"
                      name="Rate %"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={{ r: 3, fill: '#f97316' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Monthly Collection Detail</div>
                <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Invoiced</th>
                        <th style={{ textAlign: 'right' }}>Collected</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                        <th style={{ textAlign: 'right' }}>Collection Rate</th>
                        <th style={{ textAlign: 'right' }}>Invoices</th>
                        <th style={{ textAlign: 'right' }}>Payments</th>
                        <th style={{ textAlign: 'right' }}>Customers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadMonthly ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                            Loading…
                          </td>
                        </tr>
                      ) : monthly.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                            No data
                          </td>
                        </tr>
                      ) : monthly.map((r) => (
                        <tr
                          key={r.month}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDrill({ label: r.month_name, type: 'month', value: r.month })}
                        >
                          <td style={{ fontWeight: 500 }}>{r.month_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6' }}>{fmt(r.invoiced)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#22c55e' }}>{fmt(r.collected)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: r.outstanding > 0 ? '#f97316' : '#22c55e' }}>
                            {fmt(r.outstanding)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <RateBadge rate={r.collection_rate} />
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.invoice_count.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.payment_count.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.active_customers.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ BY CUSTOMER TAB ══ */}
          {tab === 'customer' && (
            <>
              <ChartCard
                title="Top 20 Customers — Invoiced vs Outstanding"
                subtitle="Click a bar to drill into that customer"
                loading={loadCustomers}
                error={errCustomers}
                height={480}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={customers.slice(0, 20)}
                    margin={{ top: 4, right: 80, bottom: 4, left: 10 }}
                    onClick={(d) => {
                      if (!d?.activeLabel) return;
                      const row = customers.find((c) => c.customer_name === d.activeLabel);
                      if (row) setDrill({ label: row.customer_name, type: 'customer', value: row.customer_name });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="customer_name"
                      tick={{ fontSize: 10 }}
                      width={160}
                      tickFormatter={(v: string) => (v?.length > 22 ? `${v.slice(0, 20)}…` : v)}
                    />
                    <Tooltip content={<CollectionTooltip />} />
                    <Legend />
                    <Bar dataKey="invoiced" name="Invoiced" fill="#3b82f6" style={{ cursor: 'pointer' }} />
                    <Bar dataKey="outstanding" name="Outstanding" fill="#f97316" radius={[0, 3, 3, 0]} style={{ cursor: 'pointer' }} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Customer Collection Detail</div>
                <div className="table-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th style={{ textAlign: 'right' }}>Invoices</th>
                        <th style={{ textAlign: 'right' }}>Invoiced</th>
                        <th style={{ textAlign: 'right' }}>Collected</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                        <th style={{ textAlign: 'right' }}>Collection Rate</th>
                        <th style={{ textAlign: 'right' }}>Entities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadCustomers ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                            Loading…
                          </td>
                        </tr>
                      ) : customers.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                            No data
                          </td>
                        </tr>
                      ) : customers.map((r) => (
                        <tr
                          key={r.customer_name}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDrill({ label: r.customer_name, type: 'customer', value: r.customer_name })}
                        >
                          <td style={{ fontWeight: 500 }}>{r.customer_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.invoice_count.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6' }}>{fmt(r.invoiced)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#22c55e' }}>{fmt(r.collected)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: r.outstanding > 0 ? '#f97316' : '#22c55e' }}>
                            {fmt(r.outstanding)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <RateBadge rate={r.collection_rate} />
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entity_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ BY ENTITY TAB ══ */}
          {tab === 'entity' && (
            <>
              <ChartCard
                title="Collection by Entity — Invoiced vs Collected"
                subtitle="Click a bar to drill into that entity"
                loading={loadEntities}
                error={errEntities}
                height={400}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={entities}
                    margin={{ top: 4, right: 80, bottom: 4, left: 10 }}
                    onClick={(d) => {
                      if (!d?.activeLabel) return;
                      const row = entities.find((e) => e.company_name === d.activeLabel);
                      if (row) setDrill({ label: row.company_name, type: 'entity', value: row.company_name });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="company_name"
                      tick={{ fontSize: 10 }}
                      width={170}
                      tickFormatter={(v: string) => (v?.length > 24 ? `${v.slice(0, 22)}…` : v)}
                    />
                    <Tooltip content={<CollectionTooltip />} />
                    <Legend />
                    <Bar dataKey="invoiced" name="Invoiced" fill="#3b82f6" style={{ cursor: 'pointer' }} />
                    <Bar dataKey="collected" name="Collected" fill="#22c55e" radius={[0, 3, 3, 0]} style={{ cursor: 'pointer' }} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Entity Collection Detail</div>
                <div className="table-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Entity</th>
                        <th style={{ textAlign: 'right' }}>Invoices</th>
                        <th style={{ textAlign: 'right' }}>Customers</th>
                        <th style={{ textAlign: 'right' }}>Invoiced</th>
                        <th style={{ textAlign: 'right' }}>Collected</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                        <th style={{ textAlign: 'right' }}>Rate %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadEntities ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                            Loading…
                          </td>
                        </tr>
                      ) : entities.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                            No data
                          </td>
                        </tr>
                      ) : entities.map((r) => (
                        <tr
                          key={r.company_name}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDrill({ label: r.company_name, type: 'entity', value: r.company_name })}
                        >
                          <td style={{ fontWeight: 500 }}>{r.company_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.invoice_count.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.customer_count.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6' }}>{fmt(r.invoiced)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#22c55e' }}>{fmt(r.collected)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: r.outstanding > 0 ? '#f97316' : '#22c55e' }}>
                            {fmt(r.outstanding)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <RateBadge rate={r.collection_rate} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ TREND ANALYSIS TAB ══ */}
          {tab === 'trend' && (
            <>
              <ChartCard
                title="Outstanding Balance Trend vs Collection Rate"
                subtitle="Area: outstanding AR balance · Line: collection rate % over time"
                loading={loadMonthly}
                error={errMonthly}
                height={340}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthly}
                    margin={{ top: 8, right: 60, bottom: 4, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="l" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                    <YAxis
                      yAxisId="r"
                      orientation="right"
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fontSize: 10 }}
                      domain={[0, 100]}
                    />
                    <Tooltip content={<CollectionTooltip />} />
                    <Legend />
                    <Area
                      yAxisId="l"
                      type="monotone"
                      dataKey="outstanding"
                      name="Outstanding"
                      fill="#f9730322"
                      stroke="#f97316"
                      strokeWidth={2}
                    />
                    <Bar
                      yAxisId="l"
                      dataKey="collected"
                      name="Collected"
                      fill="#22c55e44"
                      stroke="#22c55e"
                      strokeWidth={1}
                      radius={[3, 3, 0, 0]}
                    />
                    <Line
                      yAxisId="r"
                      type="monotone"
                      dataKey="collection_rate"
                      name="Rate %"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#3b82f6' }}
                    >
                      {monthly.map((r, i) => (
                        <Cell key={i} stroke={rateColor(r.collection_rate)} />
                      ))}
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Summary stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ borderTop: '3px solid #22c55e' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Best Collection Month
                  </div>
                  {bestMonth ? (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>
                        {bestMonth.month_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {bestMonth.collection_rate.toFixed(1)}% rate · {fmt(bestMonth.collected)} collected
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>—</div>
                  )}
                </div>

                <div className="card" style={{ borderTop: '3px solid #ef4444' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Worst Collection Month
                  </div>
                  {worstMonth ? (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>
                        {worstMonth.month_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {worstMonth.collection_rate.toFixed(1)}% rate · {fmt(worstMonth.outstanding)} outstanding
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>—</div>
                  )}
                </div>

                <div className="card" style={{ borderTop: `3px solid ${rateColor(avgRate)}` }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Avg Collection Rate
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: rateColor(avgRate) }}>
                    {monthly.length ? `${avgRate.toFixed(1)}%` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    over {monthly.length} month{monthly.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="card" style={{ borderTop: '3px solid #f97316' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Total Uncollected
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: totalOutstanding > 0 ? '#f97316' : '#22c55e' }}>
                    {fmt(totalOutstanding)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    cumulative outstanding
                  </div>
                </div>
              </div>

              {/* Monthly trend table */}
              <div className="card">
                <div className="card-title">Monthly Trend Detail</div>
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Q</th>
                        <th style={{ textAlign: 'right' }}>Invoiced</th>
                        <th style={{ textAlign: 'right' }}>Collected</th>
                        <th style={{ textAlign: 'right' }}>Refunded</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                        <th style={{ textAlign: 'right' }}>Rate</th>
                        <th style={{ textAlign: 'right' }}>Customers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadMonthly ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                            Loading…
                          </td>
                        </tr>
                      ) : monthly.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>
                            No data
                          </td>
                        </tr>
                      ) : monthly.map((r) => (
                        <tr key={r.month}>
                          <td style={{ fontWeight: 500 }}>{r.month_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>Q{r.quarter}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6' }}>{fmt(r.invoiced)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#22c55e' }}>{fmt(r.collected)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{fmt(r.refunded)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: r.outstanding > 0 ? '#f97316' : '#22c55e' }}>
                            {fmt(r.outstanding)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <RateBadge rate={r.collection_rate} />
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.active_customers.toLocaleString()}</td>
                        </tr>
                      ))}
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
