# ERP Data Pull Process: Complete Architecture, Gaps, and Verification Guide

**Last Updated:** 2026-05-09  
**Status:** Active — Living Document  
**Owner:** Rohan_Backend_003  
**Reviewer:** Meera_Architect_002  

---

## Executive Summary

CFO360 has TWO separate data ingestion paths that are NOT connected:

1. **Legacy ETL Path** — Reads Excel files, loads into `gl_unified` flat table and star schema
2. **Live BC Sync Path** — Pulls Business Central GL via OData, writes to `fact_gl_normalized`

**Critical Finding:** Reports read from the star-schema `fact_gl_entries` table, which receives data from the legacy ETL path only. The live BC sync data lands in `fact_gl_normalized` and is never promoted to `fact_gl_entries`. This means **live BC data never appears in any report**.

---

## Part 1: Architecture Overview

### Two Data Paths (Disconnected)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERP → CFO360 Data Flow                       │
└─────────────────────────────────────────────────────────────────┘

PATH A: LEGACY ETL (Batch/Historical)
──────────────────────────────────────
Excel Files (17 subsidiary GL files)
         │
         ├─→ etl/combine_gl_excel.py  (pre-processing only)
         │        └─→ combined_gl.xlsx
         │
         ├─→ etl/load_gl.py
         │        │  29-column COL_MAP normalization
         │        │  execute_batch(page_size=500)
         │        └─→ gl_unified (flat, legacy)
         │
         └─→ etl/load_star_schema.py
                  │  Loads StarSchema_GL.xlsx (16 sheets)
                  │  ON CONFLICT upserts on all dims + facts
                  └─→ star-schema tables:
                       ├─ dim_currency, dim_company, dim_account, dim_date
                       ├─ fact_gl_entries ← REPORTS READ FROM HERE
                       ├─ fact_coa_balances
                       └─ fact_posted_sales


PATH B: LIVE BC SYNC (Incremental, Real-Time)
──────────────────────────────────────────────
Business Central (OData v4)
         │
         └─→ ERPConnector.fetch_gl_entries()
              │  Posted-only filter (postingDate ne null)
              │  Debit-positive normalization
              │  Pydantic validation
              └─→ bc_sync_worker._sync_one_source()
                   │  Watermark lookup: MAX(watermark_to) from fact_sync_log
                   │  OAuth token refresh
                   │  Fetch GL entries (paginated, $top=1000)
                   │  ON CONFLICT upserts
                   └─→ fact_gl_normalized ← BC DATA LANDS HERE
                        
                        fact_sync_log updated (status, rows_fetched, 
                        rows_upserted, watermark_from/to)

❌ GAP #1: fact_gl_normalized → fact_gl_entries promotion pipeline MISSING
❌ Result: Live BC data never reaches reports
```

---

## Part 2: Connectors in Detail

### ERPConnector Abstract Base Class

All connectors extend this ABC and implement 7 methods:

```
connect(credentials: dict) → None
  - Authenticate and establish session
  - Credentials from vault/env, never stored on self beyond connect()
  
test_connection() → ConnectionStatus
  - 10-second timeout max
  - Returns: connected|degraded|disconnected|auth_expired|disabled
  
fetch_coa() → list[RawAccount]
  - Full chart of accounts (list, not generator)
  
fetch_gl_entries(from_date, to_date) → Iterator[RawGLLine]
  - MUST be a generator (yield, never load full dataset)
  - Posted-only filter at ERP query level
  - Debit-positive normalization applied
  
fetch_dimensions() → list[RawDimension]
  - All active dimension values
  
fetch_entities() → list[RawEntity]
  - All legal entities/companies
  
get_sync_cursor() → SyncCursor
  - Current cursor position (timestamp/page/offset/etag)
  - Returns SyncCursor(cursor_value=None) for full sync
