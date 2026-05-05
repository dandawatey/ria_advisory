# i-finsights — Concept Note

**Product:** i-finsights (Unified Financial Intelligence Platform)  
**Document Type:** Concept Note  
**Version:** 1.0.0  
**Status:** Draft — For Review  
**Date:** 2026-05-05  
**Prepared by:** i-Source Infosystems  
**Prepared for:** RIA Advisory  
**Related:** [06_Pricing_Cloud.md](06_Pricing_Cloud.md) | [07_Pricing_OnPrem.md](07_Pricing_OnPrem.md)

---

## 1. Executive Summary

**i-finsights** is a real-time financial intelligence platform built specifically for multi-entity organisations running on **Microsoft Dynamics 365 Business Central**. It connects directly to all BC tenants via certificate-based OAuth, consolidates GL data through an automated Bronze → Silver → Gold pipeline, eliminates intercompany transactions, translates currencies, and delivers live dashboards and reports to the CFO, Controller, and finance teams — without a single manual export.

For RIA Advisory — operating 17 independent BC tenants across multiple geographies and currencies — i-finsights replaces the current 8–10 day Excel-driven close process with a **real-time, auditable, single source of financial truth**.

> **"One number. Real-time. From 17 subsidiaries. Down to a single GL entry."**

---

## 2. The Problem

RIA Advisory operates **17 independent Business Central SaaS tenants** — one per subsidiary — across multiple geographies, currencies, and business verticals.

Every month, the Group Controller spends **8–10 business days** on:

| Pain Point | Business Impact |
|---|---|
| Manual Excel extraction from 17 BC tenants | Error-prone, hours of analyst time wasted |
| VLOOKUP-based consolidation across entities | Zero audit trail, version control nightmares |
| Email-driven intercompany reconciliation and sign-off | No accountability, missed deadlines |
| No intra-month P&L visibility | Leadership flies blind until close completes |
| No programmatic access to BC APIs | Manual exports, no automation possible |
| No data quality monitoring | Dirty data silently reaches board reports |
| No drill-through from group totals to GL entries | Analysts re-extract data on every leadership query |

**The result:** The board receives financial statements 8–10 days after month-end — by which point decisions based on stale data have already been made.

---

## 3. What is i-finsights?

i-finsights is a **three-layer financial intelligence platform**:

```
┌──────────────────────────────────────────────────────────────────┐
│                     INTELLIGENCE LAYER                            │
│    CFO Dashboard · Close Cockpit · GL Explorer · 22 Reports      │
│    Multi-Dim Analytics · Natural Language Query · Annotations     │
├──────────────────────────────────────────────────────────────────┤
│                     DATA PROCESSING LAYER                         │
│  Bronze (Raw) → Silver (Conformed) → Gold (Star Schema)          │
│  IC Elimination · FX Translation · Data Quality Gates            │
├──────────────────────────────────────────────────────────────────┤
│                     SOURCE LAYER                                  │
│  17 Business Central Tenants (OData API v2.0, Certificate OAuth) │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Guiding Principles

- **No manual exports** — every data point flows automatically from BC via API
- **One canonical truth** — single Chart of Accounts and dimension framework across all 17 entities
- **Drill-through guaranteed** — every group number traces back to a source GL entry
- **Audit-grade** — full lineage from BC source field to dashboard KPI
- **Role-aware** — each user sees only the subsidiaries they are authorised to access
- **Close-first** — the platform is built around the monthly close cycle, not just reporting

---

## 4. How the Application Works

### 4.1 Data Flow — Source to Dashboard

```
17 Business Central Tenants
        │
        │ Certificate-based OAuth (per tenant)
        ▼
BC OData API v2.0
        │  GL Entries · Chart of Accounts
        │  Customers · Vendors · Posted Sales
        ▼
BRONZE ZONE — Raw append-only store
        │  No transformations. Full historical audit trail.
        ▼
SILVER LAYER — Conformation
        │  Type casting · Null handling · Deduplication
        │  Canonical CoA mapping (474 group accounts)
        │  Date normalisation
        ▼
IC ELIMINATION ENGINE
        │  Remove intercompany transaction pairs
        │  Configurable counterparty rules
        │  Elimination entries posted to elimination entity
        ▼
FX TRANSLATION ENGINE
        │  All amounts → USD
        │  Period-average and period-end rates
        │  Historical rates stored in dim_currency
        ▼
DATA QUALITY GATES
        │  Completeness · Referential integrity
        │  Range checks · Duplicate detection
        │  Exceptions block Gold promotion
        ▼
GOLD LAYER — Star Schema (Analytics-ready)
        │  fact_gl_entries      (188,380 rows)
        │  fact_coa_balances    (7,892 rows)
        │  fact_posted_sales    (3,094 rows)
        │  12 dimension tables
        ▼
