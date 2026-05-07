# i-finsights — Vision & Idea

**Product:** i-CFO360 (Unified Financial Intelligence Platform)
**Organisation:** RIA Advisory, powered by i-Source Infosystems
**Deployed at:** Self-hosted Docker + Nginx

---

## The Problem

RIA Advisory operates **17 independent Business Central (BC) SaaS tenants** — one per subsidiary — across multiple geographies, currencies, and business verticals.

Every month, the Group Controller spends **8–10 business days** on:

| Pain Point | Impact |
|-----------|--------|
| Manual Excel extraction from 17 BC tenants | Error-prone, time-consuming |
| VLOOKUP-based consolidation across entities | Zero audit trail |
| Email-driven IC reconciliation & sign-off | No accountability, missed deadlines |
| No intra-month P&L visibility | Leadership flies blind until close |
| No programmatic auth to BC APIs | Manual exports, no automation |
| No data quality monitoring | Dirty data reaches reports |
| No drill-through from group to GL level | Analysts re-extract on every query |

**The result:** Leadership receives financial statements 8–10 days after month-end, by which point decisions based on stale data have already been made.

---

## The Idea

**Build a single, real-time financial intelligence platform that:**

1. **Connects directly** to all 17 BC tenants via certificate-based OAuth — no manual exports
2. **Ingests, transforms, and consolidates** GL data through a Bronze → Silver → Gold data pipeline with built-in quality gates
3. **Eliminates intercompany transactions** automatically with a configurable IC elimination engine
4. **Translates currencies** to USD using a configurable FX engine
5. **Delivers live dashboards** to the CFO, Controller, subsidiary controllers, and finance teams — with full drill-through from group P&L to individual GL entries
6. **Manages the monthly close** end-to-end: task assignments, IC reconciliation, sign-off workflows, and close timeline tracking
7. **Enforces data governance** with column-level lineage, DQ exceptions, audit logs, and role-based access per subsidiary

---

## The Vision

> **"One number. Real-time. From 17 subsidiaries. Down to a single GL entry."**

i-finsights becomes the **single source of financial truth** for RIA Advisory — eliminating the parallel Excel universe and replacing it with an auditable, automated, real-time platform that:

- Reduces monthly close from **10 days → 3 days**
- Gives CFO and Board **intra-month P&L visibility** (not just post-close)
- Enables subsidiary controllers to **self-serve** their entity financials without emailing HQ
- Creates an **audit-ready data trail** from every dashboard number back to its source BC journal entry
- Scales to **new subsidiaries** via an onboarding wizard (target: < 1 hour per new entity)

---

## Strategic Pillars

### 1. Automated Data Pipeline
Connect → Extract → Transform → Consolidate → Serve
No human in the data loop. Full orchestration with retry, fallback, and monitoring.

### 2. Conformed Data Model
Single canonical Chart of Accounts. Single dimension framework (entity, department, project, vertical, currency, geo). All 17 subsidiaries mapped to common dimensions.

### 3. Live Financial Intelligence
188,380+ GL entries indexed and queryable in under 2 seconds. Real-time dashboards. No stale data.

### 4. Governed Multi-Tenancy
Each organisation (RIA Advisory, iSource) has its own isolated tenant. Users see only their authorised subsidiaries. Role hierarchy enforces least-privilege access.

### 5. Close Automation
Monthly close managed in the platform: task lists, IC reconciliation, entity sign-off, Controller approval, and full close timeline with SLA tracking.

---

## Who Benefits

| Persona | Role | What They Get |
|---------|------|---------------|
| Group CFO (Elena) | Strategic | Live group P&L, KPIs, entity performance, Board-ready charts |
| Group Controller (Marcus) | Operational | Close Cockpit, IC sign-off, data quality oversight, 3-day close |
| Subsidiary Controller | Entity | Own entity Trial Balance, Balance Sheet, GL drill-through |
| Finance Analyst | Analytical | GL Explorer, 22 reports, multi-dimensional analytics |
| RIA Admin | Admin | Pipeline control, mapping console, user management |
| iSource Admin | Admin | Tenant config, user management, BC connection |
| Platform Superadmin | Platform | Tenant hub, multi-org management, billing |

---

## Competitive Context

| Capability | Excel + Email | Generic BI Tool | i-finsights |
|-----------|--------------|-----------------|-------------|
| BC API integration | Manual export | Custom connector needed | Native, certificate-based |
| IC elimination | Manual VLOOKUP | Manual configuration | Automated engine |
| Multi-tenant isolation | N/A | N/A | Built-in |
| Close workflow | Email chain | Out of scope | Close Cockpit |
| GL drill-through | N/A | Depends on data | 188K entries, < 2s |
| Time to first report | 10 days post-close | 5+ days post-close | Real-time |
| Data lineage | None | Limited | Column-level |
| Deployment | None needed | Cloud subscription | Netlify + FastAPI |

---

## Technology Bet

Built on a **modern, cost-effective stack** that RIA Advisory owns:

- **React 18 + TypeScript** — Fast, maintainable frontend; Netlify-hosted, zero infra cost
- **FastAPI (Python)** — High-performance REST API; deployable anywhere
- **PostgreSQL star schema** — Battle-tested OLAP-ready data warehouse
- **Azure Entra ID SSO** — Enterprise authentication, no password management
- **Power BI embedded** — Board-quality visualisations where needed

Total cost of ownership dramatically lower than Cognos, Hyperion, or OneStream — with full source code ownership and no per-user licensing.

---

## North Star Metric

> **Close cycle ≤ 3 business days with zero manual Excel steps.**

Secondary metrics:
- Dashboard P95 load time < 2.5 seconds
- Data completeness ≥ 99.5% across all 17 entities
- Zero audit findings on data access trail
- Subsidiary onboarding time < 1 hour
