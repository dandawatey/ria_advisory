# i-CFO360 — Feature Catalog

**Total Features:** 54+ (F000–F065+)
**Status:** In Development / Deployed to self-hosted Docker

Features grouped into 7 domains. Each domain maps to a navigation section in the app.

---

## Domain 1 — Data Pipeline (F001–F013)

The automated data ingestion and transformation backbone. No human intervention in the data flow.

| Feature | ID | Route | Status | Description |
|---------|-----|-------|--------|-------------|
| BC Tenant Authentication | F001 | `/admin/bc-tenants` | Built | Certificate-based OAuth for all 17 BC SaaS tenants. Stores credentials per-tenant in vault. Auto-rotates tokens. |
| Data Extraction Engine | F002 | `/admin/bc-tenants` | Built | Pulls GL Entries, CoA, Customers, Vendors, Posted Sales via BC OData API v2.0. Parameterised by date range, entity. |
| Pipeline Orchestration | F003 | `/admin/pipeline-health` | Built | Schedules extraction runs. Dependency graph (BC extract → Bronze → Silver → Gold). Retry with exponential backoff. |
| Ingestion Resilience | F004 | `/admin/pipeline-health` | Built | Fallback to last-known-good snapshot if BC API unavailable. Dead-letter queue for failed rows. |
| Bronze Zone | F005 | `/admin/pipeline-health` | Built | Raw data landing zone. Append-only. Full historical audit trail. No transformations applied. |
| Silver Layer | F006 | `/admin/pipeline-health` | Built | Type casting, null handling, deduplication, date normalisation. Canonical CoA account mapping applied. |
| Canonical CoA | F007 | `/admin/coa` | Built | Single group-level Chart of Accounts (474 accounts). All 17 entity CoAs mapped. Console to manage exceptions. |
| Dimension Framework | F008 | `/admin/mappings` | Built | Canonical dimensions: Company (17), Department (32), Project (44), Vertical, Geo (3), Currency (8). |
| Gold Layer | F009 | `/admin/pipeline-health` | Built | Conformed star schema. `fact_gl_entries` (188K rows), `fact_coa_balances` (7.9K), `fact_posted_sales` (3K). |
| IC Elimination | F010 | `/admin/ic-elimination` | Built | Intercompany transaction elimination. Configurable counterparty rules. Balances posted to elimination entity. |
| FX Translation | F011 | `/admin/pipeline-health` | Built | All amounts translated to USD. Period-average and period-end rates. Historical rates stored in `dim_currency`. |
| Data Quality | F012 | `/admin/dq` | Built | DQ rule engine: completeness, referential integrity, range checks, duplicate detection. Exceptions block Gold promotion. |
| Data Lineage | F013 | `/admin/pipeline-health` | Built | Column-level lineage from BC source field → Silver transform → Gold fact. Impact analysis for schema changes. |

---

## Domain 2 — Authentication & Access (F014)

| Feature | ID | Route | Status | Description |
|---------|-----|-------|--------|-------------|
| Authentication | F014 | `/login` | Built | Dual auth: Microsoft Entra ID SSO (MSAL) + Email/Password (bcrypt + JWT). Role-based redirect on login. Quick-fill dev buttons for testing. |

**Role Hierarchy:**

```
superadmin
  └── ria_admin
        └── isource_admin
              └── finance_user
                    └── viewer
```

| Role | Scope | Can Do |
|------|-------|--------|
| `superadmin` | All tenants | Everything — tenant CRUD, user management, billing |
| `ria_admin` | RIA Advisory tenant | All reports, pipeline control, user management, mappings |
| `isource_admin` | iSource tenant | Tenant config, user management, all reports |
| `finance_user` | Assigned subsidiaries | All dashboards, reports, GL explorer, annotations |
| `viewer` | Assigned subsidiaries | Read-only dashboards and shared reports |

---

## Domain 3 — Executive Dashboards (F015–F020)

The primary daily-use surface for the CFO, Controller, and finance leadership.

| Feature | ID | Route | Status | Description |
|---------|-----|-------|--------|-------------|
| Executive Dashboard | F015 | `/dashboard` | Built | Consolidated group P&L, 5 KPI tiles (Revenue, COGS, OpEx, Net Income, Entries), P&L trend chart, AR/AP aging, subsidiary performance grid, department heatmap. Real-time from star schema. |
| Close Cockpit | F016 | `/close` | Built | Monthly close management. Entity-level sign-off tracking, IC reconciliation status, close timeline with SLA, Controller approval workflow, close completion percentage. |
| Entity Detail | F017 | `/entities/:id` | Built | Subsidiary drill-through. Entity-level P&L, Trial Balance, Balance Sheet, GL entries (paginated, up to 500 per page), entity summary KPIs. |
| GL Explorer | F018 | `/explorer` | Built | Full-text search across 188,380+ GL entries. Filters: company, account, department, document type, date range. Stats view with per-entity entry counts. Chart tab for visual analysis. < 2s response. |
| Annotations & NLQ | F020 | `/annotations` | Built | In-app annotations on any financial figure. Natural language query interface. Comment threads per metric. |

