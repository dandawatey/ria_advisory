# i-CFO360 — Intelligent CFO Platform
## Product Requirements Document v3.0

**Product:** i-Source i-CFO360
**Version:** 3.0 · Draft for Review
**Date:** 2026-04-30
**Owner:** Aarav_PM_001
**Reviewer:** Kabir_Reviewer_010 · Meera_Architect_002
**Status:** Draft
**Supersedes:** UFIP_PRD_v1.0.docx · PRD_02.md

---

## Document Control

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | Apr 2026 | CoE — Data & Platforms | UFIP: BC-only, RIA Advisory specific |
| 2.0 | Apr 2026 | Aarav_PM_001 | Multi-ERP connector framework |
| 3.0 | Apr 2026 | Aarav_PM_001 | Generic platform + combined + A2A Agentic Layer |

| Role | Responsibility |
|------|---------------|
| Executive Sponsor | Funding & business outcome owner |
| VP, Product | Program owner; architecture sign-off |
| Head of Finance Operations | Functional scope & UAT |
| CISO / Head of InfoSec | Security architecture & data residency |
| Chief Compliance Officer | Regulatory review |

---

## 1. Executive Summary

### Problem

Finance teams across multi-entity organizations face three compounding problems:

1. **Latency** — no group-level visibility between month-end cycles; decisions made on 3–10 day old data
2. **Manual consolidation** — Excel-based roll-ups are error-prone, unauditable, and do not scale with acquisitions
3. **ERP fragmentation** — parent may run SAP while subsidiaries run BC, Odoo, or JDE; a single consolidated view is impossible without a normalization layer

### Platform

**i-CFO360** is an AI-native multi-ERP financial intelligence platform built on five pillars:

| Pillar | Capability |
|--------|-----------|
| 1. Universal ERP Connectivity | Native API connectors for 7 major ERPs; automated ingestion replacing Excel exports |
| 2. Intelligent Data Lakehouse | Bronze / Silver / Gold medallion architecture with canonical CoA, IC elimination, FX translation |
| 3. Agentic Processing | 8 specialized AI agents communicating via A2A protocol; human-in-the-loop at every decision point |
| 4. Unified Analytics | Role-aware dashboards, close cockpit, variance explorer, natural-language Q&A |
| 5. Governed Security | RBAC, row-level security, WORM audit logs, compliance-ready data residency |

### Headline Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Consolidated close cycle | 8–10 business days | ≤ 3 business days |
| Data freshness | Monthly (manual export) | ≤ 6 hours (automated) |
| ERP systems supported | 1 | 7 |
| Manual consolidation effort | ~180 FTE hours/month | ≤ 40 FTE hours/month |
| Invoice processing time | 5–15 min/invoice | < 2 min (AI-assisted review) |
| Reporting error rate | 3–8% (manual keying) | < 0.25% variance |

---

## 2. Business Context & Problem Statement

### 2.1 Current State — Any Multi-Entity Organization

Each subsidiary or legal entity operates its own ERP instance with its own chart of accounts, dimension structure, fiscal calendar, and posting conventions. Consolidated reporting is produced through a manual process: subsidiary controllers export trial balances, email them to the group finance team, and a small team performs manual mapping, elimination, and aggregation in spreadsheets.

### 2.2 Pain Points

| Pain Point | Description |
|-----------|-------------|
| **Latency** | No ability to see group-level performance between period-end cycles |
| **Comparability** | Non-standard CoA, dimension taxonomies, and customer master data across entities make cross-entity comparison unreliable |
| **Auditability** | Manual spreadsheet consolidation fails traceability requirements from source to report |
| **Scalability** | Adding an acquired entity compounds manual effort linearly; model does not scale with growth |
| **Analytics** | Absence of a governed analytical store blocks investment in BI, forecasting, or AI-driven insight |

### 2.3 Target State

A single governed platform that:
- Ingests data from each ERP automatically via native APIs
- Harmonises it into a canonical model with a standard CoA and dimension framework
- Applies inter-company eliminations through configurable rule-based logic
- Exposes curated data products via APIs and a React application tailored to five primary personas
- Processes operational documents (invoices, AP entries) via AI agents with human oversight

---

