/**
 * F042 — Financial Health Score
 * Composite 0-100 score across 6 weighted categories
 * Source: /api/reports/health-score
 */
import { useState, useEffect, useCallback } from 'react';
import { get, type FilterOptions } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Category {
  name: string;
  weight: number;
  metric_label: string;
  metric_value: string;
  raw_value: number;
  score: number;
  status: 'green' | 'amber' | 'red';
}
interface Driver {
  type: 'positive' | 'negative';
  text: string;
}
interface HealthScoreData {
  overall_score: number;
  grade: string;
  categories: Category[];
  drivers: Driver[];
  ratios: Record<string, number | null>;
}

// ── Gauge ─────────────────────────────────────────────────────────────────────
function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const cx = 150, cy = 145, r = 110, sw = 22;
  const radians = Math.PI * (1 - score / 100);
  const ex = cx + r * Math.cos(radians);
  const ey = cy - r * Math.sin(radians);
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <svg viewBox="0 0 300 175" style={{ width: '100%', maxWidth: 300 }}>
      {/* Background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#e5e7eb" strokeWidth={sw} strokeLinecap="round"
      />
      {/* Score arc — skip if 0 or 100 edge cases */}
      {score > 0 && score < 100 && (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        />
      )}
      {score >= 100 && (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r - 0.001} ${cy}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        />
      )}
      {/* Score text */}
      <text x={cx} y={cy - 18} textAnchor="middle" fontSize={52} fontWeight="bold" fill={color}>{score}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={14} fill="#6b7280">of 100 · Grade {grade}</text>
      {/* Scale */}
      <text x={cx - r - 4} y={cy + 20} textAnchor="end" fontSize={11} fill="#9ca3af">0</text>
      <text x={cx + r + 4} y={cy + 20} textAnchor="start" fontSize={11} fill="#9ca3af">100</text>
    </svg>
  );
}

