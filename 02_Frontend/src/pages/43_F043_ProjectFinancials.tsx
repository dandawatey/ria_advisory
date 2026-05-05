/**
 * F043 — Project-wise Financials
 * P&L breakdown by project — 44 projects from fact_gl_entries JOIN dim_project
 * Source: /api/reports/project-financials + /api/reports/project-financials/summary
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { get, type FilterOptions } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProjectRow {
  project_no: string;
  revenue: number;
  cogs: number;
  opex: number;
  net: number;
  entry_count: number;
}
interface Summary {
  project_count: number;
  total_revenue: number;
  total_spend: number;
  entry_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toFixed(0)}`;
}
function fmtN(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '16px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)', minWidth: 0,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectFinancials() {
  const [filters, setFilters]       = useState<FilterOptions | null>(null);
  const [companyIds, setCompanyIds] = useState<number[]>([]);
  const [year, setYear]             = useState<number | ''>('');
  const [accountCategory, setAccountCategory] = useState<string>('');
  const [rows, setRows]             = useState<ProjectRow[]>([]);
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState('');
  const [sortKey, setSortKey]       = useState<keyof ProjectRow>('net');
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
      const [r, s] = await Promise.all([
        get<ProjectRow[]>(`/api/reports/project-financials?${qs}`),
        get<Summary>(`/api/reports/project-financials/summary?${qs}`),
      ]);
      setRows(r);
      setSummary(s);
    } catch (e: unknown) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [companyIds, year, accountCategory]);

  useEffect(() => { load(); }, [load]);

  const toggleCompany = (id: number) =>
    setCompanyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Top 15 for chart — by absolute spend (cogs + opex)
  const top15 = [...rows]
    .filter(r => r.project_no !== '(no project)')
    .sort((a, b) => (b.cogs + b.opex) - (a.cogs + a.opex))
    .slice(0, 15)
    .map(r => ({
      project_no: r.project_no,
      cogs: Math.round(r.cogs / 1e6 * 100) / 100,
      opex: Math.round(r.opex / 1e6 * 100) / 100,
      revenue: Math.round(r.revenue / 1e6 * 100) / 100,
    }))
    .reverse(); // smallest at top for horizontal bar (Recharts renders bottom→top)

  // Filtered + sorted table
  const filtered = rows
    .filter(r => r.project_no.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });

  const handleSort = (key: keyof ProjectRow) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: 12,
    color: '#374151', borderBottom: '2px solid #e5e7eb', cursor: 'pointer',
    whiteSpace: 'nowrap', userSelect: 'none',
  };
  const tdStyle: React.CSSProperties = {
    padding: '7px 12px', textAlign: 'right', fontSize: 12,
    borderBottom: '1px solid #f3f4f6',
  };
  const arrow = (key: keyof ProjectRow) =>
    sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : '';

  const chip = (active: boolean) => ({
    padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#3b82f6' : 'var(--color-border)',
    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: active ? '#3b82f6' : 'inherit', fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Project Financials</h1>
        <p className="page-subtitle">P&L breakdown by project — revenue, COGS, OpEx, net</p>
      </div>

      {/* KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        {summary ? (
          <>
            <Tile label="Projects"      value={fmtN(summary.project_count)} sub="with GL data" />
            <Tile label="Total Revenue" value={fmt(summary.total_revenue)}  sub="across projects" />
            <Tile label="Total Spend"   value={fmt(summary.total_spend)}    sub="COGS + OpEx" />
            <Tile label="GL Entries"    value={fmtN(summary.entry_count)}   sub="total entries" />
            <Tile
              label="Avg Spend / Project"
              value={summary.project_count ? fmt(summary.total_spend / summary.project_count) : '—'}
            />
          </>
        ) : null}
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

          {/* Top 15 Chart */}
          {top15.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 28 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Top 15 Projects by Spend (USD M)</h2>
              <ResponsiveContainer width="100%" height={Math.max(320, top15.length * 26 + 40)}>
                <BarChart
                  data={top15}
                  layout="vertical"
                  margin={{ left: 100, right: 20, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}M`} />
                  <YAxis type="category" dataKey="project_no" tick={{ fontSize: 11 }} width={96} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`$${v.toFixed(2)}M`, name]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="cogs"    name="COGS"    stackId="spend" fill="#ef4444" />
                  <Bar dataKey="opex"    name="OpEx"    stackId="spend" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detail Table */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 16px 12px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, flex: 1 }}>
                All Projects — {filtered.length} shown
              </h2>
              <input
                placeholder="Search project…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #d1d5db', width: 180 }}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Project No</th>
                    {(
                      [
                        ['revenue',     'Revenue'],
                        ['cogs',        'COGS'],
                        ['opex',        'OpEx'],
                        ['net',         'Net Income'],
                        ['entry_count', 'Entries'],
                      ] as [keyof ProjectRow, string][]
                    ).map(([key, label]) => (
                      <th key={key} style={thStyle} onClick={() => handleSort(key)}>
                        {label}{arrow(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const netColor = r.net < 0 ? '#ef4444' : r.net > 0 ? '#166534' : 'inherit';
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500, fontFamily: 'monospace', fontSize: 12 }}>
                          {r.project_no}
                        </td>
                        <td style={tdStyle}>{fmt(r.revenue)}</td>
                        <td style={tdStyle}>{fmt(r.cogs)}</td>
                        <td style={tdStyle}>{fmt(r.opex)}</td>
                        <td style={{ ...tdStyle, color: netColor, fontWeight: 600 }}>{fmt(r.net)}</td>
                        <td style={tdStyle}>{fmtN(r.entry_count)}</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                        No projects match your filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
