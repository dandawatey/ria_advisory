import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { get, type FilterOptions } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface BudgetKPIs {
  total_budget: number; total_actual: number; variance: number; utilization_pct: number | null;
}
interface PeriodRow {
  year: number; month: number; month_name: string;
  budget_amount: number; actual_amount: number; variance: number;
}
interface EntityRow {
  company_name: string; budget_amount: number; actual_amount: number;
  variance: number; utilization_pct: number | null;
}
interface CategoryRow {
  account_category: string; budget_amount: number; actual_amount: number;
  variance: number; utilization_pct: number | null;
}

const CATEGORIES = ['Income', 'Expense', 'Assets', 'Liabilities'];

function fmt(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function varColor(v: number) { return v >= 0 ? '#10b981' : '#ef4444'; }

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Budgeting() {
  const [tab, setTab]             = useState<'overview' | 'period' | 'entity'>('overview');
  const [filters, setFilters]     = useState<FilterOptions | null>(null);
  const [companyIds, setCompanyIds] = useState<number[]>([]);
  const [year, setYear]           = useState<number | null>(null);
  const [category, setCategory]   = useState<string>('');
  const [kpis, setKpis]           = useState<BudgetKPIs | null>(null);
  const [periods, setPeriods]     = useState<PeriodRow[]>([]);
  const [entities, setEntities]   = useState<EntityRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading]     = useState(false);

  const token = localStorage.getItem('ria_token') ?? '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilters).catch(() => {});
  }, []);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    companyIds.forEach(id => p.append('company_id', String(id)));
    if (year)     p.set('year', String(year));
    if (category) p.set('category', category);
    return p.toString() ? `?${p.toString()}` : '';
  }, [companyIds, year, category]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = qs();
    try {
      const [k, p, e, c] = await Promise.all([
        fetch(`${BASE}/api/budgets/kpis${q}`, { headers }).then(r => r.json()),
        fetch(`${BASE}/api/budgets/by-period${q}`, { headers }).then(r => r.json()),
        fetch(`${BASE}/api/budgets/by-entity${q}`, { headers }).then(r => r.json()),
        fetch(`${BASE}/api/budgets/by-category${q}`, { headers }).then(r => r.json()),
      ]);
      setKpis(k); setPeriods(p); setEntities(e); setCategories(c);
    } finally { setLoading(false); }
  }, [qs]);

  useEffect(() => { load(); }, [load]);

  const periodChart = periods.map(r => ({
    name: r.month_name?.slice(0, 3) ?? `M${r.month}`,
    Budget: Math.round(r.budget_amount / 1e6),
    Actual: Math.round(r.actual_amount / 1e6),
  }));

  const entityChart = entities.slice(0, 12).map(r => ({
    name: r.company_name.replace('RIA', '').trim().slice(0, 12),
    Budget: Math.round(r.budget_amount / 1e6),
    Actual: Math.round(r.actual_amount / 1e6),
    Variance: Math.round(r.variance / 1e6),
  }));

  const years = filters ? [...new Set(filters.years)].sort((a, b) => b - a) : [];

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'period',   label: 'By Period' },
    { key: 'entity',   label: 'By Entity' },
  ] as const;

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
        <h1 className="page-title">Budgeting</h1>
        <p className="page-subtitle">Budget vs actual variance by period and entity</p>
      </div>

      <PageExplainer
        icon="💰"
        title="What is the Budgeting Dashboard?"
        description="This page shows <strong>budget vs actual variance</strong> across all subsidiaries by period and entity. Finance teams use this to identify where spending is over or under plan, which categories are driving variance, and how utilisation compares to approved budgets. Use the filters to slice by year, account category, or specific entity."
        concepts={[
          { icon: '●', color: '#3b82f6', label: 'Budget', desc: 'Planned spending approved for the period' },
          { icon: '●', color: '#0F3F3C', label: 'Actual', desc: 'Recorded GL spend for the same period' },
          { icon: '●', color: '#10b981', label: 'Positive Variance', desc: 'Under budget — actual spend below plan' },
          { icon: '●', color: '#ef4444', label: 'Negative Variance', desc: 'Over budget — actual spend exceeds plan' },
        ]}
        glossary={[
          { term: 'Utilization %', def: 'Actual ÷ Budget × 100 — how much of the budget has been consumed' },
          { term: 'Variance', def: 'Budget minus Actual — positive = under budget, negative = over budget' },
        ]}
      />

      {/* KPI Tiles */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
          <KpiCard label="Total Budget"       value={fmt(kpis.total_budget)} sub="Planned spending" />
          <KpiCard label="Total Actual"       value={fmt(kpis.total_actual)} sub="Recorded in GL" />
          <KpiCard label="Variance"           value={fmt(kpis.variance)}
            accent={kpis.variance >= 0 ? '#10b981' : '#ef4444'}
            sub={kpis.variance >= 0 ? 'Under budget' : 'Over budget'} />
          <KpiCard label="Utilization"
            value={kpis.utilization_pct != null ? `${kpis.utilization_pct}%` : '—'}
            accent={kpis.utilization_pct && kpis.utilization_pct > 100 ? '#ef4444' : '#3b82f6'}
            sub="Actual / Budget" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Filter Sidebar */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>

            {/* Year filter */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button style={chip(year === null)} onClick={() => setYear(null)}>All</button>
                {years.map(y => (
                  <button key={y} style={chip(year === y)} onClick={() => setYear(y)}>{y}</button>
                ))}
              </div>
            </div>

            {/* Category filter */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Category</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button style={chip(category === '')} onClick={() => setCategory('')}>All</button>
                {CATEGORIES.map(c => (
                  <button key={c} style={chip(category === c)} onClick={() => setCategory(c)}>{c}</button>
                ))}
              </div>
            </div>

            {/* Company filter */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Entity</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {filters?.companies.slice(0, 5).map(co => (
                  <button
                    key={co.company_id}
                    style={chip(companyIds.includes(co.company_id))}
                    onClick={() => setCompanyIds(prev =>
                      prev.includes(co.company_id) ? prev.filter(x => x !== co.company_id) : [...prev, co.company_id]
                    )}
                  >{co.company_name.slice(0, 8)}</button>
                ))}
                {companyIds.length > 0 && (
                  <button style={chip(false)} onClick={() => setCompanyIds([])}>Clear</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  padding: '9px 20px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                  color: tab === t.key ? '#0F3F3C' : '#6b7280',
                  borderBottom: tab === t.key ? '2px solid #0F3F3C' : '2px solid transparent',
                  marginBottom: -2,
                }}>{t.label}</button>
            ))}
          </div>

          {loading && <div style={{ color: '#9ca3af', padding: 40, textAlign: 'center' }}>Loading…</div>}

          {/* Overview Tab */}
          {!loading && tab === 'overview' && (
            <div>
              {/* Category cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, marginBottom: 28 }}>
                {categories.map(c => (
                  <div key={c.account_category} style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>{c.account_category}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Budget', val: fmt(c.budget_amount), color: '#3b82f6' },
                        { label: 'Actual', val: fmt(c.actual_amount), color: '#0F3F3C' },
                        { label: 'Variance', val: fmt(c.variance), color: varColor(c.variance) },
                        { label: 'Utilization', val: c.utilization_pct != null ? `${c.utilization_pct}%` : '—',
                          color: c.utilization_pct && c.utilization_pct > 100 ? '#ef4444' : '#6b7280' },
                      ].map(m => (
                        <div key={m.label}>
                          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                    {c.utilization_pct != null && (
                      <div style={{ marginTop: 12, background: '#f3f4f6', borderRadius: 4, height: 6 }}>
                        <div style={{
                          height: 6, borderRadius: 4,
                          width: `${Math.min(c.utilization_pct, 100)}%`,
                          background: c.utilization_pct > 100 ? '#ef4444' : '#10b981',
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Top entities table */}
              <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#111827' }}>Top Entities — Budget vs Actual</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                        {['Entity', 'Budget', 'Actual', 'Variance', 'Utilization'].map(h => (
                          <th key={h} style={{ textAlign: h === 'Entity' ? 'left' : 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entities.slice(0, 10).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>{r.company_name}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#3b82f6' }}>{fmt(r.budget_amount)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0F3F3C' }}>{fmt(r.actual_amount)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: varColor(r.variance), fontWeight: 600 }}>{fmt(r.variance)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                              background: r.utilization_pct && r.utilization_pct > 100 ? '#fee2e2' : '#dcfce7',
                              color: r.utilization_pct && r.utilization_pct > 100 ? '#ef4444' : '#16a34a',
                            }}>{r.utilization_pct != null ? `${r.utilization_pct}%` : '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* By Period Tab */}
          {!loading && tab === 'period' && (
            <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: '#111827' }}>Monthly Budget vs Actual ($M)</div>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={periodChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number, name: string) => [`$${v.toFixed(1)}M`, name]} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="Budget" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#0F3F3C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 24, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                      {['Month', 'Budget', 'Actual', 'Variance'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Month' ? 'left' : 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                        <td style={{ padding: '8px 12px' }}>{r.month_name} {r.year}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#3b82f6' }}>{fmt(r.budget_amount)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0F3F3C' }}>{fmt(r.actual_amount)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: varColor(r.variance), fontWeight: 600 }}>{fmt(r.variance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By Entity Tab */}
          {!loading && tab === 'entity' && (
            <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: '#111827' }}>Entity Budget vs Actual ($M)</div>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={entityChart} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                  <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number, name: string) => [`$${v.toFixed(1)}M`, name]} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <ReferenceLine y={0} stroke="#9ca3af" />
                  <Bar dataKey="Budget" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#0F3F3C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Variance" radius={[4, 4, 0, 0]}>
                    {entityChart.map((entry, i) => (
                      <Cell key={i} fill={entry.Variance >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Entity</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Budget</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Actual</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Variance</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Utilization %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entities.slice(0, 12).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '5px 10px' }}>{row.company_name}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(row.budget_amount)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(row.actual_amount)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: row.variance >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmt(row.variance)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{row.utilization_pct != null ? row.utilization_pct.toFixed(1) + '%' : '—'}</td>
                      </tr>
                    ))}
                    {entities.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
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