## 3. Platform Vision & Strategic Pillars

### Pillar 1 — Universal ERP Connectivity

Connect to 7 major ERP systems via native APIs, JDBC/ODBC, or structured file import. No manual exports. Every connector implements the `ERPConnector` ABC with identical interface regardless of ERP type.

**Supported ERPs:** Business Central · Dynamics 365 Finance · SAP ECC/S4HANA · JD Edwards · Oracle ERP Cloud · Odoo · Tally Prime

### Pillar 2 — Intelligent Data Lakehouse

Three-zone medallion architecture:
- **Bronze** — raw, immutable extracts partitioned by entity and ingest date
- **Silver** — typed, schema-enforced, SCD-2 history, canonical CoA mapped
- **Gold** — conformed facts and dimensions; IC-eliminated; FX-translated; DQ-gated

### Pillar 3 — Agentic Processing (A2A)

Eight specialized AI agents communicating via the A2A (Agent-to-Agent) protocol. Each agent declares its capabilities via an Agent Card manifest. The OrchestratorAgent routes tasks to the appropriate agent. Any agent can pause and ask Finance a targeted question (human-in-the-loop) rather than failing silently.

### Pillar 4 — Unified Analytics

Role-aware dashboards (CFO, Controller, FP&A, Subsidiary Controller, Finance Clerk). Close cockpit, explorer, variance analysis, natural-language Q&A backed by InsightAgent.

### Pillar 5 — Governed Security

RBAC with Entra ID (or equivalent IdP). Row-level security by legal entity. WORM audit logs (7-year retention). Column-level masking for PII. Compliance-ready for SEC 204-2, IFRS, local GAAP, GDPR.

---

## 4. Objectives & Success Metrics

### Strategic Objectives

1. Establish a single, authoritative, audit-ready financial data platform
2. Enable near-real-time visibility into group performance for the CFO and board
3. Reduce unit cost and cycle time of consolidated reporting as the group scales
4. Eliminate manual ERP data entry for operational documents (invoices, AP entries)
5. Lay the groundwork for AI-driven insight: forecasting, anomaly detection, compliance automation

### North-Star KPIs

| KPI | Baseline | Target (12 months post-GA) |
|-----|----------|---------------------------|
| Consolidated close cycle (business days) | 8–10 | ≤ 3 |
| Data freshness (ERP → lake) | Monthly | ≤ 6 hours |
| Manual consolidation effort (FTE hours/month) | ~180 | ≤ 40 |
| Reconciliation variance vs. source GL | Unmeasured | < 0.25% |
| Entity onboarding time (acquisition → live) | Undefined | ≤ 30 calendar days |
| Platform availability (business hours) | N/A | 99.9% |
| DQ rule pass rate (Silver → Gold) | N/A | ≥ 99.5% |
| Invoice processing time | 5–15 min | < 2 min |
| ERP push success rate | Manual (100% human) | ≥ 99% automated |
| Agent HITL resolution time | N/A | < 4 hours business time |

---

## 5. Scope

### In Scope (Phase 1 GA)

- ERP connectors for 7 systems (BC and Odoo GA; SAP, Oracle, D365F, JDE, Tally Phase 2 connector hardening)
- Full data lakehouse: Bronze / Silver / Gold for GL entries, AR/AP invoices, CoA, dimensions
- Canonical CoA and dimension mapping layer
- IC elimination engine (configurable rules)
- FX translation (period-end, average, historical)
- React application for 5 personas
- A2A Agent Mesh: OrchestratorAgent, ERPConnectorAgent, DataQualityAgent, InvoiceAgent (GA)
- A2A Agent Mesh: ReconciliationAgent, ForecastingAgent, ComplianceAgent, InsightAgent (Phase 2)
- RBAC with row-level security by legal entity
- Audit logging (7-year WORM retention)
- Multi-tenant: one platform instance serving multiple organizations; tenant isolation enforced

### Out of Scope (Phase 1)

- Write-back from platform into source ERPs (read-only)
- Statutory filing generation (10-K, Form ADV); platform supplies data, not filings
- Mobile native apps (responsive web only in Phase 1)
- CRM, portfolio accounting, payroll ingestion (Phase 2)
- ERP push targets beyond Business Central for InvoiceAgent (Phase 2)
- Multi-level invoice approval workflow (Phase 2)

