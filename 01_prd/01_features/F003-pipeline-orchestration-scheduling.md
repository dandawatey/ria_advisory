# F003 — Pipeline Orchestration & Scheduling

**Area:** Business Central Integration  
**Priority:** Must  
**PRD References:** FR-INT-04, FR-INT-05

---

## Situation

Data from 17 BC tenants must be extracted, transformed, and made available to consumers on a predictable schedule. The platform targets twice-daily refreshes at minimum (06:00 and 14:00 local), plus on-demand runs triggered during close events. Each pipeline run involves multiple sequential and parallel stages (extract → Bronze → Silver → Gold), and all runs must produce auditable execution records.

---

## Problem

Without centralised orchestration, pipeline runs across 17 tenants and 12+ entities become ungoverned, with no consistent retry logic, dependency management, or run history. Finance teams have no visibility into whether data is fresh or whether a run failed silently. Close events (month-end, quarter-end) require ad-hoc on-demand triggers that a static schedule cannot provide.

---

## Action

### User Stories

- As a data engineer, I can define pipeline schedules declaratively so extracts run automatically without manual intervention.
- As a finance operator, I can trigger an on-demand pipeline run during a close event from the admin console.
- As a platform administrator, I can see the status, duration, and outcome of every pipeline run in the health dashboard.

### Acceptance Criteria

1. Scheduled runs execute automatically at **minimum twice daily** — 06:00 and 14:00 local (ET) on business days; configurable to include weekends for close periods.
2. Schedule is defined in code (infrastructure-as-code / workflow YAML), not through manual console configuration.
3. On-demand triggered runs are available via:
   - Admin console UI (manual trigger button per tenant or all tenants).
   - API endpoint (authenticated) for programmatic triggering by other systems.
4. Pipeline stages execute in dependency order: extraction → Bronze landing → Silver transformation → Gold promotion; each stage gates on the success of the prior stage.
5. Parallel execution across tenants and entities where no dependency exists (e.g., all 17 tenant extractions run concurrently up to configured parallelism limit).
6. Every pipeline run emits structured run metadata per entity: `run_id`, `tenant_id`, `entity_name`, `start_time`, `end_time`, `status` (success / partial / failed), `rows_extracted`, `rows_written`, `bytes`, `duration_seconds`, `watermark`, `load_type`, `error_message`.
7. Run metadata is persisted to a queryable store (Delta table or equivalent) and retained for 7 years (audit requirement).
8. Failed runs do not block subsequent scheduled runs; each run is independently scheduled.
9. Run history is surfaced in the pipeline health dashboard (F023) with SLA adherence indicators.
10. Orchestration configuration managed in version control; changes deployed via CI/CD pipeline.

### Technical Notes

- Preferred orchestration: Databricks Workflows (native retry, dependency, and monitoring).
- Alternative: Azure Data Factory pipelines for extraction stage; Databricks Workflows for transformation.
- Event Grid integration: publish `pipeline.completed` and `pipeline.failed` events for downstream consumers.
- Parallelism limit configurable to avoid overwhelming BC API rate limits across concurrent tenant extractions.

---

## Result

- Data freshness target met: subsidiary data available in Gold layer ≤ 6 hours after source change (twice-daily full; hourly CDC where configured).
- Finance teams can trigger on-demand runs without engineering involvement during close events.
- Every run has a complete, queryable audit record — no silent failures.
- SLA adherence (≥ 99.5% successful scheduled runs) visible in real time.

---

## Constraints

- **Dependency:** F001 (authentication) and F002 (extraction engine) must be operational.
- **Dependency:** F023 (pipeline health dashboard) consumes run metadata produced here.
- **Dependency:** Azure Databricks Workflows or ADF provisioned and configured via Terraform (IaC requirement).
- **Out of scope:** Event-driven real-time streaming; this feature covers batch-scheduled and on-demand orchestration only.
- **Out of scope:** Orchestration of non-BC source systems (Phase 2).
- **Constraint:** All schedule and workflow definitions must be IaC-managed — no manual console changes in production.
