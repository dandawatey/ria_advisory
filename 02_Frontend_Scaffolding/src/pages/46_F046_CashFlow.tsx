/**
 * F046 — Cash Flow Statement
 * Indirect method derived from GL account-class flows
 * Operating (4xx–8xx) · Investing (1xx) · Financing (2xx–3xx)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { get, type FilterOptions } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OperatingSection {
  revenue_received: number;
  cogs_paid: number;
  opex_paid: number;
  other_income: number;
  other_expense: number;
  total: number;
}
interface InvestingSection {
  asset_movements: number;
  total: number;
}
interface FinancingSection {
  liability_movements: number;
  equity_movements: number;
  total: number;
}
interface CashFlowData {
  operating: OperatingSection;
  investing: InvestingSection;
  financing: FinancingSection;
  net_change: number;
}
interface TrendRow {
  year: number;
  operating_cf: number;
  investing_cf: number;
  financing_cf: number;
  net_change: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  const abs = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toFixed(0)}`;
}
function fmtM(n: number): number {
  return Math.round(Number(n) / 1e6 * 100) / 100;
}
function cfColor(n: number | null | undefined): string {
  if (n == null) return '#6b7280';
  return Number(n) >= 0 ? '#166534' : '#991b1b';
}
function cfBg(n: number | null | undefined): string {
  if (n == null) return '#f9fafb';
  return Number(n) >= 0 ? '#f0fdf4' : '#fef2f2';
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function CfTile({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: string }) {
  const pos = !value.startsWith('-') && value !== '—';
  const clr = accent ?? (pos ? '#166534' : '#991b1b');
  const bg  = accent ? '#fff' : (pos ? '#f0fdf4' : '#fef2f2');
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: '16px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      borderTop: `3px solid ${accent ?? clr}`,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: clr }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Section Block ─────────────────────────────────────────────────────────────
function SectionBlock({
  title, total, color, children,
}: {
  title: string; total: number; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        background: color + '15',
        borderLeft: `4px solid ${color}`,
        padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color }}>{title}</span>
        <span style={{
          fontWeight: 700, fontSize: 16,
          color: total >= 0 ? '#166534' : '#991b1b',
        }}>{fmt(total)}</span>
      </div>
      <div style={{ padding: '4px 0 8px' }}>{children}</div>
    </div>
  );
}

function LineItem({ label, value, indent = false, bold = false }: {
  label: string; value: number; indent?: boolean; bold?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: `5px ${indent ? 36 : 20}px`,
      borderBottom: '1px solid #f9fafb',
    }}>
      <span style={{ fontSize: 13, color: indent ? '#6b7280' : '#374151', fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, fontWeight: bold ? 700 : 400,
        color: value >= 0 ? '#166534' : '#991b1b',
        fontFamily: 'monospace',
      }}>{fmt(value)}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CashFlow() {
  const [filters, setFilters]       = useState<FilterOptions | null>(null);
  const [companyIds, setCompanyIds] = useState<number[]>([]);
  const [year, setYear]             = useState<number | ''>('');
  const [data, setData]             = useState<CashFlowData | null>(null);
  const [trend, setTrend]           = useState<TrendRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState('');
  const [tab, setTab]               = useState<'statement' | 'trend'>('statement');

  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilters).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const qs = new URLSearchParams();
      companyIds.forEach(id => qs.append('company_id', String(id)));
      if (year) qs.set('year', String(year));
      const trendQs = new URLSearchParams();
      companyIds.forEach(id => trendQs.append('company_id', String(id)));

      const [d, t] = await Promise.all([
        get<CashFlowData>(`/api/reports/cash-flow?${qs}`),
        get<TrendRow[]>(`/api/reports/cash-flow/trend?${trendQs}`),
      ]);
      setData(d);
      setTrend(t);
    } catch (e: unknown) { setErr(String(e)); }
    finally { setLoading(false); }
  }, [companyIds, year]);

  useEffect(() => { load(); }, [load]);

  const toggleCompany = (id: number) =>
    setCompanyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Trend chart data
  const trendChart = trend.map(r => ({
    year: String(r.year),
    'Operating':  fmtM(r.operating_cf),
    'Investing':  fmtM(r.investing_cf),
    'Financing':  fmtM(r.financing_cf),
    'Net Change': fmtM(r.net_change),
  }));

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 4, fontSize: 22, fontWeight: 700 }}>Cash Flow Statement</h1>
      <p style={{ color: '#6b7280', marginBottom: 20, fontSize: 13 }}>
        GL-flow indirect method · Operating (4xx–8xx) · Investing (1xx) · Financing (2xx–3xx)
      </p>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {filters?.companies?.map(c => (
          <button
            key={c.company_id}
            onClick={() => toggleCompany(c.company_id)}
            style={{
              padding: '4px 10px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              background: companyIds.includes(c.company_id) ? '#1d4ed8' : '#f3f4f6',
              color: companyIds.includes(c.company_id) ? '#fff' : '#374151',
              border: 'none',
            }}
          >{c.company_name}</button>
        ))}
        <select
          value={year}
          onChange={e => setYear(e.target.value ? Number(e.target.value) : '')}
          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 20, border: '1px solid #d1d5db' }}
        >
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {err     && <p style={{ color: '#ef4444' }}>Error: {err}</p>}

      {data && (
        <>
          {/* ── KPI Tiles ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 24 }}>
            <CfTile
              label="Operating Cash Flow"
              value={fmt(data.operating.total)}
              sub="from core operations"
              accent="#3b82f6"
            />
            <CfTile
              label="Investing Cash Flow"
              value={fmt(data.investing.total)}
              sub="asset movements"
              accent="#8b5cf6"
            />
            <CfTile
              label="Financing Cash Flow"
              value={fmt(data.financing.total)}
              sub="debt + equity"
              accent="#f59e0b"
            />
            <CfTile
              label="Net Cash Change"
              value={fmt(data.net_change)}
              sub="operating + investing + financing"
            />
          </div>

          {/* ── Tab Bar ── */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {(['statement', 'trend'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
                  background: tab === t ? '#1d4ed8' : '#f3f4f6',
                  color: tab === t ? '#fff' : '#374151',
                  border: 'none', fontWeight: tab === t ? 600 : 400,
                }}
              >{t === 'statement' ? 'Full Statement' : 'Year-over-Year Trend'}</button>
            ))}
          </div>

          {/* ── Full Statement ── */}
          {tab === 'statement' && (
            <>
              {/* Operating */}
              <SectionBlock title="Cash Flows from Operating Activities" total={data.operating.total} color="#3b82f6">
                <LineItem label="Revenue received"     value={data.operating.revenue_received} indent />
                <LineItem label="COGS paid"            value={data.operating.cogs_paid}        indent />
                <LineItem label="Operating expenses"   value={data.operating.opex_paid}        indent />
                {data.operating.other_income  !== 0 && <LineItem label="Other income"          value={data.operating.other_income}   indent />}
                {data.operating.other_expense !== 0 && <LineItem label="Other expenses"        value={data.operating.other_expense}  indent />}
                <LineItem label="Net cash from operations" value={data.operating.total} bold />
              </SectionBlock>

              {/* Investing */}
              <SectionBlock title="Cash Flows from Investing Activities" total={data.investing.total} color="#8b5cf6">
                <LineItem label="Net asset movements (CapEx / disposals)" value={data.investing.asset_movements} indent />
                <LineItem label="Net cash from investing" value={data.investing.total} bold />
              </SectionBlock>

              {/* Financing */}
              <SectionBlock title="Cash Flows from Financing Activities" total={data.financing.total} color="#f59e0b">
                <LineItem label="Liability movements (debt proceeds / repayments)" value={data.financing.liability_movements} indent />
                <LineItem label="Equity movements (issuance / buybacks)"           value={data.financing.equity_movements}    indent />
                <LineItem label="Net cash from financing" value={data.financing.total} bold />
              </SectionBlock>

              {/* Net change summary */}
              <div style={{
                background: data.net_change >= 0 ? '#f0fdf4' : '#fef2f2',
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                borderLeft: `4px solid ${data.net_change >= 0 ? '#22c55e' : '#ef4444'}`,
              }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Net Increase / (Decrease) in Cash</span>
                <span style={{
                  fontWeight: 800, fontSize: 20,
                  color: data.net_change >= 0 ? '#166534' : '#991b1b',
                }}>{fmt(data.net_change)}</span>
              </div>

              {/* Methodology note */}
              <p style={{ marginTop: 14, fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
                <strong>Methodology:</strong> GL-flow indirect approximation. Operating = 4xx–8xx account flows.
                Investing = net 1xx (asset) account movements. Financing = net 2xx (liability) + 3xx (equity) movements.
                Figures treat all GL entries as cash transactions — accrual adjustments not applied.
              </p>
            </>
          )}

          {/* ── YoY Trend ── */}
          {tab === 'trend' && trendChart.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                Cash Flow by Year — Operating · Investing · Financing (USD M)
              </h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={trendChart} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}M`} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`$${v.toFixed(2)}M`, name]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />
                  <Bar dataKey="Operating"  fill="#3b82f6" />
                  <Bar dataKey="Investing"  fill="#8b5cf6" />
                  <Bar dataKey="Financing"  fill="#f59e0b" />
                  <Bar dataKey="Net Change" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>

              {/* Trend table */}
              <div style={{ overflowX: 'auto', marginTop: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Year', 'Operating CF', 'Investing CF', 'Financing CF', 'Net Change'].map(h => (
                        <th key={h} style={{
                          padding: '8px 12px', textAlign: h === 'Year' ? 'left' : 'right',
                          fontWeight: 600, borderBottom: '2px solid #e5e7eb', fontSize: 12,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((r, i) => (
                      <tr key={r.year} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '7px 12px', fontWeight: 600 }}>{r.year}</td>
                        {[r.operating_cf, r.investing_cf, r.financing_cf, r.net_change].map((v, j) => (
                          <td key={j} style={{
                            padding: '7px 12px', textAlign: 'right', fontWeight: j === 3 ? 700 : 400,
                            background: j === 3 ? cfBg(v) : 'transparent',
                            color: cfColor(v),
                          }}>{fmt(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
