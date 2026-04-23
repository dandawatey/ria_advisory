# F018 — Explorer & Ad-Hoc Analytics

**Area:** React Application  
**Priority:** Must  
**PRD References:** FR-APP-07

---

## Situation

The Head of FP&A (Ravi) and analysts need the ability to perform ad-hoc financial analysis beyond the pre-built dashboards — slicing data by arbitrary dimension combinations, comparing periods, building custom views for modelling, and exporting data for external tools. The Explorer is the self-service analytical surface of the platform.

---

## Problem

Pre-built dashboards (F015–F017) answer known questions. FP&A's job is to answer unknown questions — cohort profitability, trend decomposition, scenario comparison — which require flexible, user-driven data exploration. Without this, FP&A defaults to requesting custom data extracts from data engineering, creating a bottleneck and delaying insight. Data exports to Excel also need to be reproducible and governed (not ad-hoc SQL sent via email).

---

## Action

### User Stories

- As the Head of FP&A, I can pivot consolidated GL data by any combination of canonical dimensions without knowing SQL.
- As an analyst, I can save a custom view (filter + dimension configuration) and come back to it in a future session.
- As an analyst, I can export a dataset as CSV or Parquet for use in financial modelling tools.

### Acceptance Criteria

**Pivot-Style Interface**

1. Explorer provides a pivot-style analytical grid over `fact_gl_entry` and other Gold fact tables.
2. Rows: canonical account (at any hierarchy level), or dimension value (entity, region, segment, service line).
3. Columns: time periods — months selectable from a period picker; supports single month, month range, YTD, trailing N months.
4. Measures selectable: Amount USD, Amount LCY, Debit Amount, Credit Amount, Row Count; additional derived measures (e.g., Gross Margin %) configurable.
5. Filters: entity (multi-select), canonical account (multi-select or hierarchy node), region, client segment, service line, posting date range, gross vs. eliminated toggle.
6. Row totals and column totals computed server-side; subtotals at each hierarchy node.
7. Explorer query P95 < 6 seconds over 12 months of data (PRD NFR).

**Saved Views**

8. Any filter + dimension configuration can be saved as a named view: name, description, owner, visibility (private / shared with group).
9. Saved views accessible from a "My Views" panel and a "Shared Views" panel.
10. Shared views are read-only for non-owners; owners can update or delete their views.
11. Saved view includes a shareable URL that restores the exact configuration.

**Export**

12. Export current Explorer result to **CSV** (up to 1M rows) or **Parquet** (up to 10M rows) — available to `group-fpa` and `group-group-finance` roles.
13. Export is asynchronous for large datasets: user receives a download link via in-app notification and email when ready.
14. Exported files include metadata header: export timestamp, user, filter configuration, Gold table version, run_id — for reproducibility and audit.
15. Exports are logged: `(user, timestamp, filters, row_count, format, export_id)` — retained 7 years.

**API Access**

16. Saved views expose a stable API endpoint (via F019) that returns the view's result as JSON or CSV — enabling programmatic access for modelling tools without requiring users to re-build queries.

---

## Result

- FP&A can answer ad-hoc analytical questions without requesting data extracts from engineering.
- Saved views enable repeatable, governed analysis — consistent inputs for board packs and regulatory submissions.
- Export capability enables Excel/Python modelling on governed data, replacing uncontrolled manual extracts.
- Explorer query performance (< 6s P95) meets FP&A usability expectations.

---

## Constraints

- **Dependency:** F014 (React foundation), F019 (API layer).
- **Dependency:** F009 (Gold layer) as the data source; F010 (elimination engine) for eliminated toggle; F011 (FX) for USD amounts.
- **Dependency:** F008 (canonical dimension framework) defines the available dimension slices.
- **Accessible to:** `group-fpa`, `group-group-finance`, `group-exec` (read-only). Subsidiary controllers can access Explorer scoped to their entity only.
- **Out of scope:** Natural language query interface — that is F020 (NLQ feature).
- **Out of scope:** Real-time streaming data — Explorer queries the Gold layer which refreshes on pipeline schedule.
- **Constraint:** Explorer does not expose Bronze or Silver data — Gold only.
- **Constraint:** Export row limits (1M CSV / 10M Parquet) are soft limits enforced server-side; queries returning more rows require API access or a data engineering request.
- **Constraint:** Saved view sharing must respect data-access boundaries — a shared view run by a subsidiary controller is filtered by their entity scope, not the creator's scope.
