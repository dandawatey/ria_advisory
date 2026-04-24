/**
 * F025 — Analytics & Insights
 * Four tabbed sections over real GL data:
 *   1. P&L Overview  — waterfall + entity contribution
 *   2. Trends        — rolling revenue + MoM change
 *   3. Cost Anatomy  — department heatmap + top accounts + doc-type mix
 *   4. Verticals     — vertical P&L + revenue share
 * + persistent Suspense Monitor banner
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, BarChart, LineChart, PieChart,
  Bar, Line, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api } from '../api/client';
import type {
  PLWaterfallRow, EntityContributionRow, RollingTrendRow,
  DeptHeatmapRow, TopAccountRow, DocTypeMixRow, SuspenseRow,
  MoMChangeRow, VerticalPLRow,
} from '../api/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(n: number) {
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toFixed(0)}`;
}

const ENTITY_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
  '#a855f7','#fb923c','#22d3ee','#fbbf24','#4ade80',
  '#f43f5e','#818cf8',
];

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899'];

// Generic loading/error card
function ChartCard({ title, loading, error, height = 300, children }: {
  title: string; loading: boolean; error: boolean; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
          Loading…
        </div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>
          Could not load data — is the API running?
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}

// Custom tooltip formatter
function USDTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {fmtM(p.value)}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'pl' | 'trends' | 'costs' | 'verticals';

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('pl');
  const [subsidiary, setSubsidiary] = useState('');
  const [month, setMonth] = useState('');
  const [entities, setEntities] = useState<{ code: string; name: string }[]>([]);

  // Data states
  const [waterfall, setWaterfall] = useState<PLWaterfallRow[]>([]);
  const [contribution, setContribution] = useState<EntityContributionRow[]>([]);
  const [rolling, setRolling] = useState<RollingTrendRow[]>([]);
  const [mom, setMom] = useState<MoMChangeRow[]>([]);
  const [deptHeat, setDeptHeat] = useState<DeptHeatmapRow[]>([]);
  const [topAccts, setTopAccts] = useState<TopAccountRow[]>([]);
  const [acctPrefix, setAcctPrefix] = useState('');
  const [docMix, setDocMix] = useState<DocTypeMixRow[]>([]);
  const [verticals, setVerticals] = useState<VerticalPLRow[]>([]);
  const [suspense, setSuspense] = useState<SuspenseRow[]>([]);

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors]   = useState<Record<string, boolean>>({});

  function L(key: string, val: boolean) { setLoading((p) => ({ ...p, [key]: val })); }
  function E(key: string, val: boolean) { setErrors((p) => ({ ...p, [key]: val })); }

  // Load entity list once
  useEffect(() => {
    api.entities.list().then(setEntities).catch(() => null);
  }, []);

  // Load suspense monitor once
  useEffect(() => {
    L('suspense', true);
    api.analytics.suspenseMonitor().then(setSuspense).catch(() => E('suspense', true)).finally(() => L('suspense', false));
  }, []);

  // P&L tab loaders
  useEffect(() => {
    if (tab !== 'pl') return;
    L('wf', true); L('ec', true);
    api.analytics.plWaterfall(subsidiary || undefined)
      .then(setWaterfall).catch(() => E('wf', true)).finally(() => L('wf', false));
    api.analytics.entityContribution()
      .then(setContribution).catch(() => E('ec', true)).finally(() => L('ec', false));
  }, [tab, subsidiary]);

  // Trends tab loaders
  useEffect(() => {
    if (tab !== 'trends') return;
    L('roll', true); L('mom', true);
    api.analytics.rollingTrend(subsidiary || undefined)
      .then(setRolling).catch(() => E('roll', true)).finally(() => L('roll', false));
    api.analytics.momChange()
      .then(setMom).catch(() => E('mom', true)).finally(() => L('mom', false));
  }, [tab, subsidiary]);

  // Costs tab loaders
  const loadCosts = useCallback(() => {
    L('dept', true); L('top', true); L('doc', true);
    api.analytics.deptHeatmap(subsidiary || undefined, month || undefined)
      .then(setDeptHeat).catch(() => E('dept', true)).finally(() => L('dept', false));
    api.analytics.topAccounts({ account_prefix: acctPrefix, subsidiary: subsidiary || undefined, month: month || undefined, limit: 20 })
      .then(setTopAccts).catch(() => E('top', true)).finally(() => L('top', false));
    api.analytics.docTypeMix(subsidiary || undefined, month || undefined)
      .then(setDocMix).catch(() => E('doc', true)).finally(() => L('doc', false));
  }, [tab, subsidiary, month, acctPrefix]);

  useEffect(() => { if (tab === 'costs') loadCosts(); }, [loadCosts]);

  // Verticals tab
  useEffect(() => {
    if (tab !== 'verticals') return;
    L('vert', true);
    api.analytics.verticalPL(subsidiary || undefined)
      .then(setVerticals).catch(() => E('vert', true)).finally(() => L('vert', false));
  }, [tab, subsidiary]);

  // ── Pivot rolling trend rows → { month, [code]: revenue } ────────────────
  const allCodes = [...new Set(rolling.map((r) => r.subsidiary_code))];
  const allMonths = [...new Set(rolling.map((r) => r.month))].sort();
  const pivoted = allMonths.map((m) => {
    const row: Record<string, string | number> = { month: m };
    rolling.filter((r) => r.month === m).forEach((r) => { row[r.subsidiary_code] = r.revenue; });
    return row;
  });

  const top5codes = [...contribution]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((c) => c.subsidiary_code);

  const totalSuspenseBalance = suspense.reduce((s, r) => s + r.net_balance, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Analytics & Insights</h1>
            <p className="page-subtitle">GL-based analytics across all 17 subsidiaries · 188,380 entries</p>
          </div>
          {/* Global filters */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-select" style={{ width: 200 }} value={subsidiary} onChange={(e) => setSubsidiary(e.target.value)}>
              <option value="">All subsidiaries</option>
              {entities.map((e) => <option key={e.code} value={e.code}>{e.code} — {e.name}</option>)}
            </select>
            <input className="form-input" type="month" style={{ width: 150 }} value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={() => { setSubsidiary(''); setMonth(''); }}>Reset</button>
          </div>
        </div>
      </div>

      {/* Suspense monitor banner */}
      {suspense.length > 0 && (
        <div style={{ background: Math.abs(totalSuspenseBalance) > 1000 ? 'rgba(239,68,68,0.08)' : 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>⚠ Suspense (999999)</span>
          <span>Net balance across all entities: <strong>{fmtM(totalSuspenseBalance)}</strong></span>
          <span style={{ color: 'var(--color-text-muted)' }}>{suspense.length} entities have suspense entries</span>
          <span style={{ color: 'var(--color-text-muted)' }}>· Opening Balance Upload entries — review for reclassification</span>
        </div>
      )}

      {/* Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tabs" style={{ borderBottom: '1px solid var(--color-border)', marginBottom: 0 }}>
          {([['pl', 'P&L Overview'], ['trends', 'Trends'], ['costs', 'Cost Anatomy'], ['verticals', 'Verticals / BU']] as [Tab, string][]).map(([t, label]) => (
            <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{label}</div>
          ))}
        </div>
        <div style={{ padding: 16 }}>

          {/* ── Tab 1: P&L Overview ────────────────────────────────────────── */}
          {tab === 'pl' && (
            <>
              <ChartCard title="Monthly Revenue vs Expenses vs Net Income" loading={!!loading.wf} error={!!errors.wf} height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={waterfall} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 11 }} />
                    <Tooltip content={<USDTooltip />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="cogs" name="COGS" stackId="cost" fill="#f97316" />
                    <Bar yAxisId="left" dataKey="opex" name="OpEx" stackId="cost" fill="#ef4444" />
                    <Bar yAxisId="left" dataKey="tax"  name="Tax"  stackId="cost" fill="#94a3b8" />
                    <Line yAxisId="right" type="monotone" dataKey="revenue"   name="Revenue"    stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="net_income" name="Net Income" stroke="#10b981" strokeWidth={2} dot={false} />
                    <ReferenceLine yAxisId="right" y={0} stroke="var(--color-border)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Entity Revenue Ranking & Gross Margin" loading={!!loading.ec} error={!!errors.ec} height={420}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart layout="vertical" data={contribution} margin={{ top: 0, right: 60, bottom: 0, left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="subsidiary_code" tick={{ fontSize: 11 }} width={50} />
                    <Tooltip content={<USDTooltip />} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" />
                    <Bar dataKey="opex"    name="OpEx"    fill="#ef4444" />
                    <Line type="monotone" dataKey="gross_margin_pct" name="Gross Margin %" stroke="#10b981" strokeWidth={2} yAxisId={undefined} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Insight tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {contribution.slice(0, 4).map((e) => (
                  <div key={e.subsidiary_code} className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{e.subsidiary_code}</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtM(e.revenue)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {e.revenue_share_pct?.toFixed(1) ?? '0'}% of group · GM {e.gross_margin_pct?.toFixed(1) ?? '—'}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Tab 2: Trends ──────────────────────────────────────────────── */}
          {tab === 'trends' && (
            <>
              <ChartCard title="Monthly Revenue by Entity (Top 5)" loading={!!loading.roll} error={!!errors.roll} height={340}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pivoted} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 11 }} />
                    <Tooltip content={<USDTooltip />} />
                    <Legend />
                    {top5codes.map((code, i) => (
                      <Line key={code} type="monotone" dataKey={code} name={code}
                        stroke={ENTITY_COLORS[i % ENTITY_COLORS.length]}
                        strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {allCodes.length > 5 && (
                <ChartCard title="Monthly Revenue — All Entities" loading={!!loading.roll} error={!!errors.roll} height={340}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pivoted} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 11 }} />
                      <Tooltip content={<USDTooltip />} />
                      {allCodes.map((code, i) => (
                        <Line key={code} type="monotone" dataKey={code} name={code}
                          stroke={ENTITY_COLORS[i % ENTITY_COLORS.length]}
                          strokeWidth={1.5} dot={false} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              <ChartCard title="Month-over-Month Revenue Change (Latest Period)" loading={!!loading.mom} error={!!errors.mom} height={340}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={mom} margin={{ top: 0, right: 20, bottom: 0, left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="subsidiary_code" tick={{ fontSize: 11 }} width={50} />
                    <Tooltip content={<USDTooltip />} />
                    <ReferenceLine x={0} stroke="var(--color-border)" />
                    <Bar dataKey="revenue_delta" name="Revenue Δ">
                      {mom.map((entry, i) => (
                        <Cell key={i} fill={entry.revenue_delta >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* MoM table */}
              {mom.length > 0 && (
                <div className="card">
                  <div className="card-title">MoM Detail</div>
                  <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead><tr><th>Entity</th><th style={{ textAlign: 'right' }}>Current</th><th style={{ textAlign: 'right' }}>Prior</th><th style={{ textAlign: 'right' }}>Δ Revenue</th><th style={{ textAlign: 'right' }}>Δ %</th></tr></thead>
                      <tbody>
                        {mom.map((r) => (
                          <tr key={r.subsidiary_code}>
                            <td style={{ fontWeight: 500 }}>{r.subsidiary_name}</td>
                            <td style={{ textAlign: 'right' }}>{fmtM(r.current_revenue)}</td>
                            <td style={{ textAlign: 'right' }}>{fmtM(r.prior_revenue)}</td>
                            <td style={{ textAlign: 'right', color: r.revenue_delta >= 0 ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
                              {r.revenue_delta >= 0 ? '+' : ''}{fmtM(r.revenue_delta)}
                            </td>
                            <td style={{ textAlign: 'right', color: (r.revenue_delta_pct ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                              {r.revenue_delta_pct != null ? `${r.revenue_delta_pct >= 0 ? '+' : ''}${r.revenue_delta_pct.toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab 3: Cost Anatomy ─────────────────────────────────────────── */}
          {tab === 'costs' && (
            <>
              {/* Account prefix toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Top accounts:</span>
                {[['', 'All'], ['4', 'Revenue'], ['5', 'COGS'], ['6', 'OpEx'], ['7', 'Other']].map(([prefix, label]) => (
                  <button key={label} className={`btn btn-sm ${acctPrefix === prefix ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setAcctPrefix(prefix)}>
                    {label}
                  </button>
                ))}
              </div>

              <ChartCard title="Top 20 GL Accounts by Absolute Volume" loading={!!loading.top} error={!!errors.top} height={440}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topAccts} margin={{ top: 0, right: 20, bottom: 0, left: 160 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="gl_account_no" tick={{ fontSize: 10 }} width={60} />
                    <Tooltip content={<USDTooltip />} />
                    <Bar dataKey="abs_amount" name="Absolute Volume">
                      {topAccts.map((row, i) => (
                        <Cell key={i} fill={
                          row.gl_account_no.startsWith('4') ? '#3b82f6'
                          : row.gl_account_no.startsWith('5') ? '#f97316'
                          : row.gl_account_no.startsWith('6') ? '#ef4444'
                          : row.gl_account_no.startsWith('1') ? '#10b981'
                          : row.gl_account_no.startsWith('2') ? '#f59e0b'
                          : '#94a3b8'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ChartCard title="Department Spend (Top 15)" loading={!!loading.dept} error={!!errors.dept} height={340}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={deptHeat.slice(0, 15)} margin={{ top: 0, right: 20, bottom: 0, left: 110 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="department_code" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip content={<USDTooltip />} />
                      <Legend />
                      <Bar dataKey="cogs" name="COGS" fill="#f97316" stackId="s" />
                      <Bar dataKey="opex" name="OpEx" fill="#ef4444" stackId="s" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Transaction Type Mix" loading={!!loading.doc} error={!!errors.doc} height={340}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={docMix} dataKey="entry_count" nameKey="document_type" cx="50%" cy="45%" outerRadius={110} innerRadius={55} label={({ name, pct_of_entries }) => `${name} ${pct_of_entries}%`} labelLine={false}>
                        {docMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v.toLocaleString()} entries`]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </>
          )}

          {/* ── Tab 4: Verticals / Business Units ──────────────────────────── */}
          {tab === 'verticals' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <ChartCard title="Revenue & OpEx by Vertical" loading={!!loading.vert} error={!!errors.vert} height={400}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={verticals} margin={{ top: 8, right: 20, bottom: 60, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="vertical_code" tick={{ fontSize: 9 } as React.SVGProps<SVGTextElement>} angle={-35} textAnchor="end" />
                      <YAxis tickFormatter={(v) => fmtM(v)} tick={{ fontSize: 10 }} />
                      <Tooltip content={<USDTooltip />} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" />
                      <Bar dataKey="cogs"    name="COGS"    fill="#f97316" />
                      <Bar dataKey="opex"    name="OpEx"    fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Revenue Share by Vertical" loading={!!loading.vert} error={!!errors.vert} height={400}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={verticals.filter((v) => v.revenue > 0)}
                        dataKey="revenue" nameKey="vertical_code"
                        cx="50%" cy="45%" outerRadius={120} innerRadius={60}
                      >
                        {verticals.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmtM(v), 'Revenue']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Vertical table */}
              {verticals.length > 0 && (
                <div className="card">
                  <div className="card-title">Vertical P&L Summary</div>
                  <div className="table-wrap">
                    <table style={{ fontSize: 13 }}>
                      <thead>
                        <tr><th>Vertical</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>COGS</th><th style={{ textAlign: 'right' }}>OpEx</th><th style={{ textAlign: 'right' }}>Net</th><th style={{ textAlign: 'right' }}>Entities</th><th style={{ textAlign: 'right' }}>Entries</th></tr>
                      </thead>
                      <tbody>
                        {verticals.map((v) => {
                          const net = v.revenue - v.cogs - v.opex;
                          return (
                            <tr key={v.vertical_code}>
                              <td style={{ fontWeight: 500 }}>{v.vertical_code}</td>
                              <td style={{ textAlign: 'right' }}>{fmtM(v.revenue)}</td>
                              <td style={{ textAlign: 'right' }}>{fmtM(v.cogs)}</td>
                              <td style={{ textAlign: 'right' }}>{fmtM(v.opex)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: net >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{fmtM(net)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{v.entity_count}</td>
                              <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{v.entry_count.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