---

## Domain 4 — Reports (F032–F046)

Standardised financial statements and management reports. All pull from the Gold layer star schema.

| Feature | ID | Route | Status | Description |
|---------|-----|-------|--------|-------------|
| P&L Analytics | F032 | `/pl` | Built | Monthly P&L waterfall: Revenue → COGS → Gross Profit → OpEx → EBITDA → Net Income. YoY comparison. Rolling 12-month trend. |
| Collections | F033 | `/collections` | Built | Accounts Receivable aging. Customer-level balances, days outstanding, collection risk flags. |
| Monthly Income | F034 | `/income` | Built | Monthly revenue trends by entity and account category. Bar/line charts. |
| AR/AP Ageing | F035 | `/ageing` | Built | AR and AP aging buckets: Current, 30, 60, 90, 90+ days. Entity filter. Total overdue summary. |
| Trial Balance | F036 | `/reports/trial-balance` | Built | Account-level Debit, Credit, Net columns. Filters: entity, date range. Export-ready layout. Summary totals row. |
| Balance Sheet | F037 | `/reports/balance-sheet` | Built | Assets, Liabilities, Equity. Three-column layout. Sub-totals per category. Net assets computation. |
| Expense Analysis | F038 | `/reports/expense` | Built | Operating expense breakdown by account and department. Trend and composition charts. |
| Department Spend | F039 | `/reports/dept-spend` | Built | Cross-entity department spend heatmap. Identify cost concentration by vertical or department. |
| KPI Dashboard | F041 | `/reports/kpi` | Built | Financial ratios: Current Ratio, Quick Ratio, EBITDA Margin, DSO, Debt-to-Equity, Return on Assets. Trend sparklines. |
| Health Score | F042 | `/reports/health-score` | Built | Composite financial health score (0–100). Weighted from liquidity, profitability, efficiency, leverage ratios. Benchmark comparisons. |
| Project Financials | F043 | `/reports/projects` | Built | Project-level P&L. Revenue, cost, margin per project code. 44 active projects tracked. |
| Vertical Analytics | F044 | `/reports/verticals` | Built | Business unit / vertical P&L. Cross-entity view by vertical dimension. |
| Entity Comparison | F045 | `/reports/entities` | Built | Side-by-side subsidiary benchmarking. Revenue, gross margin, OpEx ratio per entity. Ranked table. |
| Cash Flow Statement | F046 | `/reports/cash-flow` | Built | Operating, Investing, Financing activities. Net cash movement. Free cash flow calculation. |

---

## Domain 5 — Analytics (F025–F031)

Deep analytical workbench for finance analysts and data-savvy users.

| Feature | ID | Route | Status | Description |
|---------|-----|-------|--------|-------------|
| Multi-Dim Analytics | F025 | `/analytics` | Built | Interactive filter panel (company, year, month, currency). P&L waterfall, entity contribution, department heatmap, rolling trend, top accounts, document type mix, suspense monitor, MoM change, currency split. |
| Data Insights | F026 | `/gl-insights` | Built | Pattern analysis across 188K GL entries. Entry volume trends, completeness metrics, entity coverage. |
| GL Insights | F027 | `/insights/gl` | Built | GL account analysis. Top accounts by volume and amount. Account category distribution. |
| CoA Insights | F028 | `/insights/coa` | Built | Canonical CoA analysis. Account count by category, active vs inactive, balance totals. |
| Customer Insights | F029 | `/insights/customer` | Built | Customer and vendor analysis from GL entries. Top customers by revenue. |
| Posted Sales Insights | F030 | `/insights/posted-sales` | Built | Posted sales invoice analysis. 3,094 invoice records. Sales trends, top customers. |
| Invoice Insights | F031 | `/insights/invoices` | Built | Invoice-level detail. Open vs closed, overdue, by entity. |

---

## Domain 6 — Administration (F021–F024, F040)

Platform administration, data governance, and operational tooling.