---

## 6. User Personas

| Persona | Role | Primary Needs | Key Screens |
|---------|------|---------------|-------------|
| **Group CFO** | C-suite | Consolidated P&L, cash position, variance to plan, entity drill-down | Executive dashboard; consolidated financials; KPI tiles |
| **Group Controller** | Finance operations | Close status, mapping exceptions, elimination controls, audit trail | Close cockpit; mapping workbench; audit log |
| **Subsidiary Controller** | Entity finance | Entity data quality, IC reconciliation, submission status | Entity view; DQ exceptions; IC recon console |
| **Head of FP&A** | Analytics | Trend analysis, forecasting, ad-hoc slicing, data export | Explorer; InsightAgent Q&A; export/API |
| **Finance Clerk** | AP / invoice processing | Upload invoices, review AI-extracted fields, approve ERP push | Invoice upload; review console; history page |

---

## 7. Platform Architecture — 5 Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: SOURCE ERPs                                                        │
│  BC · D365F · SAP · JDE · Oracle · Odoo · Tally · File Upload               │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Native APIs / JDBC / SFTP
┌──────────────────────────────────▼──────────────────────────────────────────┐
│  Layer 2: INGESTION — ERP Connector Framework                                │
│  ERPConnector ABC · Credential Vault · Health Monitor · Sync Scheduler      │
│  Incremental CDC · Retry/Circuit Breaker · Sync Audit Log                   │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Raw extracts
┌──────────────────────────────────▼──────────────────────────────────────────┐
│  Layer 3: INTELLIGENT LAKEHOUSE                                              │
│  Bronze (raw, immutable) → Silver (typed, SCD-2, CoA mapped)                │
│  → Gold (conformed facts, IC-eliminated, FX-translated, DQ-gated)           │
│  Unity Catalog / Purview · Lineage · Data Quality Rules                     │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Gold facts + REST API
┌──────────────────────────────────▼──────────────────────────────────────────┐
│  Layer 4: AGENTIC LAYER — A2A Agent Mesh                                    │
│  OrchestratorAgent · ERPConnectorAgent · DataQualityAgent                   │
│  ReconciliationAgent · InvoiceAgent · ForecastingAgent                      │
│  ComplianceAgent · InsightAgent                                             │
│  A2A Protocol · Agent Registry · Human-in-the-Loop                         │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ API / WebSocket
┌──────────────────────────────────▼──────────────────────────────────────────┐
│  Layer 5: EXPERIENCE — React 18 + TypeScript                                │
│  Executive Dashboard · Close Cockpit · Entity View · Explorer               │
│  Invoice Console · InsightAgent Q&A · Admin Console                        │
│  Entra ID SSO · RBAC · Row-Level Security                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Multi-ERP Integration Layer

### 8.1 ERPConnector ABC Interface

Every connector must implement:

```
connect(credentials: dict) → ConnectionStatus
test_connection() → ConnectionStatus
fetch_coa() → list[RawAccount]
fetch_gl_entries(from_date, to_date) → Iterator[RawGLLine]   ← async generator
fetch_dimensions() → list[RawDimension]
fetch_entities() → list[RawEntity]
get_sync_cursor() → SyncCursor
```

### 8.2 Supported ERPs

| ERP | Connection | Auth | GL Endpoint | Frequency |
|-----|-----------|------|-------------|-----------|
| Business Central | REST API v2.0 (OData) | OAuth2 — Azure AD client credentials | `/api/v2.0/companies({id})/generalLedgerEntries` | Real-time webhook + daily full sync |
| Dynamics 365 Finance | OData REST + Business Events | OAuth2 — Azure AD service principal | `GeneralJournalAccountEntries` entity | Near-real-time via Business Events |
| SAP ECC / S/4HANA | OData v4 (S4H Cloud); RFC/BAPI (ECC) | SAP OAuth2 / SSO / X.509 | S4H: `API_GLACCOUNTLINEITEM_SRV`; ECC: BKPF/BSEG tables | Configurable; event-driven for S4H Cloud |
| JD Edwards | JDBC (Oracle DB) + JDE AIS REST | Oracle DB auth / JDE token | `F0911` (Account Ledger); filter `GLLT='AA'` | Scheduled batch; CDC via DB triggers |
| Oracle ERP Cloud | Oracle REST API (SOAP fallback) | OAuth2 — Oracle IDCS | `GeneralLedgerJournalEntries` | Scheduled + real-time via Oracle Events |
| Odoo | JSON-RPC v2 | API key + session token | `account.move.line` model | Scheduled + webhook |
| Tally Prime | Tally XML Request/Response | Local HTTP; token for remote | `LEDGERVOUCHERS` report XML | Scheduled pull; no push events |

