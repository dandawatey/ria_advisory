# F013 — Column-Level Data Lineage

**Area:** Data Lakehouse  
**Priority:** Must  
**PRD References:** FR-LAKE-10

---

## Situation

The platform ingests data from 17 source systems, transforms it through Bronze → Silver → Gold with canonical mapping, FX translation, and elimination applied. Regulators (SEC Rule 204-2), auditors, and finance teams need the ability to trace any number in a Gold table or the React application back to the original BC source record. This traceability must be complete, queryable, and available on demand.

---

## Problem

Without column-level lineage, a consolidated P&L figure in the executive dashboard is a black box — finance cannot explain its derivation to auditors, and data engineers cannot diagnose transformation errors by tracing field origins. In a platform touching SEC-regulated books and records, the inability to provide source-to-report traceability is a compliance gap, not just an operational inconvenience.

---

## Action

### User Stories

- As a compliance officer, I can trace any Gold metric value back to the Bronze source record and the BC API response that produced it, on demand.
- As a data engineer, I can see which Bronze columns feed into a given Silver column, and which Silver columns feed into a Gold column, in the Unity Catalog lineage graph.
- As an auditor, I can obtain a complete lineage report for any financial figure appearing in a regulatory-facing report.

### Acceptance Criteria

1. **Column-level lineage** from Bronze source field → Silver field → Gold fact/dim column is captured and queryable via Unity Catalog.
2. Unity Catalog lineage is populated automatically by Databricks transformation jobs — no manual lineage documentation required for standard transformations.
3. For transformations that Unity Catalog cannot auto-detect (e.g., complex PySpark UDFs, multi-step aggregations), lineage is manually registered via Unity Catalog APIs as part of the CI/CD deployment of those transformations.
4. Every Gold row includes `_source_run_id`, `_bronze_ingest_timestamp`, `_source_tenant_id` — enabling point-in-time audit reconstruction.
5. Lineage graph is explorable via the Unity Catalog UI and queryable via the lineage REST API.
6. Microsoft Purview integration: Unity Catalog lineage is propagated to Purview for enterprise-wide data catalog visibility (if Purview is provisioned in the Azure tenant).
7. Lineage coverage metric: target ≥ 95% of Gold columns traceable to Bronze source columns; gaps documented and tracked.
8. Lineage data retained for 7 years alongside the data it describes (satisfying audit retention requirement).
9. The React application's API layer (F019) includes a `lineage` metadata field on query responses, providing a reference to the Unity Catalog lineage path for any metric surfaced in the UI.

### Technical Notes

- Unity Catalog auto-captures lineage for SQL-based transformations run on Databricks clusters/SQL Warehouses.
- PySpark column-level lineage requires annotated transformation code (using `column_lineage` API or OpenLineage integration).
- OpenLineage / Marquez as an open-standard complement to Unity Catalog if cross-platform lineage is needed.
- Lineage for mapping tables (F007, F008): the mapping lookup is a lineage node — Gold `canonical_account_id` traces through the mapping table to the Silver `local_account_no` and back to Bronze.

---

## Result

- End-to-end audit trail from any Gold value back to BC source record — satisfying SEC Rule 204-2 traceability.
- Data engineers can diagnose transformation errors and impact-analyse schema changes with confidence.
- Auditors receive lineage evidence programmatically rather than through manual documentation.
- Purview integration enables broader data governance and enterprise data catalog initiatives.

---

## Constraints

- **Dependency:** F005 (Bronze), F006 (Silver), F009 (Gold) — lineage is registered as each layer is populated.
- **Dependency:** Unity Catalog enabled on the Databricks workspace (PRD §13.3 dependency).
- **Dependency:** Microsoft Purview provisioned in the Azure tenant for Purview integration (optional for Phase 1).
- **Out of scope:** Lineage for data flowing out of the platform to external systems (BI tools, exports) — Phase 2.
- **Constraint:** Unity Catalog column-level auto-lineage requires Databricks Runtime ≥ 12.x and SQL Warehouse use; older or non-Databricks compute will not auto-populate lineage and requires manual registration.
- **Constraint:** Lineage coverage target (95%) is aspirational for GA; 100% coverage for all canonical mapping paths is required for compliance sign-off.
