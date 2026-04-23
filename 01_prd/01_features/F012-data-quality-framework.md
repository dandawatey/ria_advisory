# F012 — Data Quality Framework

**Area:** Data Lakehouse  
**Priority:** Must  
**PRD References:** FR-LAKE-09

---

## Situation

Financial data flowing from 17 BC tenants into the platform may contain unposted batches, manual journal errors, incomplete transactions, or structural anomalies (e.g., GL entries with no account, invoices with zero amounts). The platform must enforce data quality rules systematically to prevent bad data from propagating into Gold and corrupting consolidated reporting. The PRD targets ≥ 99.5% critical DQ rule pass rate.

---

## Problem

Without enforced DQ rules, invalid or incomplete data silently flows through Bronze → Silver → Gold and surfaces as reporting errors discovered by finance teams after month-end — or worse, by auditors. Different consumers (UI, BI) cannot rely on Gold data quality. There is no systematic visibility into which subsidiaries have recurring data quality issues that need remediation at source.

---

## Action

### User Stories

- As a data engineer, I can define DQ rules for any entity in code and have them enforced automatically at Silver→Gold promotion.
- As the group controller, I can see which DQ rules failed, for which subsidiaries, and by how much, in the close cockpit.
- As a subsidiary controller, I can see DQ exceptions specific to my entity and understand what source data needs to be corrected.

### Acceptance Criteria

**Rule Definition**

1. DQ rules defined in code (Great Expectations suites or equivalent) per entity, stored in version control and deployed via CI/CD.
2. Rule types supported: not-null checks, uniqueness checks, referential integrity (e.g., every GL account exists in the CoA), range checks (e.g., amounts not implausibly large), format checks, completeness checks (e.g., expected row count ± tolerance vs. prior period).
3. Rules classified as **Critical** or **Warning**:
   - Critical: failure **blocks** Silver→Gold promotion for the affected entity/subsidiary/period.
   - Warning: failure logs an exception but allows Gold promotion; exception visible in close cockpit.

**Critical Rules (must include, non-exhaustive)**

4. GL entry has a valid canonical account mapping (every GL row maps to a canonical account — enforces F007).
5. GL entry `posting_date` is not null and within a plausible range (not future-dated beyond close, not pre-2000).
6. Debit amount + credit amount = 0 for balanced journal entries.
7. Entity dimension code maps to a known subsidiary (enforces F008 entity dimension).
8. FX rate available for all non-USD transactions in the period (enforces F011).

**Warning Rules (examples)**

9. Dimension values unmapped to canonical (enforces F008 soft rule).
10. Invoice line amount = 0 (potential data entry issue).
11. Row count for entity/period deviates > 20% from prior period (anomaly alert).

**Execution & Reporting**

12. DQ suite runs automatically after Silver transformation and before Gold promotion — triggered by F003 (orchestration).
13. DQ results persisted to a `dq_results` table: `(run_id, entity, subsidiary, rule_id, rule_name, severity, rows_checked, rows_failed, pass_rate, timestamp)`.
14. DQ rule pass rate (critical rules only) surfaced as KPI in the pipeline health dashboard (F023): target ≥ 99.5%.
15. DQ exceptions exposed in the close cockpit (F016) and entity detail view (F017) for finance review and remediation.
16. Gold promotion blocked for a subsidiary/entity if any critical rule fails — partial success (other subsidiaries proceed) is allowed.
17. DQ exception email/Teams alert sent to subsidiary controller when critical rules fail for their entity.

---

## Result

- Gold layer data quality ≥ 99.5% critical rule pass rate (PRD North-Star KPI).
- Finance teams discover data quality issues at pipeline time, not at reporting time.
- Subsidiary controllers are accountable owners of their entity's DQ exceptions with clear remediation path.
- DQ rule library grows over time as new data patterns and edge cases are discovered.

---

## Constraints

- **Dependency:** F006 (Silver) is the DQ check input; F009 (Gold) promotion is the gate.
- **Dependency:** F007 (canonical CoA) and F008 (canonical dimensions) provide the reference data for referential integrity checks.
- **Dependency:** F011 (FX) provides rate availability data for FX DQ checks.
- **Dependency:** F016 (close cockpit) and F023 (health dashboard) surface DQ results to finance and operations.
- **Dependency:** F021 (admin console) may surface DQ rule configuration in future — Phase 2 enhancement.
- **Out of scope:** Source system (BC) data correction — the platform surfaces exceptions; remediation happens in BC by subsidiary controllers.
- **Constraint:** Initial critical DQ rule set must be agreed with group finance and subsidiary controllers before pilot go-live to avoid spurious blocks during early runs.
- **Constraint:** DQ rule changes (especially adding new critical rules) must be deployed with a warm-up period (warning-only) before being elevated to blocking status.
