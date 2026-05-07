/**
 * 62_F062_Revenue.tsx — Revenue Report
 * IC-46 | Agent: Ananya_Frontend_004 | Reviewer: Kabir_Reviewer_010
 */
import { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  BarChart, Cell,
} from 'recharts';
import {
  api,
  type FilterOptions,
  type RevenueSummary,
  type RevenueMonthRow,
  type RevenueEntityRow,
  type RevenueAccountRow,
} from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtK = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const pctColor = (v: number | null) =>
  v == null ? '#666' : v >= 0 ? '#2F7873' : '#E8443B';

type TabKey = 'monthly' | 'entity' | 'account';

const COLORS = ['#1F6B66','#2F7873','#4F948D','#7DB3AC','#A9CDC8','#E8443B','#EE7D72','#F5A9A1'];

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KPITile({ label, value, sub, color = '#1F6B66' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E8ECEC', borderTop: `3px solid ${color}`,
      borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: 11, color: '#66726F', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#66726F', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E8ECEC', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Revenue() {
  const [tab, setTab]             = useState<TabKey>('monthly');
  const [filterOpts, setFilterOpts] = useState<FilterOptions | null>(null);
  const [selYear, setSelYear]     = useState<number | null>(null);
  const [selCompanies, setSelCompanies] = useState<number[]>([]);
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo]     = useState('');

  const [summary, setSummary]     = useState<RevenueSummary | null>(null);
  const [monthly, setMonthly]     = useState<RevenueMonthRow[]>([]);
  const [byEntity, setByEntity]   = useState<RevenueEntityRow[]>([]);
  const [byAccount, setByAccount] = useState<RevenueAccountRow[]>([]);

  const [loadSum, setLoadSum]     = useState(false);
  const [loadTab, setLoadTab]     = useState(false);
  const [errSum, setErrSum]       = useState(false);
  const [errTab, setErrTab]       = useState(false);

  // Load filter options once
  useEffect(() => {
    api.analytics.filters().then(setFilterOpts).catch(() => {});
  }, []);

  // Load summary whenever filters change
  useEffect(() => {
    setLoadSum(true); setErrSum(false);
    api.revenue.summary(selCompanies, selYear, monthFrom || undefined, monthTo || undefined)
      .then(setSummary)
      .catch(() => setErrSum(true))
      .finally(() => setLoadSum(false));
  }, [selCompanies, selYear, monthFrom, monthTo]);

  // Load tab data when tab or filters change
  useEffect(() => {
    setLoadTab(true); setErrTab(false);
    const ids = selCompanies;
    const yr  = selYear;
    const mf  = monthFrom || undefined;
    const mt  = monthTo   || undefined;
    const load =
      tab === 'monthly' ? api.revenue.byMonth(ids, yr, mf, mt).then(setMonthly) :
      tab === 'entity'  ? api.revenue.byEntity(ids, yr, mf, mt).then(setByEntity) :
                          api.revenue.byAccount(ids, yr, mf, mt).then(setByAccount);
    load.catch(() => setErrTab(true)).finally(() => setLoadTab(false));
  }, [tab, selCompanies, selYear, monthFrom, monthTo]);

  const toggleCompany = (id: number) =>
    setSelCompanies(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const months = filterOpts?.months ?? [];

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: '100vh', background: '#F4F6F6', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Filter sidebar ── */}
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #E8ECEC',
        padding: '20px 14px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
        boxShadow: '2px 0 8px rgba(0,0,0,.04)' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#1F6B66', textTransform: 'uppercase',
          letterSpacing: '.1em', marginBottom: 14 }}>Filters</div>

        {/* Year */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#66726F', fontWeight: 600, marginBottom: 6 }}>YEAR</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button onClick={() => setSelYear(null)}
              style={{ padding: '3px 8px', borderRadius: 99, fontSize: 11, border: '1px solid',
                borderColor: selYear === null ? '#1F6B66' : '#D1D8D8',
                background: selYear === null ? '#EEF5F4' : '#fff',
                color: selYear === null ? '#1F6B66' : '#66726F', cursor: 'pointer' }}>
              All
            </button>
            {(filterOpts?.years ?? []).map(y => (
              <button key={y} onClick={() => setSelYear(y)}
                style={{ padding: '3px 8px', borderRadius: 99, fontSize: 11, border: '1px solid',
                  borderColor: selYear === y ? '#1F6B66' : '#D1D8D8',
                  background: selYear === y ? '#EEF5F4' : '#fff',
                  color: selYear === y ? '#1F6B66' : '#66726F', cursor: 'pointer' }}>
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Month range */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#66726F', fontWeight: 600, marginBottom: 6 }}>FROM</div>
          <select value={monthFrom} onChange={e => setMonthFrom(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #D1D8D8', fontSize: 11 }}>
            <option value="">All</option>
            {months.map(m => <option key={m.month_key} value={m.month_key}>{m.month_name} {m.year}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#66726F', fontWeight: 600, marginBottom: 6 }}>TO</div>
          <select value={monthTo} onChange={e => setMonthTo(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #D1D8D8', fontSize: 11 }}>
            <option value="">All</option>
            {months.map(m => <option key={m.month_key} value={m.month_key}>{m.month_name} {m.year}</option>)}
          </select>
        </div>

        {/* Companies */}
        <div>
          <div style={{ fontSize: 11, color: '#66726F', fontWeight: 600, marginBottom: 6 }}>ENTITIES</div>
          {(filterOpts?.companies ?? []).map(c => (
            <label key={c.company_id} style={{ display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: '#333938', marginBottom: 5, cursor: 'pointer' }}>
              <input type="checkbox" checked={selCompanies.includes(c.company_id)}
                onChange={() => toggleCompany(c.company_id)} />
              {c.company_name}
            </label>
          ))}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#082624' }}>Revenue Report</div>
          <div style={{ fontSize: 13, color: '#66726F', marginTop: 3 }}>
            Recognised revenue from GL accounts (4xx) — all entities
          </div>
        </div>

        <PageExplainer
          icon="💵"
          title="What is the Revenue Report?"
          description="This page shows <strong>recognised revenue from GL accounts in the 4xx range</strong> across all subsidiaries. Revenue is sourced directly from posted GL entries — not from invoices — so it reflects actual earned income per accounting period. Use the sidebar filters to narrow by year, month, or specific entities. Tabs allow drill-down by month, entity, or account."
          concepts={[
            { icon: '●', color: '#1F6B66', label: 'Total Revenue', desc: 'Sum of all credit postings to 4xx accounts in the period' },
            { icon: '●', color: '#2F7873', label: 'Avg Monthly', desc: 'Total revenue divided by number of months in the selection' },
            { icon: '●', color: '#E8443B', label: 'Negative YoY', desc: 'Revenue declined vs same period last year' },
          ]}
          glossary={[
            { term: 'YoY Growth', def: 'Year-over-year change in revenue — requires selecting a specific year' },
            { term: '4xx Accounts', def: 'GL account codes starting with 4 — the revenue category in the canonical CoA' },
          ]}
        />

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <KPITile
            label="Total Revenue"
            value={loadSum ? '…' : errSum ? '—' : fmt(summary?.total_revenue ?? 0)}
            sub={`${summary?.entity_count ?? 0} entities · ${summary?.entry_count ?? 0} entries`}
            color="#1F6B66"
          />
          <KPITile
            label="YoY Growth"
            value={loadSum ? '…' : summary?.yoy_growth_pct == null ? 'N/A'
              : `${summary.yoy_growth_pct > 0 ? '+' : ''}${summary.yoy_growth_pct.toFixed(1)}%`}
            sub={summary?.prior_year_revenue ? `Prior: ${fmt(summary.prior_year_revenue)}` : 'Select a year for YoY'}
            color={pctColor(summary?.yoy_growth_pct ?? null)}
          />
          <KPITile
            label="Avg Monthly Revenue"
            value={loadSum ? '…' : fmtK(summary?.avg_monthly_revenue ?? 0)}
            sub={`Over ${summary?.month_count ?? 0} months`}
            color="#2F7873"
          />
          <KPITile
            label="Entities Reporting"
            value={loadSum ? '…' : String(summary?.entity_count ?? 0)}
            sub="Active revenue entities"
            color="#4F948D"
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {([['monthly','Monthly Trend'],['entity','By Entity'],['account','By Account']] as [TabKey,string][]).map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid', borderColor: tab === k ? '#1F6B66' : '#D1D8D8',
                background: tab === k ? '#1F6B66' : '#fff',
                color: tab === k ? '#fff' : '#66726F' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8ECEC',
          padding: '20px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          {errTab && <div style={{ color: '#E8443B', padding: 20 }}>Failed to load data.</div>}
          {loadTab && <div style={{ color: '#66726F', padding: 20 }}>Loading…</div>}

          {/* Monthly Trend */}
          {!loadTab && !errTab && tab === 'monthly' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1F6B66', marginBottom: 14 }}>
                Monthly Revenue — {monthly.length} months
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={monthly} margin={{ top: 4, right: 24, bottom: 4, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F2" />
                  <XAxis dataKey="month_name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#1F6B66" radius={[4,4,0,0]} />
                  <Line dataKey="revenue" name="Trend" stroke="#E8443B" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}

          {/* By Entity */}
          {!loadTab && !errTab && tab === 'entity' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1F6B66', marginBottom: 14 }}>
                Revenue by Entity — {byEntity.length} entities
              </div>
              <ResponsiveContainer width="100%" height={Math.max(260, byEntity.length * 36)}>
                <BarChart data={byEntity} layout="vertical" margin={{ top: 4, right: 80, bottom: 4, left: 140 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F2" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="company_name" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" radius={[0,4,4,0]}>
                    {byEntity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
                <thead>
                  <tr style={{ background: '#EEF5F4' }}>
                    {['Entity','Revenue','Share %','Entries'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Entity' ? 'left' : 'right',
                        color: '#1F6B66', fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byEntity.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F0F2F2' }}>
                      <td style={{ padding: '8px 12px', color: '#333938' }}>{r.company_name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1F6B66', fontWeight: 600 }}>{fmt(r.revenue)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66726F' }}>
                        {r.revenue_share_pct != null ? `${r.revenue_share_pct.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66726F' }}>{r.entry_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* By Account */}
          {!loadTab && !errTab && tab === 'account' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1F6B66', marginBottom: 14 }}>
                Revenue by Account — {byAccount.length} accounts
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#EEF5F4' }}>
                    {['Account No','Account Name','Revenue','Share %','Entities','Entries'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Account No' || h === 'Account Name' ? 'left' : 'right',
                        color: '#1F6B66', fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byAccount.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F0F2F2',
                      background: i % 2 === 0 ? '#fff' : '#FAFBFB' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#1F6B66' }}>{r.account_no}</td>
                      <td style={{ padding: '8px 12px', color: '#333938' }}>{r.account_name ?? '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#1F6B66' }}>{fmt(r.revenue)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66726F' }}>
                        {r.revenue_share_pct != null ? `${r.revenue_share_pct.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66726F' }}>{r.entity_count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66726F' }}>{r.entry_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
