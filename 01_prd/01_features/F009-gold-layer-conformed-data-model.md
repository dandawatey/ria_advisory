# F009 — Gold Layer Conformed Data Model

**Area:** Data Lakehouse  
**Priority:** Must  
**PRD References:** FR-LAKE-06

---

## Situation

The Gold layer is the consumption-ready analytical store — the single source of truth that powers the React application, the API layer, and any downstream BI tools. It assembles conformed fact and dimension tables from Silver data, enriched with canonical account/dimension mappings, FX translation, and inter-company eliminations, into a star-schema optimised for analytical queries.

---

## Problem

Without a stable, governed Gold layer, every consumer (UI, BI, API) would need to perform its own joins, mapping lookups, and aggregations — creating inconsistency, duplication of logic, and performance risk. The Gold layer centralises this complexity so consumers receive pre-conformed, pre-aggregated, query-ready data. Without it, the platform cannot deliver the sub-2.5s dashboard load and sub-6s explorer query performance targets.

---

## Action

### User Stories

- As the API layer (F019), I can query Gold fact and dimension tables with simple SQL joins to serve the React application.
- As the Head of FP&A, I can query Gold from a SQL client or BI tool and get consistent results without applying manual mapping logic.
- As a data engineer, I can add a new Gold fact table by following the established pattern without redesigning the schema.

### Acceptance Criteria

**Fact Tables**

1. `fact_gl_entry` — grain: one row per GL posting line; key measures: `amount_lcy`, `amount_usd`, `debit_amount`, `credit_amount`; dimensions: `sk_entity`, `sk_account_canonical`, `sk_account_local`, `sk_customer`, `sk_vendor`, `sk_date`, `sk_currency`; canonical and local dimension value keys included.
2. `fact_ar_invoice_line` — grain: one row per AR invoice line; key measures: `line_amount`, `tax_amount`, `discount_amount`, `margin_amount`.
3. `fact_ap_invoice_line` — grain: one row per AP invoice line; key measures: `line_amount`, `tax_amount`, `discount_amount`.
4. `fact_bank_ledger` — grain: one row per bank ledger entry; key measures: `amount_lcy`, `amount_usd`, `running_balance`.
5. `fact_fx_rate` — grain: one row per currency / date / rate type; used by F011 (FX translation).
6. All fact tables carry: `subsidiary_code`, `_gold_processed_at`, `_source_run_id`, `is_intercompany` flag (derived from canonical account flag), `is_eliminated` flag (set by F010).

**Dimension Tables**

7. `dim_entity` — legal entity (subsidiary); SCD-2; includes group hierarchy and rollup flags.
8. `dim_account_canonical` — canonical CoA node; SCD-2; includes financial statement line and account type.
9. `dim_account_local` — subsidiary native account mapped to canonical; SCD-2; foreign key to `dim_account_canonical`.
10. `dim_dimension_value` — canonical and local dimension values; SCD-2.
11. `dim_customer` — group-harmonised customer master; SCD-2; PII fields masked per F024.
12. `dim_vendor` — group-harmonised vendor master; SCD-2.
13. `dim_date` — calendar + fiscal date attributes; static; pre-populated 10 years back and forward.
14. `dim_currency` — ISO currencies; static.

**Gold Layer Governance**

15. Gold tables registered in Unity Catalog with table-level and column-level descriptions, owners, and classification tags (PII, financial).
16. Gold promotion blocked if DQ rule pass rate < threshold (enforced by F012).
17. Gold tables expose both gross and IC-eliminated views (controlled by F010 `is_eliminated` flag and/or separate views).
18. All Gold SQL is version-controlled; changes deployed via CI/CD with automated tests.
19. Gold tables are optimised for query performance: Z-ordered by frequently filtered columns (`subsidiary_code`, `posting_date`, `canonical_account_id`); `OPTIMIZE` run after each load cycle.

---

## Result

- Unified star schema available for all consumers with consistent, governed data.
- Dashboard load P95 < 2.5s and explorer query P95 < 6s achievable with Gold-layer Z-ordering and SQL Warehouse caching.
- FP&A and BI tools can access Gold directly via SQL Warehouse without bespoke integration.
- Data lineage from Gold back to Bronze source available via Unity Catalog (F013).

---

## Constraints

- **Dependency:** F006 (Silver), F007 (canonical CoA), F008 (canonical dimensions), F010 (elimination), F011 (FX), F012 (DQ) must all be operational — Gold is the final assembly layer.
- **Dependency:** F019 (API layer) and BI tools consume Gold via Databricks SQL Warehouse.
- **Dependency:** F024 (security controls) enforces row-level security and column-level masking at the SQL Warehouse layer, not in Gold table storage.
- **Out of scope:** Serving Gold data directly to end users — always via API layer or SQL Warehouse with enforced RLS.
- **Out of scope:** Write-back from Gold to BC source systems.
- **Constraint:** Gold schema changes after GA require a controlled migration process — backward-incompatible changes must be versioned (e.g., Gold v2 tables) to avoid breaking API consumers.
