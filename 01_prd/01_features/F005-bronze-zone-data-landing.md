# F005 — Bronze Zone Data Landing

**Area:** Data Lakehouse  
**Priority:** Must  
**PRD References:** FR-LAKE-01, FR-LAKE-02

---

## Situation

Every record extracted from BC tenants must be stored in a raw, immutable form before any transformation occurs. The Bronze zone is the system of record for all ingested source data — it is the audit foundation for the platform and the replay source if transformation logic needs to be corrected and reprocessed.

---

## Problem

Without a governed raw data zone, raw extracts are ephemeral — any transformation error or logic change means source data is gone and must be re-extracted from BC (potentially impossible for historical data or closed periods). Regulators (SEC Rule 204-2) require immutable, accessible records retained for 7 years. Ad-hoc file storage without partitioning or schema enforcement creates an ungoverned data swamp that cannot be reliably queried or reprocessed.

---

## Action

### User Stories

- As a data engineer, I can replay Bronze data through a corrected Silver/Gold transformation without re-extracting from BC.
- As a compliance officer, I can prove that raw source data has not been altered since ingestion.
- As a platform operator, I can query Bronze for a specific subsidiary's GL entries on a specific date for audit purposes.

### Acceptance Criteria

1. All BC extracts land in ADLS Gen2 as **Delta Lake tables** in the Bronze zone container.
2. Tables are partitioned by `subsidiary_code` and `ingest_date` (ISO date string) to enable efficient query and partition pruning.
3. Bronze tables follow the naming convention: `bronze.<subsidiary_code>.<entity_name>` (e.g., `bronze.sub01.gl_entry`).
4. **No overwrites:** Bronze uses Delta Lake append-only mode; existing data is never modified or deleted. Each extraction run appends new records (including re-extracts of changed records from CDC loads — duplicates resolved in Silver, not Bronze).
5. Each Bronze row carries standard ingestion metadata columns: `_ingest_timestamp`, `_run_id`, `_source_tenant_id`, `_load_type` (full/incremental/sftp), `_source_file` (for SFTP loads).
6. ADLS Bronze container enforces **WORM (Write Once Read Many) immutable blob policy** with 7-year retention lock — satisfying SEC Rule 204-2 immutability requirement.
7. Storage account uses **Customer-Managed Keys (CMK)** stored in Azure Key Vault for encryption at rest.
8. No public internet access to Bronze storage; access via Private Endpoint only.
9. Bronze schema is the raw BC API response schema — no field renaming, type casting, or business logic applied.
10. Schema of each Bronze table is registered in Unity Catalog with column descriptions and ownership metadata.
11. New entities added to the entity catalog (F004) automatically get a Bronze table created on first load; no manual DDL required.

### Technical Notes

- Delta Lake chosen over Parquet/CSV for ACID transactions, time-travel (audit), and schema enforcement.
- WORM policy configured at container level with time-based retention (7 years, locked).
- Managed identity used for all pipeline write access; no storage account keys in code.
- Storage tiering: recent partitions (< 90 days) on Hot tier; older partitions auto-tiered to Cool/Archive via lifecycle policy to control cost.

---

## Result

- Every raw BC record is retained immutably for 7 years, satisfying SEC Rule 204-2 and Reg S-P data retention.
- Any Silver/Gold transformation defect can be corrected by replaying from Bronze without re-extracting from source.
- Bronze is queryable for ad-hoc audit and investigation with partition-pruned performance.
- Encryption and network isolation meet CISO security architecture requirements.

---

## Constraints

- **Dependency:** F001 (auth) and F002 (extraction) must be operational to write to Bronze.
- **Dependency:** Azure Key Vault (CMK), ADLS Gen2 Private Endpoint, and Unity Catalog provisioned via Terraform before first write.
- **Dependency:** F013 (lineage) registers Bronze tables as lineage sources.
- **Out of scope:** Transformation, business logic, or DQ rules — Bronze stores raw data only.
- **Out of scope:** Serving Bronze data directly to the React application — consumers use Gold layer only.
- **Constraint:** WORM lock is irreversible once applied; must be thoroughly validated in dev/UAT before enabling on prod.
- **Constraint:** IaC-only management of storage configuration; no manual Azure portal changes in production.
