# F023 — Pipeline Health Dashboard

**Area:** Administration & Governance  
**Priority:** Must  
**PRD References:** FR-ADM-03

---

## Situation

The platform runs scheduled extraction and transformation pipelines across 17 subsidiaries on a twice-daily cadence (plus on-demand runs). Data engineering and platform operations teams need real-time visibility into pipeline health, SLA adherence, data quality pass rates, and row counts — without logging into Databricks or Azure Monitor directly. Finance teams need confidence that the data they are viewing is fresh and complete.

---

## Problem

Without a centralised health dashboard, pipeline failures are discovered reactively — a finance user notices stale data or incorrect totals and raises a ticket. Operations teams must correlate logs across Azure Monitor, Databricks Workflows, and DQ results tables to diagnose issues. There is no SLA tracking, so the platform's freshness commitments cannot be monitored or reported.

---

## Action

### User Stories

- As a platform operator, I see the current status of every pipeline run (by entity and subsidiary) on a single screen and can identify failures immediately.
- As a data engineer, I can drill into a failed run and see the error message, affected entity, and retry history without opening Databricks.
- As the Group Controller, I can see the data freshness status for each subsidiary before relying on the close cockpit data.

### Acceptance Criteria

**Overview Panel**

1. Current run cycle status: overall status (All Good / Warnings / Critical), last completed run timestamp, next scheduled run timestamp.
2. SLA adherence KPI: % of scheduled runs completing within SLA (target ≥ 99.5%) — current period and rolling 30-day.
3. DQ critical rule pass rate: current period aggregate and per-entity breakdown (target ≥ 99.5%).
4. Active circuit breakers: count and list of any tenant/entity combinations currently in `circuit_open` state (F004).

**Run History Table**

5. Filterable, paginated table of all pipeline runs: `run_id`, `subsidiary`, `entity`, `start_time`, `end_time`, `duration`, `status` (success/partial/failed/running), `load_type` (full/incremental), `rows_extracted`, `rows_written`, `watermark`, `error_message` (truncated to 500 chars with "view full" option).
6. Filters: subsidiary, entity, status, date range, load type.
7. Row click → run detail page: full error message, retry history, DQ results for that run, Bronze table partition written.
8. Export run history to CSV for operational reporting.

**Entity Freshness Grid**

9. Grid: one row per subsidiary × entity combination; column = last successful ingest timestamp, time since last success, freshness status (green < 6h / amber 6–24h / red > 24h).
10. Freshness grid auto-refreshes every 5 minutes in the browser.

**DQ Metrics Panel**

11. Per-subsidiary DQ exception summary: total exceptions (open/resolved), critical vs. warning breakdown, exceptions by rule type, trend over last 30 days.
12. Link to the DQ exceptions queue in the close cockpit (F016) for the relevant entity.

**Mapping Coverage Panel**

13. Per-subsidiary mapping coverage: % accounts mapped to canonical CoA, % dimension values mapped to canonical dimensions, unmapped count with a link to the mapping workbench (F021).

**Alerting**

14. All health dashboard metrics are backed by Azure Monitor alerts:
    - Pipeline failure: alert within 5 minutes to platform-ops Slack/Teams channel and PagerDuty.
    - Circuit breaker open: alert within 5 minutes.
    - DQ critical rule fail rate > 1% for any entity: alert to platform-ops and group-finance.
    - Data freshness > 12 hours for any entity: alert to platform-ops.
15. Alert configuration managed in Terraform (IaC); no manual Azure Monitor rule creation.

---

## Result

- Platform operations team detects and responds to failures within 5 minutes (before finance users notice stale data).
- SLA adherence (≥ 99.5% scheduled run success rate) is measurable, reportable, and defensible.
- Finance leadership can self-verify data freshness before relying on dashboard data for decisions.
- Pipeline health metrics available as input to capacity planning and reliability engineering.

---

## Constraints

- **Dependency:** F003 (orchestration) produces the run metadata that populates this dashboard.
- **Dependency:** F012 (DQ framework) produces the DQ metrics displayed here.
- **Dependency:** F004 (resilience / circuit breaker) produces circuit-breaker status displayed here.
- **Dependency:** F007 (canonical CoA) and F008 (dimensions) provide mapping coverage metrics.
- **Dependency:** F019 (API layer) serves health data to the React frontend.
- **Dependency:** Azure Monitor / Log Analytics and Databricks system tables as telemetry sources.
- **Accessible to:** `group-admin`, `group-group-finance` for full access; `group-exec` for read-only freshness view only.
- **Out of scope:** Full Databricks Workflows execution graph / DAG view — link out to Databricks UI for deep debugging.
- **Constraint:** Run metadata must be written to a queryable Delta table (not only to Azure Monitor logs) so it can be surfaced in the React app without requiring Log Analytics API access.