### 8.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-INT-01 | Authenticate to each ERP via its native auth mechanism; credentials from vault only | Must |
| FR-INT-02 | Full-load initial hydration + incremental CDC via delta tokens / Last-Modified | Must |
| FR-INT-03 | Twice-daily scheduled extraction minimum + on-demand close runs | Must |
| FR-INT-04 | Structured run metadata per extraction: entity, rows, bytes, duration, watermark, status | Must |
| FR-INT-05 | Exponential backoff, rate-limit-aware throttling, circuit breaker after N failures | Must |
| FR-INT-06 | Debit-positive normalization: all sign conventions normalized regardless of ERP native convention | Must |
| FR-INT-07 | Fallback ingestion path: secure SFTP drop for ERPs temporarily unable to expose APIs | Should |
| FR-INT-08 | Self-service entity catalog: register custom ERP API pages without code change | Should |

---

## 9. Data Lakehouse & Harmonisation

### 9.1 Zone Architecture

| Zone | Format | Mutability | Purpose |
|------|--------|-----------|---------|
| **Bronze** | Delta Lake, partitioned by entity + ingest_date | Immutable (WORM) | Raw source extracts; full history preserved for replay and audit |
| **Silver** | Delta Lake, SCD-2 history | Mutable (append + update) | Typed, schema-enforced; canonical CoA mapped; deduped by natural key |
| **Gold** | Delta Lake, consumption-optimized | Mutable (refresh) | IC-eliminated; FX-translated; DQ-gated; ready for dashboards and agents |

### 9.2 Canonical CoA — 4-Level Standard

```
L1: Financial Statement  — P&L | Balance Sheet | Cash Flow
L2: Category             — Revenue | COGS | OpEx | EBITDA | Current Assets | ...
L3: Subcategory          — Salaries | Rent | Marketing | Cash | Receivables | ...
L4: Source Account       — ERP-native account code (drill-down only)
```

All reports query at L1/L2/L3. Every L4 account maps to exactly one canonical account.

### 9.3 Conformed Data Model — Gold

**Fact Tables:**

| Table | Grain | Key Measures |
|-------|-------|-------------|
| `fact_gl_entry` | One row per GL posting line | amount_lcy, amount_usd, debit_amount, credit_amount |
| `fact_ar_invoice_line` | One row per AR invoice line | line_amount, tax_amount, discount_amount, margin_amount |
| `fact_ap_invoice_line` | One row per AP invoice line | line_amount, tax_amount, net_amount |
| `fact_bank_ledger` | One row per bank ledger entry | amount_lcy, amount_usd, running_balance |
| `fact_fx_rate` | One row per currency/date/type | rate (DECIMAL(20,8)) |

**Dimension Tables:**

| Table | Grain | SCD Type |
|-------|-------|---------|
| `dim_entity` | Legal entity / subsidiary | SCD-2 |
| `dim_account_canonical` | Canonical CoA node | SCD-2 |
| `dim_account_local` | ERP-native account mapped to canonical | SCD-2 |
| `dim_erp_source` | ERP connector configuration per tenant | SCD-2 |
| `dim_dimension_value` | Entity, Region, Client Segment, Service Line | SCD-2 |
| `dim_customer` | Group-harmonised customer master | SCD-2 |
| `dim_vendor` | Group-harmonised vendor master | SCD-2 |
| `dim_date` | Calendar + fiscal calendar | Static |
| `dim_currency` | ISO currencies | Static |

