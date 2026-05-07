/**
 * F035 — Accounts Receivable Ageing Report
 * Tabs: Bucket Summary · By Customer · By Entity
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import {
  api,
  type FilterOptions,
  type AgeingSummary,
  type AgeingCustomerRow,
  type AgeingEntityRow,
} from '../api/client';
import PageExplainer from '../components/common/PageExplainer';
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

function pct(part: number, total: number): string {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

// Bucket definitions
const BUCKETS = [
  { key: 'bucket_0_30',    label: '0–30 days',   color: '#22c55e' },
  { key: 'bucket_31_60',   label: '31–60 days',  color: '#84cc16' },
  { key: 'bucket_61_90',   label: '61–90 days',  color: '#f59e0b' },
  { key: 'bucket_91_120',  label: '91–120 days', color: '#f97316' },
  { key: 'bucket_120_plus',label: '120+ days',   color: '#ef4444' },
] as const;

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

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'buckets' | 'customer' | 'entity';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Main Component ────────────────────────────────────────────────────────────
export default function Ageing() {
  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filterOpts, setFilterOpts]         = useState<FilterOptions | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [year, setYear]                     = useState<number | null>(null);
  const [monthFrom, setMonthFrom]           = useState('');
  const [monthTo, setMonthTo]               = useState('');
  const [tab, setTab]                       = useState<Tab>('buckets');
  // ── Data state ───────────────────────────────────────────────────────────────
  const [summary, setSummary]         = useState<AgeingSummary | null>(null);
  const [customers, setCustomers]     = useState<AgeingCustomerRow[]>([]);
  const [entities, setEntities]       = useState<AgeingEntityRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingEntities, setLoadingEntities]   = useState(false);
  const [error, setError]             = useState(false);

  // ── Load filter options ───────────────────────────────────────────────────────
  useEffect(() => {
    api.analytics.filters().then(setFilterOpts).catch(() => {});
  }, []);

  // ── Build QS helpers ──────────────────────────────────────────────────────────
  const ids  = selectedCompanies;
  const yr   = year;
  const mf   = monthFrom || undefined;
  const mt   = monthTo   || undefined;

  // ── Load summary + KPIs ───────────────────────────────────────────────────────
  const loadSummary = useCallback(() => {
    setLoading(true); setError(false);
    api.ageing.summary(ids, yr, mf, mt)
      .then(setSummary)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [ids, yr, mf, mt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // ── Load by-customer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'customer') return;
    setLoadingCustomers(true);
    api.ageing.byCustomer(ids, yr, mf, mt, 25)
      .then(setCustomers)
      .catch(() => {})
      .finally(() => setLoadingCustomers(false));
  }, [tab, ids, yr, mf, mt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load by-entity ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'entity') return;
    setLoadingEntities(true);
    api.ageing.byEntity(ids, yr, mf, mt)
      .then(setEntities)
      .catch(() => {})
      .finally(() => setLoadingEntities(false));
  }, [tab, ids, yr, mf, mt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bucket chart data ─────────────────────────────────────────────────────────
  const bucketData = summary
    ? BUCKETS.map((b) => ({
        name: b.label,
        amount: summary[b.key as keyof AgeingSummary] as number,
        color: b.color,
      }))
    : [];

  const pieData = bucketData.filter((d) => d.amount > 0);

  const total = summary?.total_outstanding ?? 0;

  // ── Years ─────────────────────────────────────────────────────────────────────
  const years = filterOpts?.years ?? [];
  const companies = filterOpts?.companies ?? [];

  const toggleCompany = (id: number) =>
    setSelectedCompanies((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AR Ageing</h1>
        <p className="page-subtitle">Accounts Receivable ageing by invoice date buckets</p>
      </div>

      <PageExplainer
        icon="⏳"
        title="What is the AR Ageing Report?"
        description="This page shows <strong>Accounts Receivable balances bucketed by the age of the outstanding invoice</strong>. Buckets are: current (0–30 days), 31–60 days, 61–90 days, 91–120 days, and 120+ days overdue. The Bucket Summary tab shows the overall ageing profile as a bar chart and donut. By Customer ranks customers by overdue balance. By Entity compares ageing risk across subsidiaries. Finance teams use this to prioritise collections and assess credit risk."
        concepts={[
          { icon: '✓', color: '#22c55e', label: '0–30 Days', desc: 'Current — within payment terms; no action required' },
          { icon: '⚠', color: '#f59e0b', label: '31–90 Days', desc: 'Overdue — follow up with customer; send reminder' },
          { icon: '!', color: '#ef4444', label: '120+ Days', desc: 'Severely overdue — escalate to collections; consider bad debt provision' },
        ]}
        glossary={[
          { term: 'Ageing Bucket', def: 'Time range since invoice date — groups outstanding AR by how long it has been unpaid' },
          { term: 'Total Outstanding', def: 'Sum of all unpaid invoice balances across all ageing buckets' },
          { term: 'Bad Debt Provision', def: 'Reserve set aside for invoices unlikely to be collected, typically 120+ days overdue' },
        ]}
      />

      {/* ── KPI Tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPITile label="Total Outstanding" value={fmt(summary?.total_outstanding)} sub={`${summary?.invoice_count ?? 0} invoices`} color="#3b82f6" loading={loading} />
        <KPITile label="0–30 Days"   value={fmt(summary?.bucket_0_30)}    sub={summary ? pct(summary.bucket_0_30, total)    : ''} color="#22c55e" loading={loading} />
        <KPITile label="31–60 Days"  value={fmt(summary?.bucket_31_60)}   sub={summary ? pct(summary.bucket_31_60, total)   : ''} color="#84cc16" loading={loading} />
        <KPITile label="61–90 Days"  value={fmt(summary?.bucket_61_90)}   sub={summary ? pct(summary.bucket_61_90, total)   : ''} color="#f59e0b" loading={loading} />
        <KPITile label="91–120 Days" value={fmt(summary?.bucket_91_120)}  sub={summary ? pct(summary.bucket_91_120, total)  : ''} color="#f97316" loading={loading} />
        <KPITile label="120+ Days"   value={fmt(summary?.bucket_120_plus)} sub={summary ? pct(summary.bucket_120_plus, total): ''} color="#ef4444" loading={loading} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* ── Filter Sidebar ── */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[null, ...years].map((y) => (
                  <button key={y ?? 'all'} onClick={() => setYear(y)}
                    style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, cursor: 'pointer', border: '1px solid', borderColor: year === y ? '#3b82f6' : 'var(--color-border)', background: year === y ? 'rgba(59,130,246,0.12)' : 'transparent', color: year === y ? '#3b82f6' : 'inherit', fontWeight: year === y ? 600 : 400 }}>
                    {y ?? 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Month From</div>
              <select value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)}
                style={{ width: '100%', fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'inherit' }}>
                <option value="">All</option>
                {years.flatMap((y) => MONTHS.map((m, i) => ({ key: `${y}-${String(i + 1).padStart(2, '0')}`, label: `${m} ${y}` })))
                  .map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Month To</div>
              <select value={monthTo} onChange={(e) => setMonthTo(e.target.value)}
                style={{ width: '100%', fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'inherit' }}>
                <option value="">All</option>
                {years.flatMap((y) => MONTHS.map((m, i) => ({ key: `${y}-${String(i + 1).padStart(2, '0')}`, label: `${m} ${y}` })))
                  .map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>

            {companies.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  Entities {selectedCompanies.length > 0 && `(${selectedCompanies.length})`}
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {companies.map((c) => (
                    <label key={c.company_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '3px 0' }}>
                      <input type="checkbox" style={{ accentColor: 'var(--color-primary)' }}
                        checked={selectedCompanies.includes(c.company_id)}
                        onChange={() => toggleCompany(c.company_id)} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Main Content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* ── Tabs ── */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {(['buckets', 'customer', 'entity'] as Tab[]).map((t) => (
              <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t === 'buckets' ? 'Bucket Summary' : t === 'customer' ? 'By Customer' : 'By Entity'}
              </button>
            ))}
          </div>

      {/* ── Tab: Bucket Summary ── */}
      {tab === 'buckets' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ChartCard title="Outstanding by Age Bucket" loading={loading} error={error} height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bucketData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v) => fmt(v as number)} />
                <Bar dataKey="amount" name="Outstanding" radius={[4, 4, 0, 0]}>
                  {bucketData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Bucket Distribution" loading={loading} error={error} height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={110}
                  innerRadius={60}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  labelLine={false}
                >
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v as number)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Bucket table */}
          <div className="card" style={{ gridColumn: '1 / -1', overflowX: 'auto' }}>
            <div className="card-title">Ageing Summary Table</div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Bucket</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Amount</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {BUCKETS.map((b) => {
                  const val = (summary?.[b.key as keyof AgeingSummary] as number) ?? 0;
                  return (
                    <tr key={b.key} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                        {b.label}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>{fmt(val)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{pct(val, total)}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid var(--color-border)', fontWeight: 700 }}>
                  <td style={{ padding: '8px 12px' }}>Total Outstanding</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(total)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: By Customer ── */}
      {tab === 'customer' && (
        <>
          <ChartCard title="Top Customers — Ageing Breakdown" loading={loadingCustomers} error={false} height={360}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={customers.slice(0, 15)}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 10 }} width={150} />
                <Tooltip formatter={(v) => fmt(v as number)} />
                <Legend />
                {BUCKETS.map((b) => (
                  <Bar key={b.key} dataKey={b.key} name={b.label} stackId="a" fill={b.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="card" style={{ overflowX: 'auto' }}>
            <div className="card-title">Customer Ageing Detail</div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Customer</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Invoices</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Total</th>
                  {BUCKETS.map((b) => (
                    <th key={b.key} style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: b.color }}>
                      {b.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customer_name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.invoice_count}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(r.total_outstanding)}</td>
                    {BUCKETS.map((b) => (
                      <td key={b.key} style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        {fmt((r[b.key as keyof AgeingCustomerRow] as number) ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Tab: By Entity ── */}
      {tab === 'entity' && (
        <>
          <ChartCard title="Entity Ageing Breakdown" loading={loadingEntities} error={false} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={entities}
                margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="company_name" tick={false} interval={0} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v) => fmt(v as number)} />
                <Legend />
                {BUCKETS.map((b) => (
                  <Bar key={b.key} dataKey={b.key} name={b.label} stackId="a" fill={b.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="card" style={{ overflowX: 'auto' }}>
            <div className="card-title">Entity Ageing Detail</div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Entity</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Invoices</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Customers</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Total</th>
                  {BUCKETS.map((b) => (
                    <th key={b.key} style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: b.color }}>
                      {b.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entities.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.company_name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.invoice_count}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.customer_count}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(r.total_outstanding)}</td>
                    {BUCKETS.map((b) => (
                      <td key={b.key} style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        {fmt((r[b.key as keyof AgeingEntityRow] as number) ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
        </div>
      </div>
    </div>
  );
}