FastAPI REST API → React Dashboard
```

### 4.2 User Journey

```
User logs in (Azure Entra ID SSO or email/password)
        │
        ├── Role determined → subsidiaries authorised
        │
        ├── CFO → Executive Dashboard
        │         Live group P&L · KPI tiles · Entity grid · AR/AP aging
        │
        ├── Controller → Close Cockpit
        │         Entity sign-off · IC reconciliation · Close timeline
        │
        ├── Subsidiary Controller → Entity Detail
        │         Entity P&L · Trial Balance · Balance Sheet · GL drill-through
        │
        ├── Finance Analyst → GL Explorer + Reports + Analytics
        │         Full-text GL search · 22 standard reports · Multi-dim workbench
        │
        └── Admin → Pipeline Health + Mapping Console
                  Pipeline runs · DQ exceptions · CoA mapping · Entity onboarding
```

### 4.3 Data Refresh Cadence

| Data | Frequency |
|---|---|
| BC GL entries | On-demand trigger + scheduled runs |
| Dashboard KPIs | Live from star schema (< 2s query) |
| IC elimination | Recalculated on each pipeline run |
| FX rates | Updated per pipeline run from dim_currency |
| Close status | Real-time as entities complete sign-off |

---

## 5. Core Features

### 5.1 Automated Data Pipeline (13 features)

The backbone of the platform. Zero human intervention in the data flow.

| Capability | Detail |
|---|---|
| BC Tenant Authentication | Certificate-based OAuth for all 17 BC SaaS tenants. Auto-rotates tokens. Credentials stored per-tenant. |
| Data Extraction Engine | Pulls GL Entries, CoA, Customers, Vendors, Posted Sales via BC OData API v2.0. Parameterised by date range and entity. |
| Pipeline Orchestration | Dependency graph (BC extract → Bronze → Silver → Gold). Retry with exponential backoff. |
| Ingestion Resilience | Fallback to last-known-good snapshot if BC API unavailable. Dead-letter queue for failed rows. |
| Canonical CoA | Single group-level Chart of Accounts (474 accounts). All 17 entity CoAs mapped. Console to manage exceptions. |
| Dimension Framework | Canonical dimensions: Company (17), Department (32), Project (44), Vertical, Geography (3), Currency (8). |
| IC Elimination Engine | Configurable counterparty rules. Balances posted to elimination entity. Auditable per run. |
| FX Translation | All amounts translated to USD. Period-average and period-end rates. Historical rates persisted. |
| Data Quality Engine | Rule-based DQ: completeness, referential integrity, range checks, duplicate detection. Exceptions block Gold promotion. |
| Data Lineage | Column-level lineage from BC source field → Silver transform → Gold fact. Impact analysis for schema changes. |

### 5.2 Executive Dashboards

The primary daily interface for CFO and finance leadership.

| Dashboard | What It Shows |
|---|---|
| **Executive Dashboard** | Consolidated group P&L · 5 KPI tiles (Revenue, COGS, OpEx, Net Income, Entries) · P&L trend chart · AR/AP aging · Subsidiary performance grid · Department heatmap |
| **Close Cockpit** | Monthly close management · Entity sign-off tracking · IC reconciliation status · Close timeline with SLA · Controller approval workflow · Close % complete |
| **Entity Detail** | Subsidiary drill-through · Entity P&L · Trial Balance · Balance Sheet · GL entries (up to 500/page) · Entity KPI summary |
| **GL Explorer** | Full-text search across 188,380+ GL entries · Filters: company, account, department, document type, date range · < 2 second response |

### 5.3 Financial Reports (22 reports)

All reports pull from the Gold layer star schema. No raw BC data dependency.

| Report | Description |
|---|---|
| P&L Analytics | Monthly waterfall: Revenue → COGS → Gross Profit → OpEx → EBITDA → Net Income. YoY and rolling 12-month. |
| Trial Balance | Account-level Debit / Credit / Net. Entity and date filters. Export-ready. |
| Balance Sheet | Assets · Liabilities · Equity. Three-column layout. Sub-totals and net assets. |
| AR / AP Aging | Aging buckets: Current, 30, 60, 90, 90+ days. Entity filter. Total overdue summary. |
| Cash Flow Statement | Operating · Investing · Financing activities. Net cash movement. Free cash flow. |
| KPI Dashboard | Current Ratio · Quick Ratio · EBITDA Margin · DSO · Debt-to-Equity · ROA. Trend sparklines. |
| Financial Health Score | Composite score (0–100) weighted from liquidity, profitability, efficiency, leverage. Benchmark comparisons. |
| Expense Analysis | OpEx breakdown by account and department. Trend and composition charts. |
| Department Spend | Cross-entity heatmap. Cost concentration by vertical or department. |
| Project Financials | Project-level P&L. Revenue, cost, margin per project code. 44 active projects. |
| Vertical Analytics | Business unit P&L. Cross-entity view by vertical dimension. |
| Entity Comparison | Side-by-side subsidiary benchmarking. Revenue, gross margin, OpEx ratio. Ranked table. |
| Collections | AR aging by customer. Days outstanding. Collection risk flags. |
| Customer Insights | Top customers by revenue from GL entries. |
| Posted Sales Insights | 3,094 invoice records. Sales trends by customer and entity. |

### 5.4 Multi-Dimensional Analytics

Interactive analysis workbench for finance analysts.

- Filter panel: company, year, month, currency
- P&L waterfall, entity contribution, department heatmap, rolling trend
- Top accounts by volume and amount, document type mix, MoM change, currency split
- Suspense account monitor — flags unclassified entries automatically

### 5.5 Monthly Close Automation

End-to-end orchestration of the monthly close cycle.

- Task assignment per entity with due dates
- IC reconciliation tracking — pair completeness, sign-off status
- Entity controller sign-off workflow
- Group Controller approval gate before final close
- Close timeline with SLA tracking per entity
- Auto-escalation on missed deadlines
- **Target: 10-day close → 3-day close**

### 5.6 Administration and Governance

| Tool | Purpose |
|---|---|
| Mapping Console | Map subsidiary CoA accounts to canonical CoA. Bulk upload via Excel. Manage exceptions. |
| Onboarding Wizard | Step-by-step new subsidiary onboarding: BC connection → CoA mapping → Dimension mapping → Pipeline test run. Target: < 1 hour per entity. |
| Pipeline Health Monitor | Run history, status, duration, row counts, alert thresholds, retry controls. |
| Security and Compliance | Audit log of all data access. RBAC enforcement audit. Data retention policy config. |
| Tenant Configuration | Branding, BC OAuth credentials, subsidiary access, plan and billing per tenant. |

### 5.7 Multi-Tenancy and Access Control

- Each organisation (RIA Advisory, iSource) has its own isolated tenant
- Users see only their authorised subsidiaries
- Role hierarchy enforces least-privilege access

| Role | Scope |
|---|---|
| `superadmin` | All tenants — CRUD, user management, billing |
| `ria_admin` | RIA Advisory tenant — all reports, pipeline, users, mappings |
| `isource_admin` | iSource tenant — tenant config, users, all reports |
| `finance_user` | Assigned subsidiaries — dashboards, reports, GL Explorer |
| `viewer` | Assigned subsidiaries — read-only dashboards |

---

## 6. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | SPA dashboard, 51 pages |
| **Charts** | Recharts | Bar, line, waterfall, heatmap — no licensing cost |
| **Auth (SSO)** | Azure Entra ID (MSAL) | Enterprise SSO, no password management |
| **Auth (local)** | JWT + bcrypt | Stateless API auth, role-based access |
| **Backend** | FastAPI + Python 3.11 | 9 routers, ~65 REST endpoints |
| **Database** | PostgreSQL — Star Schema | 3 fact tables, 12 dimensions, ~200K analytical rows |
| **BC Integration** | OData API v2.0 + OAuth | Microsoft's supported BC API — no screen scraping |
| **Data Pipeline** | Python ETL (pandas) | Bronze → Silver → Gold transformations |
| **Frontend Deploy** | Netlify | Zero frontend ops, global CDN, instant deploys |
| **Backend Deploy** | Azure Container Apps (target) | Scalable, managed, close to BC tenants |

**Total cost of ownership:** Dramatically lower than Cognos, Hyperion, or OneStream — with full source code ownership and no per-user BI licensing.

---

## 7. Current State

| Metric | Value |
|---|---|
| Features built | 51 of 51 (100%) |
| GL entries indexed | 188,380 |
| Subsidiaries connected | 17 |
| Canonical accounts mapped | 474 |
| Dimensions defined | 7 frameworks (company, dept, project, vertical, geo, currency, doc type) |
| API endpoints | ~65 across 9 routers |
| Test coverage | 20 Playwright E2E tests across 4 spec files |
| Frontend deployment | Live at https://i-finsights.netlify.app |
| Dashboard query performance | < 2 seconds (P95) |

---

## 8. Deployment Options

i-finsights can be deployed in two models. Detailed pricing for each is documented separately.

### 8.1 Cloud (SaaS) — Recommended

i-finsights is hosted, managed, and operated on a secure cloud infrastructure (Azure, co-located with BC tenants for low-latency API access). RIA Advisory accesses it via browser with existing Azure Entra ID SSO — no new credentials required.

```
RIA Advisory Users (Browser / Mobile)
        │
        ▼
