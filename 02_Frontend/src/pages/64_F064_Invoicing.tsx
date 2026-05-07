import { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  BarChart, Cell,
} from 'recharts';
import {
  api,
  type FilterOptions,
  type InvoicingSummary,
  type InvoicingMonthRow,
  type InvoicingEntityRow,
  type InvoicingAccountRow,
} from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

// ── formatters ────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const fmtK = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtN = (v: number) =>
  new Intl.NumberFormat('en-US').format(v);

const COLORS = ['#1F6B66','#2F7873','#4F948D','#7DB3AC','#A9CDC8','#E8443B','#EE7D72','#F5A9A1'];

// ── KPI tile ──────────────────────────────────────────────────────────────────
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

// ── tooltip ───────────────────────────────────────────────────────────────────
function InvTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; name: string; color: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E8ECEC', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'invoice_count' ? fmtN(p.value) : fmt(p.value)}
        </div>
      ))}
    </div>
  );
}

type TabKey = 'monthly' | 'entity' | 'account';

// ── main page ─────────────────────────────────────────────────────────────────
export default function InvoicingPage() {
  const [tab, setTab]                = useState<TabKey>('monthly');
  const [filterOpts, setFilterOpts]  = useState<FilterOptions | null>(null);
  const [selYear, setSelYear]        = useState<number | null>(null);
  const [selCompanies, setSelCompanies] = useState<number[]>([]);
  const [monthFrom, setMonthFrom]    = useState('');
  const [monthTo, setMonthTo]        = useState('');

  const [summary, setSummary]        = useState<InvoicingSummary | null>(null);
  const [monthly, setMonthly]        = useState<InvoicingMonthRow[]>([]);
  const [byEntity, setByEntity]      = useState<InvoicingEntityRow[]>([]);
  const [byAccount, setByAccount]    = useState<InvoicingAccountRow[]>([]);

  const [loadSum, setLoadSum]        = useState(false);
  const [loadTab, setLoadTab]        = useState(false);
  const [, setErrSum]                = useState(false);
  const [errTab, setErrTab]          = useState(false);

  // load filter options once
  useEffect(() => {
    api.analytics.filters().then(setFilterOpts).catch(() => {});
  }, []);

  // load summary
  useEffect(() => {
    setLoadSum(true); setErrSum(false);
    api.invoicing.summary(selCompanies, selYear, monthFrom || undefined, monthTo || undefined)
      .then(setSummary)
      .catch(() => setErrSum(true))
      .finally(() => setLoadSum(false));
  }, [selCompanies, selYear, monthFrom, monthTo]);

  // load tab data
  useEffect(() => {
    setLoadTab(true); setErrTab(false);
    const ids = selCompanies;
    const yr  = selYear;
    const mf  = monthFrom || undefined;
    const mt  = monthTo   || undefined;
    const load =
      tab === 'monthly' ? api.invoicing.byMonth(ids, yr, mf, mt).then(setMonthly) :
      tab === 'entity'  ? api.invoicing.byEntity(ids, yr, mf, mt).then(setByEntity) :
                          api.invoicing.byAccount(ids, yr, mf, mt).then(setByAccount);
    load.catch(() => setErrTab(true)).finally(() => setLoadTab(false));
  }, [tab, selCompanies, selYear, monthFrom, monthTo]);

  const toggleCompany = (id: number) =>
    setSelCompanies(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#1F6B66' : '#D1D8D8',
    background: active ? '#1F6B66' : '#fff', color: active ? '#fff' : '#66726F',
  });

  const yearBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#1F6B66' : '#D1D8D8',
    background: active ? '#EEF5F4' : '#fff', color: active ? '#1F6B66' : '#66726F',
    fontWeight: active ? 700 : 400,
  });

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: '100vh', background: '#F4F6F6', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Sidebar filters ── */}
      <aside style={{ width: 220, minHeight: '100vh', background: '#fff', borderRight: '1px solid #E8ECEC',
        padding: '20px 14px', position: 'sticky', top: 0, overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1F6B66', letterSpacing: '.1em',
          textTransform: 'uppercase', marginBottom: 16 }}>Filters</div>

        {/* Year */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: '#66726F', fontWeight: 600, marginBottom: 8 }}>YEAR</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button style={yearBtnStyle(selYear === null)} onClick={() => setSelYear(null)}>All</button>
            {(filterOpts?.years ?? []).slice().reverse().map(y => (
              <button key={y} style={yearBtnStyle(selYear === y)} onClick={() => setSelYear(y)}>{y}</button>
            ))}
          </div>
        </div>

        {/* Month range */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: '#66726F', fontWeight: 600, marginBottom: 6 }}>FROM</div>
          <select value={monthFrom} onChange={e => setMonthFrom(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D1D8D8',
              fontSize: 12, color: '#333938', background: '#fff' }}>
            <option value=''>All</option>
            {(filterOpts?.months ?? []).map(m => (
              <option key={m.month_key} value={m.month_key}>{m.month_name} {m.year}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: '#66726F', fontWeight: 600, marginBottom: 6 }}>TO</div>
          <select value={monthTo} onChange={e => setMonthTo(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D1D8D8',
              fontSize: 12, color: '#333938', background: '#fff' }}>
            <option value=''>All</option>
            {(filterOpts?.months ?? []).map(m => (
              <option key={m.month_key} value={m.month_key}>{m.month_name} {m.year}</option>
            ))}
          </select>
        </div>

        {/* Entities */}
        <div>
          <div style={{ fontSize: 11, color: '#66726F', fontWeight: 600, marginBottom: 8 }}>ENTITIES</div>
          {(filterOpts?.companies ?? []).map(c => (
            <label key={c.company_id} style={{ display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 6, cursor: 'pointer', fontSize: 12, color: '#333938' }}>
              <input type='checkbox' checked={selCompanies.includes(c.company_id)}
                onChange={() => toggleCompany(c.company_id)}
                style={{ accentColor: '#1F6B66' }} />
              {c.company_name}
            </label>
          ))}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1F6B66', margin: 0 }}>Invoicing Report</h1>
          <p style={{ fontSize: 13, color: '#66726F', margin: '4px 0 0' }}>
            Invoice count and value from GL — revenue accounts (4xx) filtered to Invoice document type
          </p>
        </div>

        <PageExplainer
          icon="🧾"
          title="What is the Invoicing Report?"
          description="This page shows <strong>invoice volume and value from GL entries</strong> — specifically revenue account (4xx) postings where the document type is Invoice. It gives finance teams a GL-sourced view of billing activity: how many invoices were raised, their total value, average size, and year-over-year growth. Use the sidebar to filter by year, month, or entity."
          concepts={[
            { icon: '●', color: '#1F6B66', label: 'Invoice Value', desc: 'Total credit value of GL entries classified as Invoice document type' },
            { icon: '●', color: '#2F7873', label: 'Invoice Count', desc: 'Number of distinct invoice entries in the GL' },
            { icon: '●', color: '#E8443B', label: 'Negative Growth', desc: 'Invoice value declined year-over-year' },
          ]}
          glossary={[
            { term: 'Avg Invoice', def: 'Total invoice value ÷ invoice count — average size of each invoice' },
            { term: 'YoY Growth', def: 'Comparison of invoice value to the same period in the prior year' },
          ]}
        />

        {/* KPI strip */}
        {loadSum ? (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', color: '#66726F', fontSize: 13 }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            <KPITile label='Total Invoices' value={fmtN(summary?.total_invoices ?? 0)} color='#1F6B66' />
            <KPITile label='Total Value' value={fmt(summary?.total_value ?? 0)} color='#2F7873' />
            <KPITile label='Avg Invoice' value={summary?.avg_invoice != null ? fmt(summary.avg_invoice) : '—'} color='#4F948D' />
            <KPITile
              label='YoY Growth'
              value={summary?.yoy_growth_pct != null ? `${summary.yoy_growth_pct > 0 ? '+' : ''}${summary.yoy_growth_pct.toFixed(1)}%` : '—'}
              color={summary?.yoy_growth_pct != null && summary.yoy_growth_pct >= 0 ? '#1F6B66' : '#E8443B'}
              sub={`${summary?.entity_count ?? 0} entities`}
            />
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {([['monthly','Monthly Trend'],['entity','By Entity'],['account','By Account']] as [TabKey,string][]).map(([k,l]) => (
            <button key={k} style={btnStyle(tab === k)} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: '#fff', border: '1px solid #E8ECEC', borderRadius: 12,
          padding: '20px 24px', minHeight: 340 }}>
          {loadTab ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#66726F', fontSize: 13 }}>Loading...</div>
          ) : errTab ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#E8443B', fontSize: 13 }}>Failed to load data.</div>
          ) : tab === 'monthly' ? (
            monthly.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#66726F', fontSize: 13 }}>No data for selected filters.</div>
            ) : (
              <ResponsiveContainer width='100%' height={340}>
                <ComposedChart data={monthly} margin={{ top: 4, right: 24, bottom: 4, left: 16 }}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#F0F2F2' />
                  <XAxis dataKey='month_name' tick={{ fontSize: 11 }} />
                  <YAxis yAxisId='left' tickFormatter={fmtK} tick={{ fontSize: 11 }} width={64} />
                  <YAxis yAxisId='right' orientation='right' tick={{ fontSize: 11 }} width={48} />
                  <Tooltip content={<InvTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId='left' dataKey='total_value' name='Invoice Value' fill='#1F6B66' radius={[4,4,0,0]} />
                  <Line yAxisId='right' dataKey='invoice_count' name='Invoice Count' stroke='#E8443B' strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )
          ) : tab === 'entity' ? (
            byEntity.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#66726F', fontSize: 13 }}>No data for selected filters.</div>
            ) : (
              <>
                <ResponsiveContainer width='100%' height={Math.max(240, byEntity.length * 36)}>
                  <BarChart data={byEntity} layout='vertical' margin={{ top: 4, right: 80, bottom: 4, left: 140 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#F0F2F2' horizontal={false} />
                    <XAxis type='number' tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                    <YAxis type='category' dataKey='company_name' tick={{ fontSize: 11 }} width={130} />
                    <Tooltip content={<InvTooltip />} />
                    <Bar dataKey='total_value' name='Invoice Value' radius={[0,4,4,0]}>
                      {byEntity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
                  <thead>
                    <tr style={{ background: '#EEF5F4' }}>
                      {['Entity','Invoices','Total Value','Share %'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Entity' ? 'left' : 'right',
                          color: '#1F6B66', fontWeight: 700, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byEntity.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F0F2F2' }}>
                        <td style={{ padding: '8px 12px', color: '#333938' }}>{r.company_name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66726F' }}>{fmtN(r.invoice_count)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1F6B66', fontWeight: 600 }}>{fmt(r.total_value)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66726F' }}>
                          {r.value_share_pct != null ? `${r.value_share_pct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )
          ) : (
            byAccount.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#66726F', fontSize: 13 }}>No data for selected filters.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#EEF5F4' }}>
                    {['Account','Name','Invoices','Total Value','Share %'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Account' || h === 'Name' ? 'left' : 'right',
                        color: '#1F6B66', fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byAccount.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F0F2F2' }}>
                      <td style={{ padding: '8px 12px', color: '#333938', fontFamily: 'monospace' }}>{r.account_no}</td>
                      <td style={{ padding: '8px 12px', color: '#66726F' }}>{r.account_name ?? '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66726F' }}>{fmtN(r.invoice_count)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1F6B66', fontWeight: 600 }}>{fmt(r.total_value)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66726F' }}>
                        {r.value_share_pct != null ? `${r.value_share_pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </main>
    </div>
  );
}