### 9.4 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-LAKE-01 | Bronze: immutable raw Delta tables; no overwrites | Must |
| FR-LAKE-02 | Silver: type casting, surrogate keys, SCD-2, canonical CoA mapping | Must |
| FR-LAKE-03 | Canonical CoA owned and approved by group finance; two-person approval workflow for mapping changes | Must |
| FR-LAKE-04 | IC elimination engine: rule-based, configurable per entity pair; gross + eliminated views | Must |
| FR-LAKE-05 | FX translation: period-end (BS), average (IS), historical (equity) per stated policy | Must |
| FR-LAKE-06 | DQ rules (Great Expectations or equivalent); FAIL blocks Silver → Gold promotion | Must |
| FR-LAKE-07 | Full column-level lineage: Bronze field → Gold consumption field | Must |

---

## 10. Agentic Layer — A2A Agent Mesh

### 10.1 Why Agentic?

Static pipelines cannot handle the ambiguity inherent in real-world financial data:
- Vendor names on invoices ≠ exact ERP master records
- Inter-company reconciliation requires reasoning across mismatched dimensions
- Compliance interpretation needs contextual judgment, not just rule matching
- Forecasting requires selecting the right model based on data characteristics

AI agents reason, adapt, coordinate with each other, and ask Finance targeted questions — rather than failing with a generic error.

### 10.2 A2A Protocol

Based on the Google A2A open specification. Each agent is an A2A-compatible HTTP server.

**Core concepts:**

| Concept | Description |
|---------|-------------|
| **Agent Card** | JSON manifest declaring: `name`, `capabilities[]`, `inputSchema`, `outputSchema`, `endpoint_url`, `model` |
| **Task** | Unit of work with `task_id`, `context`, `messages[]`, `artifacts[]`, `state` (submitted → working → completed / failed) |
| **Agent Registry** | Central DB table (`dim_agent_registry`) storing all Agent Cards; queried by OrchestratorAgent for routing |
| **OrchestratorAgent** | Receives user intents; looks up Agent Registry; creates Task; dispatches to capable agent; aggregates results |
| **HITL** | Any agent can call `request_human_input(field, question, options[])` → pauses tool loop → Finance answers → agent resumes |

**Communication flow:**
```
User Intent → OrchestratorAgent
  → query dim_agent_registry for matching capability
  → create Task → POST to target agent's A2A endpoint
  → target agent processes (tool loop)
    → if ambiguous: call request_human_input → PAUSE
    → Finance answers via UI → agent RESUMES
  → agent returns Task result (completed/failed)
  → OrchestratorAgent aggregates → responds to user
  → all steps logged in fact_agent_task (immutable)
```

### 10.3 Agent Roster — 8 Agents

| Agent | Model | Status | Capabilities | Key Tools |
|-------|-------|--------|-------------|-----------|
| **OrchestratorAgent** | claude-sonnet-4-6 | Phase 1 | route_task, aggregate_results, manage_hitl | dispatch_task, get_agent_registry, request_human_input |
| **ERPConnectorAgent** | claude-haiku-4-5 | Phase 1 | sync_erp, test_connection, schedule_sync, health_check | connect_erp, fetch_gl, run_sync, get_health_status |
| **DataQualityAgent** | claude-haiku-4-5 | Phase 1 | validate_data, flag_exception, request_remediation | run_dq_rules, flag_exception, block_silver_promotion |
| **InvoiceAgent** | claude-sonnet-4-6 | GA (IC-27) | extract_invoice, validate_invoice, push_to_erp | extract_fields, validate_invoice, lookup_vendor, check_duplicate, request_human_input, push_to_erp, log_audit_event |
| **ReconciliationAgent** | claude-sonnet-4-6 | Phase 2 | reconcile_ic, detect_variance, alert_controller | match_ic_entries, compute_variance, create_alert, request_human_input |
| **ForecastingAgent** | claude-sonnet-4-6 | Phase 2 | forecast_revenue, model_scenario, detect_trend | query_gold_facts, run_forecast_model, generate_scenario |
| **ComplianceAgent** | claude-haiku-4-5 | Phase 2 | audit_trail, check_retention, flag_regulatory | query_audit_log, check_retention_policy, generate_compliance_report |
| **InsightAgent** | claude-sonnet-4-6 | Phase 2 | natural_language_query, generate_sql, explain_variance | nl_to_sql, query_gold, explain_result, visualize_result |

