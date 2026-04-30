/**
 * F057 — Cross-ERP P&L Comparison
 * Side-by-side P&L across multiple ERP data sources.
 * ERP-DS-001 | Agent: Ananya_Frontend_004
 */
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { get } from '../api/client';
import { FreshnessIndicator } from '../components/erp/FreshnessIndicator';

interface ERPSource {
  erp_source_id: number;
  erp_type: string;
  display_name: string;
}

interface PLRow {
  erp_source_id: number;
  erp_name: string;
  period: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  opex: number;
  ebitda: number;
}

interface PLSummary {
  total_revenue: number;
  total_cogs: number;
  total_opex: number;
  total_gross_profit: number;
  total_ebitda: number;
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

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 8, padding: '14px 18px', flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function CrossERPPL() {
  const [sources,    setSources]    = useState<ERPSource[]>([]);
  const [plRows,     setPlRows]     = useState<PLRow[]>([]);
  const [summary,    setSummary]    = useState<PLSummary | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [fromDate,   setFromDate]   = useState('2022-01-01');
  const [toDate,     setToDate]     = useState('2024-12-31');
  const [activeTab,  setActiveTab]  = useState<'chart' | 'table'>('chart');

  useEffect(() => {
    get<ERPSource[]>('/api/erp/sources').then(setSources).catch(() => {});
  }, []);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError('');
    Promise.all([
      get<PLRow[]>(`/api/erp/cross-erp/pl?from_date=${fromDate}&to_date=${toDate}`),
      get<PLSummary>(`/api/erp/cross-erp/pl/summary?from_date=${fromDate}&to_date=${toDate}`),
    ])
      .then(([rows, sum]) => {
        setPlRows(rows);
        setSummary(sum);
      })
      .catch(() => setError('Could not load P&L data — check backend connection'))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  // Build chart data: group by period, one key per ERP source
  const erpNames = [...new Set(plRows.map((r) => r.erp_name))];
  const chartData = [...new Set(plRows.map((r) => r.period))].sort().map((period) => {
    const entry: Record<string, unknown> = { period };
    erpNames.forEach((name) => {
      const row = plRows.find((r) => r.period === period && r.erp_name === name);
      entry[`${name}_rev`]    = row?.revenue ?? 0;
      entry[`${name}_ebitda`] = row?.ebitda  ?? 0;
    });
    return entry;
  });

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
    borderRadius: 6, color: 'var(--color-text)', padding: '5px 10px', fontSize: 13,
  };

  const TAB: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    background: 'none',
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Cross-ERP P&amp;L Comparison</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Revenue, Gross Profit and EBITDA across all connected ERP sources
          </p>
        </div>
        <FreshnessIndicator compact />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>From:</label>
        <input type="date" style={inputStyle} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <label style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>To:</label>
        <input type="date" style={inputStyle} value={toDate} onChange={(e) => setToDate(e.target.value)} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            style={{ ...TAB, background: activeTab === 'chart' ? 'var(--color-primary)' : 'none', color: activeTab === 'chart' ? '#fff' : 'var(--color-text)' }}
            onClick={() => setActiveTab('chart')}
            aria-pressed={activeTab === 'chart'}
          >
            Chart
          </button>
          <button
            style={{ ...TAB, background: activeTab === 'table' ? 'var(--color-primary)' : 'none', color: activeTab === 'table' ? '#fff' : 'var(--color-text)' }}
            onClick={() => setActiveTab('table')}
            aria-pressed={activeTab === 'table'}
          >
            Table
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 10, color: '#dc2626', marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPI cards */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <KpiCard label="Total Revenue"      value={fmtM(summary.total_revenue)} />
          <KpiCard label="Gross Profit"       value={fmtM(summary.total_gross_profit)} sub={pct(summary.total_gross_profit, summary.total_revenue) + ' GP margin'} />
          <KpiCard label="EBITDA"             value={fmtM(summary.total_ebitda)} sub={pct(summary.total_ebitda, summary.total_revenue) + ' EBITDA margin'} />
          <KpiCard label="Total COGS"         value={fmtM(summary.total_cogs)} />
          <KpiCard label="Total OpEx"         value={fmtM(summary.total_opex)} />
          <KpiCard label="ERP Sources"        value={String(sources.length)} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          Loading P&L data…
        </div>
      )}

      {/* Chart tab */}
      {!loading && activeTab === 'chart' && chartData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Revenue by ERP per month */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Monthly Revenue by ERP Source</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtM(v)} width={55} />
                <Tooltip formatter={(v: number) => fmtM(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {erpNames.map((name, i) => (
                  <Bar key={name} dataKey={`${name}_rev`} name={`${name} Revenue`} fill={COLORS[i % COLORS.length]} stackId="a" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* EBITDA by ERP per month */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Monthly EBITDA by ERP Source</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtM(v)} width={55} />
                <Tooltip formatter={(v: number) => fmtM(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {erpNames.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={`${name}_ebitda`} name={`${name} EBITDA`} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table tab */}
      {!loading && activeTab === 'table' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          {plRows.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No P&L data for the selected period.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                    {['Period', 'ERP Source', 'Revenue', 'COGS', 'Gross Profit', 'GP%', 'OpEx', 'EBITDA', 'EBITDA%'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Period' || h === 'ERP Source' ? 'left' : 'right', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11 }}>{row.period}</td>
                      <td style={{ padding: '7px 12px', fontWeight: 500 }}>{row.erp_name}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right' }}>{fmtM(row.revenue)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#ef4444' }}>{fmtM(row.cogs)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right' }}>{fmtM(row.gross_profit)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#10b981' }}>{pct(row.gross_profit, row.revenue)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#f59e0b' }}>{fmtM(row.opex)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600 }}>{fmtM(row.ebitda)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#3b82f6' }}>{pct(row.ebitda, row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && plRows.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          No P&L data found for the selected date range.
        </div>
      )}
    </div>
  );
}