| Feature | ID | Route | Status | Description |
|---------|-----|-------|--------|-------------|
| Mapping Console | F021 | `/admin/mappings` | Built | Account and dimension mapping workbench. Map subsidiary CoA accounts to canonical CoA. Bulk upload via Excel. |
| Onboarding Wizard | F022 | `/admin/onboarding` | Built | Step-by-step new subsidiary onboarding. BC tenant connection → CoA mapping → dimension mapping → pipeline test run. Target: < 1 hour. |
| Pipeline Health | F023 | `/admin/pipeline-health` | Built | Pipeline run history, status, duration, row counts. Alert thresholds. Retry controls. |
| Security & Compliance | F024 | `/admin/security` | Built | Audit log of all data access. RBAC enforcement audit. SEC Rule 204-2 compliance indicators. Data retention policy config. |
| Settings | F040 | `/settings` | Built | BC Dynamics connection config (BC Tenant ID, Client ID, Client Secret, Environment, API Version). Connection test with live OAuth validation. |

---

## Domain 7 — Multi-Tenancy & User Management (F047–F051)

Platform-level multi-organisation support. Each client organisation is an isolated tenant.

| Feature | ID | Route | Status | Description |
|---------|-----|-------|--------|-------------|
| Tenant Management | F047 | `/admin/tenants` | Built | Superadmin CRUD for all organisations. List, create, soft-delete tenants. Plan badge (trial/starter/professional/enterprise). User count per tenant. |
| User Management | F048 | `/admin/tenants/:id/users` | Built | User list per tenant. Invite users, assign roles, activate/deactivate. Role dropdown (all 5 roles). |
| Tenant Config | F049 | `/admin/tenants/:id/config` | Built | 4-tab tenant configuration: (1) Branding — display name, colours, logo URL; (2) BC Dynamics — OAuth credentials, test connection, status badge; (3) Subsidiary Access — checkbox per entity, select/clear all; (4) Plan & Billing — tier, max users, max subsidiaries, renewal date, auto-renew. |
| Tenant Hub | F050 | `/admin/hub` | Built | Superadmin landing page. Grid of all tenant tiles. Click tile → enter that tenant's context. Configure and Users shortcuts per tile. + New Tenant CTA. |
| New Tenant Form | F051 | `/admin/tenants/new` | Built | Full-page 4-section form: Organisation Details, Branding, Plan & Billing, First Admin User. Blank sidebar (logo only — no nav distraction). Creates tenant + optionally seeds first admin user. |

---

## API Endpoint Summary

**9 FastAPI routers, ~65 endpoints:**

| Router | Prefix | Key Endpoints |
|--------|--------|---------------|
| Auth | `/auth` | login, sso, refresh, me, logout, register |
| Tenants | `/api/tenants` | CRUD + users + config + bc-config |
| Dashboard | `/api/dashboard` | kpis, entities, pl-trend, departments |
| Entities | `/api/entities` | summary, trial-balance, gl-entries, pl-by-account |
| Analytics | `/api/analytics` | 17 endpoints — filters, waterfall, heatmap, trends, ratios |
| GL | `/api/gl` | entries, accounts, departments, stats |
| Insights | `/api/insights` | coa, customer, posted-sales, invoices |
| Reports | `/api/reports` | trial-balance, balance-sheet, expense, kpi-ratios, health-score, projects, verticals |
| Settings | `/api/settings` | bc config, bc test |

---

## Data Model Summary

**Star Schema — PostgreSQL**

| Layer | Tables | Rows |
|-------|--------|------|
| Fact | `fact_gl_entries` | 188,380 |
| Fact | `fact_coa_balances` | 7,892 |
| Fact | `fact_posted_sales` | 3,094 |
| Dim | `dim_company` | 17 |
| Dim | `dim_account` | 474 |
| Dim | `dim_date` | 282 |
| Dim | `dim_currency` | 8 |
| Dim | `dim_document` | 36 |
| Dim | `dim_posting_group` | 19 |
| Dim | `dim_department` | 32 |
| Dim | `dim_counterparty` | 967 |
| Dim | `dim_bal_account` | 1,007 |
| Dim | `dim_project` | 44 |
| Dim | `dim_project_code` | 259 |
| Dim | `dim_geo` | 3 |

**Total:** 3 fact tables, 12 dimension tables, ~200K analytical rows.

---

## Feature Count by Domain

| Domain | Features | Status |
|--------|----------|--------|
| Data Pipeline | 13 | All built |
| Authentication & Access | 1 | Built |
| Executive Dashboards | 5 | All built |
| Reports | 14 | All built |
| Analytics | 7 | All built |
| Administration | 5 | All built |
| Multi-Tenancy | 5 | All built |
| **Total** | **51** | **All built** |
