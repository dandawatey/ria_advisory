/**
 * F026 — GL Data Insights
 * Surfaces completeness gaps, expense analysis, and account naming quality
 * from the 188,380-row gl_unified table.
 *
 * Tab 1 — Completeness  : scorecard tiles, gap chart, monthly volume, entity coverage
 * Tab 2 — Expenses      : COGS vs OpEx totals, top-30 expense accounts chart + table
 * Tab 3 — Account Names : named vs unnamed breakdown, top unnamed accounts table
 */
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  api,
  type CompletenessSummary,
  type EntityCoverageRow,
  type MonthlyVolumeRow,
  type ExpenseAccountRow,
  type AccountSummaryRow,
} from '../api/client';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  Math.abs(n) >= 1e9
    ? `$${(n / 1e9).toFixed(2)}B`
    : Math.abs(n) >= 1e6
    ? `$${(n / 1e6).toFixed(1)}M`
    : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const pct = (num: number, den: number) =>
  den === 0 ? '0%' : `${((num / den) * 100).toFixed(1)}%`;

// Partial-month thresholds — months with <10k entries in this dataset
const PARTIAL_MONTHS = new Set(['2025-05', '2026-03', '2026-04']);

const ACCOUNT_PREFIX_COLOR: Record<string, string> = {
  '5': '#f97316', // orange — COGS
  '6': '#8b5cf6', // purple — OpEx
};

function accountColor(no: string) {
  return ACCOUNT_PREFIX_COLOR[no[0]] ?? '#94a3b8';
}

// ── sub-components ────────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string; subtitle?: string;
  loading: boolean; error: boolean;
  height?: number; children: React.ReactNode;
}
function ChartCard({ title, subtitle, loading, error, height = 280, children }: ChartCardProps) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{subtitle}</div>}
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
          Loading…
        </div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>
          Failed to load
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name}>{p.name}: {Number(p.value).toLocaleString()} entries</div>
      ))}
    </div>
  );
}

// ── Tile ─────────────────────────────────────────────────────────────────────

interface TileProps {
  label: string; value: string;
  sub?: string; severity?: 'ok' | 'warn' | 'error';
}
function Tile({ label, value, sub, severity = 'ok' }: TileProps) {
  const colors = { ok: 'var(--color-success)', warn: 'var(--color-warning)', error: 'var(--color-error)' };
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: colors[severity] }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

type Tab = 'completeness' | 'expenses' | 'naming';

