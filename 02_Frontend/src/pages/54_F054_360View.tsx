import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PageExplainer from '../components/common/PageExplainer';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const COLORS = ['#0F3F3C', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#E8443B'];

function fmt(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// Animated number counter hook
function useCountUp(value: string, duration = 800) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Only animate numeric values starting with $ or ending with %
    const isDollar = value.startsWith('$');
    const isPercent = value.endsWith('%');

    if (value === '—' || (!isDollar && !isPercent)) {
      setDisplay(value);
      return;
    }

    // Extract numeric part
    let rawNum: number;
    let suffix = '';
    let prefix = '';

    if (isDollar) {
      prefix = '$';
      const inner = value.slice(1);
      if (inner.endsWith('B')) { rawNum = parseFloat(inner); suffix = 'B'; }
      else if (inner.endsWith('M')) { rawNum = parseFloat(inner); suffix = 'M'; }
      else if (inner.endsWith('K')) { rawNum = parseFloat(inner); suffix = 'K'; }
      else { rawNum = parseFloat(inner); }
    } else {
      // percent
      rawNum = parseFloat(value);
      suffix = '%';
    }

    if (isNaN(rawNum)) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = rawNum * eased;

      let formatted: string;
      if (suffix === 'B' || suffix === 'M') {
        formatted = `${prefix}${current.toFixed(2)}${suffix}`;
      } else if (suffix === 'K') {
        formatted = `${prefix}${current.toFixed(1)}${suffix}`;
      } else if (suffix === '%') {
        formatted = `${current.toFixed(1)}%`;
      } else {
        formatted = `${prefix}${Math.round(current)}`;
      }

      setDisplay(formatted);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(value); // snap to exact final value
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return display;
}

interface KpiTileProps {
  label: string; value: string; sub?: string;
  accent?: string; onClick?: () => void;
}
function KpiTile({ label, value, sub, accent, onClick }: KpiTileProps) {
  const animatedValue = useCountUp(value);

  return (
    <motion.div
      variants={itemVariants}
      layout
      whileHover={{ scale: 1.025, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 10, padding: '18px 22px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.08)', flex: 1, minWidth: 160,
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `4px solid ${accent ?? '#e5e7eb'}`,
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? '#111827' }}>{animatedValue}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </motion.div>
  );
}

interface PanelProps {
  title: string; subtitle?: string; icon: string;
  linkTo: string; linkLabel: string;
  children: React.ReactNode;
  index?: number;
}
function Panel({ title, subtitle, icon, linkTo, linkLabel, children, index = 0 }: PanelProps) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.12 }}
      whileHover={{ y: -3, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
      style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{icon} {title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <button
          onClick={() => navigate(linkTo)}
          style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
        >{linkLabel} →</button>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </motion.div>
  );
}

export default function View360() {
  const navigate = useNavigate();
  const [kpis, setKpis]             = useState<any>(null);
  const [collections, setCollections] = useState<any>(null);
  const [investments, setInvestments] = useState<any>(null);
  const [budgets, setBudgets]         = useState<any>(null);
  const [incomeMonthly, setIncomeMonthly] = useState<any[]>([]);
  const [expenseData, setExpenseData]     = useState<any[]>([]);
  const [investByType, setInvestByType]   = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);

  const token = localStorage.getItem('ria_token') ?? '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const f = (url: string) => fetch(`${BASE}${url}`, { headers }).then(r => r.json()).catch(() => null);

    Promise.all([
      f('/api/analytics/kpi-summary'),
      f('/api/insights/collections/summary'),
      f('/api/investments/portfolio'),
      f('/api/budgets/kpis'),
      f('/api/insights/income/monthly?'),
      f('/api/budgets/by-category'),
      f('/api/investments/by-type'),
    ]).then(([k, c, inv, bud, im, bcat, itype]) => {
      setKpis(k);
      setCollections(c);
      setInvestments(inv);
      setBudgets(bud);
      setIncomeMonthly(Array.isArray(im) ? im.slice(-6) : []);
      setExpenseData(Array.isArray(bcat) ? bcat : []);
      setInvestByType(Array.isArray(itype) ? itype : []);
    }).finally(() => setLoading(false));
  }, []);

  // Revenue trend chart data (last 6 months)
  const revenueChart = incomeMonthly.map((r: any) => ({
    name: r.month_name?.slice(0, 3) ?? '',
    Revenue: Math.round((r.total_income ?? 0) / 1e6),
  }));

  // Expense by category chart
  const expenseChart = expenseData.slice(0, 5).map((r: any) => ({
    name: r.account_category,
    Budget: Math.round((r.budget_amount ?? 0) / 1e6),
    Actual: Math.round((r.actual_amount ?? 0) / 1e6),
  }));

  // Investment pie
  const pieData = investByType.map((t: any) => ({
    name: t.investment_type, value: t.total_invested,
  }));

  const TYPE_COLORS: Record<string, string> = {
    Equity: '#3b82f6', 'Fixed Income': '#10b981', Property: '#f59e0b',
    Cash: '#6b7280', Alternative: '#8b5cf6',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '28px 32px', background: '#f8fafc', minHeight: '100vh' }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: 0 }}>360° Financial View</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Unified view: Revenue · Expenses · Invoices · Investments · Budget</p>
      </div>

      <PageExplainer
        icon="🔭"
        title="What is the 360° Financial View?"
        description="This page is the <strong>unified CFO command centre</strong> — combining Revenue, Expenses, Invoices, Investments, and Budget in one animated dashboard. Instead of navigating five separate pages, the 360° view gives a single-screen overview of financial health across all dimensions. Cards are animated with staggered entry for fast visual scanning. Click any metric to drill into the detailed report."
        concepts={[
          { icon: '●', color: '#1F6B66', label: 'Revenue', desc: 'Total recognised income from GL 4xx accounts' },
          { icon: '●', color: '#E8443B', label: 'Expenses', desc: 'Operating and cost-of-sales spend from GL 5xx/6xx accounts' },
          { icon: '●', color: '#3b82f6', label: 'Investments', desc: 'Total invested capital and current portfolio value' },
          { icon: '●', color: '#f59e0b', label: 'Budget Utilisation', desc: 'Actual spend as % of approved budget for the period' },
        ]}
        glossary={[
          { term: '360° View', def: 'Single-page cross-module summary pulling from Revenue, Budget, Invoicing, UBR, and Investment APIs' },
          { term: 'KPI Card', def: 'Key Performance Indicator — one number with trend context for fast executive reading' },
        ]}
      />

      {loading && <div style={{ color: '#9ca3af', padding: 60, textAlign: 'center', fontSize: 16 }}>Loading 360° data…</div>}

      <AnimatePresence>
        {!loading && (
          <>
            {/* KPI Row — staggered container */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}
            >
              <KpiTile
                label="Revenue"
                value={kpis ? fmt(kpis.revenue ?? 0) : '—'}
                accent="#0F3F3C"
                sub="Total GL income"
                onClick={() => navigate('/pl')}
              />
              <KpiTile
                label="Expenses"
                value={kpis ? fmt(kpis.opex ?? 0) : '—'}
                accent="#E8443B"
                sub="Operating expenditure"
                onClick={() => navigate('/reports/expense')}
              />
              <KpiTile
                label="Invoices Outstanding"
                value={collections ? fmt(collections.outstanding ?? 0) : '—'}
                accent="#f59e0b"
                sub={collections ? `${collections.invoice_count} invoices` : undefined}
                onClick={() => navigate('/collections')}
              />
              <KpiTile
                label="Total Invested"
                value={investments ? fmt(investments.total_invested ?? 0) : '—'}
                accent="#3b82f6"
                sub={investments ? `${investments.holding_count} holdings` : undefined}
                onClick={() => navigate('/investments')}
              />
              <KpiTile
                label="Portfolio Return"
                value={investments ? fmt(investments.total_return ?? 0) : '—'}
                accent={investments?.total_return >= 0 ? '#10b981' : '#ef4444'}
                sub={investments?.roi_pct != null ? `${investments.roi_pct}% ROI` : undefined}
                onClick={() => navigate('/investments')}
              />
              <KpiTile
                label="Budget Utilization"
                value={budgets?.utilization_pct != null ? `${budgets.utilization_pct}%` : '—'}
                accent="#8b5cf6"
                sub={budgets ? `${fmt(budgets.total_actual)} of ${fmt(budgets.total_budget)}` : undefined}
                onClick={() => navigate('/budgeting')}
              />
            </motion.div>

            {/* Three panels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 24 }}>
              {/* Invoices / Revenue panel */}
              <Panel title="Revenue Trend" subtitle="Last 6 months · $M" icon="📄" linkTo="/pl" linkLabel="P&L" index={0}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revenueChart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(1)}M`, 'Revenue']} />
                    <Bar dataKey="Revenue" fill="#0F3F3C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {collections && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#fffbeb', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>Outstanding Invoices</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{fmt(collections.outstanding)}</div>
                  </div>
                )}
              </Panel>

              {/* Expenses panel */}
              <Panel title="Budget vs Actual" subtitle="By category · $M" icon="💸" linkTo="/budgeting" linkLabel="Budgets" index={1}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={expenseChart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, name: string) => [`$${v.toFixed(1)}M`, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Budget" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Actual" fill="#E8443B"  radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {budgets && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Variance</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: budgets.variance >= 0 ? '#10b981' : '#ef4444' }}>{fmt(budgets.variance)}</div>
                  </div>
                )}
              </Panel>

              {/* Investments panel */}
              <Panel title="Investment Portfolio" subtitle="By asset class" icon="💹" linkTo="/investments" linkLabel="Portfolio" index={2}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                      dataKey="value" nameKey="name" paddingAngle={3}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={TYPE_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmt(v), 'Invested']} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                {investments && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#eff6ff', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Total Return</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6' }}>{fmt(investments.total_return)} ({investments.roi_pct}% ROI)</div>
                  </div>
                )}
              </Panel>
            </div>

            {/* Summary strip */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Quick Links</div>
              {[
                { label: 'Collections & AR',   path: '/collections',         color: '#f59e0b' },
                { label: 'AR/AP Ageing',        path: '/ageing',              color: '#ef4444' },
                { label: 'Trial Balance',       path: '/reports/trial-balance', color: '#0F3F3C' },
                { label: 'Balance Sheet',       path: '/reports/balance-sheet', color: '#3b82f6' },
                { label: 'Cash Flow',           path: '/reports/cash-flow',   color: '#10b981' },
                { label: 'KPI Dashboard',       path: '/reports/kpi',         color: '#8b5cf6' },
                { label: 'GL Explorer',         path: '/explorer',            color: '#374151' },
              ].map(l => (
                <button key={l.path}
                  onClick={() => navigate(l.path)}
                  style={{ padding: '7px 16px', borderRadius: 20, border: `1px solid ${l.color}30`, background: `${l.color}10`, color: l.color, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {l.label}
                </button>
              ))}
            </div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
