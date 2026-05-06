/**
 * 63_F063_UBR.tsx — Unbilled Revenue (UBR) Report
 * IC-46 | Agent: Ananya_Frontend_004 | Reviewer: Kabir_Reviewer_010
 *
 * UBR = Revenue (4xx accounts) NOT tied to an Invoice document_type.
 * Billed = Revenue tied to Invoice document_type.
 */
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  api,
  type FilterOptions,
  type UBRSummary,
  type UBRMonthRow,
  type UBREntityRow,
  type UBRAccountRow,
} from '../api/client';

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtK = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

type TabKey = 'monthly' | 'entity' | 'account';

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

// ── UBR stacked bar tooltip ────────────────────────────────────────────────────
function UBRTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const billed = payload.find((p: any) => p.dataKey === 'billed')?.value ?? 0;
  const ubr    = payload.find((p: any) => p.dataKey === 'ubr')?.value ?? 0;
  const total  = billed + ubr;
  return (
    <div style={{ background: '#fff', border: '1px solid #E8ECEC', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ color: '#1F6B66' }}>Billed: {fmt(billed)}</div>
      <div style={{ color: '#E8443B' }}>Unbilled (UBR): {fmt(ubr)}</div>
      <div style={{ color: '#333938', marginTop: 4, borderTop: '1px solid #E8ECEC', paddingTop: 4 }}>
        Total: {fmt(total)} &nbsp;·&nbsp; UBR: {total > 0 ? ((ubr / total) * 100).toFixed(1) : 0}%
      </div>
    </div>
  );
}