```

### Business Central Connector (`connectors/bc_connector.py`)

**Authentication:** OAuth2 (client_credentials flow to Azure AD)

**Key Constants:**
- Batch size: 1,000 rows per OData `$top`
- HTTP timeout: 30 seconds
- Test timeout: 10 seconds

**Normalization:**
- Maps: documentNumber → journal_id, id → line_number
- Converts debitAmount/creditAmount to debit-positive floats
- Stores full BC JSON in `raw_payload` (JSONB)

**OData Query:**
```
{base_url}/companies/{company_id}/generalLedgerEntries?
  $filter=postingDate ne null AND postingDate ge {from_date} 
  AND postingDate le {to_date}
  &$top=1000
  &$select=id,documentNumber,accountNumber,postingDate,debitAmount,
           creditAmount,description,currencyCode,departmentCode,...
```

**Pagination:** Follows `@odata.nextLink` until None

### SAP S/4HANA Connector (`connectors/sap_connector.py`)

**Authentication:** Basic Auth (HTTP Basic)

**Normalization:**
- Maps GLDC field: 'S' (Sollbuchung) → debit, 'H' (Habenbuchung) → credit
- Stores all JSON in `raw_payload`

**OData Query:**
```
{base_url}/GLDocumentLineItems?
  $filter=Ledger eq '0L' AND PostingDate ge {from_date}
  &$skip={offset}&$top=1000
