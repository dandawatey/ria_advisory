# F002 — BC Data Extraction Engine

**Area:** Business Central Integration  
**Priority:** Must  
**PRD References:** FR-INT-02, FR-INT-03

---

## Situation

The platform must extract financial data from all 17 BC tenants across 12+ entity types (GL Entries, Chart of Accounts, Dimensions, Customers, Vendors, Items, Sales/Purchase Invoices, Bank Accounts, Fixed Assets, FX Rates). BC exposes these via its standard OData v4 REST API (v2.0). Data volumes range from small reference tables (currencies) to large transactional tables (GL entries spanning years of history).

---

## Problem

A naïve full-extract on every run is impractical at scale: large GL entry tables can have millions of rows, and extracting them fully twice daily would exceed BC API rate limits and create unnecessary processing load. Conversely, missing changed records due to unreliable incremental logic leads to reporting errors. There is no existing mechanism to extract BC data systematically with change tracking.

---

## Action

### User Stories

- As a pipeline engineer, I can perform a full historical load of any BC entity for initial hydration.
- As a pipeline engineer, I can perform incremental loads that only retrieve records changed since the last successful run.
- As a data consumer, I can trust that no records are silently dropped between incremental loads.

### Acceptance Criteria

1. Extractor supports all 12+ BC entities listed in PRD §5.1 via BC API v2.0 OData endpoints.
2. **Full load:** Extracts all records for a given entity and tenant; used for initial hydration and periodic reconciliation.
3. **Incremental load (delta token):** Uses `@odata.deltaLink` returned by BC to retrieve only changed records since last run where supported.
4. **Incremental load (Last-Modified fallback):** Where delta tokens are unavailable, filters by `lastModifiedDateTime ge {watermark}` with a configurable overlap window (default: 15 minutes) to prevent missed records at boundary.
5. Server-side OData `$filter`, `$select`, and `$top`/`$skip` (or `$skiptoken`) used for pagination — client never loads entire result set into memory.
6. Page size configurable per entity (default: 1000 rows); validated against BC API maximums.
7. Watermark (last successful extract timestamp or delta token) persisted in a durable state store after each successful run; never in pipeline memory only.
8. Extractor emits per-entity run metadata: entity name, tenant, rows extracted, bytes, duration, watermark value, load type (full/incremental), status (success/partial/failed).
9. Schema drift detection: if BC API returns an unexpected field or drops an expected field, the extractor raises an alert before writing to Bronze — it does not silently ignore drift.

### Technical Notes

- Delta token approach preferred; Last-Modified fallback documented per entity in entity catalog.
- Overlap window on Last-Modified loads trades minor re-processing for correctness; Bronze deduplication handles duplicates.
- Pagination via `@odata.nextLink` until exhausted; do not assume fixed page counts.
- `$select` projection used to exclude fields not in scope, reducing payload size.

---

## Result

- Initial hydration completes for all entities across all 17 tenants within the maintenance window.
- Incremental loads capture all changes between runs with < 0.25% reconciliation variance vs. source GL (PRD KPI).
- No silent data loss between extraction cycles.
- Run metadata available for pipeline health monitoring (F023).

---

## Constraints

- **Dependency:** F001 (authentication) must be complete before extraction can run.
- **Dependency:** F003 (scheduling) determines when this engine is invoked.
- **Dependency:** F005 (Bronze zone) is the write target.
- **Constraint:** BC API rate limits (HTTP 429) govern maximum extraction throughput; managed by F004.
- **Out of scope:** Custom BC API pages published by subsidiaries — handled in F004 / FR-INT-07.
- **Out of scope:** SFTP fallback ingestion path — handled in F004 / FR-INT-08.
- **Out of scope:** Transformation, mapping, or any business logic — this feature covers raw extraction only.
