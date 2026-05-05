# 06 — Canonical Data Model (ERP-Agnostic)

**Status:** Active
**Owner:** Kiran_Data_008
**Reviewer:** Kabir_Reviewer_010
**Created:** 2026-05-05

---

## Architecture Overview

```
ERP Sources (BC, SAP, Odoo, Dynamics, etc.)
        │
        │  Raw GL entries (connector fetch)
        ▼
┌─────────────────────┐
│  dim_account        │  ← BC native Chart of Accounts (534 accounts)
│  fact_gl_entries    │  ← BC historical GL (188,380 rows)
└─────────────────────┘
        │
        │  account_mapping table
        │  (source_account → canonical_id)
        ▼
┌─────────────────────────────────────────────────────────┐
│  dim_canonical_account                                  │
│                                                         │
│  L1: P&L | Balance Sheet | Cash Flow                    │
│    L2: Revenue | COGS | OpEx | Current Assets | ...     │
│      L3: Advisory Fee Revenue | Cash & Equivalents | …  │
└─────────────────────────────────────────────────────────┘
        │
        │  fact_gl_normalized (future: multi-ERP landing table)
        ▼
┌─────────────────────────────────────────────────────────┐
│  Reports & Analytics (ERP-agnostic queries)             │
│  P&L, Balance Sheet, Cash Flow, Consolidated View       │
└─────────────────────────────────────────────────────────┘
```

---

## Table Definitions

### `dim_canonical_account`

ERP-independent chart of accounts hierarchy. Single source of truth for all financial categorisation.

| Column         | Type    | Description |
|----------------|---------|-------------|
| canonical_id   | SERIAL  | Primary key |
| l1_statement   | TEXT    | P&L \| Balance Sheet \| Cash Flow |
| l2_category    | TEXT    | Revenue \| COGS \| OpEx \| Current Assets \| etc. |
| l3_subcategory | TEXT    | Specific sub-classification (nullable) |
| display_name   | TEXT    | Human-readable label for UI |
| sort_order     | INT     | Display ordering |
| is_active      | BOOLEAN | Soft delete flag |

Unique index: `(l2_category, COALESCE(l3_subcategory, ''))`

---

### `account_mapping`

Maps ERP-native accounts to canonical hierarchy. Per-tenant, per-ERP.

| Column         | Type         | Description |
|----------------|--------------|-------------|
| mapping_id     | SERIAL       | Primary key |
| tenant_id      | UUID         | FK → tenants(id) |
| source_erp     | TEXT         | ERP identifier: BC \| SAP \| ODOO \| etc. |
| source_account | TEXT         | ERP-native account code |
| source_name    | TEXT         | ERP-native account name |
| canonical_id   | INT          | FK → dim_canonical_account |
| l2_override    | TEXT         | User can override L2 without full canonical |
| mapped_by      | TEXT         | 'auto' \| 'user' |
| confidence     | DECIMAL(5,2) | Auto-map confidence 0–100 |
| notes          | TEXT         | User notes |

Unique constraint: `(tenant_id, source_erp, source_account)`

---

### `fact_gl_normalized`

Future multi-ERP landing table. Connectors write here once implemented.

| Column          | Type          | Description |
|-----------------|---------------|-------------|
| id              | BIGSERIAL     | Primary key |
| tenant_id       | UUID          | Required — multi-tenant isolation |
| source_erp      | TEXT          | ERP source identifier |
| source_id       | TEXT          | ERP-native journal/document ID |
| source_line     | INT           | Line number within journal |
| posting_date    | DATE          | Date of posting |
| account_code    | TEXT          | ERP-native account code |
| canonical_id    | INT           | FK → dim_canonical_account |
| entity_code     | TEXT          | ERP-native entity code |
| entity_id       | INT           | FK → dim_company |
| debit_amount    | DECIMAL(20,4) | Debit-positive normal form |
| credit_amount   | DECIMAL(20,4) | Credit-positive normal form |
| currency        | CHAR(3)       | ISO 4217 currency code |
| fx_rate         | DECIMAL(20,8) | FX rate to reporting currency |
| reporting_amount| DECIMAL(20,4) | Amount in reporting currency |
| dimension_1     | TEXT          | ERP dimension 1 (dept, cost centre, etc.) |
| dimension_2     | TEXT          | ERP dimension 2 |
| description     | TEXT          | Line description |
| raw_payload     | JSONB         | Full raw ERP payload (audit trail) |

Unique constraint: `(tenant_id, source_erp, source_id, source_line)`

---

## L1/L2/L3 Canonical Hierarchy

### P&L Statement