```

**Pagination:** Via `$skip` offset

### Odoo Connector (`connectors/odoo_connector.py`)

**Authentication:** API key (JSON-RPC)

**Normalization:**
- GL entries already debit/credit separated (no sign inversion needed)

**RPC Call:**
```
account.move.line.search_read(
  domain=[['parent_state', '=', 'posted'],
          ['date', '>=', from_date],
          ['date', '<=', to_date]]
)
```

**Pagination:** Via offset on subsequent calls

---

## Part 3: ETL Pipeline

### Script 1: `etl/combine_gl_excel.py`

**Purpose:** Combine 17 subsidiary Excel files (pre-processing only)

**Flow:**
1. Loop through 17 subsidiary files (map filename → subsidiary name)
2. Read each from sheet "General Ledger Entries"
3. Prepend "Subsidiary" and "Subsidiary Name" columns
4. Concatenate all with `pd.concat()`
5. Write to `combined_gl.xlsx` (no DB interaction)

**Output:** Combined file serves as intermediate artifact; actual load uses original files

### Script 2: `etl/load_gl.py`

**Purpose:** Load 17 Excel files → flat `gl_unified` table

**Flow:**
1. Apply `sql/schema.sql` (creates tables)
2. Truncate `gl_unified` (idempotent)
3. Loop each subsidiary file:
   - Read sheet "General Ledger Entries"
   - Map 29 column headers via `COL_MAP` (handles 26-col and 29-col variants)
   - Clean each field: null checks, float/int coercion, date parsing
   - Bulk insert via `execute_batch()` (page_size=500)
4. Commit per file

**Target:** `gl_unified` (flat table, 32 columns, 4 indexes)

### Script 3: `etl/load_star_schema.py`

**Purpose:** Load `StarSchema_GL.xlsx` (16 sheets) → star schema

**Flow:**
1. Apply `sql/star_schema.sql` (creates all dims + facts)
2. Load in dependency order (leaves → root):
   - Dimensions: currency → company → account → date → document → posting_group → department → counterparty → bal_account → project → project_code → geo → customer
   - Facts: fact_gl_entries → fact_coa_balances → fact_posted_sales
3. Each table uses `ON CONFLICT ... DO UPDATE` upserts (idempotent)
4. Commit after all tables

**Key Safety:** FK constraints deferred until all tables loaded; no orphaned references

---

## Part 4: BC Sync Worker (`workers/bc_sync_worker.py`)

### APScheduler Setup

```
BackgroundScheduler initialized on FastAPI startup
├─ Interval: 15 minutes (configurable via SYNC_INTERVAL_MINUTES env var)
├─ Coalesce: true (skip missed runs, don't queue)
├─ Max instances: 1 (prevent overlapping syncs)
└─ Misfire grace time: 60 seconds
```

### Per-Sync Lifecycle (6 Steps)

**Step 1: Identify Sources**
```
Query: SELECT * FROM dim_erp_source 
       WHERE erp_type='BC' AND connection_status!='disabled' 
       AND auth_status='authenticated'
```
Only BC sources processed (SAP + Odoo exist as code but not wired here — GAP #3)

**Step 2: Watermark Lookup**
```
Query: SELECT MAX(watermark_to) FROM fact_sync_log 
       WHERE erp_source_id=%s AND status='completed'
Result: 
  ├─ Found: watermark_from = MAX(watermark_to), watermark_to = NOW()
  └─ Not found (first sync): watermark_from = NOW() - 90 days
```

**Step 3: OAuth Token**
```
POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
Body: grant_type=client_credentials&client_id=...&client_secret=...&scope=...
Result: Bearer token for all BC API calls
```

**Step 4: Fetch GL Entries**
```
For each BC company:
  GET {base_url}/v2.0/{env}/api/companies/{company_id}/generalLedgerEntries?
    $filter=postingDate ge {watermark_from} and postingDate ne null
    &$top=1000
    
  Loop @odata.nextLink until None (paginate all entries)
  
Normalize each entry:
  ├─ Parse dates (ISO 8601 → Python date)
  ├─ Convert amounts to Decimal (Rule 06 — no float precision loss)
  ├─ Debit-positive normalization
  └─ Store raw BC JSON in raw_payload JSONB
```

**Step 5: Upsert to `fact_gl_normalized`**
```
INSERT INTO fact_gl_normalized 
  (tenant_id, source_erp, source_id, source_line, 
   posting_date, account_code, debit_amount, credit_amount,
   currency, fx_rate, reporting_amount, dimension_1, dimension_2,
   description, raw_payload, ingested_at)
VALUES (...)
ON CONFLICT (tenant_id, source_erp, source_id, source_line) 
DO UPDATE SET posting_date=%s, account_code=%s, 
             debit_amount=%s, credit_amount=%s, ...

Track: max_posting_date (for next watermark)
```

**Step 6: Finalize Sync Log**
```
UPDATE fact_sync_log SET 
  status = 'completed' or 'failed'
  rows_fetched = N
  rows_upserted = N
  watermark_from = watermark_from_value
  watermark_to = watermark_to_value
  error_msg = error (if failed)
WHERE sync_id = %s
```

### Error Handling

```
ConnectorTimeoutError       → Retry (ERP-SP-004 rule)
ConnectorAuthError          → No retry, mark auth_expired, alert
ConnectorRateLimitError     → Wait retry_after_seconds, retry
DataValidationError         → No retry, dead-letter queue
Other                       → Exponential backoff: base * 2^(attempt-1)
```

---

## Part 5: Database Model (28 Tables, 4 Layers)

### Layer 0: Legacy Flat (gl_unified)

Single table with 32 columns: subsidiary_name, posting_date, gl_account_no, amount, department_code, etc. + 4 indexes.

### Layer 1: Star Schema Dimensions (13 tables)

```
dim_currency      ← Currency reference (USD, AED, EUR, etc.)
dim_company       ← Legal entities (17 RIA + 3 iSource), links to tenant_id
dim_account       ← Chart of accounts (L1-L2-L3 hierarchy)
dim_date          ← Date dimension (month-end, fiscal periods, etc.)
dim_document      ← Document types (Invoice, Payment, etc.)
dim_posting_group ← Posting group classification
dim_department    ← Departments + verticals
dim_counterparty  ← Vendors/customers (source_type + source_no)
dim_bal_account   ← Balancing accounts
dim_project       ← Projects
dim_project_code  ← Project codes
dim_geo           ← Geography codes
dim_customer      ← Customer detail (30 seeded)
```

### Layer 2: Live Ingest Table (fact_gl_normalized)

Landing table for all ERP sync data:
```
fact_gl_normalized
├─ UNIQUE (tenant_id, source_erp, source_id, source_line)
├─ posting_date, account_code, debit_amount, credit_amount
├─ currency, fx_rate, reporting_amount
├─ dimension_1, dimension_2, description
├─ raw_payload (JSONB — full BC JSON)
├─ canonical_id (FK to dim_canonical_account — NULL for most rows ← GAP #6)
└─ ingested_at (TIMESTAMPTZ)
```

**Important:** This is the BC sync landing zone. Reports do NOT read from here.

### Layer 2: Star Schema Facts (3 tables)

```
fact_gl_entries
├─ (company_id, entry_no) composite PK
├─ Links to all dimensions
├─ amount (DECIMAL 20,4)
├─ erp_source_id, erp_native_journal_id, erp_native_line_number
├─ Indexes: company_id, date_id, account_no, (tenant_id, posting_date)
└─ ← REPORTS READ FROM HERE (legacy ETL data only)

fact_coa_balances        ← Account balances by company
fact_posted_sales        ← Sales GL entries
```

### Layer 3: Canonical Model (cross-ERP)

```
dim_canonical_account
├─ L1: P&L / Balance Sheet / Cash Flow
├─ L2: Revenue, COGS, OpEx, Assets, Liabilities, etc.
├─ L3: Salary, Rent, Marketing, Cash, Receivables, etc.
└─ Used for cross-ERP P&L comparison

account_mapping
├─ (tenant_id, source_erp, source_account) UNIQUE
├─ Maps ERP account code → canonical_id
├─ confidence score, mapped_by (auto/user)
└─ ← Auto-populated MISSING for live BC syncs (GAP #6)
```

### Layer 4: Metadata + Auth (9 tables)

```
tenants                    ← CFO360 customers
users                      ← Employees + SSO (Azure AD oid)
dim_erp_source             ← Connector registry (connection_status, last_synced_at)
tenant_bc_config           ← BC credentials per tenant
fact_sync_log              ← Sync history + watermarks + cursors
fact_connector_health_log  ← Health snapshots per source
fact_connector_alerts      ← Unresolved sync failures
account_groups             ← User-created account groupings
feature_flags              ← 52 flags (8 phase-1, 44 phase-2)
```

---

## Part 6: Current Implementation Evaluation

### What Works

✓ **BC Connector:** Fully implemented, tested (unit tests), wired to scheduler  
✓ **ETL Scripts:** Load historical/seed data cleanly into star schema  
✓ **BC Sync Worker:** Watermark-based incremental fetch, handles pagination  
✓ **Credential Security:** Secrets never logged, OAuth tokens refreshed per sync  
✓ **Multi-tenant Isolation:** tenant_id enforced on all queries  
✓ **Data Freshness Tracking:** fact_sync_log captures timestamps + watermarks  

### What Doesn't Work

❌ **PATH DISCONNECTION:** fact_gl_normalized → fact_gl_entries promotion MISSING (GAP #1)  
❌ **DUAL SCHEMA:** Dashboard reads gl_unified, reports read star schema (GAP #2)  
❌ **SCHEDULER INCOMPLETE:** Only BC wired; SAP + Odoo code exists but not scheduled (GAP #3)  
❌ **AUTH GUARD MISSING:** Settings endpoints no JWT protection (GAP #5)  
❌ **CANONICAL UNMAPPED:** account_mapping not auto-populated (GAP #6)  
❌ **TEST COVERAGE:** All 25 tests mock the DB; zero integration tests (GAP #4)  

---

## Part 7: Critical Gaps

### GAP #1: fact_gl_normalized ↛ fact_gl_entries (CRITICAL)

**Problem:** Live BC data sits in `fact_gl_normalized` indefinitely. Reports query `fact_gl_entries`. Result: reports show only historical/seed data, never live BC pulls.

**Evidence:**
- `bc_sync_worker.py:_sync_one_source()` upserts to `fact_gl_normalized`
- `routers/reports.py:GET /api/reports/*` joins `fact_gl_entries` + dims
- No migration script promotes `fact_gl_normalized` → `fact_gl_entries`

**Solution:** Add a promotion step in bc_sync_worker (after upsert to fact_gl_normalized):
```
1. After GL upsert to fact_gl_normalized, read all entries from that sync
2. For each entry:
   - Resolve canonical_id via account_mapping (LEFT JOIN)
   - Resolve dimension IDs (company_id, date_id, account_no, etc.)
   - Determine entity_id from erp_source_id
3. INSERT or UPDATE into fact_gl_entries with resolved IDs
4. Commit as single transaction
```

### GAP #2: Dashboard ↛ Star Schema (CRITICAL)

**Problem:** Dashboard queries legacy `gl_unified` table, all reports query star schema. Dashboard and report totals will never match.

**Evidence:**
- `routers/dashboard.py:GET /api/dashboard/kpis` references `gl_unified` directly
- `routers/reports.py:GET /api/reports/revenue/summary` references `fact_gl_entries`

**Solution:** Replace gl_unified queries with star-schema joins in dashboard.py
```
FROM fact_gl_entries g
JOIN dim_company c ON g.company_id = c.company_id
JOIN dim_date d ON g.date_id = d.date_id
JOIN dim_account a ON g.account_no = a.account_no
```

### GAP #3: SAP + Odoo Not Scheduled (HIGH)

**Problem:** SAP and Odoo connectors exist (`connectors/sap_connector.py`, `connectors/odoo_connector.py`) but are never instantiated or scheduled. Only BC syncs automatically.

**Evidence:**
- `bc_sync_worker.py` has hardcoded `WHERE erp_type='BC'`
- main.py startup does not loop all active ERP sources

**Solution:** Generalize bc_sync_worker to handle all ERPConnector subclasses:
```
for source in query(SELECT * FROM dim_erp_source WHERE connection_status != 'disabled'):
  if source.erp_type == 'BC':
    connector = BCConnector()
  elif source.erp_type == 'SAP_S4':
    connector = SAPConnector()
  elif source.erp_type == 'ODOO':
    connector = OdooConnector()
  _sync_one_source(source, connector)
```

### GAP #4: No Integration Tests (HIGH)

**Problem:** All 25 unit tests mock the database. Zero integration tests execute the real data path: fetch → normalize → upsert → promote.

**Evidence:**
- `05_Tests/backend/test_*.py` use mock `db_query()` callable
- No tests in 05_Tests/backend/integration/
- No conftest fixture spawning a test PostgreSQL instance

**Solution:** Create integration test suite:
```
1. Pytest fixture: tmpdir PostgreSQL with migrations applied
2. Spawn mock OData server (httpretty or responses)
3. Test: ETL load_star_schema → fact_gl_entries
4. Test: BC sync → fact_gl_normalized → promotion → fact_gl_entries
5. Test: Cross-ERP consolidation (BC + SAP both synced)
6. Verify reported totals match database state
```

### GAP #5: Settings Endpoints No Auth Guard (HIGH)

**Problem:** `routers/settings.py` connector endpoints (test BC, upsert BC config) have no JWT auth check. Admin-only by convention.

**Evidence:**
- `POST /api/settings/bc` and `POST /api/settings/bc/test` missing `@require_auth` decorator

**Solution:** Add `@require_auth` + `@require_role('admin')` to settings endpoints

### GAP #6: account_mapping Not Auto-Populated (MEDIUM)

**Problem:** After BC sync, entries land in `fact_gl_normalized` with `canonical_id = NULL`. The `account_mapping` table (which maps ERP account → canonical) is not populated post-sync.

**Evidence:**
- No code in bc_sync_worker calls account_mapping populate logic
- `services/incremental_sync.py` has `upsert_gl_entry()` but no canonical enrichment

**Solution:** After GL upsert, call enrichment service:
```
for entry in fact_gl_normalized WHERE canonical_id IS NULL:
  mapping = lookup account_mapping(tenant_id, source_erp, source_account)
  UPDATE fact_gl_normalized SET canonical_id = mapping.canonical_id
```

---

## Part 8: Verification Guide

### How to Know Everything is Working

#### 1. Data Freshness Check

Query to ensure BC sync is running and data is fresh:

```sql
SELECT 
  erp_source_id,
  connection_status,
  last_synced_at,
  NOW() - last_synced_at AS staleness,
  CASE 
    WHEN NOW() - last_synced_at < INTERVAL '24 hours' THEN 'Fresh'
    WHEN NOW() - last_synced_at < INTERVAL '48 hours' THEN 'Stale'
    ELSE 'Very Stale'
  END AS freshness_status
FROM dim_erp_source
WHERE tenant_id = %s
ORDER BY last_synced_at DESC;
```

Expected: `freshness_status = 'Fresh'` for all active sources; `last_synced_at` within last 15 minutes.

#### 2. Sync Log Health

Query the sync_log table to verify sync runs are completing:

```sql
SELECT 
  sync_id,
  erp_source_id,
  sync_type,
  status,
  rows_fetched,
  rows_upserted,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at)) AS duration_seconds,
  error_msg
FROM fact_sync_log
WHERE erp_source_id = %s
ORDER BY completed_at DESC
LIMIT 10;
```

Expected: 
- Latest status = 'completed' (not 'running' or 'failed')
- rows_fetched > 0 and rows_upserted > 0
- duration_seconds < 600 (10 minutes)
- error_msg is NULL

#### 3. Data in Landing Table

Check that BC sync is writing to fact_gl_normalized:

```sql
SELECT 
  COUNT(*) AS total_entries,
  MAX(ingested_at) AS latest_ingest,
  COUNT(DISTINCT source_id) AS distinct_source_ids,
  COUNT(DISTINCT DATE(posting_date)) AS distinct_posting_dates
FROM fact_gl_normalized
WHERE tenant_id = %s
  AND source_erp = 'BC'
  AND ingested_at > NOW() - INTERVAL '24 hours';
```

Expected: total_entries > 0, latest_ingest = very recent, distinct_posting_dates covers active GL period.

#### 4. Promotion Pipeline Check

Verify that data is being promoted to fact_gl_entries (once GAP #1 fixed):

```sql
SELECT 
  COUNT(*) AS total_in_fact_gl_entries,
  COUNT(DISTINCT company_id) AS companies,
  COUNT(DISTINCT DATE(posting_date)) AS posting_dates
FROM fact_gl_entries
WHERE erp_source_id IN (SELECT erp_source_id FROM dim_erp_source WHERE erp_type = 'BC')
  AND posting_date > NOW() - INTERVAL '30 days';
```

Expected: total > 0, companies match active BC sources, posting_dates covers recent GL.

#### 5. Report Consistency Check

Verify that reports are reading correct data:

```sql
-- Revenue (L2 = Revenue)
SELECT SUM(amount) AS total_revenue
FROM fact_gl_entries
WHERE account_no LIKE '4%'
  AND company_id = %s
  AND posting_date BETWEEN %s AND %s;

-- Then call the API:
GET /api/reports/revenue/summary?company_id=X&from_date=Y&to_date=Z
-- Response should have revenue that matches SQL total
```

Expected: API total ≈ SQL total (within rounding error).

#### 6. Canonical Mapping Check

Verify that account_mapping is populated (once GAP #6 fixed):

```sql
SELECT 
  COUNT(*) AS mapped,
  COUNT(CASE WHEN canonical_id IS NULL THEN 1 END) AS unmapped,
  ROUND(100.0 * COUNT(CASE WHEN canonical_id IS NOT NULL THEN 1 END) / COUNT(*), 2) AS percent_mapped
FROM account_mapping
WHERE tenant_id = %s
  AND source_erp = 'BC';
```

Expected: percent_mapped > 95% (some accounts may not have canonical mappings).

---

## Part 9: Database State Post-Pull

### Expected Row Counts (Seed + 30 Days Live BC Sync)

| Table | Expected Rows | Notes |
|---|---|---|
| `dim_currency` | 3-5 | USD, AED, EUR, etc. |
| `dim_company` | 20+ | 17 RIA + 3 iSource |
| `dim_account` | 20-30 | CoA hierarchy |
| `dim_date` | 30-40 | Daily or month-end |
| `dim_document` | 10-20 | Document types |
| `dim_posting_group` | 5-10 | Posting group variants |
| `dim_department` | 15-25 | Departments + verticals |
| `dim_counterparty` | 50-100 | Vendors + customers |
| `dim_project` | 10-20 | Active projects |
| `dim_customer` | 30+ | Customer records |
| `fact_gl_entries` | 4,000-12,000 | Seed + ETL loads |
| `fact_gl_normalized` | 1,000-5,000 | 30 days BC sync |
| `fact_sync_log` | 60-100 | 4-6 syncs per day × 30 days |
| `fact_connector_health_log` | 180-300 | ~1 health check per 5 min × 30 days |
| `fact_connector_alerts` | 0-10 | Only if syncs fail |
| `account_mapping` | 20-40 | One per unique ERP account |

---

## Part 10: Spot Check Queries

After a BC sync completes, run these to verify correctness:

```sql
-- 1. All BC entries posted?
SELECT COUNT(*) AS unposted_entries
FROM fact_gl_normalized
WHERE source_erp = 'BC' AND posting_date IS NULL;
-- Expected: 0

-- 2. All amounts have sign (debit XOR credit)?
SELECT COUNT(*) AS invalid_amounts
FROM fact_gl_normalized
WHERE source_erp = 'BC' AND (
  (debit_amount > 0 AND credit_amount > 0) OR 
  (debit_amount = 0 AND credit_amount = 0)
);
-- Expected: 0

-- 3. Watermark moving forward?
SELECT 
  MAX(watermark_to) AS latest_watermark,
  MAX(watermark_to) - LAG(MAX(watermark_to)) OVER () AS watermark_delta
FROM fact_sync_log
WHERE status = 'completed'
ORDER BY watermark_to DESC
LIMIT 2;
-- Expected: watermark_delta > 0 (moving forward)

-- 4. No orphaned dimension references?
SELECT COUNT(*) AS orphaned
FROM fact_gl_normalized
WHERE source_erp = 'BC'
  AND account_code NOT IN (SELECT account_code FROM dim_account);
-- Expected: 0

-- 5. Tenant isolation enforced?
SELECT COUNT(DISTINCT tenant_id) AS tenants_in_bc_data
FROM fact_gl_normalized
WHERE source_erp = 'BC';
-- Expected: 1 (only querying tenant should see its data)
```

---

## Part 11: Improvement Roadmap

### Phase 1 (Weeks 1-2): Fix Critical Gaps

1. **GAP #1** — Implement fact_gl_normalized → fact_gl_entries promotion
2. **GAP #2** — Update dashboard queries to star schema
3. **GAP #5** — Add JWT auth guards to settings endpoints

### Phase 2 (Weeks 2-3): Widen Connector Support

4. **GAP #3** — Generalize bc_sync_worker to handle SAP + Odoo
5. **GAP #6** — Auto-populate account_mapping post-sync

### Phase 3 (Week 3): Test Coverage

6. **GAP #4** — Build integration test suite with real database

### Phase 4 (Ongoing): Observability

7. Add alerting on sync failures > 2 hours
8. Dashboard widget for sync freshness + health
9. Metadata export (row counts, freshness) via `/api/admin/data-health`

---

## Appendix: Contact Lens for Each Gap

| Gap | Files | Owners |
|---|---|---|
| G1 | workers/bc_sync_worker.py, services/incremental_sync.py | Rohan_Backend_003 |
| G2 | routers/dashboard.py | Ananya_Frontend_004 |
| G3 | workers/bc_sync_worker.py, main.py, connectors/sap_connector.py, connectors/odoo_connector.py | Rohan_Backend_003 |
| G4 | 05_Tests/backend/ | Vikram_QA_005 |
| G5 | routers/settings.py, middleware/auth.py | Ishaan_Security_007 |
| G6 | workers/bc_sync_worker.py, services/incremental_sync.py | Kiran_Data_008 |

---

**END OF DOCUMENT**

Next: See /claude/plans/validated-floating-hickey.md for EPIC → Stories → Sprint → Agent assignments.
