/**
 * Thin API client — all calls go to the FastAPI backend (port 8000).
 * Falls back to mock data when the API is unreachable so the scaffold
 * still renders without a running backend.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EntitySummary {
  code: string;
  name: string;
  revenue: number;
  expenses: number;
  net_income: number;
  entry_count: number;
}

export interface KPIs {
  total_revenue: number;
  total_cogs: number;
  total_opex: number;
  total_assets: number;
  total_liabilities: number;
  entity_count: number;
  total_entries: number;
}

export interface PLTrend {
  month: string;
  revenue: number;
  expenses: number;
}

export interface EntityDetail {
  code: string;
  name: string;
  revenue: number;
  cogs: number;
  opex: number;
  total_assets: number;
  total_liabilities: number;
  entry_count: number;
  earliest_date: string;
  latest_date: string;
}

export interface TrialBalanceLine {
  gl_account_no: string;
  gl_account_name: string | null;
  debit: number;
  credit: number;
  net_balance: number;
}

export interface GLEntry {
  id: number;
  subsidiary_code: string;
  subsidiary_name: string;
  posting_date: string;
  document_type: string | null;
  document_no: string | null;
  gl_account_no: string;
  gl_account_name: string | null;
  description: string | null;
  customer_or_vendor_name: string | null;
  department_code: string | null;
  vertical_code: string | null;
  amount: number;
  bal_account_type: string | null;
  bal_account_no: string | null;
  source_code: string | null;
  entry_no: number | null;
  external_document_no: string | null;
}

export interface GLStats {
  code: string;
  name: string;
  total_entries: number;
  date_from: string;
  date_to: string;
  net_amount: number;
}

// ── Analytics types ───────────────────────────────────────────────────────────

export interface PLWaterfallRow {
  month: string; revenue: number; cogs: number; opex: number;
  other_income: number; tax: number; net_income: number;
}
export interface EntityContributionRow {
  subsidiary_code: string; subsidiary_name: string;
  revenue: number; cogs: number; opex: number;
  gross_margin_pct: number | null; revenue_share_pct: number;
}
export interface RollingTrendRow {
  subsidiary_code: string; subsidiary_name: string;
  month: string; revenue: number; expenses: number;
}
export interface DeptHeatmapRow {
  department_code: string; vertical_code: string | null;
  month: string; cogs: number; opex: number;
  total_spend: number; entry_count: number;
}
export interface TopAccountRow {
  gl_account_no: string; gl_account_name: string | null;
  display_amount: number; abs_amount: number;
  entry_count: number; entity_count: number;
}
export interface DocTypeMixRow {
  document_type: string; entry_count: number;
  total_absolute_value: number; pct_of_entries: number;
}
export interface SuspenseRow {
  subsidiary_code: string; subsidiary_name: string;
  entry_count: number; net_balance: number;
  earliest: string; latest: string;
}
export interface MoMChangeRow {
  subsidiary_code: string; subsidiary_name: string;
  current_revenue: number; prior_revenue: number;
  revenue_delta: number; revenue_delta_pct: number | null;
  current_opex: number; prior_opex: number; opex_delta: number;
}
export interface VerticalPLRow {
  vertical_code: string; revenue: number; cogs: number;
  opex: number; entry_count: number; entity_count: number;
}
export interface AccountSummaryRow {
  category: string; account_count: number; entry_count: number;
  raw_sum: number; display_amount: number;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  dashboard: {
    kpis: () => get<KPIs>('/api/dashboard/kpis'),
    entities: () => get<EntitySummary[]>('/api/dashboard/entities'),
    plTrend: () => get<PLTrend[]>('/api/dashboard/pl-trend'),
    departments: () => get<{ department_code: string; vertical_code: string; total_amount: number }[]>('/api/dashboard/departments'),
  },
  entities: {
    list: () => get<{ code: string; name: string }[]>('/api/entities/'),
    summary: (code: string) => get<EntityDetail>(`/api/entities/${code}/summary`),
    trialBalance: (code: string) => get<TrialBalanceLine[]>(`/api/entities/${code}/trial-balance`),
    glEntries: (code: string, limit = 200, offset = 0) =>
      get<GLEntry[]>(`/api/entities/${code}/gl-entries?limit=${limit}&offset=${offset}`),
    plByAccount: (code: string) =>
      get<{ gl_account_no: string; gl_account_name: string; department_code: string; total_amount: number }[]>(
        `/api/entities/${code}/pl-by-account`
      ),
  },
  analytics: {
    plWaterfall: (subsidiary?: string) =>
      get<PLWaterfallRow[]>(`/api/analytics/pl-waterfall${subsidiary ? `?subsidiary=${subsidiary}` : ''}`),
    entityContribution: () => get<EntityContributionRow[]>('/api/analytics/entity-contribution'),
    rollingTrend: (subsidiary?: string) =>
      get<RollingTrendRow[]>(`/api/analytics/rolling-trend${subsidiary ? `?subsidiary=${subsidiary}` : ''}`),
    deptHeatmap: (subsidiary?: string, month?: string) => {
      const qs = new URLSearchParams();
      if (subsidiary) qs.set('subsidiary', subsidiary);
      if (month) qs.set('month', month);
      const s = qs.toString();
      return get<DeptHeatmapRow[]>(`/api/analytics/department-heatmap${s ? `?${s}` : ''}`);
    },
    topAccounts: (params: { account_prefix?: string; subsidiary?: string; month?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params.account_prefix !== undefined) qs.set('account_prefix', params.account_prefix);
      if (params.subsidiary) qs.set('subsidiary', params.subsidiary);
      if (params.month) qs.set('month', params.month);
      if (params.limit) qs.set('limit', String(params.limit));
      return get<TopAccountRow[]>(`/api/analytics/top-accounts?${qs}`);
    },
    docTypeMix: (subsidiary?: string, month?: string) => {
      const qs = new URLSearchParams();
      if (subsidiary) qs.set('subsidiary', subsidiary);
      if (month) qs.set('month', month);
      const s = qs.toString();
      return get<DocTypeMixRow[]>(`/api/analytics/doc-type-mix${s ? `?${s}` : ''}`);
    },
    suspenseMonitor: () => get<SuspenseRow[]>('/api/analytics/suspense-monitor'),
    momChange: (currentMonth?: string, priorMonth?: string) => {
      const qs = new URLSearchParams();
      if (currentMonth) qs.set('current_month', currentMonth);
      if (priorMonth) qs.set('prior_month', priorMonth);
      const s = qs.toString();
      return get<MoMChangeRow[]>(`/api/analytics/mom-change${s ? `?${s}` : ''}`);
    },
    verticalPL: (subsidiary?: string) =>
      get<VerticalPLRow[]>(`/api/analytics/vertical-pl${subsidiary ? `?subsidiary=${subsidiary}` : ''}`),
    accountSummary: (subsidiary?: string) =>
      get<AccountSummaryRow[]>(`/api/analytics/account-summary${subsidiary ? `?subsidiary=${subsidiary}` : ''}`),
  },
  gl: {
    entries: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return get<GLEntry[]>(`/api/gl/entries?${qs}`);
    },
    stats: () => get<GLStats[]>('/api/gl/stats'),
    accounts: () => get<{ gl_account_no: string; gl_account_name: string | null; entity_count: number; total_amount: number }[]>('/api/gl/accounts'),
  },
};