### 10.4 Agent Communication Scenarios

| Scenario | Agent Flow |
|---------|-----------|
| Invoice uploaded by Finance Clerk | InvoiceAgent → (if vendor ambiguous) → request_human_input → Finance confirms → push_to_erp → log_audit_event |
| ERP sync fails after 3 retries | ERPConnectorAgent → OrchestratorAgent → notify Finance admin |
| Silver data fails DQ rule | DataQualityAgent → flag_exception → block Gold promotion → alert Controller |
| IC reconciliation mismatch | ReconciliationAgent → compute_variance → (if > threshold) → request_human_input from Controller |
| CFO asks "What is our Q1 margin by entity?" | InsightAgent → nl_to_sql → query_gold → explain_result → visualize |
| Compliance check on audit log | ComplianceAgent → query_audit_log → check_retention → generate_compliance_report |

### 10.5 Human-in-the-Loop (HITL) Protocol

```
1. Agent calls request_human_input(field, question, options[])
2. Backend stores question in pending_question JSONB column on relevant record
3. Agent tool loop pauses (returns PENDING token)
4. Frontend polls GET /api/{resource}/{id}
5. On pending_question detected → renders HITL question widget in UI
6. Finance selects answer → POST /api/{resource}/{id}/answer
7. Backend appends Finance answer to agent conversation history
8. Agent loop resumes with confirmed answer
9. Every HITL interaction logged in fact_agent_hitl_log (append-only, immutable)
```

### 10.6 A2A DB Schema

```sql
-- Agent registry (Agent Cards)
CREATE TABLE dim_agent_registry (
  agent_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              TEXT NOT NULL,           -- 'InvoiceAgent', 'DataQualityAgent', etc.
  endpoint_url      TEXT NOT NULL,
  model             TEXT NOT NULL,           -- 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'
  capabilities      JSONB NOT NULL,          -- ['extract_invoice', 'push_to_erp', ...]
  input_schema      JSONB,
  output_schema     JSONB,
  status            TEXT DEFAULT 'active',   -- active | suspended | deprecated
  version           TEXT DEFAULT '1.0',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Task log (all A2A task dispatches — append-only)
CREATE TABLE fact_agent_task (
  task_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  from_agent        TEXT NOT NULL,           -- 'OrchestratorAgent'
  to_agent          TEXT NOT NULL,           -- 'InvoiceAgent'
  capability        TEXT NOT NULL,           -- 'extract_invoice'
  input_payload     JSONB,
  output_payload    JSONB,
  state             TEXT NOT NULL DEFAULT 'submitted',  -- submitted|working|completed|failed
  error_message     TEXT,
  duration_ms       INTEGER,
  created_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

-- HITL interaction log (immutable)
CREATE TABLE fact_agent_hitl_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           UUID NOT NULL REFERENCES fact_agent_task(task_id),
  tenant_id         UUID NOT NULL,
  agent_id          TEXT NOT NULL,
  field_name        TEXT NOT NULL,
  question          TEXT NOT NULL,
  options           JSONB,
  answer            TEXT,
  answered_by       UUID REFERENCES users(id),
  asked_at          TIMESTAMPTZ DEFAULT now(),
  answered_at       TIMESTAMPTZ
);
```

---

## 11. Analytics & Reporting Capabilities

### 11.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-APP-01 | Single-page React 18 + TypeScript application; SSO via Entra ID (or SAML-compatible IdP) | Must |
| FR-APP-02 | Executive dashboard: consolidated P&L, cash, AR/AP aging, KPI tiles, entity drill-down | Must |
| FR-APP-03 | Close cockpit: per-entity close status, mapping exceptions queue, elimination review, sign-off workflow | Must |
| FR-APP-04 | Entity detail view: single-entity scope for subsidiary controller; DQ exceptions, IC recon | Must |
| FR-APP-05 | Explorer / ad-hoc view: pivot-style over Gold facts; saved views; CSV/Parquet export | Must |
| FR-APP-06 | Invoice upload console: drag-drop, batch, AI extraction, HITL review, ERP push, history | Must |
| FR-APP-07 | InsightAgent Q&A pane: natural-language query; returns answer + underlying SQL for audit | Should |
| FR-APP-08 | All data served via versioned REST API; UI never queries lake directly | Must |
| FR-APP-09 | Data freshness indicator on every dashboard showing last sync time per ERP source | Must |
| FR-APP-10 | In-app annotations and comments on any tile or line item | Should |
| FR-APP-11 | Accessibility: WCAG 2.1 AA | Must |
| FR-APP-12 | Responsive down to tablet (768px) | Should |

