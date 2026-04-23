# F006 — Silver Layer Transformation

**Area:** Data Lakehouse  
**Priority:** Must  
**PRD References:** FR-LAKE-03

---

## Situation

Bronze data is raw — it carries BC API schemas with string-typed dates, inconsistent nullability, no surrogate keys, and no history tracking for slowly changing attributes. The Silver layer is the conformed, cleansed, and historically accurate representation of each entity, ready for canonical mapping and Gold aggregation. Silver is entity-scoped (per subsidiary) and not yet cross-entity consolidated.

---

## Problem

Consuming raw Bronze data directly in reporting would require every downstream query to perform type casting, deduplication, and history resolution — creating fragile, inconsistent results across different consumers. SCD-2 history is required for dimensional entities (customer, vendor, account) so that historical facts can be correctly attributed to attributes as they existed at transaction time. Without Silver as a stable, governed layer, any schema change in BC propagates directly into reporting.

---

## Action

### User Stories

- As a data engineer, I can trust that Silver tables have correct data types, no duplicates from CDC overlap, and accurate history for dimensional attributes.
- As a Gold layer process, I can join Silver fact tables to Silver dimension tables without performing any type casting or deduplication.
- As a compliance reviewer, I can see the full history of any customer or account attribute change, not just the current state.

### Acceptance Criteria

1. Silver tables are created for each entity type, named `silver.<subsidiary_code>.<entity_name>`.
2. **Type casting:** all BC string-typed dates cast to `DATE` or `TIMESTAMP`; amounts cast to `DECIMAL(18,4)`; boolean fields normalised; string fields trimmed and null-coalesced consistently.
3. **Schema enforcement:** Silver table schema is defined in code (DDL or Delta table schema); schema mismatches from Bronze raise a DQ alert and halt Silver promotion for that entity/run.
4. **Deduplication:** Bronze CDC overlap records are deduplicated using `lastModifiedDateTime` and the BC record's native primary key — only the most recent version of each record is active in Silver.
5. **Surrogate keys:** each Silver row receives a platform-generated surrogate key (`sk_<entity>`) — a deterministic hash of `(subsidiary_code, native_pk)` — enabling cross-entity joins without key collisions.
6. **SCD-2 history** for dimensional entities (customer, vendor, account, dimension value): when an attribute changes, the prior row is closed (`valid_to = change_date - 1 day`, `is_current = false`) and a new row is inserted (`valid_from = change_date`, `is_current = true`).
7. Transactional/fact entities (GL entries, invoices, bank ledger) are treated as immutable; once posted in BC they are insert-only in Silver.
8. Silver tables carry standard metadata columns: `sk_<entity>`, `subsidiary_code`, `_silver_processed_at`, `_source_run_id`, `valid_from`, `valid_to` (dims only), `is_current` (dims only).
9. Silver processing is idempotent: re-running Silver transformation for a given run produces the same output.
10. Transformation logic is expressed as SQL or PySpark in version-controlled notebooks/scripts, deployable via Databricks Asset Bundles or DBT.

### Technical Notes

- SCD-2 implementation: MERGE statement on Silver table using `surrogate_key` as match key; updates `valid_to`/`is_current` on changed rows, inserts new rows.
- Surrogate key generation: `SHA256(subsidiary_code || '|' || native_pk)` cast to string — deterministic, collision-resistant.
- Silver transformation triggered by F003 (orchestration) after Bronze landing succeeds for a given entity/tenant.
- Failed Silver transformation for one entity does not block Silver for other entities in the same run.

---

## Result

- Silver layer provides a clean, typed, deduplicated, historically accurate representation of all BC entities per subsidiary.
- SCD-2 history enables correct point-in-time analysis — critical for financial audit and variance explanation.
- Gold layer can consume Silver with no further cleansing — only aggregation and cross-entity joining needed.
- Transformation logic is testable, versioned, and replayable from Bronze.

---

## Constraints

- **Dependency:** F005 (Bronze) must be populated before Silver can run.
- **Dependency:** F007 (canonical CoA mapping) and F008 (dimension mapping) are applied in Gold, not Silver — Silver remains subsidiary-native.
- **Dependency:** F012 (DQ framework) runs after Silver promotion and before Gold promotion.
- **Dependency:** F013 (lineage) records Bronze → Silver column mappings.
- **Out of scope:** Cross-subsidiary joins, canonical mapping, elimination, FX translation — all Gold concerns.
- **Out of scope:** Any UI-facing serving — Silver is an internal transformation layer only.
- **Constraint:** SCD-2 for all 12+ entity types requires careful definition of which attributes trigger a new SCD version; finance team must sign off on SCD attribute lists per entity.
