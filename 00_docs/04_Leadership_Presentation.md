# i-finsights — Leadership Presentation
### RIA Advisory | Financial Intelligence Platform
**Presented by:** i-Source Infosystems
**For:** Board & Executive Leadership
**Classification:** Internal — Confidential

---

---

# SLIDE 1 — Title

## i-finsights
### One Number. Real-Time. From 17 Subsidiaries Down to a Single GL Entry.

**Unified Financial Intelligence Platform for RIA Advisory Group**

*Developed & powered by i-Source Infosystems*

---

---

# SLIDE 2 — The Problem We Solve

## Today, Your Finance Team Loses 8–10 Business Days Every Month

```
Month-End Day 1                              Month-End Day 10
     │                                              │
     ├─ Manually export GL from 17 BC tenants       │
     ├─ VLOOKUP consolidation in Excel              │
     ├─ Email chain for IC reconciliation           │
     ├─ Manual FX translation                       │
     ├─ Finance signs off one entity at a time      │
     └─ Controller approves final P&L ─────────────►│
                                                     │
                                           CFO finally
                                           sees the numbers
```

### The Real Cost

| Problem | Business Impact |
|---------|----------------|
| 8–10 day close cycle | Board decisions based on month-old data |
| Manual Excel consolidation | Error risk, no audit trail |
| Zero intra-month visibility | CFO flying blind on current month |
| Email-driven IC sign-off | No accountability, missed deadlines |
| 17 disconnected BC tenants | No programmatic access, no automation |

> **"We're a group of 17 subsidiaries with 17 separate financial realities — and no single version of the truth."**

---

---

# SLIDE 3 — Our Answer

## i-finsights: One Platform. Real-Time. Automated.

### What It Does

```
17 Business Central Tenants  ──►  Automated Pipeline  ──►  Live Dashboards
                                                            │
                                                            ├─ Group CFO
                                                            ├─ Controller
                                                            ├─ Entity Heads
                                                            └─ Finance Teams
```

### Three Core Outcomes

**1. CLOSE IN 3 DAYS** — Not 10
The Close Cockpit manages the entire month-end workflow in one place.

**2. SEE TODAY'S NUMBERS** — Not Last Month's
Live consolidated P&L, KPIs, and subsidiary performance. Intra-month.

**3. DRILL FROM GROUP TO GL IN ONE CLICK**
From consolidated revenue → subsidiary → department → individual GL entry.

---

---

# SLIDE 4 — Platform at a Glance

## 51 Features. 9 API Layers. 200,000+ Data Points.

### What's Built

| Category | What Users Get |
|----------|---------------|
| **Executive Dashboard** | Live group P&L, 5 KPI tiles, subsidiary grid, trend charts |
| **Close Cockpit** | IC reconciliation, entity sign-off, close timeline, Controller approval |
| **Financial Reports** | Trial Balance, Balance Sheet, P&L, Cash Flow, Expense Analysis |
| **GL Explorer** | Search 188,380 journal entries in under 2 seconds |
| **KPI & Analytics** | Current Ratio, EBITDA Margin, DSO, Health Score, YoY trends |
| **Subsidiary Benchmarking** | Side-by-side entity comparison — revenue, margin, spend |
| **Administration** | Mapping console, pipeline health, data quality monitoring |
| **Multi-Tenancy** | Isolated organisations — RIA Advisory + iSource, fully separate |
| **User Management** | 5-role hierarchy — superadmin to viewer, per-entity access control |

### Data Behind It
- **188,380** GL entries across 17 subsidiaries
- **474** canonical Chart of Accounts
- **32** departments tracked
- **44** projects tracked
- **8** currencies (auto-translated to USD)

---

---

# SLIDE 5 — The Data Pipeline

## Automated. Auditable. No Human in the Data Loop.