| L2 Category   | L3 Subcategory             |
|---------------|----------------------------|
| Revenue       | Advisory Fee Revenue       |
|               | Management Fee Revenue     |
|               | Consulting Revenue         |
|               | Other Revenue              |
| COGS          | Direct Labour              |
|               | Direct Materials           |
|               | Subcontractors             |
|               | Other COGS                 |
| OpEx          | Compensation & Benefits    |
|               | Technology & Software      |
|               | Occupancy & Facilities     |
|               | Marketing & Biz Dev        |
|               | Travel & Entertainment     |
|               | Professional Fees          |
|               | General & Administrative   |
| Other Income  | Interest Income            |
|               | FX Gain                    |
|               | Other Income               |
| Other Expense | Interest Expense           |
|               | FX Loss                    |
|               | Other Expense              |
| Income Tax    | Current Tax                |
|               | Deferred Tax               |

### Balance Sheet

| L2 Category         | L3 Subcategory               |
|---------------------|------------------------------|
| Current Assets      | Cash & Equivalents           |
|                     | Accounts Receivable          |
|                     | Prepaid Expenses             |
|                     | Inventory                    |
|                     | Other Current Assets         |
| Fixed Assets        | Property Plant & Equipment   |
|                     | Intangible Assets            |
|                     | Capital WIP                  |
| Other Assets        | Long-term Investments        |
|                     | Deferred Tax Asset           |
| Current Liabilities | Accounts Payable             |
|                     | Accrued Liabilities          |
|                     | Short-term Debt              |
|                     | Tax Payable                  |
| LT Liabilities      | Long-term Debt               |
|                     | Deferred Tax Liability       |
| Equity              | Share Capital                |
|                     | Retained Earnings            |
|                     | Other Comprehensive Income   |

### Cash Flow

| L2 Category         | L3 Subcategory                        |
|---------------------|---------------------------------------|
| Operating Activities| Net Cash from Operating Activities    |
| Investing Activities| Net Cash from Investing Activities    |
| Financing Activities| Net Cash from Financing Activities    |

---

## Auto-Mapping Logic

When `seed_canonical.py` (or `/api/canonical/mappings/auto-map`) runs:

1. **Category match** — if `dim_account.account_category` is in `CATEGORY_TO_L2` map → assign L2 directly. Confidence: 90%.
2. **Prefix fallback** — if category is NULL, use first digit of `account_no`:
   - 4xx → Revenue
   - 5xx → COGS
   - 6xx → OpEx
   - 7xx → Other Income
   - 8xx → Income Tax
   - 1xx → Current Assets
   - 2xx → Current Liabilities
   - 3xx → Equity
   - 999999 → NULL (suspense, no mapping)
   Confidence: 60%.
3. **User override** — user edits via Mapping Console → `mapped_by = 'user'`, confidence overridden. Auto-map never overwrites user-mapped rows.

---

## API Endpoints

Base: `/api/canonical`

| Method | Path                               | Description |
|--------|------------------------------------|-------------|
| GET    | /accounts                          | List all dim_canonical_account rows |
| GET    | /mappings?source_erp=BC            | List account_mapping for tenant+ERP |
| PUT    | /mappings/{source_account}         | User override: canonical_id, l2_override, notes |
| POST   | /mappings/auto-map?source_erp=BC   | Re-run auto-map for unmapped accounts |
| GET    | /stats?source_erp=BC               | Coverage stats |
| GET    | /erp-types                         | Distinct ERP types in mappings |

---

## Adding a New ERP Connector

When a new ERP connector is added (SAP, Odoo, Dynamics, etc.):

1. **Implement connector** — extend `ERPConnector` ABC in `03_Backend/connectors/`. See Rule 07.
2. **Seed mappings** — after initial GL sync, call `POST /api/canonical/mappings/auto-map?source_erp=SAP`.
3. **Review unmapped** — check `GET /api/canonical/stats?source_erp=SAP` for unmapped accounts.
4. **User overrides** — finance user reviews and manually fixes low-confidence or unmapped accounts via Mapping Console.
5. **Write to fact_gl_normalized** — connector writes normalised entries to `fact_gl_normalized` with `source_erp=SAP` and `canonical_id` resolved from `account_mapping`.
6. **Reports auto-include** — all reports querying `fact_gl_normalized` automatically include the new ERP data without code changes.

---

## Current Coverage (as of 2026-05-05)

- Total BC accounts: 534
- Mapped: 533 (99.8%)
- Unmapped: 1 (account 999999 — suspense, intentionally excluded)
- Tenants seeded: RIA Advisory + iSource

---

## Update Log

### 2026-05-05 — Initial creation
- Migration 007_canonical_model.sql: dim_canonical_account, account_mapping, fact_gl_normalized
- seed_canonical.py: seeded 45 canonical rows + 1068 mapping rows (534 accounts × 2 tenants)
- routers/canonical.py: full CRUD + stats + auto-map endpoint
- F021_MappingConsole.tsx: 3-tab interface — GL Master & Mapping, Canonical Hierarchy, Coverage Stats
- Coverage: 99.8% of BC accounts auto-mapped on first run
