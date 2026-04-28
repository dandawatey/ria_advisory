/**
 * F037 — Balance Sheet
 * Source: v_coa_balances (1xx Assets · 2xx Liabilities · 3xx Equity)
 */
import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { get, type FilterOptions } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BSRow {
  company_name: string;
  account_no: string;
  account_name: string | null;
  account_category: string | null;
  account_subcategory: string | null;
  income_balance: string | null;
  net_change: number;
  balance: number;
}
interface BSSummary {
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  net_equity: number;
  debt_equity: number | null;
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

function accountSection(account_no: string): 'Assets' | 'Liabilities' | 'Equity' | null {
  if (account_no.startsWith('1')) return 'Assets';
  if (account_no.startsWith('2')) return 'Liabilities';
  if (account_no.startsWith('3')) return 'Equity';
  return null;
}

function KPITile({ label, value, sub, color = '#3b82f6', loading }: {
  label: string; value: string; sub?: string; color?: string; loading?: boolean;
}) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{loading ? '…' : value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const SECTION_COLORS = { Assets: '#3b82f6', Liabilities: '#ef4444', Equity: '#10b981' };

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BalanceSheet() {
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ companies: [], years: [], months: [], currencies: [] });
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [openSection, setOpenSection] = useState<string | null>('Assets');

  const [summary, setSummary] = useState<BSSummary | null>(null);
  const [rows, setRows] = useState<BSRow[]>([]);
  const [loadSummary, setLoadSummary] = useState(true);
  const [loadRows, setLoadRows] = useState(true);
  const [errRows, setErrRows] = useState(false);

  useEffect(() => {
    get<FilterOptions>('/api/analytics/filters').then(setFilterOpts).catch(() => {});
  }, []);

  const buildQS = useCallback(() => {
    const qs = new URLSearchParams();
    selectedCompanies.forEach((id) => qs.append('company_id', String(id)));
    return qs;
  }, [selectedCompanies]);

  useEffect(() => {
    setLoadSummary(true);
    get<BSSummary>(`/api/reports/balance-sheet/summary?${buildQS()}`)
      .then(setSummary).catch(() => setSummary(null)).finally(() => setLoadSummary(false));
  }, [buildQS]);

  useEffect(() => {
    setLoadRows(true); setErrRows(false);
    get<BSRow[]>(`/api/reports/balance-sheet?${buildQS()}`)
      .then(setRows).catch(() => { setErrRows(true); setRows([]); }).finally(() => setLoadRows(false));
  }, [buildQS]);

  const chip = (active: boolean) => ({
    padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#3b82f6' : 'var(--color-border)',
    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: active ? '#3b82f6' : 'inherit', fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  });

  const sectionRows = (sec: string) => rows.filter((r) => accountSection(r.account_no) === sec);
  const sectionTotal = (sec: string) => sectionRows(sec).reduce((s, r) => s + (r.balance ?? 0), 0);

  const donutData = [
    { name: 'Assets',      value: Math.abs(summary?.total_assets ?? 0) },
    { name: 'Liabilities', value: Math.abs(summary?.total_liabilities ?? 0) },
    { name: 'Equity',      value: Math.abs(summary?.total_equity ?? 0) },
  ].filter((d) => d.value > 0);

  return (
    <div className="page-content">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Balance Sheet</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Assets · Liabilities · Equity — 1xx / 2xx / 3xx accounts
        </div>
      </div>

      {/* Filter Panel */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entity</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button onClick={() => setSelectedCompanies([])} style={chip(selectedCompanies.length === 0)}>All</button>
          {filterOpts.companies.map((c) => (
            <button key={c.company_id} onClick={() => {
              setSelectedCompanies((prev) =>
                prev.includes(c.company_id) ? prev.filter((x) => x !== c.company_id) : [...prev, c.company_id]
              );
            }} style={chip(selectedCompanies.includes(c.company_id))}>
              {c.company_name}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
        <KPITile label="Total Assets"      value={fmt(summary?.total_assets)}      color="#3b82f6" loading={loadSummary} />
        <KPITile label="Total Liabilities" value={fmt(Math.abs(summary?.total_liabilities ?? 0))} color="#ef4444" loading={loadSummary} />
        <KPITile label="Total Equity"      value={fmt(summary?.total_equity)}       color="#10b981" loading={loadSummary} />
        <KPITile label="Net Equity"        value={fmt(summary?.net_equity)}         color="#8b5cf6" loading={loadSummary} />
        <KPITile label="Debt / Equity"     value={summary?.debt_equity != null ? `${summary.debt_equity.toFixed(2)}×` : '—'} color="#f59e0b" loading={loadSummary} />
      </div>

      {/* Chart + Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'start' }}>

        {/* Accordion Sections */}
        <div>
          {(['Assets', 'Liabilities', 'Equity'] as const).map((sec) => {
            const open  = openSection === sec;
            const total = sectionTotal(sec);
            const color = SECTION_COLORS[sec];
            return (
              <div key={sec} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
                {/* Section Header */}
                <button
                  onClick={() => setOpenSection(open ? null : sec)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    borderLeft: `4px solid ${color}`,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14, color }}>{sec}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{fmt(total)}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{open ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Account Rows */}
                {open && (
                  <div style={{ overflowX: 'auto' }}>
                    {loadRows ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
                    ) : errRows ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-error)' }}>Failed to load</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600 }}>Account No</th>
                            <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600 }}>Account Name</th>
                            <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600 }}>Subcategory</th>
                            <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>Net Change</th>
                            <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionRows(sec).map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '5px 12px', fontFamily: 'monospace' }}>{r.account_no}</td>
                              <td style={{ padding: '5px 12px' }}>{r.account_name ?? '—'}</td>
                              <td style={{ padding: '5px 12px', color: 'var(--color-text-muted)' }}>{r.account_subcategory ?? '—'}</td>
                              <td style={{ padding: '5px 12px', textAlign: 'right', color: r.net_change < 0 ? '#ef4444' : 'inherit' }}>{fmt(r.net_change)}</td>
                              <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(r.balance)}</td>
                            </tr>
                          ))}
                          <tr style={{ background: 'var(--color-surface-alt)', borderTop: '2px solid var(--color-border)', fontWeight: 700 }}>
                            <td colSpan={4} style={{ padding: '6px 12px' }}>Total {sec}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', color }}>{fmt(total)}</td>
                          </tr>
                          {sectionRows(sec).length === 0 && (
                            <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</td></tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Donut Chart */}
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-title">Composition</div>
          {donutData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={SECTION_COLORS[entry.name as keyof typeof SECTION_COLORS] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {donutData.map((d) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SECTION_COLORS[d.name as keyof typeof SECTION_COLORS], display: 'inline-block' }} />
                      {d.name}
                    </span>
                    <strong>{fmt(d.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>No data</div>
          )}
        </div>
      </div>
    </div>
  );
}
