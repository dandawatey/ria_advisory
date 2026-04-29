import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { get, type FilterOptions } from '../api/client';

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

  return (
    <div style={{ padding: '28px 32px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: 0 }}>Budget Planning</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Budget vs Actual across all entities</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <select
          value={year ?? ''}
          onChange={e => setYear(e.target.value ? +e.target.value : null)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: '#fff' }}
        >
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: '#fff' }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {filters?.companies.slice(0, 5).map(co => (
          <button
            key={co.company_id}
            onClick={() => setCompanyIds(prev =>
              prev.includes(co.company_id) ? prev.filter(x => x !== co.company_id) : [...prev, co.company_id]
            )}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid',
              borderColor: companyIds.includes(co.company_id) ? '#0F3F3C' : '#e5e7eb',
              background: companyIds.includes(co.company_id) ? '#0F3F3C' : '#fff',
              color: companyIds.includes(co.company_id) ? '#fff' : '#374151',
              fontSize: 13, cursor: 'pointer', fontWeight: 500,
            }}
          >{co.company_name.slice(0, 8)}</button>
        ))}
        {companyIds.length > 0 && (
          <button onClick={() => setCompanyIds([])}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>

      {/* KPI Row */}
      {kpis && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
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
        </div>
      )}
    </div>
  );
}
