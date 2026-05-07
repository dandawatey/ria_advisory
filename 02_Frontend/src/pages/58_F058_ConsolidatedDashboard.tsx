/**
 * F058 — Consolidated Multi-ERP Dashboard
 * Aggregated KPIs + trend + per-source breakdown across all ERP data sources.
 * ERP-DS-002 | Agent: Ananya_Frontend_004
 */
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { get } from '../api/client';
import { FreshnessIndicator } from '../components/erp/FreshnessIndicator';
import PageExplainer from '../components/common/PageExplainer';

interface ConsolidatedSummary {
  total_revenue: number;
  total_cogs: number;
  total_opex: number;
  gross_profit: number;
  ebitda: number;
  erp_sources_count: number;
  period: string;
}

interface TrendRow {
  period: string;
  revenue: number;
  ebitda: number;
}

interface SourceRow {
  erp_source_id: number;
  erp_name: string;
  revenue: number;
  ebitda: number;
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtM(n: number): string {
  const abs = Math.abs(n), s = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`;
  return `${s}$${abs.toFixed(0)}`;
}
function pct(a: number, b: number): string {
  if (!b) return '—';
  return `${((a / b) * 100).toFixed(1)}%`;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 150,
      borderTop: accent ? `3px solid ${accent}` : undefined,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function ConsolidatedDashboard() {
  const [summary,  setSummary]  = useState<ConsolidatedSummary | null>(null);
  const [trend,    setTrend]    = useState<TrendRow[]>([]);
  const [bySource, setBySource] = useState<SourceRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [fromDate, setFromDate] = useState('2022-01-01');
  const [toDate,   setToDate]   = useState('2024-12-31');

  useEffect(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError('');
    Promise.all([
      get<ConsolidatedSummary>(`/api/erp/consolidated/summary?from_date=${fromDate}&to_date=${toDate}`),
      get<TrendRow[]>(`/api/erp/consolidated/trend?from_date=${fromDate}&to_date=${toDate}`),
      get<SourceRow[]>(`/api/erp/consolidated/by-source?from_date=${fromDate}&to_date=${toDate}`),
    ])
      .then(([s, t, b]) => {
        setSummary(s);
        setTrend(t);
        setBySource(b);
      })
      .catch(() => setError('Could not load dashboard — check backend connection'))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const totalRevForPie = bySource.reduce((s, r) => s + r.revenue, 0);

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
    borderRadius: 6, color: 'var(--color-text)', padding: '5px 10px', fontSize: 13,
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Consolidated Dashboard</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Aggregated financials across all ERP data sources
          </p>
        </div>
        <FreshnessIndicator />
      </div>

      <PageExplainer
        icon="🏦"
        title="What is the Consolidated Dashboard?"
        description="This page shows <strong>group-wide financial KPIs aggregated across all ERP systems</strong> — Revenue, Gross Profit, EBITDA, and trends over time. Data from BC, SAP, Odoo, and other sources is normalised and combined into a single consolidated view. CFOs use this as the primary single-pane-of-glass for overall business performance."
        concepts={[
          { icon: '●', color: '#3b82f6', label: 'Revenue', desc: 'Total group revenue across all ERP sources' },
          { icon: '●', color: '#10b981', label: 'Gross Profit', desc: 'Revenue minus COGS — consolidated across all entities' },
          { icon: '●', color: '#f59e0b', label: 'EBITDA', desc: 'Operating profitability before non-cash and financing items' },
        ]}
        glossary={[
          { term: 'Consolidated', def: 'Data from all ERPs summed after normalisation and intercompany elimination' },
          { term: 'Trend', def: 'Monthly series showing how KPIs have changed over the selected date range' },
        ]}
      />

      {/* Date range */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>From:</label>
        <input type="date" style={inputStyle} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <label style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>To:</label>
        <input type="date" style={inputStyle} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        {summary && (
          <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {summary.erp_sources_count} ERP source{summary.erp_sources_count !== 1 ? 's' : ''} contributing data
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 10, color: '#dc2626', marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
          Loading consolidated data…
        </div>
      )}

      {!loading && summary && (
        <>
          {/* KPI Row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <KpiCard label="Total Revenue"  value={fmtM(summary.total_revenue)}  accent="#3b82f6" />
            <KpiCard label="Gross Profit"   value={fmtM(summary.gross_profit)}   sub={`${pct(summary.gross_profit, summary.total_revenue)} GP margin`} accent="#10b981" />
            <KpiCard label="EBITDA"         value={fmtM(summary.ebitda)}         sub={`${pct(summary.ebitda, summary.total_revenue)} EBITDA margin`} accent="#8b5cf6" />
            <KpiCard label="Total COGS"     value={fmtM(summary.total_cogs)}     sub={pct(summary.total_cogs, summary.total_revenue) + ' of revenue'} accent="#ef4444" />
            <KpiCard label="Total OpEx"     value={fmtM(summary.total_opex)}     sub={pct(summary.total_opex, summary.total_revenue) + ' of revenue'} accent="#f59e0b" />
          </div>

          {/* Charts row 1: trend */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Revenue + EBITDA trend */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Monthly Revenue &amp; EBITDA Trend</div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="ebitdaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtM(v)} width={60} />
                  <Tooltip formatter={(v: number) => fmtM(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="ebitda"  name="EBITDA"  stroke="#8b5cf6" fill="url(#ebitdaGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue mix by ERP source (pie) */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Revenue Mix by ERP Source</div>
              {bySource.length === 0 ? (
                <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={bySource}
                      dataKey="revenue"
                      nameKey="erp_name"
                      cx="50%"
                      cy="45%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={2}
                      label={({ revenue }: { revenue: number }) => `${((revenue / totalRevForPie) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {bySource.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtM(v)} />
                    <Legend
                      formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Charts row 2: per-source bar */}
          {bySource.length > 0 && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Revenue &amp; EBITDA by ERP Source</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bySource} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtM(v)} />
                  <YAxis type="category" dataKey="erp_name" tick={{ fontSize: 11 }} width={160} />
                  <Tooltip formatter={(v: number) => fmtM(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="ebitda"  name="EBITDA"  fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {!loading && !summary && !error && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
          No data found for the selected date range.
        </div>
      )}
    </div>
  );
}
