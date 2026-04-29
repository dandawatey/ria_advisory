import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { get, type FilterOptions } from '../api/client';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface PortfolioKPIs {
  holding_count: number; total_invested: number; current_value: number;
  total_return: number; roi_pct: number | null;
}
interface TypeRow {
  investment_type: string; holding_count: number; total_invested: number;
  current_value: number; total_return: number; roi_pct: number | null; weight_pct: number;
}
interface EntityRow {
  company_name: string; holding_count: number; total_invested: number;
  current_value: number; total_return: number; roi_pct: number | null;
}
interface InvestmentRow {
  id: string; company_name: string; investment_name: string; investment_type: string;
  asset_class: string; currency_code: string; invested_amount: number;
  current_value: number; return_amount: number; roi_pct: number | null;
  investment_date: string; maturity_date: string | null; status: string;
}

const COLORS = ['#0F3F3C', '#E8443B', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981'];
const TYPE_COLORS: Record<string, string> = {
  Equity: '#3b82f6', 'Fixed Income': '#10b981', Property: '#f59e0b',
  Cash: '#6b7280', Alternative: '#8b5cf6',
};

function fmt(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active:   { bg: '#dcfce7', color: '#16a34a' },
    matured:  { bg: '#dbeafe', color: '#1d4ed8' },
    divested: { bg: '#f3f4f6', color: '#6b7280' },
  };
  const s = cfg[status] ?? cfg.divested;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function Investment() {
  const [tab, setTab]               = useState<'portfolio' | 'bytype' | 'entity'>('portfolio');
  const [filters, setFilters]       = useState<FilterOptions | null>(null);
  const [companyIds, setCompanyIds] = useState<number[]>([]);
  const [statusFilter, setStatus]   = useState<string>('active');
  const [kpis, setKpis]             = useState<PortfolioKPIs | null>(null);
  const [byType, setByType]         = useState<TypeRow[]>([]);
  const [byEntity, setByEntity]     = useState<EntityRow[]>([]);
  const [list, setList]             = useState<InvestmentRow[]>([]);
  const [loading, setLoading]       = useState(false);

  const token = localStorage.getItem('ria_token') ?? '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilters).catch(() => {});
  }, []);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    companyIds.forEach(id => p.append('company_id', String(id)));
    if (statusFilter) p.set('status', statusFilter);
    return p.toString() ? `?${p.toString()}` : '';
  }, [companyIds, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = qs();
    try {
      const [k, t, e, l] = await Promise.all([
        fetch(`${BASE}/api/investments/portfolio${q}`, { headers }).then(r => r.json()),
        fetch(`${BASE}/api/investments/by-type${q}`, { headers }).then(r => r.json()),
        fetch(`${BASE}/api/investments/by-entity${q}`, { headers }).then(r => r.json()),
        fetch(`${BASE}/api/investments/list${q}`, { headers }).then(r => r.json()),
      ]);
      setKpis(k); setByType(t); setByEntity(e); setList(l);
    } finally { setLoading(false); }
  }, [qs]);

  useEffect(() => { load(); }, [load]);

  const pieData = byType.map(t => ({ name: t.investment_type, value: t.total_invested }));
  const barData = byEntity.map(e => ({
    name: e.company_name.slice(0, 12),
    Invested: Math.round(e.total_invested / 1e3),
    Value:    Math.round(e.current_value / 1e3),
  }));

  const TABS = [
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'bytype',   label: 'By Type' },
    { key: 'entity',   label: 'By Entity' },
  ] as const;

  return (
    <div style={{ padding: '28px 32px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: 0 }}>Investment Portfolio</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Holdings, returns, and portfolio composition</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: '#fff' }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="matured">Matured</option>
          <option value="divested">Divested</option>
        </select>
        {filters?.companies.slice(0, 5).map(co => (
          <button key={co.company_id}
            onClick={() => setCompanyIds(prev =>
              prev.includes(co.company_id) ? prev.filter(x => x !== co.company_id) : [...prev, co.company_id]
            )}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid',
              borderColor: companyIds.includes(co.company_id) ? '#0F3F3C' : '#e5e7eb',
              background: companyIds.includes(co.company_id) ? '#0F3F3C' : '#fff',
              color: companyIds.includes(co.company_id) ? '#fff' : '#374151',
              fontSize: 13, cursor: 'pointer', fontWeight: 500,
            }}>{co.company_name.slice(0, 8)}</button>
        ))}
        {companyIds.length > 0 && (
          <button onClick={() => setCompanyIds([])}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Clear</button>
        )}
      </div>

      {/* KPI Row */}
      {kpis && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <KpiCard label="Holdings"       value={String(kpis.holding_count)}   sub="Active positions" />
          <KpiCard label="Total Invested" value={fmt(kpis.total_invested)}     sub="Capital deployed" />
          <KpiCard label="Current Value"  value={fmt(kpis.current_value)}      accent="#0F3F3C" sub="Mark-to-market" />
          <KpiCard label="Total Return"   value={fmt(kpis.total_return)}
            accent={kpis.total_return >= 0 ? '#10b981' : '#ef4444'}
            sub={kpis.roi_pct != null ? `${kpis.roi_pct}% ROI` : undefined} />
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

      {/* Portfolio Tab */}
      {!loading && tab === 'portfolio' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
          {/* Donut chart */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Allocation by Type</div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={TYPE_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [fmt(v), 'Invested']} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Holdings table */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Holdings</div>
            <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
                  <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                    {['Investment', 'Type', 'Invested', 'Value', 'Return', 'ROI', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Investment' ? 'left' : 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={{ padding: '9px 10px', maxWidth: 160 }}>
                        <div style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>{r.investment_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.company_name}</div>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          background: TYPE_COLORS[r.investment_type] ? TYPE_COLORS[r.investment_type] + '20' : '#f3f4f6',
                          color: TYPE_COLORS[r.investment_type] ?? '#6b7280' }}>
                          {r.investment_type}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: '#374151' }}>{fmt(r.invested_amount)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: '#0F3F3C', fontWeight: 600 }}>{fmt(r.current_value)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: r.return_amount >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmt(r.return_amount)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: r.roi_pct && r.roi_pct >= 0 ? '#10b981' : '#ef4444' }}>
                        {r.roi_pct != null ? `${r.roi_pct}%` : '—'}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* By Type Tab */}
      {!loading && tab === 'bytype' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: '#111827' }}>Breakdown by Investment Type</div>
          <div style={{ display: 'grid', gap: 16 }}>
            {byType.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: '#f9fafb', borderRadius: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: TYPE_COLORS[t.investment_type] ?? COLORS[i % COLORS.length], flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{t.investment_type}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{t.holding_count} holdings · {t.weight_pct}% of portfolio</div>
                </div>
                {[
                  { label: 'Invested', val: fmt(t.total_invested), color: '#374151' },
                  { label: 'Value',    val: fmt(t.current_value),  color: '#0F3F3C' },
                  { label: 'Return',   val: fmt(t.total_return),   color: t.total_return >= 0 ? '#10b981' : '#ef4444' },
                  { label: 'ROI',      val: t.roi_pct != null ? `${t.roi_pct}%` : '—', color: t.roi_pct && t.roi_pct >= 0 ? '#10b981' : '#ef4444' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.val}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Entity Tab */}
      {!loading && tab === 'entity' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: '#111827' }}>Entity Holdings ($K)</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tickFormatter={v => `$${v}K`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number, name: string) => [`$${v.toFixed(0)}K`, name]} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="Invested" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Value"    fill="#0F3F3C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 24, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Entity', 'Holdings', 'Invested', 'Current Value', 'Return', 'ROI'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Entity' ? 'left' : 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byEntity.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.company_name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{r.holding_count}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(r.total_invested)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0F3F3C', fontWeight: 600 }}>{fmt(r.current_value)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: r.total_return >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmt(r.total_return)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: r.roi_pct && r.roi_pct >= 0 ? '#10b981' : '#ef4444' }}>
                      {r.roi_pct != null ? `${r.roi_pct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
