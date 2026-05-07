/**
 * F045 — Entity / Company Comparison
 * 17 subsidiaries side-by-side: Revenue, COGS, OpEx, Net, Margins
 * Source: /api/reports/entity-comparison
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { get, type FilterOptions } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EntityRow {
  company_name: string;
  company_id: number;
  revenue: number;
  cogs: number;
  opex: number;
  net: number;
  total_spend: number;
  entry_count: number;
  gross_margin_pct: number | null;
  net_margin_pct: number | null;
  opex_ratio_pct: number | null;
  revenue_share_pct: number | null;
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
function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${Number(n).toFixed(1)}%`;
}
function fmtN(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

// Short company name for charts
function shortName(name: string): string {
  return name.replace('RIA Advisory ', '').replace(' LLC', '').replace(' Ltd', '').slice(0, 18);
}

// RAG helpers
function marginClr(pct: number | null): string {
  if (pct == null) return '#6b7280';
  if (pct >= 15) return '#166534';
  if (pct >= 5)  return '#92400e';
  return '#991b1b';
}
function marginBg(pct: number | null): string {
  if (pct == null) return '#f9fafb';
  if (pct >= 15) return '#f0fdf4';
  if (pct >= 5)  return '#fffbeb';
  return '#fef2f2';
}

// Stable colour palette for 17 entities
const PALETTE = [
  '#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1',
  '#84cc16','#a855f7','#0ea5e9','#d97706','#10b981',
  '#e11d48','#7c3aed',
];

// ── Tile ──────────────────────────────────────────────────────────────────────
function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '16px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)', minWidth: 0,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EntityComparison() {
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ companies: [], years: [], months: [], currencies: [], account_categories: [] });
  const [year, setYear]             = useState<number | ''>('');
  const [accountCategory, setAccountCategory] = useState<string>('');
  const [rows, setRows]       = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [tab, setTab]         = useState<'table' | 'revenue' | 'margins'>('table');
  const [sortKey, setSortKey] = useState<keyof EntityRow>('revenue');
  const [sortAsc, setSortAsc] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilterOpts).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const qs = new URLSearchParams();
      if (year)            qs.set('year',             String(year));
      if (accountCategory) qs.set('account_category', accountCategory);
      const r = await get<EntityRow[]>(`/api/reports/entity-comparison?${qs}`);
      setRows(r);
    } catch (e: unknown) { setErr(String(e)); }
    finally { setLoading(false); }
  }, [year, accountCategory]);

  useEffect(() => { load(); }, [load]);

  // Summary metrics
  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalSpend   = rows.reduce((s, r) => s + Number(r.total_spend || 0), 0);
  const profitable   = rows.filter(r => Number(r.net || 0) > 0).length;
  const topEntity    = rows[0];

  // Sorted table
  const sorted = [...rows].sort((a, b) => {
    const av = Number(a[sortKey] ?? 0), bv = Number(b[sortKey] ?? 0);
    return sortAsc ? av - bv : bv - av;
  });
  const handleSort = (k: keyof EntityRow) => {
    if (sortKey === k) setSortAsc(a => !a);
    else { setSortKey(k); setSortAsc(false); }
  };
  const arrow = (k: keyof EntityRow) => sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : '';

  // Revenue chart — top 15, horizontal bars, sorted descending
  const revenueChart = [...rows]
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 15)
    .reverse()
    .map((r, i) => ({
      name: shortName(r.company_name),
      Revenue: Math.round(Number(r.revenue) / 1e6 * 100) / 100,
      Spend:   Math.round(Number(r.total_spend) / 1e6 * 100) / 100,
      _idx: i,
    }));

  // Margin chart — all entities, ordered by gross margin
  const marginChart = [...rows]
    .filter(r => r.gross_margin_pct != null)
    .sort((a, b) => Number(b.gross_margin_pct) - Number(a.gross_margin_pct))
    .map(r => ({
      name:         shortName(r.company_name),
      'Gross Margin %': Number(r.gross_margin_pct ?? 0),
      'Net Margin %':   Number(r.net_margin_pct   ?? 0),
    }));

  const thS: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontSize: 11,
    borderBottom: '2px solid #e5e7eb', cursor: 'pointer', userSelect: 'none',
    whiteSpace: 'nowrap', color: '#374151',
  };
  const tdS: React.CSSProperties = {
    padding: '7px 10px', textAlign: 'right', fontSize: 11,
    borderBottom: '1px solid #f3f4f6',
  };

  const tabs = (['table', 'revenue', 'margins'] as const).map(t => ({
    id: t,
    label: t === 'table' ? 'Summary Table' : t === 'revenue' ? 'Revenue Chart' : 'Margin Chart',
  }));

  const chip = (active: boolean) => ({
    padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#3b82f6' : 'var(--color-border)',
    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: active ? '#3b82f6' : 'inherit', fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div>
      <PageExplainer
        icon="🏢"
        title="What is Entity Comparison?"
        description="This page places all <strong>17 subsidiaries side-by-side</strong> so the CFO can instantly compare Revenue, COGS, OpEx, Net Income, and Gross Margin across the group. Use it to identify outperformers, underperformers, and entities with abnormal cost structures. Revenue share shows each entity's contribution to consolidated group revenue."
        concepts={[
          { icon: '🟢', color: '#16a34a', label: 'Profitable', desc: 'Net Income > 0 — entity generating bottom-line profit' },
          { icon: '🔴', color: '#dc2626', label: 'Loss-making', desc: 'Net Income < 0 — needs investigation or restructuring' },
          { icon: '📊', color: '#2563eb', label: 'Revenue Share', desc: 'Entity\'s % contribution to total consolidated revenue' },
        ]}
        glossary={[
          { term: 'Gross Margin', def: '(Revenue − COGS) ÷ Revenue — profitability after direct costs' },
          { term: 'OpEx Ratio', def: 'Operating expenses ÷ Revenue — overhead efficiency measure' },
          { term: 'Net Margin', def: 'Net Income ÷ Revenue — bottom-line profitability percentage' },
        ]}
      />
      <div className="page-header">
        <h1 className="page-title">Entity Comparison</h1>
        <p className="page-subtitle">Revenue · Spend · Margin comparison across all entities</p>
      </div>

      {/* KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <Tile label="Entities"       value={String(rows.length)}    sub="subsidiaries" />
        <Tile label="Total Revenue"  value={fmt(totalRevenue)}      sub="consolidated" />
        <Tile label="Total Spend"    value={fmt(totalSpend)}        sub="COGS + OpEx" />
        <Tile label="Profitable"     value={`${profitable} / ${rows.length}`} sub="net income > 0" />
        {topEntity && (
          <Tile
            label="Top Entity"
            value={shortName(topEntity.company_name)}
            sub={`${fmt(topEntity.revenue)} · ${fmtPct(topEntity.revenue_share_pct)} share`}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Filter Sidebar */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>

            {/* Year filter chips */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setYear('')} style={chip(year === '')}>All</button>
                {years.map(y => (
                  <button key={y} onClick={() => setYear(y)} style={chip(year === y)}>{y}</button>
                ))}
              </div>
            </div>

            {/* GL Group filter chips */}
            {filterOpts.account_categories?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>GL Group</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button onClick={() => setAccountCategory('')} style={chip(accountCategory === '')}>All</button>
                  {filterOpts.account_categories.map(cat => (
                    <button key={cat} onClick={() => setAccountCategory(cat === accountCategory ? '' : cat)} style={chip(accountCategory === cat)}>{cat}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
          {err     && <p style={{ color: '#ef4444' }}>Error: {err}</p>}

          {/* Tab Bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
                  background: tab === t.id ? '#1d4ed8' : '#f3f4f6',
                  color: tab === t.id ? '#fff' : '#374151',
                  border: 'none', fontWeight: tab === t.id ? 600 : 400,
                }}
              >{t.label}</button>
            ))}
          </div>

          {/* Summary Table */}
          {tab === 'table' && (
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ ...thS, textAlign: 'left', minWidth: 180 }}>Entity</th>
                      {(
                        [
                          ['revenue',          'Revenue'],
                          ['cogs',             'COGS'],
                          ['opex',             'OpEx'],
                          ['net',              'Net Income'],
                          ['gross_margin_pct', 'Gross Margin'],
                          ['net_margin_pct',   'Net Margin'],
                          ['opex_ratio_pct',   'OpEx Ratio'],
                          ['revenue_share_pct','Rev Share'],
                          ['entry_count',      'GL Entries'],
                        ] as [keyof EntityRow, string][]
                      ).map(([k, lbl]) => (
                        <th key={k} style={thS} onClick={() => handleSort(k)}>{lbl}{arrow(k)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => (
                      <tr key={r.company_id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ ...tdS, textAlign: 'left' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                              background: PALETTE[i % PALETTE.length],
                            }} />
                            <span style={{ fontSize: 11, fontWeight: 500 }}>{r.company_name}</span>
                          </span>
                        </td>
                        <td style={tdS}>{fmt(r.revenue)}</td>
                        <td style={tdS}>{fmt(r.cogs)}</td>
                        <td style={tdS}>{fmt(r.opex)}</td>
                        <td style={{
                          ...tdS, fontWeight: 600,
                          color: Number(r.net) >= 0 ? '#166534' : '#991b1b',
                        }}>{fmt(r.net)}</td>
                        <td style={{ ...tdS, background: marginBg(r.gross_margin_pct), color: marginClr(r.gross_margin_pct), fontWeight: 600 }}>
                          {fmtPct(r.gross_margin_pct)}
                        </td>
                        <td style={{ ...tdS, background: marginBg(r.net_margin_pct), color: marginClr(r.net_margin_pct), fontWeight: 600 }}>
                          {fmtPct(r.net_margin_pct)}
                        </td>
                        <td style={tdS}>{fmtPct(r.opex_ratio_pct)}</td>
                        <td style={tdS}>{fmtPct(r.revenue_share_pct)}</td>
                        <td style={tdS}>{fmtN(r.entry_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Revenue Chart */}
          {tab === 'revenue' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Revenue vs Spend — Top 15 Entities (USD M)</h2>
              <ResponsiveContainer width="100%" height={Math.max(360, revenueChart.length * 30 + 40)}>
                <BarChart
                  data={revenueChart}
                  layout="vertical"
                  margin={{ left: 140, right: 20, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}M`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={136} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`$${v.toFixed(2)}M`, name]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Revenue" fill="#3b82f6">
                    {revenueChart.map((_, idx) => (
                      <Cell key={idx} fill={PALETTE[revenueChart.length - 1 - idx] ?? '#3b82f6'} />
                    ))}
                  </Bar>
                  <Bar dataKey="Spend" fill="#ef444480" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Entity</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Revenue</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Spend</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Net Income</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows]
                      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
                      .slice(0, 15)
                      .map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '5px 10px' }}>{row.company_name}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(row.revenue)}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(row.total_spend)}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', color: Number(row.net) >= 0 ? '#10b981' : '#ef4444' }}>{fmt(row.net)}</td>
                        </tr>
                      ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Margin Chart */}
          {tab === 'margins' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Gross vs Net Margin — All Entities (%)</h2>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                Green zone: Gross Margin ≥ 40% · Net Margin ≥ 15%
              </p>
              {/* Reference lines via SVG overlay — using Recharts */}
              <ResponsiveContainer width="100%" height={Math.max(360, marginChart.length * 28 + 60)}>
                <BarChart
                  data={marginChart}
                  layout="vertical"
                  margin={{ left: 140, right: 20, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={136} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Gross Margin %" fill="#22c55e" opacity={0.85} />
                  <Bar dataKey="Net Margin %"   fill="#3b82f6" opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Entity</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Gross Margin %</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Net Margin %</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>OpEx Ratio %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows]
                      .filter(r => r.gross_margin_pct != null)
                      .sort((a, b) => Number(b.gross_margin_pct) - Number(a.gross_margin_pct))
                      .map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '5px 10px' }}>{row.company_name}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{row.gross_margin_pct != null ? row.gross_margin_pct.toFixed(1) + '%' : '—'}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{row.net_margin_pct != null ? row.net_margin_pct.toFixed(1) + '%' : '—'}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{row.opex_ratio_pct != null ? row.opex_ratio_pct.toFixed(1) + '%' : '—'}</td>
                        </tr>
                      ))}
                    {rows.filter(r => r.gross_margin_pct != null).length === 0 && (
                      <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
