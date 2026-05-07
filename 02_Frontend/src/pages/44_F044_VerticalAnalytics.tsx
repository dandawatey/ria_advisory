/**
 * F044 — Vertical Analytics
 * CFO-level P&L + ratio breakdown by business vertical
 * Source: fact_gl_entries JOIN dim_department → 6 verticals
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { get, type FilterOptions } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

// ── Types ─────────────────────────────────────────────────────────────────────
interface VerticalRow {
  vertical_code: string;
  revenue: number;
  cogs: number;
  opex: number;
  net: number;
  total_spend: number;
  entity_count: number;
  entry_count: number;
  gross_margin_pct: number | null;
  net_margin_pct: number | null;
  opex_ratio_pct: number | null;
}
interface DeptRow {
  department_code: string;
  vertical_code: string;
  revenue: number;
  cogs: number;
  opex: number;
  entry_count: number;
  gross_margin_pct: number | null;
  opex_ratio_pct: number | null;
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

// Colour per vertical (stable mapping)
const VERT_COLORS: Record<string, string> = {
  'HEALTHCARE':          '#6366f1',
  'UTILITIES':           '#22c55e',
  'FINANCIAL SERVICES':  '#3b82f6',
  'CORPORATE G&A':       '#f59e0b',
  'CORPORATE SG&A':      '#ef4444',
  'CONSULTING PRODUCTS': '#8b5cf6',
};
function vertColor(code: string): string {
  return VERT_COLORS[code] ?? '#94a3b8';
}

// RAG for margin %
function marginColor(pct: number | null): string {
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

// ── KPI Tile ──────────────────────────────────────────────────────────────────
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
export default function VerticalAnalytics() {
  const [filters, setFilters]       = useState<FilterOptions | null>(null);
  const [companyIds, setCompanyIds] = useState<number[]>([]);
  const [year, setYear]             = useState<number | ''>('');
  const [accountCategory, setAccountCategory] = useState<string>('');
  const [rows, setRows]             = useState<VerticalRow[]>([]);
  const [depts, setDepts]           = useState<DeptRow[]>([]);
  const [selectedVert, setSelectedVert] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [deptLoading, setDeptLoading] = useState(false);
  const [err, setErr]               = useState('');
  const [sortKey, setSortKey]       = useState<keyof VerticalRow>('revenue');
  const [sortAsc, setSortAsc]       = useState(false);

  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilters).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const qs = new URLSearchParams();
      companyIds.forEach(id => qs.append('company_id', String(id)));
      if (year)            qs.set('year',             String(year));
      if (accountCategory) qs.set('account_category', accountCategory);
      const r = await get<VerticalRow[]>(`/api/reports/vertical-analytics?${qs}`);
      setRows(r);
    } catch (e: unknown) { setErr(String(e)); }
    finally { setLoading(false); }
  }, [companyIds, year, accountCategory]);

  useEffect(() => { load(); }, [load]);

  const loadDepts = useCallback(async (vert: string) => {
    setDeptLoading(true);
    try {
      const qs = new URLSearchParams({ vertical_code: vert });
      companyIds.forEach(id => qs.append('company_id', String(id)));
      if (year) qs.set('year', String(year));
      const d = await get<DeptRow[]>(`/api/reports/vertical-analytics/departments?${qs}`);
      setDepts(d);
    } catch (_) { setDepts([]); }
    finally { setDeptLoading(false); }
  }, [companyIds, year]);

  const handleVertClick = (vert: string) => {
    if (selectedVert === vert) {
      setSelectedVert(null); setDepts([]);
    } else {
      setSelectedVert(vert);
      loadDepts(vert);
    }
  };

  const toggleCompany = (id: number) =>
    setCompanyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Chart data — top-level revenue vs spend per vertical
  const chartData = [...rows]
    .filter(r => Math.abs(r.revenue) + Math.abs(r.cogs) + Math.abs(r.opex) > 0)
    .map(r => ({
      vertical: r.vertical_code,
      Revenue: Math.round(Number(r.revenue) / 1e6 * 100) / 100,
      COGS:    Math.round(Number(r.cogs)    / 1e6 * 100) / 100,
      OpEx:    Math.round(Number(r.opex)    / 1e6 * 100) / 100,
    }));

  // Totals
  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalSpend   = rows.reduce((s, r) => s + Number(r.total_spend || 0), 0);

  // Sorted table
  const sorted = [...rows].sort((a, b) => {
    const av = Number(a[sortKey] ?? 0), bv = Number(b[sortKey] ?? 0);
    return sortAsc ? av - bv : bv - av;
  });

  const handleSort = (key: keyof VerticalRow) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };
  const arrow = (k: keyof VerticalRow) => sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : '';

  const thS: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: 12,
    borderBottom: '2px solid #e5e7eb', cursor: 'pointer', userSelect: 'none',
    whiteSpace: 'nowrap', color: '#374151',
  };
  const tdS: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'right', fontSize: 12,
    borderBottom: '1px solid #f3f4f6',
  };

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
        icon="📊"
        title="What is Vertical Analytics?"
        description="This page breaks down <strong>Revenue, COGS, and OpEx by business vertical</strong> across all subsidiaries. CFOs and finance directors use it to identify which business segments drive profitability, where costs are concentrated, and how margins compare across verticals. Each vertical groups departments from the GL dimension framework into a logical business unit."
        concepts={[
          { icon: '📈', color: '#16a34a', label: 'Revenue', desc: 'Total income accounts (4xx) attributed to the vertical' },
          { icon: '📉', color: '#dc2626', label: 'COGS + OpEx', desc: 'Cost of goods sold plus operating expenditure per vertical' },
          { icon: '▲', color: '#2563eb', label: 'Gross Margin', desc: '(Revenue − COGS) ÷ Revenue — primary profitability signal' },
        ]}
        glossary={[
          { term: 'Vertical', def: 'Business segment grouping (e.g. Asset Mgmt, Advisory, Operations) derived from GL dimensions' },
          { term: 'Net Margin', def: '(Revenue − COGS − OpEx) ÷ Revenue — bottom-line profitability per vertical' },
          { term: 'OpEx Ratio', def: 'Operating expenses as % of revenue — efficiency indicator' },
        ]}
      />
      <div className="page-header">
        <h1 className="page-title">Vertical Analytics</h1>
        <p className="page-subtitle">Revenue · COGS · OpEx breakdown by business vertical</p>
      </div>

      {/* KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <Tile label="Verticals"      value={String(rows.length)}    sub="business segments" />
        <Tile label="Total Revenue"  value={fmt(totalRevenue)}      sub="across verticals" />
        <Tile label="Total Spend"    value={fmt(totalSpend)}        sub="COGS + OpEx" />
        <Tile
          label="Top Vertical"
          value={rows[0]?.vertical_code ?? '—'}
          sub={rows[0] ? `${fmt(rows[0].revenue)} revenue` : undefined}
        />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Filter Sidebar */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>

            {/* Entity filter chips */}
            {filters?.companies && filters.companies.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Entity</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {filters.companies.map(c => (
                    <button
                      key={c.company_id}
                      onClick={() => toggleCompany(c.company_id)}
                      style={chip(companyIds.includes(c.company_id))}
                    >{c.company_name}</button>
                  ))}
                </div>
              </div>
            )}

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
            {(filters?.account_categories ?? []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>GL Group</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button onClick={() => setAccountCategory('')} style={chip(accountCategory === '')}>All</button>
                  {(filters?.account_categories ?? []).map(cat => (
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

          {/* Grouped Bar Chart */}
          {chartData.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Revenue vs COGS vs OpEx by Vertical (USD M)</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="vertical"
                    tick={{ fontSize: 10 }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}M`} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`$${v.toFixed(2)}M`, name]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Revenue" fill="#3b82f6">
                    {chartData.map(d => (
                      <Cell key={d.vertical} fill={vertColor(d.vertical)} />
                    ))}
                  </Bar>
                  <Bar dataKey="COGS"    fill="#ef4444" opacity={0.8} />
                  <Bar dataKey="OpEx"    fill="#f59e0b" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Ratio Table */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                Ratio Breakdown — click row to drill into departments
              </h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ ...thS, textAlign: 'left' }}>Vertical</th>
                    {(
                      [
                        ['revenue',          'Revenue'],
                        ['cogs',             'COGS'],
                        ['opex',             'OpEx'],
                        ['net',              'Net Income'],
                        ['gross_margin_pct', 'Gross Margin %'],
                        ['net_margin_pct',   'Net Margin %'],
                        ['opex_ratio_pct',   'OpEx Ratio %'],
                        ['entity_count',     'Entities'],
                      ] as [keyof VerticalRow, string][]
                    ).map(([k, lbl]) => (
                      <th key={k} style={thS} onClick={() => handleSort(k)}>{lbl}{arrow(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => {
                    const selected = selectedVert === r.vertical_code;
                    const bg = selected ? '#eff6ff' : i % 2 === 0 ? '#fff' : '#fafafa';
                    return (
                      <>
                        <tr
                          key={r.vertical_code}
                          onClick={() => handleVertClick(r.vertical_code)}
                          style={{ background: bg, cursor: 'pointer' }}
                        >
                          <td style={{ ...tdS, textAlign: 'left' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                            }}>
                              <span style={{
                                width: 10, height: 10, borderRadius: '50%',
                                background: vertColor(r.vertical_code), flexShrink: 0,
                              }} />
                              <strong style={{ fontSize: 12 }}>{r.vertical_code}</strong>
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                                {selected ? '▾' : '▸'}
                              </span>
                            </span>
                          </td>
                          <td style={tdS}>{fmt(r.revenue)}</td>
                          <td style={tdS}>{fmt(r.cogs)}</td>
                          <td style={tdS}>{fmt(r.opex)}</td>
                          <td style={{
                            ...tdS, fontWeight: 600,
                            color: Number(r.net) >= 0 ? '#166534' : '#991b1b',
                          }}>{fmt(r.net)}</td>
                          <td style={{
                            ...tdS, fontWeight: 600,
                            background: marginBg(r.gross_margin_pct),
                            color: marginColor(r.gross_margin_pct),
                          }}>{fmtPct(r.gross_margin_pct)}</td>
                          <td style={{
                            ...tdS, fontWeight: 600,
                            background: marginBg(r.net_margin_pct),
                            color: marginColor(r.net_margin_pct),
                          }}>{fmtPct(r.net_margin_pct)}</td>
                          <td style={tdS}>{fmtPct(r.opex_ratio_pct)}</td>
                          <td style={tdS}>{fmtN(r.entity_count)}</td>
                        </tr>

                        {/* Department drill-down */}
                        {selected && (
                          <tr key={`${r.vertical_code}-dept`}>
                            <td colSpan={9} style={{ padding: 0 }}>
                              <div style={{ background: '#f0f9ff', borderTop: '1px solid #bae6fd', padding: '12px 24px 16px' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', marginBottom: 8 }}>
                                  Departments within {r.vertical_code}
                                </div>
                                {deptLoading ? (
                                  <p style={{ fontSize: 12, color: '#6b7280' }}>Loading…</p>
                                ) : (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                    <thead>
                                      <tr>
                                        {['Department', 'Revenue', 'COGS', 'OpEx', 'Gross Margin %', 'OpEx Ratio %', 'Entries'].map(h => (
                                          <th key={h} style={{
                                            padding: '4px 10px', textAlign: h === 'Department' ? 'left' : 'right',
                                            fontWeight: 600, color: '#374151', borderBottom: '1px solid #bae6fd',
                                          }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {depts.map((d, di) => (
                                        <tr key={d.department_code} style={{ background: di % 2 === 0 ? 'transparent' : '#e0f2fe' }}>
                                          <td style={{ padding: '4px 10px', fontFamily: 'monospace', fontWeight: 500 }}>{d.department_code}</td>
                                          <td style={{ padding: '4px 10px', textAlign: 'right' }}>{fmt(d.revenue)}</td>
                                          <td style={{ padding: '4px 10px', textAlign: 'right' }}>{fmt(d.cogs)}</td>
                                          <td style={{ padding: '4px 10px', textAlign: 'right' }}>{fmt(d.opex)}</td>
                                          <td style={{ padding: '4px 10px', textAlign: 'right', color: marginColor(d.gross_margin_pct), fontWeight: 600 }}>{fmtPct(d.gross_margin_pct)}</td>
                                          <td style={{ padding: '4px 10px', textAlign: 'right' }}>{fmtPct(d.opex_ratio_pct)}</td>
                                          <td style={{ padding: '4px 10px', textAlign: 'right' }}>{fmtN(d.entry_count)}</td>
                                        </tr>
                                      ))}
                                      {depts.length === 0 && (
                                        <tr><td colSpan={7} style={{ padding: 8, color: '#9ca3af' }}>No departments found</td></tr>
                                      )}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* CFO Ratio Reference */}
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
              CFO ratio thresholds reference
            </summary>
            <div style={{ marginTop: 10, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Ratio', 'Formula', 'Green', 'Amber', 'Red', 'Interpretation'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Gross Margin %',  '(Rev–COGS)/Rev',  '>40%',  '20–40%', '<20%', 'Core product economics — higher = better pricing power'],
                    ['Net Margin %',    'Net/Revenue',      '>15%',  '5–15%',  '<5%',  'Bottom-line efficiency — includes all costs'],
                    ['EBITDA Margin %', '(Rev–COGS–OpEx)/Rev','>20%','10–20%','<10%', 'Operating performance ex-financing charges'],
                    ['OpEx Ratio %',    'OpEx/Revenue',     '<10%',  '10–25%', '>25%', 'Cost discipline — lower means lean overhead'],
                    ['Revenue Mix %',   'Vert.Rev/Total',   'N/A',   'N/A',    'N/A',  'Segment contribution to portfolio revenue'],
                  ].map(row => (
                    <tr key={row[0]} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {row.map((cell, i) => (
                        <td key={i} style={{
                          padding: '5px 10px',
                          color: i === 2 ? '#166534' : i === 3 ? '#92400e' : i === 4 ? '#991b1b' : 'inherit',
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
