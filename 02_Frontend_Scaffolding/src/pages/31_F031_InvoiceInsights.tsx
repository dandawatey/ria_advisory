/**
 * F031 — Invoice Insights
 * Source: fact_posted_sales WHERE document_type = 'Invoice'
 * Drill: clicking entity → drill to customer-level for that entity.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';

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

interface Company { company_id: number; company_name: string; }

interface InvoiceSummary {
  invoice_count: number;
  total_value: number;
  avg_invoice: number;
  entity_count: number;
  customer_count: number;
}

interface PeriodRow {
  month: number;
  month_name: string;
  invoice_count: number;
  invoice_value: number;
  avg_invoice: number;
}

interface CustomerRow {
  customer_vendor_name: string;
  invoice_count: number;
  total_value: number;
  avg_invoice: number;
  company_name: string;
}

interface EntityRow {
  company_name: string;
  invoice_count: number;
  total_value: number;
  avg_invoice: number;
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

function ChartCard({ title, subtitle, loading, error, height = 300, children }: {
  title: string; subtitle?: string; loading: boolean; error: boolean; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, marginTop: -8 }}>{subtitle}</div>}
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
        <div key={p.name} style={{ color: p.color ?? 'var(--color-text)' }}>
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? fmt(p.value) : Number(p.value).toLocaleString()}
        </div>
      ))}
    </div>
  );
}

type Tab = 'trend' | 'entity' | 'customer' | 'distribution';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMagnitudeColor(count: number, max: number): string {
  if (max === 0) return '#94a3b8';
  const ratio = count / max;
  if (ratio >= 0.7) return '#3b82f6';
  if (ratio >= 0.4) return '#06b6d4';
  return '#94a3b8';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function InvoiceInsights() {
  const [tab, setTab] = useState<Tab>('trend');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [drill, setDrill] = useState<{ label: string; filter: Record<string, string> } | null>(null);

  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [periodData, setPeriodData] = useState<PeriodRow[]>([]);
  const [customerData, setCustomerData] = useState<CustomerRow[]>([]);
  const [entityData, setEntityData] = useState<EntityRow[]>([]);

  const [loadFilters, setLoadFilters] = useState(true);
  const [loadSum, setLoadSum] = useState(true);
  const [loadPeriod, setLoadPeriod] = useState(true);
  const [loadCust, setLoadCust] = useState(true);
  const [loadEnt, setLoadEnt] = useState(true);
  const [, setErrSum] = useState(false);
  const [errPeriod, setErrPeriod] = useState(false);
  const [errCust, setErrCust] = useState(false);
  const [errEnt, setErrEnt] = useState(false);

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
    fetch(`${BASE}/api/insights/invoices/summary?${qs}`)
      .then((r) => r.json()).then(setSummary).catch(() => setErrSum(true)).finally(() => setLoadSum(false));
  }, [buildQS]);

  // Period
  useEffect(() => {
    setLoadPeriod(true); setErrPeriod(false);
    const qs = buildQS();
    fetch(`${BASE}/api/insights/invoices/by-period?${qs}`)
      .then((r) => r.json()).then(setPeriodData).catch(() => setErrPeriod(true)).finally(() => setLoadPeriod(false));
  }, [buildQS]);

  // Customer
  useEffect(() => {
    setLoadCust(true); setErrCust(false);
    const qs = buildQS();
    qs.set('limit', '15');
    fetch(`${BASE}/api/insights/invoices/by-customer?${qs}`)
      .then((r) => r.json()).then(setCustomerData).catch(() => setErrCust(true)).finally(() => setLoadCust(false));
  }, [buildQS]);

  // Entity
  useEffect(() => {
    setLoadEnt(true); setErrEnt(false);
    const qs = buildQS();
    fetch(`${BASE}/api/insights/invoices/by-entity?${qs}`)
      .then((r) => r.json()).then(setEntityData).catch(() => setErrEnt(true)).finally(() => setLoadEnt(false));
  }, [buildQS]);

  const valuesAvailable = (summary?.total_value ?? 0) !== 0;

  const toggleCompany = (id: number) =>
    setSelectedCompanies((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  // Distribution stats
  const maxCount = Math.max(...periodData.map((p) => p.invoice_count), 1);
  const peakMonth = periodData.reduce((best, p) => p.invoice_count > (best?.invoice_count ?? 0) ? p : best, periodData[0] ?? null);
  const lowestMonth = periodData.filter((p) => p.invoice_count > 0).reduce((low, p) => p.invoice_count < (low?.invoice_count ?? Infinity) ? p : low, periodData[0] ?? null);
  const avgMonthly = periodData.length > 0 ? Math.round(periodData.reduce((s, p) => s + p.invoice_count, 0) / periodData.length) : 0;

  const filteredEntityCustomers = drill?.filter.entity
    ? customerData.filter((c) => c.company_name === drill.filter.entity)
    : customerData;

  const TABS: [Tab, string][] = [
    ['trend', 'Monthly Trend'],
    ['entity', 'By Entity'],
    ['customer', 'By Customer'],
    ['distribution', 'Invoice Distribution'],
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Invoice Insights</h1>
        <p className="page-subtitle">
          Invoice-only analysis from fact_posted_sales — document_type = 'Invoice'
        </p>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <Tile label="Invoice Count" value={loadSum ? '…' : (summary?.invoice_count ?? 0).toLocaleString()} sub="Total invoices" />
        <Tile label="Total Invoice Value" value={loadSum ? '…' : (valuesAvailable ? fmt(summary?.total_value ?? 0) : '—')} sub={valuesAvailable ? undefined : 'Amounts not loaded'} />
        <Tile label="Avg Invoice Value" value={loadSum ? '…' : (valuesAvailable ? fmt(summary?.avg_invoice ?? 0) : '—')} sub="Per invoice" />
        <Tile label="Entities with Invoices" value={loadSum ? '…' : (summary?.entity_count ?? 0).toLocaleString()} sub="Active companies" />
        <Tile label="Unique Customers" value={loadSum ? '…' : (summary?.customer_count ?? 0).toLocaleString()} sub="Distinct customers" />
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
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
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

            {/* Drill indicator */}
            {drill && (
              <div style={{ marginTop: 4, padding: '6px 10px', background: 'var(--color-primary-light)', borderRadius: 6, fontSize: 11 }}>
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
              <button className="btn btn-secondary btn-sm" onClick={() => setDrill(null)}>All Entities</button>
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

          {/* ── Tab: Monthly Trend ── */}
          {tab === 'trend' && (
            <>
              <ChartCard
                title="Monthly Invoice Count & Value Trend"
                subtitle={valuesAvailable ? 'Bar = invoice count (blue), Line = invoice value (green dashed)' : 'Bar = invoice count — value amounts not yet loaded'}
                loading={loadPeriod}
                error={errPeriod}
                height={320}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={periodData} margin={{ top: 8, right: 60, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                    {valuesAvailable && <YAxis yAxisId="r" orientation="right" tickFormatter={fmt} tick={{ fontSize: 10 }} />}
                    <Tooltip content={<MoneyTip />} />
                    <Legend />
                    <Bar
                      yAxisId="l"
                      dataKey="invoice_count"
                      name="Invoice Count"
                      fill="#3b82f6"
                      radius={[3, 3, 0, 0]}
                      onClick={(data) => setDrill({ label: String(data.month_name), filter: { month: String(data.month) } })}
                      style={{ cursor: 'pointer' }}
                    />
                    {valuesAvailable && (
                      <Line
                        yAxisId="r"
                        dataKey="invoice_value"
                        name="Invoice Value"
                        stroke="#22c55e"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={false}
                        type="monotone"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Monthly Invoice Data</div>
                <div className="table-wrap">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Invoice Count</th>
                        {valuesAvailable && <th style={{ textAlign: 'right' }}>Invoice Value</th>}
                        {valuesAvailable && <th style={{ textAlign: 'right' }}>Avg Invoice</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loadPeriod ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : periodData.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data for selected filters</td></tr>
                      ) : periodData.map((p) => (
                        <tr key={`${p.month}-${p.month_name}`}>
                          <td style={{ fontWeight: 500 }}>{p.month_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{p.invoice_count.toLocaleString()}</td>
                          {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.invoice_value)}</td>}
                          {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.avg_invoice)}</td>}
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
              <ChartCard title="Invoice Count by Entity" subtitle="Click a bar to drill into that entity's customers" loading={loadEnt} error={errEnt} height={360}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={drill?.filter.entity ? entityData.filter((e) => e.company_name === drill.filter.entity) : entityData}
                    layout="vertical"
                    margin={{ top: 4, right: 80, bottom: 4, left: 170 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="company_name"
                      tick={{ fontSize: 10 }}
                      width={170}
                      tickFormatter={(v: string) => v.length > 24 ? v.slice(0, 22) + '…' : v}
                    />
                    <Tooltip content={<MoneyTip />} />
                    <Legend />
                    <Bar
                      dataKey="invoice_count"
                      name="Invoice Count"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => setDrill({ label: String(data.company_name), filter: { entity: String(data.company_name) } })}
                      style={{ cursor: 'pointer' }}
                    />
                    {valuesAvailable && (
                      <Bar dataKey="avg_invoice" name="Avg Invoice" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Entity Invoice Summary</div>
                <div className="table-wrap">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Entity</th>
                        <th style={{ textAlign: 'right' }}>Invoices</th>
                        {valuesAvailable && <th style={{ textAlign: 'right' }}>Total Value</th>}
                        {valuesAvailable && <th style={{ textAlign: 'right' }}>Avg Invoice</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loadEnt ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : entityData.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data</td></tr>
                      ) : (drill?.filter.entity ? entityData.filter((e) => e.company_name === drill.filter.entity) : entityData).map((e) => (
                        <tr key={e.company_name}>
                          <td style={{ fontWeight: 500 }}>{e.company_name}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{e.invoice_count.toLocaleString()}</td>
                          {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(e.total_value)}</td>}
                          {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(e.avg_invoice)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Drill: show customers for selected entity */}
              {drill?.filter.entity && (
                <div className="card" style={{ marginTop: 16 }}>
                  <div className="card-title">Customers in {drill.label}</div>
                  <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th style={{ textAlign: 'right' }}>Invoices</th>
                          {valuesAvailable && <th style={{ textAlign: 'right' }}>Total Value</th>}
                          {valuesAvailable && <th style={{ textAlign: 'right' }}>Avg Invoice</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {loadCust ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: 12, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                        ) : filteredEntityCustomers.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: 12, color: 'var(--color-text-muted)' }}>No customers found for this entity</td></tr>
                        ) : filteredEntityCustomers.map((c) => (
                          <tr key={c.customer_vendor_name}>
                            <td>{c.customer_vendor_name}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{c.invoice_count.toLocaleString()}</td>
                            {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.total_value)}</td>}
                            {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.avg_invoice)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab: By Customer ── */}
          {tab === 'customer' && (
            <>
              <ChartCard title="Top 15 Customers by Invoice Count" loading={loadCust} error={errCust} height={360}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={customerData.slice(0, 15)}
                    layout="vertical"
                    margin={{ top: 4, right: 60, bottom: 4, left: 160 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="customer_vendor_name"
                      tick={{ fontSize: 10 }}
                      width={160}
                      tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + '…' : v}
                    />
                    <Tooltip content={<MoneyTip />} />
                    <Bar
                      dataKey="invoice_count"
                      name="Invoice Count"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => setDrill({ label: String(data.customer_vendor_name), filter: { customer: String(data.customer_vendor_name) } })}
                      style={{ cursor: 'pointer' }}
                    >
                      {customerData.slice(0, 15).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card">
                <div className="card-title">Customer Invoice Detail</div>
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Entity</th>
                        <th style={{ textAlign: 'right' }}>Invoices</th>
                        {valuesAvailable && <th style={{ textAlign: 'right' }}>Total Value</th>}
                        {valuesAvailable && <th style={{ textAlign: 'right' }}>Avg Invoice</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loadCust ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : customerData.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No results</td></tr>
                      ) : (drill?.filter.customer
                        ? customerData.filter((c) => c.customer_vendor_name === drill.filter.customer)
                        : customerData
                      ).map((c) => (
                        <tr key={`${c.customer_vendor_name}-${c.company_name}`}>
                          <td style={{ fontWeight: 500 }}>{c.customer_vendor_name}</td>
                          <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.company_name || '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{c.invoice_count.toLocaleString()}</td>
                          {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.total_value)}</td>}
                          {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.avg_invoice)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Tab: Invoice Distribution ── */}
          {tab === 'distribution' && (
            <>
              {/* Callout cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ padding: '14px 16px', borderTop: '3px solid #3b82f6' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Peak Month</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{peakMonth?.month_name ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{peakMonth ? `${peakMonth.invoice_count} invoices` : ''}</div>
                </div>
                <div className="card" style={{ padding: '14px 16px', borderTop: '3px solid #94a3b8' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Lowest Month</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8' }}>{lowestMonth?.month_name ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{lowestMonth ? `${lowestMonth.invoice_count} invoices` : ''}</div>
                </div>
                <div className="card" style={{ padding: '14px 16px', borderTop: '3px solid #22c55e' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Total Months</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{periodData.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>with invoice data</div>
                </div>
                <div className="card" style={{ padding: '14px 16px', borderTop: '3px solid #f97316' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Avg Monthly Invoices</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#f97316' }}>{avgMonthly}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>per month</div>
                </div>
              </div>

              <ChartCard
                title="Invoice Count per Month — Colored by Magnitude"
                subtitle="Blue = high volume (≥70% of peak), Cyan = medium (40–69%), Gray = low (<40%)"
                loading={loadPeriod}
                error={errPeriod}
                height={280}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={periodData} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<MoneyTip />} />
                    <Bar dataKey="invoice_count" name="Invoices" radius={[3, 3, 0, 0]}>
                      {periodData.map((p, i) => (
                        <Cell key={i} fill={getMagnitudeColor(p.invoice_count, maxCount)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="card" style={{ marginTop: 0 }}>
                <div className="card-title">Distribution Statistics</div>
                <div className="table-wrap">
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Invoice Count</th>
                        <th style={{ textAlign: 'center' }}>Magnitude</th>
                        {valuesAvailable && <th style={{ textAlign: 'right' }}>Invoice Value</th>}
                        {valuesAvailable && <th style={{ textAlign: 'right' }}>Avg Invoice</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loadPeriod ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                      ) : periodData.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)' }}>No data</td></tr>
                      ) : periodData.map((p) => {
                        const ratio = maxCount > 0 ? p.invoice_count / maxCount : 0;
                        const level = ratio >= 0.7 ? 'High' : ratio >= 0.4 ? 'Medium' : 'Low';
                        const badgeClass = ratio >= 0.7 ? 'badge-success' : ratio >= 0.4 ? 'badge-muted' : '';
                        return (
                          <tr key={`${p.month}-dist`}>
                            <td style={{ fontWeight: 500 }}>{p.month_name}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{p.invoice_count.toLocaleString()}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${badgeClass}`} style={{ fontSize: 10 }}>{level}</span>
                            </td>
                            {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.invoice_value)}</td>}
                            {valuesAvailable && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.avg_invoice)}</td>}
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