// ── Category Tile ─────────────────────────────────────────────────────────────
function CategoryTile({ cat }: { cat: Category }) {
  const clr = cat.status === 'green' ? '#22c55e' : cat.status === 'amber' ? '#f59e0b' : '#ef4444';
  const bg  = cat.status === 'green' ? '#f0fdf4' : cat.status === 'amber' ? '#fffbeb' : '#fef2f2';
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: '14px 16px',
      borderLeft: `4px solid ${clr}`, minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{cat.name}</span>
        <span style={{ fontSize: 11, color: '#6b7280' }}>{cat.weight}%</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: clr, marginBottom: 4 }}>{cat.score}</div>
      <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, marginBottom: 6 }}>
        <div style={{ background: clr, width: `${cat.score}%`, height: '100%', borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{cat.metric_label}: <strong>{cat.metric_value}</strong></div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HealthScore() {
  const [filters, setFilters]     = useState<FilterOptions | null>(null);
  const [companyIds, setCompanyIds] = useState<number[]>([]);
  const [year, setYear]           = useState<number | ''>('');
  const [data, setData]           = useState<HealthScoreData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState('');

  // Load filter options
  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilters).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const qs = new URLSearchParams();
      companyIds.forEach(id => qs.append('company_id', String(id)));
      if (year) qs.set('year', String(year));
      const d = await get<HealthScoreData>(`/api/reports/health-score?${qs}`);
      setData(d);
    } catch (e: unknown) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [companyIds, year]);

  useEffect(() => { load(); }, [load]);

  const toggleCompany = (id: number) =>
    setCompanyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const years = filters?.companies
    ? Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
    : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Financial Health Score</h1>
        <p className="page-subtitle">Composite 0–100 score across 6 weighted categories</p>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {err     && <p style={{ color: '#ef4444' }}>Error: {err}</p>}

      {/* KPI Area — Gauge + Drivers + Mini Ratios */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, marginBottom: 20, alignItems: 'start' }}>
          {/* Gauge */}
          <div style={{
            background: '#fff', borderRadius: 12, padding: '24px 16px 16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center',
          }}>
            <ScoreGauge score={data.overall_score} grade={data.grade} />
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12, fontSize: 11, color: '#6b7280',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />70–100 Healthy
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />40–69 Caution
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />0–39 Critical
              </span>
            </div>
          </div>

          {/* Drivers */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Score Drivers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.drivers.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '8px 12px', borderRadius: 8,
                  background: d.type === 'positive' ? '#f0fdf4' : '#fef2f2',
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{d.type === 'positive' ? '▲' : '▼'}</span>
                  <span style={{
                    fontSize: 13, color: d.type === 'positive' ? '#166534' : '#991b1b',
                  }}>{d.text}</span>
                </div>
              ))}
            </div>

            {/* Mini ratios summary */}
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Gross Margin', val: data.ratios.gross_margin_pct != null ? `${Number(data.ratios.gross_margin_pct).toFixed(1)}%` : '—' },
                { label: 'Net Margin',   val: data.ratios.net_margin_pct   != null ? `${Number(data.ratios.net_margin_pct).toFixed(1)}%`   : '—' },
                { label: 'Current Ratio',val: data.ratios.current_ratio    != null ? `${Number(data.ratios.current_ratio).toFixed(2)}×`    : '—' },
                { label: 'D/E Ratio',    val: data.ratios.debt_equity      != null ? `${Number(data.ratios.debt_equity).toFixed(2)}×`      : '—' },
                { label: 'OpEx Ratio',   val: data.ratios.opex_ratio_pct   != null ? `${Number(data.ratios.opex_ratio_pct).toFixed(1)}%`   : '—' },
                { label: 'EBITDA Margin',val: data.ratios.ebitda_margin_pct != null ? `${Number(data.ratios.ebitda_margin_pct).toFixed(1)}%` : '—' },
              ].map(m => (
                <div key={m.label} style={{ background: '#f9fafb', borderRadius: 6, padding: '6px 10px' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Filter Sidebar */}
        <div style={{ width: 220, flexShrink: 0, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 12 }}>Filters</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entity</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year</div>
              <select
                value={year}
                onChange={e => setYear(e.target.value ? Number(e.target.value) : '')}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 20, border: '1px solid #d1d5db', width: '100%' }}
              >
                <option value="">All Years</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content — Category Breakdown */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {data && (
            <>
              {/* ── Category Tiles ── */}
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Category Breakdown</h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
                marginBottom: 28,
              }}>
                {data.categories.map(cat => (
                  <CategoryTile key={cat.name} cat={cat} />
                ))}
              </div>

              {/* ── Scoring Guide ── */}
              <details style={{ marginBottom: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
                  Scoring methodology
                </summary>
                <div style={{ marginTop: 10, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Category', 'Weight', 'Metric', 'Green (100)', 'Amber (50–99)', 'Red (<50)'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Profitability',    '25%', 'Net Margin %',     '>15%',   '5–15%',  '<5%'],
                        ['Gross Efficiency', '20%', 'Gross Margin %',   '>40%',   '20–40%', '<20%'],
                        ['Liquidity',        '20%', 'Current Ratio',    '>2.0×',  '1–2×',   '<1×'],
                        ['Leverage',         '15%', 'Debt/Equity',      '<0.5×',  '0.5–2×', '>2×'],
                        ['OpEx Control',     '10%', 'OpEx Ratio %',     '<10%',   '10–25%', '>25%'],
                        ['Data Coverage',    '10%', 'Entity Coverage %', '>80%',  '50–80%', '<50%'],
                      ].map(row => (
                        <tr key={row[0]} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          {row.map((cell, i) => (
                            <td key={i} style={{
                              padding: '6px 10px',
                              color: i === 3 ? '#166534' : i === 4 ? '#92400e' : i === 5 ? '#991b1b' : 'inherit',
                            }}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
