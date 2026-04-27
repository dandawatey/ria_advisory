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

// ── Shared filter state type ──────────────────────────────────────────────────
export interface GLFilters {
  company_ids?: number[];   // [] or undefined = all companies
  year?: number;            // undefined = all years
  month_from?: string;      // 'YYYY-MM'
  month_to?: string;        // 'YYYY-MM'
  account_prefix?: string;  // e.g. '4' → 4xx accounts only
  gen_post_type?: string;   // document_type e.g. 'Invoice'
}

export function buildFilterQS(f?: GLFilters, extra?: Record<string, string | number>): string {
  const qs = new URLSearchParams();
  (f?.company_ids ?? []).forEach((id) => qs.append('company_id', String(id)));
  if (f?.year)            qs.set('year',           String(f.year));
  if (f?.month_from)      qs.set('month_from',     f.month_from);
  if (f?.month_to)        qs.set('month_to',       f.month_to);
  if (f?.account_prefix)  qs.set('account_prefix', f.account_prefix);
  if (f?.gen_post_type)   qs.set('doc_type',       f.gen_post_type);
  if (extra) Object.entries(extra).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ── Existing types (unchanged) ────────────────────────────────────────────────

export interface EntitySummary {
  code: string; name: string;
  revenue: number; expenses: number; net_income: number; entry_count: number;
}
export interface KPIs {
  total_revenue: number; total_cogs: number; total_opex: number;
  total_assets: number; total_liabilities: number;
  entity_count: number; total_entries: number;
}
export interface PLTrend { month: string; revenue: number; expenses: number; }
export interface EntityDetail {
  code: string; name: string; revenue: number; cogs: number; opex: number;
  total_assets: number; total_liabilities: number; entry_count: number;
  earliest_date: string; latest_date: string;
}
export interface TrialBalanceLine {
  gl_account_no: string; gl_account_name: string | null;
  debit: number; credit: number; net_balance: number;
}
export interface GLEntry {
  id: number; subsidiary_code: string; subsidiary_name: string;
  posting_date: string; document_type: string | null; document_no: string | null;
  gl_account_no: string; gl_account_name: string | null; description: string | null;
  customer_or_vendor_name: string | null; department_code: string | null;
  vertical_code: string | null; amount: number; bal_account_type: string | null;
  bal_account_no: string | null; source_code: string | null;
  entry_no: number | null; external_document_no: string | null;
}
export interface GLStats {
  code: string; name: string; total_entries: number;
  date_from: string; date_to: string; net_amount: number;
}

// ── Analytics types (star schema) ────────────────────────────────────────────

export interface FilterOptions {
  companies: { company_id: number; company_name: string }[];
  years: number[];
  months: { year: number; month: number; month_key: string; month_name: string }[];
  currencies: { currency_code: string; currency_name: string }[];
}
export interface KPISummary {
  revenue: number; cogs: number; opex: number; net_income: number;
  entry_count: number; entity_count: number;
}
export interface PLWaterfallRow {
  month: string; month_name: string;
  revenue: number; cogs: number; opex: number;
  other_income: number; tax: number; net_income: number;
}
export interface EntityContributionRow {
  company_id: number; company_name: string;
  revenue: number; cogs: number; opex: number;
  gross_margin_pct: number | null; revenue_share_pct: number;
}
export interface RollingTrendRow {
  company_id: number; company_name: string;
  month: string; month_name: string; revenue: number; expenses: number;
}
export interface DeptHeatmapRow {
  department_code: string; vertical_code: string | null;
  cogs: number; opex: number; total_spend: number; entry_count: number;
}
export interface TopAccountRow {
  gl_account_no: string; gl_account_name: string | null;
  account_category: string | null;
  display_amount: number; abs_amount: number;
  entry_count: number; entity_count: number;
}
export interface DocTypeMixRow {
  document_type: string; entry_count: number;
  total_absolute_value: number; pct_of_entries: number;
}
export interface SuspenseRow {
  company_id: number; company_name: string;
  entry_count: number; net_balance: number;
  earliest: string; latest: string;
}
export interface MoMChangeRow {
  company_id: number; company_name: string;
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
export interface CompletenessSummary {
  total_entries: number; unnamed_account_entries: number;
  no_dept_entries: number; no_vertical_entries: number;
  suspense_entries: number; suspense_net: number;
}
export interface PLYoYRow {
  year: number; revenue: number; cogs: number; opex: number;
  other_income: number; tax: number; net_income: number; entry_count: number;
}

// Collections
export interface CollectionSummary {
  total_invoiced: number; total_collected: number; total_refunded: number;
  outstanding: number; collection_rate: number;
  invoice_count: number; payment_count: number;
  customer_count: number; entity_count: number;
}
export interface CollectionMonthRow {
  month: string; month_name: string; year: number; quarter: number;
  invoiced: number; collected: number; refunded: number;
  outstanding: number; collection_rate: number;
  invoice_count: number; payment_count: number; active_customers: number;
}
export interface CollectionCustomerRow {
  customer_name: string; entity_count: number; invoice_count: number;
  invoiced: number; collected: number; refunded: number;
  outstanding: number; collection_rate: number;
}
export interface CollectionEntityRow {
  company_name: string; invoice_count: number; customer_count: number;
  invoiced: number; collected: number; outstanding: number; collection_rate: number;
}

// Monthly Income
export interface IncomeSummary {
  total_income: number; revenue: number; other_income: number;
  months_count: number; avg_monthly_income: number;
  entity_count: number; entry_count: number;
}
export interface IncomeMonthRow {
  month: string; month_name: string; year: number; quarter: number;
  total_income: number; revenue: number; other_income: number;
  entity_count: number; entry_count: number;
}
export interface IncomeAccountRow {
  account_no: string; account_name: string;
  account_category: string; account_subcategory: string;
  total_income: number; entity_count: number; entry_count: number;
}
export interface IncomeEntityRow {
  company_name: string; total_income: number; revenue: number;
  other_income: number; months_active: number; entry_count: number;
}
export interface EntityCoverageRow {
  company_id: number; company_name: string;
  months_present: number; from_date: string; to_date: string;
  total_entries: number; coverage_pct: number;
}
export interface MonthlyVolumeRow { month: string; year: number; month_num: number; entry_count: number; }
export interface ExpenseAccountRow {
  gl_account_no: string; gl_account_name: string | null;
  account_subcategory: string | null;
  total_amount: number; entry_count: number; entity_count: number;
}
export interface CurrencySplitRow {
  currency_code: string; currency_name: string;
  entity_count: number; entry_count: number;
  revenue: number; total_volume: number;
}

// Ageing
export interface AgeingSummary {
  invoice_count: number; entity_count: number; customer_count: number;
  total_outstanding: number;
  bucket_0_30: number; bucket_31_60: number; bucket_61_90: number;
  bucket_91_120: number; bucket_120_plus: number;
}
export interface AgeingCustomerRow {
  customer_name: string; invoice_count: number; entity_count: number;
  total_outstanding: number;
  bucket_0_30: number; bucket_31_60: number; bucket_61_90: number;
  bucket_91_120: number; bucket_120_plus: number;
}
export interface AgeingEntityRow {
  company_name: string; invoice_count: number; customer_count: number;
  total_outstanding: number;
  bucket_0_30: number; bucket_31_60: number; bucket_61_90: number;
  bucket_91_120: number; bucket_120_plus: number;
}

// ── Insights types ────────────────────────────────────────────────────────────

export interface CoASummary {
  total_accounts: number; active_accounts: number;
  balance_total_abs: number; income_accounts: number; expense_accounts: number;
}
export interface CoACategoryRow {
  account_category: string; account_count: number;
  balance: number; net_change: number; entry_count: number;
}
export interface CoAAccountRow {
  account_no: string; account_name: string | null;
  account_category: string; account_subcategory: string;
  company_count: number; balance_total: number;
  net_change_total: number; entry_count: number;
}
export interface CoACoverageRow {
  account_category: string; company_name: string;
  account_count: number; balance: number;
}
export interface CustomerSummary {
  total_customers: number; total_balance: number;
  total_balance_due: number; total_sales: number; avg_balance: number;
}
export interface CustomerRow {
  customer_name: string | null; company: string | null;
  city: string | null; state: string | null;
  balance: number; balance_due: number;
  total_sales: number; total_payments: number;
}
export interface CustomerByEntityRow {
  company_name: string; customer_count: number;
  total_balance: number; total_sales: number;
}
export interface CustomerGeoRow {
  city: string | null; state: string | null;
  customer_count: number; total_balance: number; total_sales: number;
}
export interface PostedSalesSummary {
  total_entries: number; total_amount: number; unique_customers: number;
  entity_count: number; invoice_count: number; payment_count: number;
}
export interface PostedSalesPeriodRow {
  month: string; month_name: string;
  invoice_amount: number; payment_amount: number;
  refund_amount: number; net_amount: number; entry_count: number;
}
export interface PostedSalesCustomerRow {
  customer_vendor_name: string; entity_count: number;
  invoice_count: number; total_invoiced: number;
  total_paid: number; net_amount: number;
}
export interface PostedSalesTypeRow {
  document_type: string; entry_count: number;
  total_amount: number; pct: number;
}
export interface InvoiceSummary {
  invoice_count: number; total_value: number;
  avg_invoice: number; entity_count: number; customer_count: number;
}
export interface InvoicePeriodRow {
  month: string; month_name: string;
  invoice_count: number; invoice_value: number; avg_invoice: number;
}
export interface InvoiceCustomerRow {
  customer_vendor_name: string; invoice_count: number;
  total_value: number; avg_invoice: number; company_name: string | null;
}
export interface InvoiceEntityRow {
  company_name: string; invoice_count: number;
  total_value: number; avg_invoice: number;
}

// helper — build QS for insights endpoints (supports repeated company_id)
export function buildInsightsQS(
  companyIds: number[],
  year: number | null,
  extra?: Record<string, string | number>,
  accountPrefix?: string,
  genPostType?: string,
): string {
  const qs = new URLSearchParams();
  companyIds.forEach((id) => qs.append('company_id', String(id)));
  if (year)           qs.set('year',           String(year));
  if (accountPrefix)  qs.set('account_prefix', accountPrefix);
  if (genPostType)    qs.set('doc_type',        genPostType);
  if (extra) Object.entries(extra).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  dashboard: {
    kpis:        () => get<KPIs>('/api/dashboard/kpis'),
    entities:    () => get<EntitySummary[]>('/api/dashboard/entities'),
    plTrend:     () => get<PLTrend[]>('/api/dashboard/pl-trend'),
    departments: () => get<{ department_code: string; vertical_code: string; total_amount: number }[]>('/api/dashboard/departments'),
  },
  entities: {
    list: () => get<{ code: string; name: string }[]>('/api/entities/'),
    summary:      (code: string) => get<EntityDetail>(`/api/entities/${code}/summary`),
    trialBalance: (code: string) => get<TrialBalanceLine[]>(`/api/entities/${code}/trial-balance`),
    glEntries:    (code: string, limit = 200, offset = 0) =>
      get<GLEntry[]>(`/api/entities/${code}/gl-entries?limit=${limit}&offset=${offset}`),
    plByAccount:  (code: string) =>
      get<{ gl_account_no: string; gl_account_name: string; department_code: string; total_amount: number }[]>(
        `/api/entities/${code}/pl-by-account`
      ),
  },
  analytics: {
    filters:         () => get<FilterOptions>('/api/analytics/filters'),
    kpiSummary:      (f?: GLFilters) => get<KPISummary>(`/api/analytics/kpi-summary${buildFilterQS(f)}`),
    plWaterfall:     (f?: GLFilters) => get<PLWaterfallRow[]>(`/api/analytics/pl-waterfall${buildFilterQS(f)}`),
    entityContribution: (f?: GLFilters) => get<EntityContributionRow[]>(`/api/analytics/entity-contribution${buildFilterQS(f)}`),
    rollingTrend:    (f?: GLFilters) => get<RollingTrendRow[]>(`/api/analytics/rolling-trend${buildFilterQS(f)}`),
    deptHeatmap:     (f?: GLFilters) => get<DeptHeatmapRow[]>(`/api/analytics/department-heatmap${buildFilterQS(f)}`),
    topAccounts:     (f?: GLFilters, prefix = '', limit = 20) =>
      get<TopAccountRow[]>(`/api/analytics/top-accounts${buildFilterQS(f, { account_prefix: prefix, limit })}`),
    docTypeMix:      (f?: GLFilters) => get<DocTypeMixRow[]>(`/api/analytics/doc-type-mix${buildFilterQS(f)}`),
    suspenseMonitor: () => get<SuspenseRow[]>('/api/analytics/suspense-monitor'),
    momChange:       (currentMonth?: string, priorMonth?: string) => {
      const qs = new URLSearchParams();
      if (currentMonth) qs.set('current_month', currentMonth);
      if (priorMonth)   qs.set('prior_month',   priorMonth);
      const s = qs.toString();
      return get<MoMChangeRow[]>(`/api/analytics/mom-change${s ? `?${s}` : ''}`);
    },
    verticalPL:      (f?: GLFilters) => get<VerticalPLRow[]>(`/api/analytics/vertical-pl${buildFilterQS(f)}`),
    accountSummary:  (f?: GLFilters) => get<AccountSummaryRow[]>(`/api/analytics/account-summary${buildFilterQS(f)}`),
    completenessSummary: () => get<CompletenessSummary>('/api/analytics/completeness-summary'),
    entityCoverage:  () => get<EntityCoverageRow[]>('/api/analytics/entity-coverage'),
    monthlyVolume:   () => get<MonthlyVolumeRow[]>('/api/analytics/monthly-volume'),
    expenseAccounts: (f?: GLFilters) => get<ExpenseAccountRow[]>(`/api/analytics/expense-accounts${buildFilterQS(f)}`),
    currencySplit:   (f?: GLFilters) => get<CurrencySplitRow[]>(`/api/analytics/currency-split${buildFilterQS(f)}`),
    plYoY:           (f?: GLFilters) => get<PLYoYRow[]>(`/api/analytics/pl-yoy${buildFilterQS(f)}`),
  },
  collections: {
    summary:    (ids: number[], yr: number | null, mf?: string, mt?: string, ap?: string, gpt?: string) =>
      get<CollectionSummary>(`/api/insights/collections/summary${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}), ...(gpt ? { doc_type: gpt } : {}) }, ap)}`),
    monthly:    (ids: number[], yr: number | null, mf?: string, mt?: string, ap?: string, gpt?: string) =>
      get<CollectionMonthRow[]>(`/api/insights/collections/monthly${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}), ...(gpt ? { doc_type: gpt } : {}) }, ap)}`),
    byCustomer: (ids: number[], yr: number | null, mf?: string, mt?: string, limit = 25, ap?: string, gpt?: string) =>
      get<CollectionCustomerRow[]>(`/api/insights/collections/by-customer${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}), ...(gpt ? { doc_type: gpt } : {}), limit }, ap)}`),
    byEntity:   (ids: number[], yr: number | null, mf?: string, mt?: string, ap?: string, gpt?: string) =>
      get<CollectionEntityRow[]>(`/api/insights/collections/by-entity${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}), ...(gpt ? { doc_type: gpt } : {}) }, ap)}`),
  },
  income: {
    summary:   (ids: number[], yr: number | null, mf?: string, mt?: string, ap?: string) =>
      get<IncomeSummary>(`/api/insights/income/summary${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}) }, ap)}`),
    monthly:   (ids: number[], yr: number | null, mf?: string, mt?: string, ap?: string) =>
      get<IncomeMonthRow[]>(`/api/insights/income/monthly${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}) }, ap)}`),
    byAccount: (ids: number[], yr: number | null, mf?: string, mt?: string, ap?: string) =>
      get<IncomeAccountRow[]>(`/api/insights/income/by-account${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}) }, ap)}`),
    byEntity:  (ids: number[], yr: number | null, mf?: string, mt?: string, ap?: string) =>
      get<IncomeEntityRow[]>(`/api/insights/income/by-entity${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}) }, ap)}`),
  },
  ageing: {
    summary:    (ids: number[], yr: number | null, mf?: string, mt?: string, gpt?: string) =>
      get<AgeingSummary>(`/api/insights/ageing/summary${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}), ...(gpt ? { doc_type: gpt } : {}) })}`),
    byCustomer: (ids: number[], yr: number | null, mf?: string, mt?: string, limit = 25, gpt?: string) =>
      get<AgeingCustomerRow[]>(`/api/insights/ageing/by-customer${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}), ...(gpt ? { doc_type: gpt } : {}), limit })}`),
    byEntity:   (ids: number[], yr: number | null, mf?: string, mt?: string, gpt?: string) =>
      get<AgeingEntityRow[]>(`/api/insights/ageing/by-entity${buildInsightsQS(ids, yr, { ...(mf ? { month_from: mf } : {}), ...(mt ? { month_to: mt } : {}), ...(gpt ? { doc_type: gpt } : {}) })}`),
  },
  insights: {
    coa: {
      summary:    ()                              => get<CoASummary>('/api/insights/coa/summary'),
      byCategory: (ids: number[], yr: number | null) => get<CoACategoryRow[]>(`/api/insights/coa/by-category${buildInsightsQS(ids, yr)}`),
      accounts:   (ids: number[], cat?: string)   => get<CoAAccountRow[]>(`/api/insights/coa/accounts${buildInsightsQS(ids, null, cat ? { category: cat } : {})}`),
      coverage:   ()                              => get<CoACoverageRow[]>('/api/insights/coa/coverage'),
    },
    customers: {
      summary:    ()                                => get<CustomerSummary>('/api/insights/customers/summary'),
      top:        (limit = 20, sortBy: 'sales'|'balance' = 'sales') => get<CustomerRow[]>(`/api/insights/customers/top?limit=${limit}&sort_by=${sortBy}`),
      byEntity:   ()                                => get<CustomerByEntityRow[]>('/api/insights/customers/by-entity'),
      geographic: ()                                => get<CustomerGeoRow[]>('/api/insights/customers/geographic'),
    },
    postedSales: {
      summary:    (ids: number[], yr: number | null) => get<PostedSalesSummary>(`/api/insights/posted-sales/summary${buildInsightsQS(ids, yr)}`),
      byPeriod:   (ids: number[], yr: number | null) => get<PostedSalesPeriodRow[]>(`/api/insights/posted-sales/by-period${buildInsightsQS(ids, yr)}`),
      byCustomer: (ids: number[], yr: number | null, docType?: string, limit = 20) =>
        get<PostedSalesCustomerRow[]>(`/api/insights/posted-sales/by-customer${buildInsightsQS(ids, yr, { ...(docType ? { doc_type: docType } : {}), limit })}`),
      byType:     (ids: number[], yr: number | null) => get<PostedSalesTypeRow[]>(`/api/insights/posted-sales/by-type${buildInsightsQS(ids, yr)}`),
    },
    invoices: {
      summary:    (ids: number[], yr: number | null) => get<InvoiceSummary>(`/api/insights/invoices/summary${buildInsightsQS(ids, yr)}`),
      byPeriod:   (ids: number[], yr: number | null) => get<InvoicePeriodRow[]>(`/api/insights/invoices/by-period${buildInsightsQS(ids, yr)}`),
      byCustomer: (ids: number[], yr: number | null, limit = 15) =>
        get<InvoiceCustomerRow[]>(`/api/insights/invoices/by-customer${buildInsightsQS(ids, yr, { limit })}`),
      byEntity:   (yr: number | null) => get<InvoiceEntityRow[]>(`/api/insights/invoices/by-entity${buildInsightsQS([], yr)}`),
    },
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
    stats:    () => get<GLStats[]>('/api/gl/stats'),
    accounts: () => get<{ gl_account_no: string; gl_account_name: string | null; entity_count: number; total_amount: number }[]>('/api/gl/accounts'),
  },
};