Azure CDN + Load Balancer (SSL)
        │
        ▼
Netlify (React Frontend)   +   Azure Container Apps (FastAPI Backend)
        │                                    │
        └───────────────┬────────────────────┘
                        │
                   Azure PostgreSQL
                        │
        17 BC Tenants (OData API — Azure-to-Azure, low latency)
```

**Key advantages for RIA Advisory:**
- Azure-native — backend co-located with BC tenants, minimal latency on API calls
- Existing Azure Entra ID — users log in with their Microsoft 365 credentials, no new passwords
- No infrastructure investment — i-Source manages hosting, monitoring, and upgrades
- Instant access — live at https://i-finsights.netlify.app today

→ **Full pricing details:** [06_Pricing_Cloud.md](06_Pricing_Cloud.md)

---

### 8.2 On-Premises (Self-Hosted)

i-finsights is deployed entirely within RIA Advisory's own data center or private Azure subscription. i-Source provides the software packages, Docker images, deployment runbooks, and support.

```
RIA Advisory Internal Network
        │
        ▼
Docker Host or Azure Private Container (Customer-managed)
  ┌───────────────────────────────────┐
  │  nginx           port 80 / 443    │
  │  Frontend        port 5173         │
  │  FastAPI Backend port 8000         │
  │  PostgreSQL      port 5432         │
  │  MinIO (docs)    port 9000 / 9001  │
  │  Redis (cache)   port 6379         │
  └───────────────────────────────────┘
        │
  17 BC Tenants (OData API — internal or Azure VNet peered)
