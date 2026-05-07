/**
 * F039 — Department Spend
 * Source: v_dept_spend (company, dept, vertical, fiscal_year, period, amount)
 */
import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { get, type FilterOptions } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DeptRow {
  company_name: string;
  department_code: string;
  vertical_code: string | null;
  fiscal_year: number;
  fiscal_period: number;
  account_category: string | null;
  total_amount: number;
  entry_count: number;
}
interface DeptSummary {
  total_spend: number;
  dept_count: number;
  vertical_count: number;
  entity_count: number;
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

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#6366f1','#ec4899','#14b8a6','#f97316','#84cc16'];

function KPITile({ label, value, color = '#3b82f6', loading }: {
  label: string; value: string; color?: string; loading?: boolean;
}) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{loading ? '…' : value}</div>
    </div>
  );
}

// Aggregate rows by dept
function deptTotals(rows: DeptRow[]): { dept: string; vertical: string | null; total: number }[] {
  const map = new Map<string, { vertical: string | null; total: number }>();
  for (const r of rows) {
    const existing = map.get(r.department_code);
    if (existing) {
      existing.total += Math.abs(r.total_amount);
    } else {
      map.set(r.department_code, { vertical: r.vertical_code, total: Math.abs(r.total_amount) });
    }
  }
  return Array.from(map.entries())
    .map(([dept, v]) => ({ dept, vertical: v.vertical, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DeptSpend() {
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ companies: [], years: [], months: [], currencies: [], account_categories: [] });
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [deptFilter, setDeptFilter] = useState('');
  const [accountCategory, setAccountCategory] = useState<string>('');

  const [summary, setSummary] = useState<DeptSummary | null>(null);
  const [rows, setRows]       = useState<DeptRow[]>([]);
  const [loadSummary, setLoadSummary] = useState(true);
  const [loadRows, setLoadRows]       = useState(true);
  const [errRows, setErrRows]         = useState(false);

  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilterOpts).catch(() => {});
  }, []);

  const buildQS = useCallback(() => {
    const qs = new URLSearchParams();
    selectedCompanies.forEach((id) => qs.append('company_id', String(id)));
    if (year)            qs.set('year',             String(year));
    if (deptFilter)      qs.set('department_code',  deptFilter);
    if (accountCategory) qs.set('account_category', accountCategory);
    return qs;
  }, [selectedCompanies, year, deptFilter, accountCategory]);

  useEffect(() => {
    setLoadSummary(true);
    get<DeptSummary>(`/api/reports/dept-spend/summary?${buildQS()}`)
      .then(setSummary).catch(() => setSummary(null)).finally(() => setLoadSummary(false));
  }, [buildQS]);

  useEffect(() => {
    setLoadRows(true); setErrRows(false);
    get<DeptRow[]>(`/api/reports/dept-spend?${buildQS()}`)
      .then(setRows).catch(() => { setErrRows(true); setRows([]); }).finally(() => setLoadRows(false));
  }, [buildQS]);

  const chip = (active: boolean) => ({
    padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#3b82f6' : 'var(--color-border)',
    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: active ? '#3b82f6' : 'inherit', fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  });

  const chartData = deptTotals(rows);

  // Dept options for filter dropdown
  const deptOptions = Array.from(new Set(rows.map((r) => r.department_code))).sort();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Department Spend</h1>
        <p className="page-subtitle">Spend by department + vertical · quarterly breakdown</p>
      </div>

      <PageExplainer
        icon="🏢"
        title="What is Department Spend?"
        description="This page analyses <strong>operating expenses broken down by department code and vertical business line</strong>. It answers questions like 'Which department is spending the most?' and 'How does spend compare across verticals?' The bar chart shows total spend per department. The table allows filtering by entity, department, vertical, and fiscal year. Finance business partners use this to challenge budgets and identify cost centres running over plan."
        concepts={[
          { icon: 'D', color: '#3b82f6', label: 'Department', desc: 'Cost centre code from BC — e.g. ADMIN, SALES, TECH, OPS' },
          { icon: 'V', color: '#10b981', label: 'Vertical', desc: 'Business line code — e.g. ADVISORY, FUND, CORP' },
          { icon: '$', color: '#f59e0b', label: 'Total Spend', desc: 'Sum of all GL entries posted to this department for the period' },
        ]}
        glossary={[
          { term: 'v_dept_spend', def: 'Database view aggregating GL entries by department code, vertical, entity, and fiscal period' },
          { term: 'Fiscal Period', def: 'Month number within the fiscal year — period 1 = first month of fiscal year' },
          { term: 'Department Code', def: 'Dimension tag on GL entries that assigns the transaction to a cost centre' },
        ]}
      />

      {/* KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <KPITile label="Total Spend"  value={fmt(summary?.total_spend)}              color="#3b82f6" loading={loadSummary} />
        <KPITile label="Departments"  value={String(summary?.dept_count    ?? '—')}  color="#f59e0b" loading={loadSummary} />
        <KPITile label="Verticals"    value={String(summary?.vertical_count ?? '—')} color="#10b981" loading={loadSummary} />
        <KPITile label="Entities"     value={String(summary?.entity_count  ?? '—')}  color="#8b5cf6" loading={loadSummary} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Filter Panel */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Entity</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setSelectedCompanies([])} style={chip(selectedCompanies.length === 0)}>All</button>
                {filterOpts.companies.map((c) => (
                  <button key={c.company_id} onClick={() => {
                    setSelectedCompanies((prev) =>
                      prev.includes(c.company_id) ? prev.filter((x) => x !== c.company_id) : [...prev, c.company_id]
                    );
                  }} style={chip(selectedCompanies.includes(c.company_id))}>{c.company_name}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setYear(null)} style={chip(year === null)}>All</button>
                {filterOpts.years.map((y) => (
                  <button key={y} onClick={() => setYear(y === year ? null : y)} style={chip(year === y)}>{y}</button>
                ))}
              </div>
            </div>

            {deptOptions.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Department</div>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'inherit', fontSize: 12 }}
                >
                  <option value="">All</option>
                  {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {filterOpts.account_categories?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>GL Group</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button onClick={() => setAccountCategory('')} style={chip(accountCategory === '')}>All</button>
                  {filterOpts.account_categories.map((cat) => (
                    <button key={cat} onClick={() => setAccountCategory(cat === accountCategory ? '' : cat)} style={chip(accountCategory === cat)}>{cat}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loadRows ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
          ) : errRows ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-error)' }}>Failed to load</div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">Top Departments by Spend</div>
                <div style={{ height: Math.max(240, chartData.length * 28 + 40) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="dept" width={115} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="total" name="Spend">
                        {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Entity</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Department</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Vertical</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Year</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Period</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Category</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 200).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '5px 12px' }}>{r.company_name}</td>
                          <td style={{ padding: '5px 12px', fontFamily: 'monospace' }}>{r.department_code}</td>
                          <td style={{ padding: '5px 12px', color: 'var(--color-text-muted)' }}>{r.vertical_code ?? '—'}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'center' }}>{r.fiscal_year}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'center' }}>P{r.fiscal_period}</td>
                          <td style={{ padding: '5px 12px', color: 'var(--color-text-muted)' }}>{r.account_category ?? '—'}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(r.total_amount)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{r.entry_count}</td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
                      )}
                    </tbody>
                  </table>
                  {rows.length > 200 && (
                    <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
                      Showing 200 of {rows.length} rows
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