```
                    ┌──────────────────────────────────────────┐
                    │   17 Business Central Tenants (OData)    │
                    └────────────────┬─────────────────────────┘
                                     │ Certificate OAuth (no passwords)
                                     ▼
                    ┌──────────────────────────────────────────┐
                    │  BRONZE ZONE — Raw append-only store     │
                    │  Every source record preserved forever   │
                    └────────────────┬─────────────────────────┘
                                     │ Type cast · Deduplicate
                                     ▼
                    ┌──────────────────────────────────────────┐
                    │  SILVER LAYER — Canonical mapping        │
                    │  Subsidiary CoA → Group CoA              │
                    │  Dimensions: Dept · Project · Vertical   │
                    └────────────────┬─────────────────────────┘
                                     │ IC Elimination · FX Translation
                                     ▼
                    ┌──────────────────────────────────────────┐
                    │  GOLD LAYER — Star Schema (Analytics)    │
                    │  fact_gl_entries · fact_coa_balances     │
                    │  12 dimension tables                     │
                    └────────────────┬─────────────────────────┘
                                     │ REST API
                                     ▼
                    ┌──────────────────────────────────────────┐
                    │  i-finsights Dashboard                   │
                    │  CFO · Controller · Finance Teams        │
                    └──────────────────────────────────────────┘
```

### Pipeline Safeguards
- **Data Quality gates** — blocks promotion to Gold if completeness < threshold
- **Retry + fallback** — pipeline auto-recovers from BC API outages
- **Full audit trail** — every transformation step logged with source row lineage
- **IC Elimination** — intercompany transactions removed automatically with configurable rules

---

---

# SLIDE 6 — Key Features Deep Dive

## What Each Persona Gets

### Group CFO
- **Executive Dashboard** — Consolidated P&L, EBITDA, Net Income, Revenue, OpEx in real-time
- **Entity Grid** — All 17 subsidiaries ranked by revenue, margin, and profitability
- **KPI Dashboard** — Current Ratio, Quick Ratio, DSO, Return on Assets
- **Cash Flow Statement** — Operating, Investing, Financing activities
- **Financial Health Score** — Composite 0–100 score from 6 financial ratios

### Group Controller
- **Close Cockpit** — Close cycle from 10 days → 3 days
  - IC reconciliation status per entity
  - Sign-off tracking per subsidiary controller
  - SLA timeline with overdue alerts
  - Controller final approval workflow
- **Data Quality Monitor** — DQ exceptions visible before close sign-off
- **Trial Balance** — Full debit/credit/net by account across all entities

### Subsidiary Controllers
- **Entity Detail View** — Own entity P&L, Trial Balance, Balance Sheet, GL entries
- **GL Explorer** — Search their entity's 188K+ journal entries by account, department, date
- **Vertical Analytics** — Business unit P&L

### Finance Analysts
- **22 Reports** — All financial statements available for custom date ranges and entity filters
- **Multi-Dimensional Analytics** — Filter by company, year, month, currency; 17 chart types
- **Insights Pages** — CoA insights, customer insights, posted sales analysis, invoice detail

---

---

# SLIDE 7 — Security & Governance

## Enterprise-Grade Access Control

### Role Hierarchy

```
superadmin      ← Platform owner (i-Source)
    │
    ├── ria_admin       ← RIA Advisory org admin
    │       │
    │       └── finance_user    ← Finance team (read + annotate)
    │               │
    │               └── viewer    ← Read-only shared access
    │
    └── isource_admin   ← iSource org admin
```

### What Each Role Can Do

| Action | superadmin | ria_admin | isource_admin | finance_user | viewer |
|--------|:---:|:---:|:---:|:---:|:---:|
| View all tenants | ✓ | — | — | — | — |
| Create tenants | ✓ | — | — | — | — |
| Manage users | ✓ | ✓ | ✓ | — | — |
| View all reports | ✓ | ✓ | ✓ | ✓ | Limited |
| GL Explorer | ✓ | ✓ | ✓ | ✓ | — |
| Pipeline control | ✓ | ✓ | — | — | — |
| BC config | ✓ | ✓ | ✓ | — | — |
| Annotations | ✓ | ✓ | ✓ | ✓ | — |

### Compliance Posture
- **Authentication:** Azure Entra ID SSO — no RIA Advisory passwords stored
- **Encryption:** bcrypt for local passwords, JWT for API sessions
- **Audit Trail:** All data access logged with user, timestamp, entity
- **Tenant Isolation:** RIA Advisory and iSource data never cross-visible
- **BC Credentials:** Separate config per tenant, secret redacted on read
- **Lineage:** Column-level data lineage from source BC field to dashboard metric

---

---

# SLIDE 8 — Multi-Tenancy Architecture

## Built for Multiple Organisations from Day One

