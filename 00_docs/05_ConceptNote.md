# i-finsights — Concept Note

---

**FROM:** i-Source Infosystems  
**TO:** RIA Advisory — Group Finance Leadership  
**SUBJECT:** i-finsights — Unified Financial Intelligence Platform for Microsoft Business Central  
**Document Type:** Concept Note and Feature Delivery Proposal  
**Version:** 1.2.0  
**Status:** Updated — Phase 1 / Phase 2 Split  
**Date:** 2026-05-06  
**Related:** [06_Pricing_Cloud.md](06_Pricing_Cloud.md) | [07_Pricing_OnPrem.md](07_Pricing_OnPrem.md)

---

## Foreword from i-Source Infosystems

We are pleased to present this concept note to RIA Advisory outlining **i-finsights** — a financial intelligence platform purpose-built for multi-entity organisations running on Microsoft Dynamics 365 Business Central.

This document covers:
- What i-finsights is and how it works
- The full feature set and delivery roadmap, with the **3-week initial delivery sprint clearly marked**
- Hardware requirements to be provisioned by RIA Advisory for on-premises deployment
- Deployment architecture options
- The value delivered to RIA Advisory's finance organisation

We look forward to your review and are available to present and discuss at your convenience.

**i-Source Infosystems**  
Contact: [to be inserted by account team]

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem](#2-the-problem)
3. [What is i-finsights?](#3-what-is-i-finsights)
4. [How the Application Works](#4-how-the-application-works)
5. [Core Features](#5-core-features)
6. [Feature Delivery Roadmap](#6-feature-delivery-roadmap)
7. [Technology Stack](#7-technology-stack)
8. [Hardware Requirements — To Be Provided by RIA Advisory](#8-hardware-requirements--to-be-provided-by-ria-advisory)
9. [Current State](#9-current-state)
10. [Deployment Options](#10-deployment-options)
11. [Value Delivered to RIA Advisory](#11-value-delivered-to-ria-advisory)
12. [Competitive Context](#12-competitive-context)
13. [Product Roadmap](#13-product-roadmap)
14. [Summary and Next Steps](#14-summary-and-next-steps)

---

## 1. Executive Summary

**i-finsights** is a real-time financial intelligence platform built specifically for multi-entity organisations running on **Microsoft Dynamics 365 Business Central**. It connects directly to all BC tenants via certificate-based OAuth, consolidates GL data through an automated Bronze → Silver → Gold pipeline, eliminates intercompany transactions, translates currencies, and delivers live dashboards and reports to the CFO, Controller, and finance teams — without a single manual export.

For RIA Advisory — operating 17 independent BC tenants across multiple geographies and currencies — i-finsights replaces the current 8–10 day Excel-driven close process with a **real-time, auditable, single source of financial truth**.

> **"One number. Real-time. From 17 subsidiaries. Down to a single GL entry."**

**Phase 1 delivery commitment to RIA Advisory:** The initial delivery focuses on the five revenue and receivables reports your finance team needs most — **Collections, Invoicing, Revenue, Unbilled Revenue (UBR), and AR** — alongside **Azure Entra ID Single Sign-On**. These six capabilities represent the highest-value, fastest-payback set and will be live and in your team's hands before the full platform is rolled out in Phase 2.

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

- **BC API is the sole data source** — all financial data (GL, CoA, AR/AP, sales) pulled directly from Business Central via OData API v2.0. No manual exports, no file uploads, no Excel feeds.
- **No manual exports** — every data point flows automatically from BC via API
- **One canonical truth** — single Chart of Accounts and dimension framework across all 17 entities
- **Drill-through guaranteed** — every group number traces back to a source GL entry
- **Audit-grade** — full lineage from BC source field to dashboard KPI
- **Role-aware** — each user sees only the subsidiaries they are authorised to access
- **Close-first** — the platform is built around the monthly close cycle, not just reporting

---

## 4. How the Application Works

### 4.1 Data Flow — Source to Dashboard

> **Important:** All financial data — GL entries, Chart of Accounts, customers, vendors, posted sales — is pulled **directly from Business Central via API**. There is no manual file upload, no Excel export, and no human step in the data path. BC API is the single and only source of financial data in i-finsights.

```
17 Business Central Tenants
        │
        │ Certificate-based OAuth (per tenant)
        │ [ALL financial data pulled here — no manual exports, no Excel]
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
        │         Full-text GL search · full report suite · Multi-dim workbench
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

> **ERP Integration Scope:** The base platform includes **Microsoft Dynamics 365 Business Central integration only**. Integration with other ERP systems (SAP, Oracle, Odoo, Dynamics 365 Finance, NetSuite, JDE, Tally) is available as a **paid add-on**. See Section 5.8 for details.

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

### 5.3 Financial Reports

All reports pull exclusively from the Gold layer star schema. No direct BC API dependency at report time — all data landed and processed before query.

---

#### P&L Analytics

**What it contains:** Monthly P&L waterfall from Revenue through COGS, Gross Profit, OpEx, EBITDA, to Net Income. Year-on-year comparison. Rolling 12-month trend. Breakdown by entity and by month. Revenue and expense contribution by subsidiary. Account-level drill-down from any P&L line.

**DB tables:** `fact_gl_entries`, `dim_account` (account_no prefix: 4xx Revenue, 5xx COGS, 6xx OpEx, 7xx Other Income, 8xx Other Expense), `dim_company`, `dim_date`, `dim_currency`

**Business Central source:** `generalLedgerEntries` (OData) — all posted GL entries. `chartOfAccounts` — account names and categories.

---

#### Trial Balance

**What it contains:** Account-by-account listing of total debits, total credits, and net balance for a selected period and entity. Account category and sub-category. Income Statement vs Balance Sheet classification per account. Group totals by category. Export-ready format.

**DB tables:** `v_trial_balance` (view over `fact_gl_entries`), `dim_account`, `dim_company`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `chartOfAccounts`

---

#### Balance Sheet

**What it contains:** Point-in-time financial position — Total Assets (1xx accounts), Total Liabilities (2xx accounts), Total Equity (3xx accounts). Three-column layout with account-level detail, sub-totals, and net assets. Debt-to-equity ratio derived from balance sheet totals.

**DB tables:** `v_coa_balances` (view over `fact_coa_balances`), `fact_coa_balances`, `dim_account`, `dim_company`

**Business Central source:** `generalLedgerEntries`, `chartOfAccounts` — balance sheet accounts are identified by account number prefix (1xx/2xx/3xx) after canonical CoA mapping.

---

#### AR / AP Aging

**What it contains:** Open receivables and payables bucketed by aging: Current (0–30 days), 31–60 days, 61–90 days, 90+ days. Total overdue summary. Per-entity breakdown. Customer-level AR aging and vendor-level AP aging. Days outstanding per counterparty.

**DB tables:** `fact_gl_entries`, `dim_counterparty` (967 customers and vendors), `dim_company`, `dim_date`, `dim_account` (receivable and payable account categories)

**Business Central source:** `customerLedgerEntries`, `vendorLedgerEntries`, `customers`, `vendors`

---

#### Cash Flow Statement

**What it contains:** Indirect-method cash flow statement structured into Operating activities (revenue received, COGS paid, OpEx paid, other income/expense), Investing activities (asset account movements), and Financing activities (liability and equity account movements). Net cash change for the period. Year-by-year trend.

**DB tables:** `fact_gl_entries`, `dim_account` (account number prefix used to classify: 4xx–8xx for Operating, 1xx for Investing, 2xx–3xx for Financing), `dim_company`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `chartOfAccounts`

---

#### KPI Dashboard

**What it contains:** Six financial ratios computed from the Gold layer: Gross Margin %, Net Margin %, EBITDA Margin %, OpEx Ratio %, Current Ratio (Assets/Liabilities), Debt-to-Equity (Liabilities/Equity). Monthly trend for each KPI. Per-entity breakdown of all KPIs. Revenue per entity and expense per entity.

**DB tables:** `fact_gl_entries` (for P&L ratios — accounts 4xx–8xx), `fact_coa_balances` (for balance sheet ratios — 1xx/2xx/3xx), `dim_account`, `dim_company`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `chartOfAccounts`

---

#### Financial Health Score

**What it contains:** Composite score (0–100) with letter grade (A–F) calculated from six weighted categories: Profitability (Net Margin, 25%), Gross Efficiency (Gross Margin, 20%), Liquidity (Current Ratio, 20%), Leverage (Debt/Equity, 15%), OpEx Control (OpEx Ratio, 10%), Data Coverage (entity completeness, 10%). Per-category status (green/amber/red). Key drivers — top positive and negative contributors to the score.

**DB tables:** `fact_gl_entries`, `fact_coa_balances`, `dim_account`, `dim_company`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `chartOfAccounts` — same source as KPI Dashboard; Health Score is a derived composite from KPI values.

---

#### Expense Analysis

**What it contains:** OpEx breakdown by GL account (top 50 by absolute amount). COGS vs OpEx split. Trend by month. Breakdown by entity. Account category and sub-category detail. Entry count per account. Filterable by entity, year, month, and account category.

**DB tables:** `fact_gl_entries`, `dim_account` (5xx COGS, 6xx OpEx), `dim_company`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `chartOfAccounts` — expense accounts identified by canonical account number prefix post-mapping.

---

#### Department Spend

**What it contains:** Cross-entity spend heatmap grouped by department code and vertical code. Total spend per department per entity per fiscal period. COGS vs OpEx breakdown by department. Vertical-level aggregation. Entry count per department.

**DB tables:** `v_dept_spend` (view), `fact_gl_entries`, `dim_department` (32 departments), `dim_company`, `dim_account`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `dimensions` (global dimension 1 — typically Department), `dimensionValues`

---

#### Project Financials

**What it contains:** Project-level P&L — Revenue, COGS, OpEx, and Net per project code. Entry count and entity count per project. Identifies projects with no revenue (pure cost centres). Drill-down from group totals to GL entries per project.

**DB tables:** `fact_gl_entries`, `dim_project` (44 projects), `dim_project_code` (259 codes), `dim_account`, `dim_company`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `dimensions` (global dimension 2 — typically Project), `dimensionValues`

---

#### Vertical Analytics

**What it contains:** Business unit (vertical) P&L — Revenue, COGS, OpEx, Net, Gross Margin %, Net Margin %, OpEx Ratio % per vertical. Vertical-to-department drill-down. Entity count per vertical. Excludes system entries (OPENBAL, pre-period entries).

**DB tables:** `fact_gl_entries`, `dim_department` (vertical_code field), `dim_account`, `dim_company`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `dimensions`, `dimensionValues` — vertical derived from department dimension groupings configured in the Dimension Framework.

---

#### Entity Comparison

**What it contains:** Side-by-side comparison of all 17 subsidiaries — Revenue, COGS, OpEx, Net Income, Gross Margin %, Net Margin %, OpEx Ratio %, Revenue Share %, Total Spend, Entry Count. Ranked table by revenue. Highlights highest- and lowest-performing entities.

**DB tables:** `fact_gl_entries`, `dim_account`, `dim_company`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `chartOfAccounts` — aggregated per company_id across all 17 BC tenants.

---

#### Collections (AR Aging by Customer)

**What it contains:** Outstanding receivables aged by customer. Days outstanding per customer. Collection risk flags for overdue balances. Per-entity view. Total overdue amount. Identifies customers with longest outstanding days.

**DB tables:** `fact_gl_entries`, `dim_counterparty` (customer entries — source_no field), `dim_company`, `dim_date`, `dim_account` (receivable account category)

**Business Central source:** `customerLedgerEntries`, `customers`

---

#### Monthly Income

**What it contains:** Month-by-month income trend — Revenue, COGS, and Net Income per month across all entities or filtered by entity. Running totals. Seasonal pattern identification. Monthly contribution of each entity to group income.

**DB tables:** `fact_gl_entries`, `dim_account` (4xx Revenue, 5xx COGS), `dim_company`, `dim_date`

**Business Central source:** `generalLedgerEntries`, `chartOfAccounts`

---

#### GL Insights

**What it contains:** Overview of the canonical Chart of Accounts — total account count, active accounts (accounts with GL activity), total and net balance across all accounts, income vs expense account split. Account-by-category breakdown with balance, net change, and entry count. Account-level listing with balance and activity status.

**DB tables:** `dim_account`, `fact_coa_balances`, `fact_gl_entries`, `dim_date`, `dim_company`

**Business Central source:** `chartOfAccounts` (for account master), `generalLedgerEntries` (for activity and balance data)

---

#### CoA Insights

**What it contains:** Canonical Chart of Accounts deep-dive — account mapping status, uncategorised account detection, balance sheet vs income statement split, account hierarchy (L1–L4), net change by account, drill-down from account group to individual GL entries.

**DB tables:** `fact_coa_balances`, `dim_account`, `dim_company`

**Business Central source:** `chartOfAccounts`, `generalLedgerEntries`

---

#### Customer Insights

**What it contains:** Top customers by revenue contribution from GL entries. Revenue per customer per entity. Customer-level entry count. Trend of customer revenue over time. Cross-entity customer view (customers appearing across multiple subsidiaries).

**DB tables:** `fact_gl_entries`, `dim_counterparty` (source_no = customer code), `dim_company`, `dim_date`, `dim_account` (revenue accounts 4xx)

**Business Central source:** `generalLedgerEntries` (with counterparty = customer), `customers`

---

#### Posted Sales Insights

**What it contains:** Posted sales invoice analysis — total invoice amount, invoice count, average invoice value, top customers by invoice value, sales trend by month and entity, invoice detail (document number, customer, amount, date, entity).

**DB tables:** `fact_posted_sales` (3,094 rows), `dim_counterparty`, `dim_company`, `dim_date`

**Business Central source:** `salesInvoices` (posted status only), `customers` — this is the only report sourced from `fact_posted_sales` rather than `fact_gl_entries`.

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
| Mapping Console | Map subsidiary CoA accounts to canonical CoA. CoA accounts are sourced from BC API — no manual data entry. Excel upload available only for bulk mapping configuration (account-to-canonical mapping rules), not for financial data. |
| Onboarding Wizard | Step-by-step new subsidiary onboarding: BC connection → CoA mapping → Dimension mapping → Pipeline test run. Target: < 1 hour per entity. |
| Pipeline Health Monitor | Run history, status, duration, row counts, alert thresholds, retry controls. |
| Security and Compliance | Audit log of all data access. RBAC enforcement audit. Data retention policy config. |
| Tenant Configuration | Branding, BC OAuth credentials, subsidiary access, plan and billing per tenant. |

### 5.8 ERP Integration — Included vs Add-On

**Included in base platform:**

| ERP | Integration Type | Included |
|---|---|---|
| **Microsoft Dynamics 365 Business Central** | OData API v2.0, Certificate-based OAuth | ✅ Included — all tiers |

**Available as paid add-ons** (additional license fee per connector per month):

| ERP | Integration Type | Availability |
|---|---|---|
| SAP S/4HANA | REST API / OData | Add-on — Q3 2026 |
| Microsoft Dynamics 365 Finance | OData API | Add-on — Q4 2026 |
| Oracle ERP Cloud | REST API | Add-on — Q4 2026 |
| Odoo | JSON-RPC API | Add-on — Q4 2026 |
| JD Edwards (JDE) | JDBC / REST | Add-on — Q4 2026 |
| NetSuite | SuiteQL / REST | Add-on — Q4 2026 |
| Tally Prime | Tally XML API | Add-on — Q4 2026 |

> Pricing for ERP add-on connectors available on request. Each connector integrates into the same Bronze → Silver → Gold pipeline and appears in all existing dashboards and reports once activated.

---

### 5.9 Multi-Tenancy and Access Control

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

## 6. Feature Delivery Roadmap

Delivery is structured in **two phases**. Phase 1 delivers the five revenue and receivables reports that generate immediate value for the RIA Advisory finance team, along with Single Sign-On. Phase 2 delivers the full platform.

> **Legend:**  
> 🟢 **Phase 1** — Initial delivery: Collections, Invoicing, Revenue, UBR, AR + SSO  
> 🔵 **Phase 2** — Full platform: Dashboards, all reports, analytics, close automation, AI

---

### 6.1 Phase 1 — Revenue and Receivables Reports + SSO

**Goal:** Five targeted financial reports live and in use by RIA Advisory finance team. Azure Entra ID Single Sign-On configured. Users log in with their existing Microsoft 365 credentials from day one.

**What Phase 1 delivers — and nothing more:** Only the six capabilities below. All other reports, dashboards, and analytics are Phase 2. This keeps Phase 1 focused, fast, and immediately valuable.

#### Phase 1 Capabilities

---

##### 1. Collections Report

**What it shows:** Outstanding receivables aged by customer. Days outstanding per customer. Collection risk flags for balances overdue beyond 30, 60, and 90 days. Per-entity view — so RIA Advisory's controller can see which subsidiary has the largest outstanding balances and who owes it. Total overdue amount across all entities. Customers with the longest outstanding days ranked at the top.

**Source:** BC `customerLedgerEntries` — only open (uncleared) entries. All 17 subsidiaries. Filtered by entry type = receivable.

**Value to RIA Advisory:** Finance team knows within seconds which customers are delinquent across all 17 entities, without pulling a single BC report manually.

---

##### 2. Invoicing Report

**What it shows:** All posted sales invoices — invoice number, customer name, invoice date, due date, amount, entity, and payment status. Total invoice value issued in any selected period. Invoice count per entity. Average invoice value. Top customers by invoice volume. Month-by-month invoice trend. Drill-through from summary to individual invoice lines.

**Source:** BC `salesInvoices` (posted status only) and `salesInvoiceLines`. Pulled via OData for all 17 BC tenants. Stored in `fact_posted_sales`.

**Value to RIA Advisory:** Complete invoicing picture across all subsidiaries in one view — no entity-by-entity manual extraction from 17 separate BC environments.

---

##### 3. Revenue Report

**What it shows:** Revenue recognised per entity per month. Revenue breakdown by GL account (revenue account codes — 4xx prefix). Month-on-month revenue trend. Year-to-date revenue by entity. Revenue contribution per subsidiary as a percentage of group total. Drill-down from group revenue to individual GL entries.

**Source:** BC `generalLedgerEntries` filtered to revenue accounts (canonical CoA L2 = Revenue). All 17 BC tenants via OData API v2.0.

**Value to RIA Advisory:** Real-time revenue visibility across the group — not the 8–10 day lagged view from the current Excel process. Leadership can see intra-month revenue without waiting for close.

---

##### 4. UBR — Unbilled Revenue Report

**What it shows:** Revenue earned by the business but not yet invoiced to customers — Work in Progress (WIP) and accrued income balances. Unbilled amounts per project, per entity, and per customer. Age of unbilled balances (how long revenue has been earned but not invoiced). Trend of UBR across periods — growing UBR signals billing lag. Flags entities or projects where unbilled balances exceed a configurable threshold.

**Source:** BC `generalLedgerEntries` for accounts classified as WIP / accrued income (specific GL account codes configured during onboarding). Customer ledger entries where invoiced amount < recognised amount. WIP journal entries from BC project module where applicable.

**Value to RIA Advisory:** UBR is invisible in standard BC reports. This report surfaces cash that is owed but not yet billed — enabling the finance team to accelerate billing and reduce Days Sales Outstanding (DSO).

---

##### 5. AR — Accounts Receivable Report

**What it shows:** Complete open AR position across all 17 entities. Total outstanding receivables balance. Aging buckets: Current (0–30 days), 31–60 days, 61–90 days, 90+ days (overdue). Per-entity AR breakdown. Per-customer AR detail. Days Sales Outstanding (DSO) calculated per entity. Receivables trend over time — is the AR balance growing or shrinking? Identifies entities with highest overdue exposure.

**Source:** BC `customerLedgerEntries` — all open entries (remaining amount > 0). Applied against BC `customers` master for customer name and credit terms. All 17 subsidiaries.

**Value to RIA Advisory:** The AR report is the single most-requested addition to any finance team's toolkit. This delivers it across the entire group in real time — without a single Excel extraction.

---

##### 6. Single Sign-On (Azure Entra ID / MSAL)

**What it delivers:** RIA Advisory users log in to i-finsights using their existing **Microsoft 365 credentials** — the same username and password they use for Outlook, Teams, and Business Central. No new password to remember. No separate account to create. Azure Entra ID (formerly Azure AD) handles authentication via MSAL (Microsoft Authentication Library). Token-based session with automatic refresh. Role mapping from Azure AD groups to i-finsights RBAC roles.

**Configuration required:** i-Source registers i-finsights as an Azure Enterprise Application in RIA Advisory's Azure AD tenant. RIA Advisory IT team provides temporary Azure AD admin access (one-time, during onboarding week). Takes approximately 2 hours to configure and test.

**Value to RIA Advisory:** Zero password management overhead. Users are onboarded and offboarded through Azure AD — the same system HR already uses. When an employee leaves, disabling their Microsoft 365 account automatically revokes i-finsights access.

---

#### Phase 1 Delivery Checklist

- [ ] All 17 BC tenants authenticated — OData API connected, data flowing
- [ ] Collections Report live — aged receivables by customer, all entities
- [ ] Invoicing Report live — posted invoices with drill-through, all entities
- [ ] Revenue Report live — monthly revenue by entity and account
- [ ] UBR Report live — unbilled balances flagged by entity and project
- [ ] AR Report live — open receivables with aging buckets, DSO per entity
- [ ] Azure Entra ID SSO live — RIA users log in with Microsoft 365 credentials
- [ ] All RIA Advisory users created, subsidiaries assigned, roles set
- [ ] Data pipeline running on schedule — GL, invoices, customer ledger from BC API

---

### 6.2 Phase 2 — Full Platform

**Dependency:** Phase 1 live and accepted by RIA Advisory finance team.

**Goal:** Complete financial intelligence platform — executive dashboards, full report suite, multi-dimensional analytics, monthly close automation, and AI-driven commentary.

> Phase 2 scope is the full feature set described in Sections 5.2 through 5.6 of this document. All items below are out of scope for Phase 1.

#### Phase 2 — Data Infrastructure

| Feature | Notes |
|---|---|
| GL Code Mapping and Account Grouping | All 17 entity GL codes → canonical 4-level hierarchy. RIA Controller sign-off gate. |
| Dimension Framework (7 dimensions) | Department, Project, Vertical, Geography, Currency, Doc Type — all mapped. |
| IC Elimination Engine | Intercompany pairs identified, counterparty rules configured, elimination entries posted. |
| FX Translation | All amounts → USD. Period-average and period-end rates. |
| Gold Layer — Star Schema | Built on verified mappings. Analytics-ready fact tables with 12 dimensions. |

#### Phase 2 — Dashboards

| Feature | Notes |
|---|---|
| Executive Dashboard | Group P&L · KPI tiles · AR/AP aging · Entity grid · Department heatmap |
| Entity Detail View | Drill-through to entity P&L, Trial Balance, Balance Sheet, GL entries |
| Close Cockpit | Entity sign-off, IC reconciliation status, close timeline |
| GL Explorer (with account groups) | Full-text GL search with canonical account groupings applied |

#### Phase 2 — Core Financial Reports

| Report | Notes |
|---|---|
| P&L Analytics | Monthly waterfall — Revenue → COGS → Gross Profit → EBITDA → Net Income |
| Trial Balance | Account-level Debit / Credit / Net per entity, per period |
| Balance Sheet | Assets, Liabilities, Equity — requires Balance Sheet groupings from GL mapping |
| AP Aging | Vendor payables aging — mirrors AR report structure |
| Cash Flow Statement | Operating, Investing, Financing — indirect method |
| KPI Dashboard | Current Ratio, EBITDA Margin, DSO, Debt-to-Equity |

#### Phase 2 — Additional Reports and Analytics

| Feature | Notes |
|---|---|
| Financial Health Score | Composite 0–100 score with grade A–F |
| Expense Analysis | OpEx breakdown by GL account and department |
| Department Spend Heatmap | Cross-entity spend by department code |
| Project Financials | Revenue, COGS, OpEx, Net per project |
| Vertical Analytics | Business unit P&L across entities |
| Entity Comparison | Side-by-side subsidiary benchmarking |
| Customer Insights | Top customers by revenue contribution |
| Posted Sales Insights | Full invoice analytics from fact_posted_sales |
| Multi-Dimensional Analytics Workbench | Full interactive workbench for analysts |
| Monthly Income Report | Month-by-month revenue and income trend |
| GL Insights and CoA Insights | Account-level balance and mapping visibility |

#### Phase 2 — Operations and Automation

| Feature | Notes |
|---|---|
| Monthly Close Automation | Task assignment, controller sign-off, IC reconciliation, auto-escalation |
| Data Lineage (column-level) | Audit/compliance — BC source field → dashboard KPI |
| Security and Compliance Audit Module | Audit log viewer, RBAC audit, retention configuration |
| Subsidiary Onboarding Wizard | Step-by-step onboarding for future BC entities |
| Pipeline Health Monitor (advanced) | Extended run history, DQ exceptions, alert thresholds |

#### Phase 2 — Intelligence (AI)

| Feature | Notes |
|---|---|
| AI-generated variance commentary | Auto-drafted narrative on P&L variances |
| Anomaly detection | ML-based outlier flagging on GL entries |
| Natural language query | Ask financial questions in plain English |
| WhatsApp / Slack / Teams daily briefing | CFO digest to messaging apps |

#### Phase 2 — Additional ERP Connectors (Paid Add-Ons)

| ERP | Availability |
|---|---|
| SAP S/4HANA | Q3 2026 — add-on |
| Microsoft Dynamics 365 Finance | Q4 2026 — add-on |
| Oracle ERP Cloud | Q4 2026 — add-on |
| Odoo | Q4 2026 — add-on |
| NetSuite | Q4 2026 — add-on |
| Mobile app (iOS / Android) | Q4 2026 |
| Multi-client SaaS / partner model | Q1 2027 |

---

### 6.3 Delivery Summary

| Phase | Scope | Gate |
|---|---|---|
| **Phase 1** — Collections, Invoicing, Revenue, UBR, AR + SSO | 5 reports + SSO only | RIA Advisory finance team acceptance |
| **Phase 2** — Full Platform | All dashboards, reports, analytics, close automation, AI | Phase 1 accepted + GL mapping sign-off by RIA Controller |

---

## 7. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | SPA dashboard, 51 pages |
| **Charts** | Recharts | Bar, line, waterfall, heatmap — no licensing cost |
| **Auth (SSO)** | Azure Entra ID (MSAL) | Enterprise SSO, no password management |
| **Auth (local)** | JWT + bcrypt | Stateless API auth, role-based access |
| **Backend** | FastAPI + Python 3.11 | 9 routers, ~65 REST endpoints |
| **Database** | PostgreSQL — Star Schema | 3 fact tables, 12 dimensions, ~200K analytical rows |
| **ERP Integration** | **Business Central only** — OData API v2.0 + Certificate OAuth | Included. Other ERP connectors (SAP, Oracle, Odoo, NetSuite) available as paid add-ons. |
| **Data Pipeline** | Python ETL (pandas) | Bronze → Silver → Gold transformations |
| **Frontend Deploy** | Self-hosted Nginx | Docker-based, on-premise control, no CDN costs |
| **Backend Deploy** | Azure Container Apps (target) | Scalable, managed, close to BC tenants |

**Total cost of ownership:** Dramatically lower than Cognos, Hyperion, or OneStream — with full source code ownership and no per-user BI licensing.

---

## 8. Hardware Requirements — To Be Provided by RIA Advisory

This section applies to the **On-Premises (self-hosted) deployment model** where i-finsights will be deployed on infrastructure owned and operated by RIA Advisory. i-Source Infosystems will supply all software, Docker images, deployment runbooks, and configuration scripts.

> **Note:** If RIA Advisory chooses the **Cloud (SaaS) model**, no hardware is required — i-Source manages all infrastructure. See [06_Pricing_Cloud.md](06_Pricing_Cloud.md) for cloud pricing details.

---

### 8.1 Recommended Configuration — Professional (All 17 Subsidiaries)

This is the recommended specification for RIA Advisory's full deployment covering all 17 BC subsidiaries and up to 100 concurrent finance users.

#### Application and Database Server (Primary)

| Component | Minimum | Recommended |
|---|---|---|
| **CPU** | 8 vCPU | 16 vCPU |
| **RAM** | 16 GB | 32 GB |
| **Application Disk** (OS + Docker + application containers) | 100 GB SSD | 200 GB NVMe SSD |
| **Data Disk** (PostgreSQL database + document storage) | 500 GB SSD | 1 TB NVMe SSD |
| **Network** | 1 Gbps | 1 Gbps |
| **Operating System** | Ubuntu Server 22.04 LTS | Ubuntu Server 22.04 LTS |

#### Optional Standby / Replica Server

For high availability (strongly recommended for production):

| Component | Specification |
|---|---|
| **CPU** | Same as primary (8–16 vCPU) |
| **RAM** | Same as primary (16–32 GB) |
| **Disk** | Same as primary — PostgreSQL streaming replication |
| **Role** | PostgreSQL standby + hot standby for read workloads |

---

### 8.2 Network Requirements

| Requirement | Detail |
|---|---|
| **Internal DNS** | Hostname resolvable on RIA network (e.g., `finsights.ria.internal`) |
| **Load Balancer / Reverse Proxy** | Nginx (supplied by i-Source in Docker image) or hardware LB |
| **Inbound ports** | 80 (HTTP redirect) and 443 (HTTPS) only |
| **Outbound HTTPS** | Server must reach `api.businesscentral.dynamics.com` for BC API calls |
| **Outbound HTTPS** | Server must reach `login.microsoftonline.com` for Azure Entra ID SSO |
| **Inter-container traffic** | Stays within Docker bridge network — no external exposure |
| **SSL/TLS Certificate** | Valid certificate required — Azure-issued, internal CA, or Let's Encrypt accepted |
| **SMTP Relay** | Internal or external SMTP for system alerts and pipeline notifications |

---

### 8.3 Software Prerequisites (installed by RIA IT team before deployment)

All software below is open source or community edition. No third-party licensing fees.

| Software | Version | Purpose |
|---|---|---|
| Ubuntu Server | 22.04 LTS | Host operating system |
| Docker Engine | 26.x | Container runtime |
| Docker Compose | v2.x | Service orchestration |
| Git | 2.x | For receiving i-Source deployment packages |

> i-Source Infosystems will install and configure all remaining application software (PostgreSQL, Redis, MinIO, Nginx, Python, Node.js) as part of the deployment runbook.

---

### 8.4 Services Provisioned by i-Source (Inside Docker)

The following services are packaged and deployed by i-Source — RIA Advisory does not need to install or manage these separately:

| Service | Port | Purpose |
|---|---|---|
| Nginx | 80 / 443 | Reverse proxy, SSL termination |
| React Frontend | 5173 (internal) | Web application |
| FastAPI Backend | 8000 (internal) | REST API layer |
| PostgreSQL 16 | 5432 (internal) | Star schema database |
| Redis 7 | 6379 (internal) | API response cache |
| MinIO | 9000 / 9001 (internal) | Document and object storage |

---

### 8.5 Access Required from RIA IT Team

For deployment and go-live, i-Source will need RIA IT to provide:

| Access | Purpose | When |
|---|---|---|
| SSH access to the server (temporary, key-based) | Deployment and configuration | Week 1 of sprint |
| Azure AD tenant admin (temporary) | Configure Entra ID SSO app registration | Week 1 of sprint |
| BC tenant admin access for OAuth setup | Certificate-based OAuth configuration for all 17 tenants | Week 1 of sprint |
| SMTP relay credentials | System alert emails | Week 2 of sprint |
| SSL certificate and private key | HTTPS configuration | Before go-live |
| DNS entry creation | Point hostname to server IP | Before go-live |

---

### 8.6 Minimum vs Recommended — Summary

| Scenario | Minimum | Recommended |
|---|---|---|
| Growth (up to 5 BC tenants, 20 users) | 4 vCPU / 8 GB RAM / 250 GB disk | 8 vCPU / 16 GB RAM / 600 GB disk |
| **Professional — Full RIA Advisory (17 tenants, 100 users)** | **8 vCPU / 16 GB RAM / 600 GB disk** | **16 vCPU / 32 GB RAM / 1.2 TB disk** |
| Enterprise (100+ users, HA required) | 2 nodes × 16 vCPU / 32 GB | 4 nodes + dedicated DB server |

> **RIA Advisory's required spec (all 17 BC tenants):** Professional — Recommended tier.

---

## 9. Current State

| Metric | Value |
|---|---|
| Features built | 51 of 51 (100%) |
| GL entries indexed | 188,380 |
| Subsidiaries connected | 17 |
| Canonical accounts mapped | 474 |
| Dimensions defined | 7 frameworks (company, dept, project, vertical, geo, currency, doc type) |
| API endpoints | ~65 across 9 routers |
| Test coverage | 20 Playwright E2E tests across 4 spec files |
| Frontend deployment | Self-hosted Docker at http://localhost:5002 (dev) |
| Dashboard query performance | < 2 seconds (P95) |

---

## 10. Deployment Options

i-finsights can be deployed in two models. Detailed pricing for each is documented separately.

### 10.1 Cloud (SaaS) — Recommended

i-finsights is hosted, managed, and operated on a secure cloud infrastructure (Azure, co-located with BC tenants for low-latency API access). RIA Advisory accesses it via browser with existing Azure Entra ID SSO — no new credentials required. **No hardware provisioning needed from RIA Advisory.**

```
RIA Advisory Users (Browser / Mobile)
        │
        ▼
Azure CDN + Load Balancer (SSL)
        │
        ▼
Docker/Nginx (React Frontend)   +   Self-hosted (FastAPI Backend)
        │                                    │
        └───────────────┬────────────────────┘
                        │
                   Azure PostgreSQL
                        │
        17 BC Tenants (OData API — Azure-to-Azure, low latency)
```

**Key advantages:**
- Azure-native — backend co-located with BC tenants, minimal latency on API calls
- Existing Azure Entra ID — users log in with their Microsoft 365 credentials, no new passwords
- No infrastructure investment — i-Source manages hosting, monitoring, and upgrades
- Instant access — demo ready at http://localhost:5002

→ **Full pricing details:** [06_Pricing_Cloud.md](06_Pricing_Cloud.md)

---

### 10.2 On-Premises (Self-Hosted)

i-finsights is deployed entirely within RIA Advisory's own data center or private Azure subscription. i-Source provides the software packages, Docker images, deployment runbooks, and support. **RIA Advisory provisions the hardware as specified in Section 8.**

```
RIA Advisory Internal Network
        │
        ▼
Docker Host (Customer-managed — RIA Advisory hardware)
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

## 11. Value Delivered to RIA Advisory

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

## 12. Competitive Context

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

## 13. Product Roadmap

| Phase | Scope | Capabilities |
|---|---|---|
| **Phase 1 — Revenue and Receivables + SSO** | Initial delivery | **Collections** (AR aging by customer) · **Invoicing** (posted sales invoices) · **Revenue** (monthly revenue by entity and account) · **UBR** (unbilled / accrued revenue) · **AR** (open receivables with aging + DSO) · **Azure Entra ID SSO** |
| **Phase 2 — Full Platform** | Post Phase 1 acceptance | GL code mapping · Gold layer · Executive Dashboard · P&L, Balance Sheet, Trial Balance, Cash Flow, KPI · Expense Analysis · Department Spend · Project Financials · Vertical Analytics · Entity Comparison · Close Cockpit · Multi-Dim Analytics · AI commentary · Anomaly detection · Natural language query |
| **Phase 2 — Additional ERP Connectors** | Q3–Q4 2026 (paid add-ons) | SAP S/4HANA · Dynamics 365 Finance · Oracle · Odoo · NetSuite — each as a separate paid connector license |
| **Phase 2 — Mobile + Platform** | Q4 2026 – Q1 2027 | Mobile app (iOS / Android) · Multi-client SaaS · Partner reseller model |

---

## 14. Summary and Next Steps

i-finsights gives RIA Advisory what no off-the-shelf BI tool or ERP report can: a **real-time, auditable, fully automated financial intelligence platform** that is native to Business Central, built around the monthly close cycle, and owned entirely by RIA Advisory.

**Phase 1** puts the five most immediately valuable reports — Collections, Invoicing, Revenue, UBR, and AR — into the hands of RIA Advisory's finance team quickly, alongside Single Sign-On so every user logs in with their existing Microsoft 365 credentials. No waiting for the full platform. No Excel extraction. Real data, from BC, in your browser, from day one.

**Phase 2** delivers the complete platform: Executive Dashboards, consolidated P&L, Balance Sheet, Cash Flow, close automation, AI commentary, and multi-dimensional analytics — built on the verified GL mapping foundation established in Phase 1.

### Proposed Next Steps

| Step | Owner | Timeline |
|---|---|---|
| Review concept note and pricing documents | RIA Advisory | This week |
| Clarification call — Phase 1 scope walkthrough and Q&A | i-Source + RIA Advisory | TBD |
| Decision: Cloud vs On-Premises deployment model | RIA Advisory | Before contract |
| If On-Premises: confirm hardware specification (Section 8) | RIA Advisory IT | Before contract |
| Contract and SOW signing | Both parties | TBD |
| Kick-off — Phase 1 delivery begins | i-Source | Week 1 post-signing |
| Phase 1 go-live — Collections, Invoicing, Revenue, UBR, AR + SSO live | i-Source | To be agreed at kick-off |
| Phase 1 acceptance — RIA Advisory finance team sign-off | RIA Advisory | Post go-live |
| Phase 2 kick-off — Full platform delivery begins | i-Source | Post Phase 1 acceptance |

---

*Concept note prepared and submitted by i-Source Infosystems to RIA Advisory*  
*Version 1.2.0 | 2026-05-06 — Phase 1 / Phase 2 restructure*  
*For queries: contact i-Source Infosystems account team*  
*Next Review: 2026-06-05*