export default function DataInsights() {
  const [tab, setTab] = useState<Tab>('completeness');

  const [summary, setSummary] = useState<CompletenessSummary | null>(null);
  const [coverage, setCoverage] = useState<EntityCoverageRow[]>([]);
  const [volume, setVolume] = useState<MonthlyVolumeRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseAccountRow[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummaryRow[]>([]);

  const [loading, setLoading] = useState({ summary: true, coverage: true, volume: true, expenses: true, acct: true });
  const [errors, setErrors] = useState({ summary: false, coverage: false, volume: false, expenses: false, acct: false });

  useEffect(() => {
    api.analytics.completenessSummary()
      .then(setSummary)
      .catch(() => setErrors((e) => ({ ...e, summary: true })))
      .finally(() => setLoading((l) => ({ ...l, summary: false })));

    api.analytics.entityCoverage()
      .then(setCoverage)
      .catch(() => setErrors((e) => ({ ...e, coverage: true })))
      .finally(() => setLoading((l) => ({ ...l, coverage: false })));

    api.analytics.monthlyVolume()
      .then(setVolume)
      .catch(() => setErrors((e) => ({ ...e, volume: true })))
      .finally(() => setLoading((l) => ({ ...l, volume: false })));

    api.analytics.expenseAccounts()
      .then(setExpenses)
      .catch(() => setErrors((e) => ({ ...e, expenses: true })))
      .finally(() => setLoading((l) => ({ ...l, expenses: false })));

    api.analytics.accountSummary()
      .then(setAccountSummary)
      .catch(() => setErrors((e) => ({ ...e, acct: true })))
      .finally(() => setLoading((l) => ({ ...l, acct: false })));
  }, []);

  // ── derived metrics ────────────────────────────────────────────────────────

  const total = summary?.total_entries ?? 0;

  const gapChartData = summary
    ? [
        { name: 'Unnamed GL Account', affected: +((summary.unnamed_account_entries / total) * 100).toFixed(1) },
        { name: 'No Department Code', affected: +((summary.no_dept_entries / total) * 100).toFixed(1) },
        { name: 'No Vertical Code',   affected: +((summary.no_vertical_entries / total) * 100).toFixed(1) },
        { name: 'Suspense (999999)',   affected: +((summary.suspense_entries / total) * 100).toFixed(1) },
      ]
    : [];

  const cogsRow  = accountSummary.find((r) => r.category === 'COGS');
  const opexRow  = accountSummary.find((r) => r.category === 'OpEx');

  // Unnamed expense accounts (for Tab 3)
  const unnamedExpenses = expenses.filter((e) => !e.gl_account_name);
  const namedExpenses   = expenses.filter((e) =>  e.gl_account_name);

  // Named vs unnamed per category from accountSummary — we need a different breakdown
  // Use expense data to build named/unnamed split for account naming tab
  const namingData = [
    { category: 'COGS (5xx)', named: namedExpenses.filter(e => e.gl_account_no[0] === '5').length, unnamed: unnamedExpenses.filter(e => e.gl_account_no[0] === '5').length },
    { category: 'OpEx (6xx)', named: namedExpenses.filter(e => e.gl_account_no[0] === '6').length, unnamed: unnamedExpenses.filter(e => e.gl_account_no[0] === '6').length },
  ];

  // Income Tax misclassification flag
  const incomeTaxInOpex = expenses.find((e) => e.gl_account_no === '601201');

  // Max monthly volume for chart scale
  const maxVolume = Math.max(...volume.map((v) => v.entry_count), 1);

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">GL Data Insights</h1>
          <p className="page-subtitle">
            {total > 0
              ? `${total.toLocaleString()} GL entries · ${coverage.length} subsidiaries · May 2025 – Apr 2026`
              : 'Loading…'}
          </p>
        </div>
      </div>

      {/* ── Top KPI row (always visible) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <Tile
          label="Total GL Entries"
          value={total > 0 ? total.toLocaleString() : '…'}
          sub="17 subsidiaries"
          severity="ok"
        />
        <Tile
          label="Unnamed Account Entries"
          value={summary ? pct(summary.unnamed_account_entries, total) : '…'}
          sub={summary ? `${summary.unnamed_account_entries.toLocaleString()} entries affected` : undefined}
          severity="error"
        />
        <Tile
          label="Missing Dept / Vertical"
          value={summary ? pct(summary.no_dept_entries, total) : '…'}
          sub={summary ? `${summary.no_dept_entries.toLocaleString()} entries without dept code` : undefined}
          severity="warn"
        />
        <Tile
          label="Suspense Net Balance"
          value={summary ? fmt(summary.suspense_net) : '…'}
          sub={summary ? `${summary.suspense_entries.toLocaleString()} suspense entries` : undefined}
          severity={summary && Math.abs(summary.suspense_net) < 1 ? 'ok' : 'warn'}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {([
          ['completeness', 'Completeness & Coverage'],
          ['expenses',     'Expense Intelligence'],
          ['naming',       'Account Naming Quality'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — COMPLETENESS                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'completeness' && (
        <>
          {/* Completeness gap bar chart */}
          <ChartCard
            title="Data Completeness Gaps"
            subtitle="% of total GL entries affected by each quality issue"
            loading={loading.summary}
            error={errors.summary}
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gapChartData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 140 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
                <Tooltip formatter={(v) => [`${v}%`, 'Affected']} />
                <Bar dataKey="affected" name="% Affected" radius={[0, 4, 4, 0]}>
                  {gapChartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.affected > 50
                          ? 'var(--color-error)'
                          : entry.affected > 10
                          ? 'var(--color-warning)'
                          : 'var(--color-success)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Monthly volume bar chart */}
          <ChartCard
            title="Monthly Entry Volume"
            subtitle="Partial months highlighted — May 2025 (period open), Mar–Apr 2026 (recent/open)"
            loading={loading.volume}
            error={errors.volume}
            height={240}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volume} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10 }} />
                <Tooltip content={<CountTooltip />} />
                <ReferenceLine
                  y={maxVolume * 0.5}
                  stroke="var(--color-warning)"
                  strokeDasharray="4 4"
                  label={{ value: 'Partial threshold', position: 'insideTopRight', fontSize: 10, fill: 'var(--color-warning)' }}
                />
                <Bar dataKey="entry_count" name="Entries" radius={[3, 3, 0, 0]}>
                  {volume.map((row) => (
                    <Cell
                      key={row.month}
                      fill={PARTIAL_MONTHS.has(row.month) ? 'var(--color-warning)' : 'var(--color-primary)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Entity coverage table */}
          <div className="card">
            <div className="card-title">Entity Coverage Matrix</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Coverage % = months with data out of 12 possible (May 2025 – Apr 2026)
            </div>
            <div className="table-wrap">
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Subsidiary</th>
                    <th style={{ textAlign: 'center' }}>Months</th>
                    <th>Date Range</th>
                    <th style={{ textAlign: 'right' }}>Entries</th>
                    <th style={{ minWidth: 160 }}>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {loading.coverage ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                  ) : coverage.map((row) => {
                    const cpct = Number(row.coverage_pct);
                    const fillClass = cpct >= 90 ? 'progress-fill-success' : cpct >= 60 ? 'progress-fill-warning' : 'progress-fill-error';
                    const badgeClass = cpct >= 90 ? 'badge-success' : cpct >= 60 ? 'badge-warning' : 'badge-error';
                    return (
                      <tr key={row.subsidiary_code}>
                        <td className="table-mono" style={{ fontSize: 11 }}>{row.subsidiary_code}</td>
                        <td>{row.subsidiary_name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${badgeClass}`}>{row.months_present} / 12</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {row.from_date?.slice(0, 10)} → {row.to_date?.slice(0, 10)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                          {Number(row.total_entries).toLocaleString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ flex: 1 }}>
                              <div className={`progress-fill ${fillClass}`} style={{ width: `${cpct}%` }} />
                            </div>
                            <span style={{ fontSize: 11, fontFamily: 'monospace', minWidth: 36 }}>{cpct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — EXPENSE INTELLIGENCE                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'expenses' && (
        <>
          {/* COGS / OpEx tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <Tile
              label="COGS (5xx accounts)"
              value={cogsRow ? fmt(cogsRow.display_amount) : '…'}
              sub={cogsRow ? `${cogsRow.entry_count.toLocaleString()} entries · ${cogsRow.account_count} accounts` : undefined}
              severity="warn"
            />
            <Tile
              label="OpEx (6xx accounts)"
              value={opexRow ? fmt(opexRow.display_amount) : '…'}
              sub={opexRow ? `${opexRow.entry_count.toLocaleString()} entries · ${opexRow.account_count} accounts` : undefined}
              severity="warn"
            />
            <Tile
              label="COGS as % of Total Expenses"
              value={cogsRow && opexRow
                ? pct(cogsRow.display_amount, cogsRow.display_amount + opexRow.display_amount)
                : '…'}
              sub="5xx ÷ (5xx + 6xx)"
              severity="ok"
            />
          </div>

          {/* Misclassification alert */}
          {incomeTaxInOpex && (
            <div className="alert alert-warning" style={{ marginBottom: 16, fontSize: 13 }}>
              <strong>Classification Flag — Account 601201 (Income Tax Expense)</strong><br />
              {fmt(incomeTaxInOpex.total_amount)} is currently recorded in the <strong>6xx OpEx bucket</strong>.
              This is typically a tax item (8xx) and may distort OpEx totals.
              Recommend reclassifying to an 8xx account in Business Central.
            </div>
          )}

          {/* Top 30 expense accounts chart */}
          <ChartCard
            title="Top 30 Expense GL Accounts by Total Spend"
            subtitle="Orange = COGS (5xx) · Purple = OpEx (6xx) · Unnamed accounts shown as account number only"
            loading={loading.expenses}
            error={errors.expenses}
            height={520}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={expenses.map((e) => ({
                  name: e.gl_account_name ? `${e.gl_account_no} ${e.gl_account_name}` : e.gl_account_no,
                  amount: Math.abs(e.total_amount),
                  prefix: e.gl_account_no[0],
                  no: e.gl_account_no,
                }))}
                layout="vertical"
                margin={{ top: 4, right: 80, bottom: 4, left: 220 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => fmt(v)}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  width={220}
                />
                <Tooltip
                  formatter={(v) => [fmt(Number(v)), 'Total Spend']}
                />
                <Bar dataKey="amount" name="Total Spend" radius={[0, 4, 4, 0]}>
                  {expenses.map((e) => (
                    <Cell key={e.gl_account_no} fill={accountColor(e.gl_account_no)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Expense accounts table */}
          <div className="card">
            <div className="card-title">Expense Account Detail</div>
            <div className="table-wrap">
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>GL Account</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Total Spend</th>
                    <th style={{ textAlign: 'right' }}>Entries</th>
                    <th style={{ textAlign: 'right' }}>Entities</th>
                  </tr>
                </thead>
                <tbody>
                  {loading.expenses ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                  ) : expenses.map((e) => (
                    <tr key={e.gl_account_no}>
                      <td className="table-mono">{e.gl_account_no}</td>
                      <td>
                        {e.gl_account_name ?? (
                          <span className="badge badge-warning" style={{ fontSize: 10 }}>Unnamed</span>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: e.gl_account_no[0] === '5' ? '#fff7ed' : '#f5f3ff',
                            color: e.gl_account_no[0] === '5' ? '#c2410c' : '#6d28d9',
                            fontSize: 10,
                          }}
                        >
                          {e.gl_account_no[0] === '5' ? 'COGS' : 'OpEx'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmt(Math.abs(e.total_amount))}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {e.entry_count.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {e.entity_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — ACCOUNT NAMING QUALITY                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'naming' && (
        <>
          {/* Summary tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <Tile
              label="Unnamed GL Accounts (in top 30 expenses)"
              value={unnamedExpenses.length.toString()}
              sub={`out of ${expenses.length} top expense accounts`}
              severity={unnamedExpenses.length > 5 ? 'error' : 'warn'}
            />
            <Tile
              label="Entries on Unnamed Accounts"
              value={summary ? pct(summary.unnamed_account_entries, total) : '…'}
              sub={summary ? `${summary.unnamed_account_entries.toLocaleString()} entries lack GL name` : undefined}
              severity="error"
            />
            <Tile
              label="Action Required"
              value="Map in BC"
              sub="Add gl_account_name in Business Central chart of accounts"
              severity="warn"
            />
          </div>

          {/* Alert */}
          <div className="alert alert-error" style={{ marginBottom: 16, fontSize: 13 }}>
            <strong>91% of GL entries have no account name.</strong> This is the single largest data quality
            issue — it prevents meaningful account-level analysis. Root cause: GL account names are not
            exported from Business Central into the GL extract. Ensure the <em>G/L Account Name</em> field
            is included in the BC data export template.
          </div>

          {/* Named vs unnamed chart */}
          <ChartCard
            title="Named vs Unnamed Accounts — Top 30 Expense Accounts"
            subtitle="Count of GL accounts with and without names, by category"
            loading={loading.expenses}
            error={errors.expenses}
            height={200}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={namingData} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="named"   name="Named"   fill="var(--color-success)" radius={[3,3,0,0]} />
                <Bar dataKey="unnamed" name="Unnamed" fill="var(--color-error)"   radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Unnamed accounts table */}
          <div className="card">
            <div className="card-title">Unnamed Expense Accounts — Remediation List</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              These accounts need GL names added in Business Central. Sorted by total spend descending.
            </div>
            {loading.expenses ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
            ) : unnamedExpenses.length === 0 ? (
              <div className="alert alert-success">All top expense accounts are named.</div>
            ) : (
              <div className="table-wrap">
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>GL Account No</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Total Spend</th>
                      <th style={{ textAlign: 'right' }}>Entries</th>
                      <th style={{ textAlign: 'right' }}>Entities Using It</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unnamedExpenses.map((e, i) => (
                      <tr key={e.gl_account_no}>
                        <td style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td className="table-mono" style={{ fontWeight: 700 }}>{e.gl_account_no}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: e.gl_account_no[0] === '5' ? '#fff7ed' : '#f5f3ff',
                              color: e.gl_account_no[0] === '5' ? '#c2410c' : '#6d28d9',
                              fontSize: 10,
                            }}
                          >
                            {e.gl_account_no[0] === '5' ? 'COGS (5xx)' : 'OpEx (6xx)'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {fmt(Math.abs(e.total_amount))}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {e.entry_count.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {e.entity_count}
                        </td>
                        <td>
                          <span className="badge badge-warning" style={{ fontSize: 10 }}>Add name in BC</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* All account summary for context */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Account Category Summary</div>
            <div className="table-wrap">
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Distinct Accounts</th>
                    <th style={{ textAlign: 'right' }}>Entries</th>
                    <th style={{ textAlign: 'right' }}>Display Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading.acct ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
                  ) : accountSummary.map((r) => (
                    <tr key={r.category}>
                      <td><span className="badge badge-info" style={{ fontSize: 10 }}>{r.category}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.account_count.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.entry_count.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.display_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