```

**When to choose on-premises:**
- Strict data residency — financial data must not leave RIA Advisory's own infrastructure
- Regulatory or group policy requirement for self-hosted software
- RIA Advisory has an existing IT team and data center capacity

→ **Full pricing, server sizing, and TCO details:** [07_Pricing_OnPrem.md](07_Pricing_OnPrem.md)

---

## 9. Value Delivered to RIA Advisory

| Metric | Before i-finsights | After i-finsights |
|---|---|---|
| Monthly close duration | 8–10 business days | **3 business days (target)** |
| Data extraction from BC | Manual, per tenant, per analyst | **Automated — zero manual exports** |
| Intercompany reconciliation | Email chain, manual VLOOKUP | **Automated engine, sign-off tracked** |
| Intra-month P&L visibility | Not available | **Real-time, always-on** |
| Drill-through to GL | Re-export required | **One click from group total to GL entry** |
| Audit trail | None (Excel) | **Column-level lineage, full access log** |
| New entity onboarding | Days (IT project) | **< 1 hour via onboarding wizard** |
| Report generation | 2–3 days analyst effort | **Instant, from live star schema** |
| Data quality | Unknown — discovered post-close | **DQ gates block bad data before Gold** |

---

## 10. Competitive Context

| Capability | Excel + Email | Generic BI Tool | i-finsights |
|---|---|---|---|
| BC API integration | Manual export | Custom connector needed | Native — certificate OAuth |
| IC elimination | Manual VLOOKUP | Manual configuration | Automated engine |
| Multi-tenant isolation | None | None | Built-in, role-enforced |
| Close workflow | Email chain | Out of scope | Close Cockpit |
| GL drill-through | None | Depends on data model | 188K entries, < 2s |
| Time to first report | 10 days post-close | 5+ days post-close | Real-time |
| Data lineage | None | Limited | Column-level |
| Azure Entra ID SSO | None | Varies | Native MSAL integration |
| Total cost | Low upfront, high labour | High licensing | Competitive, source-owned |

---

## 11. Roadmap

| Phase | Timeline | Capabilities |
|---|---|---|
| **Phase 1 — Foundation** | Completed | All 51 features — pipeline, dashboards, reports, close, admin, multi-tenancy |
| **Phase 2 — Intelligence** | Q3 2026 | AI-generated variance commentary, anomaly detection, natural language query (full) |
| **Phase 3 — Expansion** | Q4 2026 | Additional ERP connectors (Dynamics 365 Finance, NetSuite), mobile app |
| **Phase 4 — Platform** | Q1 2027 | Multi-client SaaS — onboard additional group clients, partner reseller model |

---

## 12. Summary

i-finsights gives RIA Advisory what no off-the-shelf BI tool or ERP report can: a **real-time, auditable, fully automated financial intelligence platform** that is native to Business Central, built around the monthly close cycle, and owned entirely by RIA Advisory.

It eliminates the parallel Excel universe that currently costs 8–10 business days of high-value finance talent every month — replacing it with a platform that surfaces the same answers in under 2 seconds, with a full audit trail from board dashboard to source GL journal.

---

*Document prepared by i-Source Infosystems for RIA Advisory | Version 1.0.0 | 2026-05-05*  
*Next Review: 2026-06-05*
