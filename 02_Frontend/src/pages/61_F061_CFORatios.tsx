/**
 * F061 — CFO Ratios Dashboard
 * 20 ratios across 4 categories: Liquidity · Profitability · Efficiency · Leverage
 */
import { useState, useEffect, useCallback } from 'react';
import { get } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

// ── Types ────────────────────────────────────────────────────────────────────

interface CFORatiosData {
  // Liquidity
  current_ratio:      number | null;
  quick_ratio:        number | null;
  cash_ratio:         number | null;
  working_capital:    number | null;
  // Profitability
  gross_margin_pct:   number | null;
  ebitda_margin_pct:  number | null;
  net_margin_pct:     number | null;
  roa_pct:            number | null;
  roe_pct:            number | null;
  // Efficiency
  asset_turnover:     number | null;
  cost_to_income_pct: number | null;
  dso_days:           number | null;
  opex_ratio_pct:     number | null;
  // Leverage
  debt_equity:        number | null;
  debt_ratio:         number | null;
  interest_coverage:  number | null;
  debt_to_ebitda:     number | null;
  // Context
  revenue:            number | null;
  ebitda:             number | null;
  net_income:         number | null;
  total_assets:       number | null;
  total_liabilities:  number | null;
  total_equity:       number | null;
  entity_count:       number;
}

interface EntityRow {
  company_name:       string;
  company_id:         number;
  revenue:            number;
  gross_margin_pct:   number | null;
  ebitda_margin_pct:  number | null;
  net_margin_pct:     number | null;
  cost_to_income_pct: number | null;
}

interface RatioCardDef {
  key:        keyof CFORatiosData;
  label:      string;
  format:     'pct' | 'x' | 'days' | 'abs';
  green:      [number, number]; // [min, max] or [max, min] depending on direction
  better:     'high' | 'low';
  benchmark:  string;
  insight:    string;
}

// ── Benchmark Definitions ────────────────────────────────────────────────────

const LIQUIDITY: RatioCardDef[] = [
  {
    key: 'current_ratio', label: 'Current Ratio', format: 'x', better: 'high',
    green: [2, 1], benchmark: '≥ 2.0×',
    insight: 'Ability to cover short-term obligations with current assets.',
  },
  {
    key: 'quick_ratio', label: 'Quick Ratio', format: 'x', better: 'high',
    green: [1, 0.7], benchmark: '≥ 1.0×',
    insight: 'Liquidity excluding inventory — more conservative test.',
  },
  {
    key: 'cash_ratio', label: 'Cash Ratio', format: 'x', better: 'high',
    green: [0.5, 0.2], benchmark: '≥ 0.5×',
    insight: 'Strictest test — only cash vs current liabilities.',
  },
  {
    key: 'working_capital', label: 'Working Capital', format: 'abs', better: 'high',
    green: [0, -Infinity], benchmark: '> 0',
    insight: 'Net short-term liquidity buffer (Current Assets − Current Liabilities).',
  },
];

const PROFITABILITY: RatioCardDef[] = [
  {
    key: 'gross_margin_pct', label: 'Gross Margin', format: 'pct', better: 'high',
    green: [40, 20], benchmark: '≥ 40%',
    insight: 'Revenue retained after cost of goods sold.',
  },
  {
    key: 'ebitda_margin_pct', label: 'EBITDA Margin', format: 'pct', better: 'high',
    green: [20, 10], benchmark: '≥ 20%',
    insight: 'Operating earnings power before non-cash charges.',
  },
  {
    key: 'net_margin_pct', label: 'Net Margin', format: 'pct', better: 'high',
    green: [15, 5], benchmark: '≥ 15%',
    insight: 'Bottom-line profitability after all expenses and taxes.',
  },
  {
    key: 'roa_pct', label: 'Return on Assets', format: 'pct', better: 'high',
    green: [10, 5], benchmark: '≥ 10%',
    insight: 'How efficiently the company generates profit from its assets.',
  },
  {
    key: 'roe_pct', label: 'Return on Equity', format: 'pct', better: 'high',
    green: [15, 8], benchmark: '≥ 15%',
    insight: "Shareholder return on invested equity capital.",
  },
];