### 11.2 Administration Console

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ADM-01 | Self-service mapping console: account, dimension, entity, customer master | Must |
| FR-ADM-02 | All mapping changes: two-person approval workflow with full history | Must |
| FR-ADM-03 | Pipeline health dashboard: run status, SLA adherence, DQ rule pass rates, row counts | Must |
| FR-ADM-04 | Entity onboarding wizard: register ERP, configure auth, map accounts, validate, go live | Should |
| FR-ADM-05 | Agent management: register/suspend agents, view Agent Cards, monitor task queue | Should |

---

## 12. Security, Privacy & Compliance

### 12.1 Regulatory Framing

The platform is designed to satisfy common financial regulatory requirements. Customers must confirm applicable obligations for their jurisdiction:

- **SEC Investment Advisers Act Rule 204-2** — books and records retention (7 years), immutability, accessibility
- **IFRS / local GAAP** — audit trail from source to consolidated report
- **GDPR / Reg S-P** — PII handling, data residency, access controls
- **SOX-equivalent** — segregation of duties, change controls, financial control environment

### 12.2 Security Controls

| Control | Implementation |
|---------|---------------|
| Encryption at rest | Customer-managed keys (CMK); no platform-managed key exposure |
| Encryption in transit | TLS 1.2+ on all connections |
| Network isolation | No inbound public access to storage or compute; Private Link / Private Endpoints |
| Identity | Single IdP (Entra ID or SAML); no local accounts except emergency break-glass |
| Row-level security | Enforced at SQL/API layer; users query only entities their role grants |
| Column masking | PII fields (customer IDs, bank accounts) masked except narrowly authorised roles |
| Immutable audit logs | WORM storage; DELETE/UPDATE revoked at DB privilege level |
| Secrets management | Vault service (Azure Key Vault / AWS Secrets Manager / HashiCorp Vault); no credentials in code |
| Agent data isolation | Every agent queries with tenant_id filter; cross-tenant data access = security incident |
| Audit logging | Every UI, API, and SQL query logged; retained 7 years minimum |
| Penetration testing | Annual third-party pen test; quarterly vulnerability scans; SAST in CI pipeline |
| SOC 2 posture | Year 1: readiness assessment; Year 2: Type II target |

---

## 13. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Availability | Application (business hours 07:00–20:00 local) | 99.9% |
| Availability | Data pipeline (scheduled run success rate) | ≥ 99.5% |
| Performance | Executive dashboard P95 load | < 2.5 seconds |
| Performance | Explorer query P95 (12 months data) | < 6 seconds |
| Performance | OrchestratorAgent task routing | < 2 seconds |
| Performance | Agent tool loop (single invoice) | < 30 seconds |
| Scalability | Entities: architected for 100+ without redesign | Linear scale |
| Scalability | Concurrent application users | 250 (no degradation) |
| Recoverability | RPO (pipeline data) | ≤ 6 hours |
| Recoverability | RTO (application) | ≤ 4 hours |
| Auditability | Retention of source extracts and logs | ≥ 7 years, WORM |
| Observability | End-to-end trace: UI query → Gold row → Bronze source → ERP | Available on demand |
| Maintainability | Infrastructure as code; zero manual console changes in production | 100% IaC |
| Agent SLA | HITL question answered by Finance | < 4 hours (business hours) |

---

## 14. Phased Rollout Plan