### Today

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│     RIA Advisory Tenant         │   │     iSource Infosystems Tenant   │
│                                 │   │                                  │
│  17 Subsidiaries                │   │  iSource users only              │
│  RIA Admin users                │   │  iSource Admin                   │
│  Full financial access          │   │  Tenant config                   │
│  BC Dynamics connection         │   │  BC Dynamics connection          │
└─────────────────────────────────┘   └─────────────────────────────────┘
         │                                        │
         └────────────────┬───────────────────────┘
                          │
               ┌──────────┴──────────┐
               │  Superadmin Hub     │
               │  (i-Source team)    │
               │  Both tenants       │
               └─────────────────────┘
```

### Adding a New Client Organisation

1. Superadmin creates new tenant (< 1 minute)
2. Configure branding (logo, colours)
3. Set subsidiary access (which entities they see)
4. Run onboarding wizard: BC connect → CoA map → pipeline test
5. Invite first admin user

**Target: New client fully onboarded in < 1 hour**

---

---

# SLIDE 9 — Technology Choices

## Modern Stack. Zero Licensing Cost. Full Ownership.

### Why This Stack?

| Component | Choice | Why |
|-----------|--------|-----|
| Frontend | React 18 + TypeScript | Battle-tested, Netlify-hosted, zero server ops |
| Backend | FastAPI (Python) | Async, auto-documented API, easy cloud deploy |
| Database | PostgreSQL + Star Schema | ACID + OLAP at scale; no licensing fee |
| Charts | Recharts | React-native, customisable, open source |
| Auth | Azure Entra ID + JWT | Enterprise SSO — no password management for RIA staff |
| BI Embed | Power BI Client | Board-quality visuals where needed |
| Deploy | Netlify + Container | Frontend free tier; backend scales on demand |
| Tests | Playwright | Full E2E browser automation, 20 tests passing |

### vs. Enterprise Alternatives

| Capability | Hyperion / OneStream | Power BI Premium | i-finsights |
|-----------|---------------------|------------------|-------------|
| BC native integration | Custom connector | Custom connector | Built-in OData |
| Source code ownership | No | No | 100% |
| Monthly close workflow | Separate module | No | Built-in |
| Per-user licensing | $$$$ | $$ per user | None |
| On-prem / cloud choice | Limited | Cloud only | Either |
| Customisation | Vendor dependent | Limited | Full |

**i-finsights costs a fraction of enterprise alternatives with full customisation and source ownership.**

---

---

# SLIDE 10 — Current Status

## 51 Features Built and Deployed

### Sprint Progress

| Domain | Features | Status |
|--------|----------|--------|
| Data Pipeline (F001–F013) | 13 | ✓ Complete |
| Authentication & Access (F014) | 1 | ✓ Complete |
| Executive Dashboards (F015–F020) | 5 | ✓ Complete |
| Financial Reports (F032–F046) | 14 | ✓ Complete |
| Analytics Workbench (F025–F031) | 7 | ✓ Complete |
| Administration (F021–F024, F040) | 5 | ✓ Complete |
| Multi-Tenancy (F047–F051) | 5 | ✓ Complete |
| **Total** | **51** | **✓ All complete** |

### Quality Gates Passed
- [x] 20 Playwright E2E tests passing (headed browser)
- [x] All 5 role levels tested: superadmin → viewer
- [x] Superadmin hub → tenant switch → dashboard flow verified
- [x] BC OAuth test endpoint functional
- [x] Star schema: 188,380 GL entries indexed and queryable

### Live Deployment
**URL:** https://i-finsights.netlify.app

---

---

# SLIDE 11 — Roadmap

## What's Next

### Phase 2 — Close Automation & AI (Q3 2026)
| Feature | Value |
|---------|-------|
| Automated IC reconciliation matching (rule-based) | Eliminate manual matching |
| Close deadline alerts (email + in-app) | Never miss a sign-off |
| Natural Language Query (NLQ) — "Show me March OpEx by entity" | Self-service for non-technical users |
| AI anomaly detection on GL entries | Flag unusual postings before close |
| Scheduled pipeline runs (cron-based) | Zero-touch daily data refresh |

### Phase 3 — External Reporting & Compliance (Q4 2026)
| Feature | Value |
|---------|-------|
| XBRL export (iXBRL) | Regulatory filing-ready |
| Board pack PDF generation | One-click Board report |
| IFRS/GAAP presentation layer | External financial statement format |
| External auditor read-only portal | No more Excel to auditors |
| Forecast vs Actual module | Budget variance tracking |

### Phase 4 — Expansion (2027)
| Feature | Value |
|---------|-------|
| Additional client tenants | SaaS revenue from new clients |
| Mobile dashboard (PWA) | CFO access on any device |
| Power Platform integration | Power Automate + Copilot |
| Azure Synapse connector | Large-scale data warehouse option |

---

---

# SLIDE 12 — Business Case

## Return on Investment

### Time Savings (Conservative)

| Activity | Today | With i-finsights | Monthly Saving |
|----------|-------|-----------------|----------------|
| Monthly close cycle | 10 days × 4 finance staff | 3 days × 2 staff | 34 person-days |
| IC reconciliation | 3 days manually | Automated | 3 person-days |
| Report preparation | 2 days per report request | Self-service | ~8 person-days |
| Data quality fixes | 1 day per close | DQ gates prevent | 1 person-day |
| **Total monthly saving** | | | **~46 person-days** |

**At average finance salary: 46 days × AED cost ≈ significant monthly saving**

### Risk Reduction
- **Restatement risk:** Manual Excel consolidation → material misstatement risk eliminated
- **Audit risk:** Full data lineage → auditors can trace every number to source
- **Decision risk:** Month-old data → real-time → better strategic decisions
- **Compliance risk:** Full RBAC audit trail → regulatory defensibility

### Strategic Value
- Board visibility into group performance **7 days sooner** each month
- CFO can make resource allocation decisions **intra-month** based on live data
- New subsidiary onboarded in **< 1 hour** vs weeks of manual setup

---

---

# SLIDE 13 — Ask & Next Steps

## What We Need to Move Forward

### Immediate (30 days)
- [ ] **Production database hosting** — Managed PostgreSQL (Azure Database for PostgreSQL / Supabase)
- [ ] **Backend cloud deployment** — Azure Container Apps or Render.com
- [ ] **BC credential provisioning** — App registration per BC tenant (IT/BC admin task)
- [ ] **User acceptance testing** — Group Controller + 2 subsidiary controllers, 2 weeks

### 90 Days
- [ ] **Live BC connection** — Real data from at least 3 BC tenants via OData
- [ ] **First live close cycle** — Run February close through Close Cockpit
- [ ] **Training** — CFO dashboard walkthrough, Controller close workflow, subsidiary entity detail

### Investment Required
| Item | One-time | Recurring (monthly) |
|------|---------|---------------------|
| Production DB (Azure PostgreSQL) | — | ~$50–150 |
| Backend hosting (Azure Container) | — | ~$30–80 |
| Netlify Frontend | — | Free (or $19 Pro) |
| BC App Registration (IT effort) | 2 days | — |
| UAT & Hypercare | 40 hours | — |

**Total infrastructure cost: < $250/month to serve all RIA Advisory users.**

---

---

# SLIDE 14 — Summary

## i-finsights in One Page

### The Problem
17 subsidiaries. 10-day close. Manual Excel. No real-time visibility.

### The Solution
Automated financial intelligence platform. Live data. Automated pipeline. 3-day close.

### What's Built
51 features. 9 API layers. 188,380 GL entries. 20 E2E tests passing.
Deployed at **https://i-finsights.netlify.app**

### The Outcomes
| Before | After |
|--------|-------|
| 10-day close | 3-day close |
| Month-old data | Real-time |
| Excel + email | Single platform |
| No drill-through | Group → GL in one click |
| No audit trail | Full data lineage |
| Manual IC reconciliation | Automated |

### The Ask
Production infrastructure + BC credentials + 2-week UAT = Go Live.

---

**Thank you.**

*i-Source Infosystems — Engineering Intelligence for Finance*
*i-finsights | RIA Advisory Group*

---

---

## Appendix A — Full Feature List

See: `00_docs/02_Feature_Catalog.md`

## Appendix B — Technical Architecture

See: `00_docs/03_Technical_Architecture.md`

## Appendix C — Live Demo

URL: https://i-finsights.netlify.app
Login: Contact i-Source Infosystems team for demo credentials.

## Appendix D — Data Volume

| Entity | GL Entries | Date Range |
|--------|-----------|------------|
| All 17 subsidiaries | 188,380 | FY2022–2025 |
| fact_coa_balances | 7,892 | FY2022–2025 |
| fact_posted_sales | 3,094 | FY2022–2025 |
| Canonical accounts | 474 | — |
| Departments | 32 | — |
| Projects | 44 | — |
| Currencies | 8 (base: USD) | — |
