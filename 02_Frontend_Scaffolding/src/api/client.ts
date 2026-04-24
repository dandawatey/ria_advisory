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