| Phase | Duration | Entities | Key Deliverables |
|-------|----------|----------|-----------------|
| **0 — Foundation** | Month 1–2 | None (platform only) | Cloud landing zone, IdP groups, lakehouse infra, CI/CD, connector framework, canonical CoA draft, Agent Registry, A2A protocol baseline |
| **1 — Pilot** | Month 3–4 | 1–2 entities | End-to-end ingestion for BC + Odoo, Silver/Gold for pilot entities, Executive Dashboard v1, Close Cockpit v1, OrchestratorAgent + ERPConnectorAgent + DataQualityAgent, InvoiceAgent GA (IC-27) |
| **2 — Scale** | Month 5–7 | 5–10 entities | All 7 ERP connectors hardened, onboarding runbook, DQ rule library, ReconciliationAgent, Explorer v1 |
| **3 — Intelligence** | Month 8–10 | All entities | ForecastingAgent, InsightAgent, ComplianceAgent, elimination engine GA, audit evidence pack |
| **4 — GA** | Month 11–12 | All entities live | Full A2A mesh (8 agents), HITL polished, external agent connectors, ops handover, training |

---

## 15. Risks, Assumptions & Dependencies

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| CoA harmonisation underestimated; entity CoAs diverge more than assumed | High | High | Run CoA discovery in Month 1; assign finance lead with veto authority |
| ERP API access provisioning delays | Medium | High | Executive directive; central SecOps contact per entity |
| ERP rate limits constrain large historical backfills | Medium | Medium | Staged backfill, off-hours scheduling |
| Source data quality weaker than assumed | Medium | High | DQ rule library; remediation SLA with each controller |
| LLM API latency in production financial workflows | Medium | Medium | Async agent execution; tool loops non-blocking; SLA monitoring |
| Agent hallucination in financial calculations | Low | High | Agents use tools for numbers, not direct reasoning; every calculation via SQL/code tool |
| A2A protocol immaturity | Low | Medium | HTTP + JSON contract; protocol-agnostic interface layer; no lock-in |
| Key-person concentration on canonical model | Medium | Medium | Two-person rule on canonical mappings; documented decision log |

### Assumptions

- Entities will grant the programme an app registration / API credentials within 10 business days of request
- Group finance will own and staff the canonical CoA and dimension framework
- Legal entity structure is stable during initial rollout; re-orgs trigger re-planning
- Claude API (claude-sonnet-4-6 / claude-haiku-4-5) available and stable for production agent workloads

### Dependencies

- Cloud platform subscription (Azure / AWS / GCP) with sufficient quota
- IdP (Entra ID or SAML provider) configured
- Vault service available for credential storage
- ERP sandbox tenants available for connector development and testing
- Finance leadership availability for canonical CoA sessions (estimated 40 hours in Phase 0)

---

## 16. Glossary

| Term | Definition |
|------|------------|
| **A2A** | Agent-to-Agent — Google's open protocol for AI agent communication via HTTP + JSON Task/AgentCard semantics |
| **Agent Card** | JSON manifest declaring an agent's name, capabilities, input/output schemas, and endpoint URL |
| **Bronze / Silver / Gold** | Medallion architecture zones: raw · conformed · consumption |
| **Canonical CoA** | Standard 4-level chart of accounts used across all entities regardless of native ERP CoA |
| **CDC** | Change Data Capture — propagating only changed rows since the last extract |
| **HITL** | Human-in-the-Loop — agent pauses to ask Finance a targeted question; resumes on answer |
| **IC** | Intercompany — transactions between legal entities within the same group |
| **InvoiceAgent** | The first live A2A agent (IC-27): extracts, validates, and pushes vendor invoices to ERP |
| **OrchestratorAgent** | The routing hub: receives user intents and dispatches Tasks to the appropriate specialized agent |
| **RPO / RTO** | Recovery Point Objective / Recovery Time Objective |
| **SCD-2** | Slowly Changing Dimension Type 2 — preserves full history via effective-date rows |
| **Task (A2A)** | Unit of work in the A2A protocol: id, context, messages[], artifacts[], state |
| **WORM** | Write Once Read Many — immutable storage policy for regulated records |
| **ERP** | Enterprise Resource Planning — business management software (BC, SAP, Oracle, Odoo, etc.) |

---

*Document prepared by Aarav_PM_001. Reviewed by Kabir_Reviewer_010 · Meera_Architect_002.*
*Supersedes UFIP_PRD_v1.0.docx and PRD_02.md.*
*Feature files: `.claude/features/` — IC-27 through IC-33 for InvoiceAgent implementation.*