const EFFICIENCY: RatioCardDef[] = [
  {
    key: 'asset_turnover', label: 'Asset Turnover', format: 'x', better: 'high',
    green: [1, 0.5], benchmark: '≥ 1.0×',
    insight: 'Revenue generated per unit of assets deployed.',
  },
  {
    key: 'cost_to_income_pct', label: 'Cost-to-Income', format: 'pct', better: 'low',
    green: [60, 80], benchmark: '< 60%',
    insight: 'Total costs as share of revenue — lower is more efficient.',
  },
  {
    key: 'dso_days', label: 'DSO (Days)', format: 'days', better: 'low',
    green: [30, 60], benchmark: '< 30 days',
    insight: 'Average days to collect receivables — lower = faster cash conversion.',
  },
  {
    key: 'opex_ratio_pct', label: 'OpEx Ratio', format: 'pct', better: 'low',
    green: [15, 30], benchmark: '< 15%',
    insight: 'Operating expenses as % of revenue.',
  },
];

const LEVERAGE: RatioCardDef[] = [
  {
    key: 'debt_equity', label: 'Debt / Equity', format: 'x', better: 'low',
    green: [0.5, 2], benchmark: '< 0.5×',
    insight: 'Financial leverage — how much debt funds the business relative to equity.',
  },
  {
    key: 'debt_ratio', label: 'Debt Ratio', format: 'x', better: 'low',
    green: [0.4, 0.7], benchmark: '< 0.4×',
    insight: 'Share of assets financed by debt.',
  },
  {
    key: 'interest_coverage', label: 'Interest Coverage', format: 'x', better: 'high',
    green: [5, 2], benchmark: '≥ 5×',
    insight: 'EBITDA / Interest — capacity to service debt. Below 2× = distress risk.',
  },
  {
    key: 'debt_to_ebitda', label: 'Debt / EBITDA', format: 'x', better: 'low',
    green: [2, 4], benchmark: '< 2×',
    insight: 'Years to repay debt from EBITDA — key lender metric.',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(v: number | null, decimals = 1) {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(decimals)}M`;
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(decimals)}K`;
  return v.toFixed(decimals);
}

function fmtValue(v: number | null, fmt: RatioCardDef['format']) {
  if (v === null || v === undefined) return '—';
  switch (fmt) {
    case 'pct':  return `${v.toFixed(1)}%`;
    case 'x':    return `${v.toFixed(2)}×`;
    case 'days': return `${v.toFixed(0)}d`;
    case 'abs':  return fmtM(v);
  }
}

function trafficLight(v: number | null, def: RatioCardDef): 'green' | 'amber' | 'red' {
  if (v === null || v === undefined) return 'amber';
  const [g, a] = def.green;
  if (def.better === 'high') {
    if (v >= g) return 'green';
    if (v >= a) return 'amber';
    return 'red';
  } else {
    if (v <= g) return 'green';
    if (v <= a) return 'amber';
    return 'red';
  }
}

const STATUS_COLOR = {
  green: { bg: 'rgba(16,185,129,.10)', border: 'rgba(16,185,129,.30)', text: '#059669', dot: '#10b981' },
  amber: { bg: 'rgba(245,158,11,.10)', border: 'rgba(245,158,11,.30)', text: '#d97706', dot: '#f59e0b' },
  red:   { bg: 'rgba(239,68,68,.10)',  border: 'rgba(239,68,68,.30)',  text: '#dc2626', dot: '#ef4444' },
};

const SECTION_COLORS = {
  Liquidity:     { accent: '#0f3f3c', light: 'var(--teal-50)',  icon: '💧' },
  Profitability: { accent: '#6d28d9', light: '#f5f3ff',         icon: '📈' },
  Efficiency:    { accent: '#0369a1', light: '#eff6ff',         icon: '⚙' },
  Leverage:      { accent: '#b45309', light: '#fffbeb',         icon: '⚖' },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function RatioCard({ def, value }: { def: RatioCardDef; value: number | null }) {
  const status = trafficLight(value, def);
  const sc = STATUS_COLOR[status];

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${sc.border}`,
      borderRadius: 12,
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-500)', letterSpacing: '.03em' }}>
          {def.label}
        </span>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: sc.dot, marginTop: 3, flexShrink: 0,
        }} />
      </div>

      <div style={{ fontSize: 28, fontWeight: 900, color: sc.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {fmtValue(value, def.format)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: sc.text, background: sc.bg,
          padding: '2px 8px', borderRadius: 999,
          letterSpacing: '.04em',
        }}>
          Benchmark {def.benchmark}
        </span>
        <span style={{ fontSize: 10, color: sc.text, fontWeight: 600 }}>
          {status.toUpperCase()}
        </span>
      </div>

      <p style={{ fontSize: 11, color: 'var(--neutral-400)', lineHeight: 1.5, margin: 0 }}>
        {def.insight}
      </p>
    </div>
  );
}

function SectionHeader({ title, accent, icon }: { title: string; accent: string; icon: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: accent, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 17,
      }}>
        {icon}
      </div>
      <h2 style={{
        margin: 0, fontSize: 18, fontWeight: 900,
        color: 'var(--neutral-900)', letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CFORatios() {
  const [data, setData]       = useState<CFORatiosData | null>(null);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [year, setYear]       = useState<number>(new Date().getFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ratios, ent] = await Promise.all([
        get<CFORatiosData>(`/api/reports/cfo-ratios?year=${year}`),
        get<EntityRow[]>(`/api/reports/cfo-ratios/by-entity?year=${year}`),
      ]);
      setData(ratios);
      setEntities(ent);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load ratios');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  // ── Score summary (traffic-light counts) ─────────────────────────────────
  const allDefs = [...LIQUIDITY, ...PROFITABILITY, ...EFFICIENCY, ...LEVERAGE];
  const counts = data
    ? allDefs.reduce((acc, d) => {
        const s = trafficLight(data[d.key] as number | null, d);
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : { green: 0, amber: 0, red: 0 };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-400)', fontSize: 14 }}>
          Loading CFO ratios…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container">
        <div style={{ padding: 40, color: 'var(--coral-500)', fontSize: 14 }}>
          {error || 'No data available.'}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--neutral-900)', letterSpacing: '-0.02em' }}>
            CFO Ratios Dashboard
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--neutral-400)' }}>
            20 key ratios across Liquidity · Profitability · Efficiency · Leverage — {data.entity_count} entities
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{
              padding: '7px 12px', borderRadius: 8,
              border: '1px solid var(--neutral-200)',
              fontSize: 13, fontWeight: 600, color: 'var(--neutral-700)',
              background: '#fff', cursor: 'pointer',
            }}
          >
            {[2022, 2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <PageExplainer
        icon="📐"
        title="What is the CFO Ratios Dashboard?"
        description="This page shows <strong>20 key financial ratios</strong> across four categories: Liquidity (can the firm pay its bills?), Profitability (is it earning enough?), Efficiency (how well are assets deployed?), and Leverage (how much debt is it carrying?). Each ratio is colour-coded green/amber/red against industry benchmarks so CFOs can instantly spot concerns."
        concepts={[
          { icon: '●', color: '#059669', label: 'Green', desc: 'Ratio within healthy benchmark range' },
          { icon: '●', color: '#d97706', label: 'Amber', desc: 'Ratio near boundary — monitor closely' },
          { icon: '●', color: '#dc2626', label: 'Red', desc: 'Ratio outside healthy range — action required' },
        ]}
        glossary={[
          { term: 'Current Ratio', def: 'Current Assets ÷ Current Liabilities — measures short-term liquidity' },
          { term: 'EBITDA Margin', def: 'EBITDA ÷ Revenue — operating profitability before non-cash items' },
          { term: 'Debt-to-Equity', def: 'Total Debt ÷ Equity — financial leverage measure' },
        ]}
      />

      {/* ── KPI Summary strip ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 32,
      }}>
        {[
          { label: 'Revenue',    value: fmtM(data.revenue), color: 'var(--teal-700)' },
          { label: 'EBITDA',     value: fmtM(data.ebitda),  color: '#6d28d9' },
          { label: 'Net Income', value: fmtM(data.net_income), color: data.net_income && data.net_income >= 0 ? '#059669' : '#dc2626' },
          { label: 'Total Assets', value: fmtM(data.total_assets), color: '#0369a1' },
          { label: 'Green', value: `${counts.green || 0}/20`, color: '#059669' },
          { label: 'Red',   value: `${counts.red   || 0}/20`, color: '#dc2626' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: '#fff', border: '1px solid var(--neutral-100)',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)', letterSpacing: '.04em', marginBottom: 4 }}>
              {kpi.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: kpi.color, letterSpacing: '-0.02em' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Ratio Sections ── */}
      {(
        [
          { title: 'Liquidity',     defs: LIQUIDITY     },
          { title: 'Profitability', defs: PROFITABILITY },
          { title: 'Efficiency',    defs: EFFICIENCY    },
          { title: 'Leverage',      defs: LEVERAGE      },
        ] as const
      ).map(section => {
        const sc = SECTION_COLORS[section.title];
        return (
          <div key={section.title} style={{ marginBottom: 36 }}>
            <SectionHeader title={section.title} accent={sc.accent} icon={sc.icon} />
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${section.defs.length}, 1fr)`,
              gap: 14,
            }}>
              {section.defs.map(def => (
                <RatioCard key={def.key} def={def} value={data[def.key] as number | null} />
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Entity breakdown ── */}
      {entities.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--teal-800)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 17,
            }}>◉</div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
              Entity Breakdown
            </h2>
          </div>

          <div style={{
            background: '#fff', border: '1px solid var(--neutral-100)', borderRadius: 12, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-100)' }}>
                  {['Entity', 'Revenue', 'Gross Margin', 'EBITDA Margin', 'Net Margin', 'Cost-to-Income'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: h === 'Entity' ? 'left' : 'right',
                      fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', letterSpacing: '.04em',
                      textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entities.slice(0, 17).map((ent, i) => (
                  <tr key={ent.company_id}
                    style={{ borderBottom: i < entities.length - 1 ? '1px solid var(--neutral-50)' : 'none' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--neutral-800)' }}>
                      {ent.company_name}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--teal-700)', fontWeight: 700 }}>
                      {fmtM(ent.revenue)}
                    </td>
                    {[ent.gross_margin_pct, ent.ebitda_margin_pct, ent.net_margin_pct].map((v, idx) => {
                      const color = v === null ? 'var(--neutral-300)' : v >= 15 ? '#059669' : v >= 5 ? '#d97706' : '#dc2626';
                      return (
                        <td key={idx} style={{ padding: '9px 14px', textAlign: 'right', color, fontWeight: 700 }}>
                          {v !== null && v !== undefined ? `${v.toFixed(1)}%` : '—'}
                        </td>
                      );
                    })}
                    <td style={{ padding: '9px 14px', textAlign: 'right',
                      color: ent.cost_to_income_pct !== null
                        ? ent.cost_to_income_pct! <= 60 ? '#059669' : ent.cost_to_income_pct! <= 80 ? '#d97706' : '#dc2626'
                        : 'var(--neutral-300)',
                      fontWeight: 700 }}>
                      {ent.cost_to_income_pct !== null && ent.cost_to_income_pct !== undefined
                        ? `${ent.cost_to_income_pct.toFixed(1)}%` : '—'}
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
