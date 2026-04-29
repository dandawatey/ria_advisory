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
import { get } from '../api/client';

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
  const [year, setYear]       = useState<number | ''>('');
  const [rows, setRows]       = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [tab, setTab]         = useState<'table' | 'revenue' | 'margins'>('table');
  const [sortKey, setSortKey] = useState<keyof EntityRow>('revenue');
  const [sortAsc, setSortAsc] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const qs = new URLSearchParams();
      if (year) qs.set('year', String(year));
      const r = await get<EntityRow[]>(`/api/reports/entity-comparison?${qs}`);
      setRows(r);
    } catch (e: unknown) { setErr(String(e)); }
    finally { setLoading(false); }
  }, [year]);

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

  return (
    <div style={{ padding: 24, maxWidth: 1300, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 4, fontSize: 22, fontWeight: 700 }}>Entity Comparison</h1>
      <p style={{ color: '#6b7280', marginBottom: 20, fontSize: 13 }}>
        All {rows.length} subsidiaries — revenue, cost and margin side-by-side
      </p>

      {/* ── Year Filter ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Year:</span>
        <select
          value={year}
          onChange={e => setYear(e.target.value ? Number(e.target.value) : '')}
          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #d1d5db' }}
        >
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {err     && <p style={{ color: '#ef4444' }}>Error: {err}</p>}

      {/* ── KPI Tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
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

      {/* ── Tab Bar ── */}
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

      {/* ── Summary Table ── */}
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

      {/* ── Revenue Chart ── */}
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
        </div>
      )}

      {/* ── Margin Chart ── */}
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
        </div>
      )}
    </div>
  );
}