// ── UBR bar in entity/account tables ─────────────────────────────────────────
function UBRBar({ pct }: { pct: number | null }) {
  const p = Math.min(pct ?? 0, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
      <div style={{ flex: 1, height: 8, background: '#E8ECEC', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: p > 50 ? '#E8443B' : '#2F7873', borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, color: p > 50 ? '#E8443B' : '#1F6B66', fontWeight: 600, minWidth: 36 }}>
        {p.toFixed(1)}%
      </span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function UBR() {
  const [tab, setTab]               = useState<TabKey>('monthly');
  const [filterOpts, setFilterOpts] = useState<FilterOptions | null>(null);
  const [selYear, setSelYear]       = useState<number | null>(null);
  const [selCompanies, setSelCompanies] = useState<number[]>([]);
  const [monthFrom, setMonthFrom]   = useState('');
  const [monthTo, setMonthTo]       = useState('');

  const [summary, setSummary]       = useState<UBRSummary | null>(null);
  const [monthly, setMonthly]       = useState<UBRMonthRow[]>([]);
  const [byEntity, setByEntity]     = useState<UBREntityRow[]>([]);
  const [byAccount, setByAccount]   = useState<UBRAccountRow[]>([]);

  const [loadSum, setLoadSum]       = useState(false);
  const [loadTab, setLoadTab]       = useState(false);
  const [, setErrSum]               = useState(false);
  const [errTab, setErrTab]         = useState(false);

  useEffect(() => {
    api.analytics.filters().then(setFilterOpts).catch(() => {});
  }, []);

  useEffect(() => {
    setLoadSum(true); setErrSum(false);
    api.ubr.summary(selCompanies, selYear, monthFrom || undefined, monthTo || undefined)
      .then(setSummary)
      .catch(() => setErrSum(true))
      .finally(() => setLoadSum(false));
  }, [selCompanies, selYear, monthFrom, monthTo]);

  useEffect(() => {
    setLoadTab(true); setErrTab(false);
    const ids = selCompanies;
    const yr  = selYear;
    const mf  = monthFrom || undefined;
    const mt  = monthTo   || undefined;
    const load =
      tab === 'monthly' ? api.ubr.byMonth(ids, yr, mf, mt).then(setMonthly) :
      tab === 'entity'  ? api.ubr.byEntity(ids, yr, mf, mt).then(setByEntity) :
                          api.ubr.byAccount(ids, yr, mf, mt).then(setByAccount);
    load.catch(() => setErrTab(true)).finally(() => setLoadTab(false));
  }, [tab, selCompanies, selYear, monthFrom, monthTo]);

  const toggleCompany = (id: number) =>
    setSelCompanies(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const months = filterOpts?.months ?? [];
  const ubrPct = summary?.ubr_pct ?? 0;

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: '100vh', background: '#F4F6F6', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Filter sidebar ── */}
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #E8ECEC',
        padding: '20px 14px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
        boxShadow: '2px 0 8px rgba(0,0,0,.04)' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#1F6B66', textTransform: 'uppercase',
          letterSpacing: '.1em', marginBottom: 14 }}>Filters</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#66726F', fontWeight: 600, marginBottom: 6 }}>YEAR</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button onClick={() => setSelYear(null)}
              style={{ padding: '3px 8px', borderRadius: 99, fontSize: 11, border: '1px solid',
                borderColor: selYear === null ? '#1F6B66' : '#D1D8D8',
                background: selYear === null ? '#EEF5F4' : '#fff',
                color: selYear === null ? '#1F6B66' : '#66726F', cursor: 'pointer' }}>All</button>
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
          <div style={{ fontSize: 22, fontWeight: 800, color: '#082624' }}>Unbilled Revenue (UBR)</div>
          <div style={{ fontSize: 13, color: '#66726F', marginTop: 3 }}>
            Revenue recognized (4xx accounts) not yet tied to an Invoice — gap between work done and billed
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <KPITile
            label="Total Revenue"
            value={loadSum ? '…' : fmt(summary?.total_revenue ?? 0)}
            sub={`${summary?.entity_count ?? 0} entities`}
            color="#1F6B66"
          />
          <KPITile
            label="Billed Revenue"
            value={loadSum ? '…' : fmt(summary?.billed_revenue ?? 0)}
            sub="Invoice document entries"
            color="#2F7873"
          />
          <KPITile
            label="Unbilled (UBR)"
            value={loadSum ? '…' : fmt(summary?.ubr_amount ?? 0)}
            sub="Non-invoice / accrual entries"
            color="#E8443B"
          />
          <KPITile
            label="UBR % of Revenue"
            value={loadSum ? '…' : `${(ubrPct).toFixed(1)}%`}
            sub={ubrPct > 30 ? '⚠ High unbilled ratio' : 'Within normal range'}
            color={ubrPct > 30 ? '#E8443B' : '#1F6B66'}
          />
        </div>

        {/* UBR progress bar */}
        {summary && !loadSum && (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8ECEC',
            padding: '14px 20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 11, color: '#66726F', marginBottom: 8 }}>
              REVENUE BILLING STATUS — {fmt(summary.billed_revenue)} billed · {fmt(summary.ubr_amount)} unbilled
            </div>
            <div style={{ height: 16, background: '#E8ECEC', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
              <div style={{
                width: `${Math.min(100 - ubrPct, 100)}%`, height: '100%',
                background: '#1F6B66', borderRadius: '99px 0 0 99px',
              }} />
              <div style={{
                width: `${Math.min(ubrPct, 100)}%`, height: '100%',
                background: '#E8443B', borderRadius: '0 99px 99px 0',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#66726F', marginTop: 4 }}>
              <span style={{ color: '#1F6B66', fontWeight: 600 }}>■ Billed {(100 - ubrPct).toFixed(1)}%</span>
              <span style={{ color: '#E8443B', fontWeight: 600 }}>■ Unbilled {ubrPct.toFixed(1)}%</span>
            </div>
          </div>
        )}

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

          {/* Monthly stacked bar */}
          {!loadTab && !errTab && tab === 'monthly' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1F6B66', marginBottom: 14 }}>
                Billed vs Unbilled — {monthly.length} months
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={monthly} margin={{ top: 4, right: 24, bottom: 4, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F2" />
                  <XAxis dataKey="month_name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip content={<UBRTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="billed" name="Billed" stackId="a" fill="#1F6B66" />
                  <Bar dataKey="ubr"    name="Unbilled (UBR)" stackId="a" fill="#E8443B" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {/* By Entity */}
          {!loadTab && !errTab && tab === 'entity' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1F6B66', marginBottom: 14 }}>
                UBR by Entity — {byEntity.length} entities
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#EEF5F4' }}>
                    {['Entity','Total Revenue','Billed','Unbilled (UBR)','UBR %'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Entity' ? 'left' : 'right',
                        color: '#1F6B66', fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byEntity.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F0F2F2',
                      background: i % 2 === 0 ? '#fff' : '#FAFBFB' }}>
                      <td style={{ padding: '8px 12px', color: '#333938', fontWeight: 600 }}>{r.company_name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1F6B66' }}>{fmt(r.total_revenue)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#2F7873' }}>{fmt(r.billed_revenue)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#E8443B', fontWeight: 600 }}>{fmt(r.ubr_amount)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <UBRBar pct={r.ubr_pct} />
                      </td>
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
                UBR by Account — {byAccount.length} accounts
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#EEF5F4' }}>
                    {['Account','Name','Total','Billed','Unbilled','UBR %','Entries'].map(h => (
                      <th key={h} style={{ padding: '8px 12px',
                        textAlign: h === 'Account' || h === 'Name' ? 'left' : 'right',
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
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#333938' }}>{fmt(r.total_revenue)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#2F7873' }}>{fmt(r.billed_revenue)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#E8443B', fontWeight: 600 }}>{fmt(r.ubr_amount)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <UBRBar pct={r.ubr_pct} />
                      </td>
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
