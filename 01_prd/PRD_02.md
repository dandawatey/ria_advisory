# PRD_02 — Multi-ERP Data Source Integration

**Version:** 1.0
**Date:** 2026-04-29
**Owner:** Aarav_PM_001
**Reviewer:** Meera_Architect_002
**Status:** Draft

---

## 1. Executive Summary

### Problem

i-finsights currently ingests GL data exclusively from Microsoft Business Central via Excel exports. This creates three critical gaps:

1. **Coverage gap** — Clients running SAP, Oracle, JD Edwards, Odoo, or Tally produce no data for i-finsights.
2. **Latency gap** — Excel exports are manual, stale by definition, and error-prone. CFOs make decisions on data that may be 3–10 days old.
3. **Consolidation gap** — Multi-ERP organizations (e.g., parent on SAP, subsidiary on BC, regional entity on Odoo) cannot produce a single consolidated view of group financials.

### Opportunity

The global ERP market covers 80,000+ mid-to-large enterprises. A platform that normalizes GL data across all major ERPs into a single analytical layer becomes the CFO's source of truth — regardless of which ERP each entity runs.

### Strategic Goal

Expand i-finsights into a **universal GL intelligence layer** that:
- Connects to 7 ERP systems via native APIs, ODBC, or structured file import
- Normalizes all GL data into a canonical Chart of Accounts (CoA)
- Enables consolidated P&L, balance sheet, and variance analysis across entities running different ERPs
- Provides real-time or near-real-time data freshness for operational decisions

### Business Impact

| Metric | Before | After |
|--------|--------|-------|
| ERP systems supported | 1 (BC via Excel) | 7 |
| Data latency | 3–10 days (manual) | 1 hour – 24 hours (automated) |
| Consolidation capability | Single ERP, single entity | Multi-ERP, multi-entity group |
| Target customer segment | BC-only SMBs | Mid-market to enterprise, any ERP stack |

---

## 2. ERP Connector Architecture

### 2.1 Microsoft Business Central (existing — upgrade)

| Attribute | Detail |
|-----------|--------|
| Current method | Excel export (manual) |
| Target method | BC REST API v2.0 (OData + standard API) |
| Auth | OAuth2 — Azure AD app registration (client credentials flow) |
| GL endpoint | `/api/v2.0/companies({id})/generalLedgerEntries` |
| Chart of Accounts | `/api/v2.0/companies({id})/accounts` |
| Dimensions | `/api/v2.0/companies({id})/dimensionValues` |
| Frequency | Real-time webhook (BC webhook subscription) + daily full sync fallback |
| FY convention | Configurable per company; typically Jan–Dec or Apr–Mar |
| Data model notes | GL entries carry `accountNumber`, `postingDate`, `documentNumber`, `debitAmount`, `creditAmount`, `description`. Dimensions are separate dimension value sets linked by `dimensionSetID`. No native intercompany elimination — must be handled at normalization layer. |

### 2.2 Microsoft Dynamics 365 Finance (D365F)

| Attribute | Detail |
|-----------|--------|
| Connection method | D365F OData REST API + Dual-write (Dataverse) |
| Auth | OAuth2 — Azure AD service principal, scope `https://{tenant}.operations.dynamics.com/` |
| GL endpoint | `GeneralJournalAccountEntries` entity (OData); `LedgerJournalTransactions` for posted journals |
| Chart of Accounts | `MainAccounts` entity |
| Dimensions | Financial dimensions stored as `LedgerDimensionValue`; up to 11 configurable dimensions per legal entity |
| Frequency | Near-real-time via D365F Business Events (webhook push to Azure Service Bus or HTTP endpoint) |
| FY convention | Fiscal calendar defined per legal entity; can differ from calendar year |
| Data model notes | D365F uses legal entities as the top-level segmentation unit. Multi-currency: functional currency + transaction currency + reporting currency — all three stored. Consolidation accounts separate from operating accounts. Intercompany accounting built in but needs mapping to canonical model. |

### 2.3 SAP ECC / S/4HANA

| Attribute | Detail |
|-----------|--------|
| Connection method | SAP OData v2/v4 (preferred for S/4HANA); RFC/BAPI via SAP JCo for ECC; optionally SAP BTP Integration Suite |
| Auth | SAP OAuth2 (S/4HANA Cloud); SAP SSO / basic auth over HTTPS (ECC on-premise); X.509 certificates for BTP |
| GL endpoint | S/4HANA: `API_GLACCOUNTLINEITEM_SRV` OData service, entity `GLAccountLineItem`. ECC: BAPI `BAPI_GL_GETGLACCPERIODVALUES` or RFC `RFC_READ_TABLE` on `BKPF`/`BSEG` tables |
| Chart of Accounts | `ChartOfAccount` entity in OData; `T004`/`SKA1`/`SKB1` tables in ECC |
| Dimensions | CO-PA (Controlling Profitability Analysis) dimensions — profit center, cost center, WBS element, segment |
| Frequency | S/4HANA Cloud: near-real-time via SAP Event Mesh (CloudEvents). ECC on-premise: scheduled batch (daily); optionally SAP PI/PO middleware for push |
| FY convention | SAP fiscal year variant — can be non-calendar (e.g., April–March, custom 4-4-5). Stored in `T009` fiscal year variant table. Period numbers do NOT equal calendar months unless variant is K4. |
| Data model notes | SAP uses chart of accounts (KTOPL) + account (SAKNR). `BKPF` is document header; `BSEG` is line item. Amount fields: `DMBTR` (local currency), `WRBTR` (transaction currency). Company code is the entity unit. Must map company code → canonical entity. SAP allows parallel ledgers (0L, N1, etc.) — need to specify which ledger to pull. Debit/credit convention: SAP uses sign reversal for expense accounts — normalize to debit-positive. |

### 2.4 JD Edwards EnterpriseOne (JDE)

| Attribute | Detail |
|-----------|--------|
| Connection method | JDE Orchestrator Framework REST API (E9.2+); direct JDBC to JDE business data schema (Oracle DB) for older versions |
| Auth | JDE Orchestrator: token-based auth (JDE security token); JDBC: Oracle DB credentials + JDE security server |
| GL endpoint | Orchestrator: `GetF0911Records` orchestration (Account Ledger table F0911). Direct DB: `F0911` table (Account Ledger), `F0901` (Account Master) |
| Chart of Accounts | `F0901` Account Master; business unit + object + subsidiary = natural account |
| Dimensions | Business Unit (BU), Object Account, Subsidiary, Subledger — four-segment natural account structure |
| Frequency | On-demand pull (Orchestrator REST call) or scheduled batch; no native webhook |
| FY convention | JDE uses Period Number (01–14) within fiscal year. Period 01 may not be January — depends on company fiscal date pattern in `F0010`. Up to 14 periods (including adjustment periods). |
| Data model notes | JDE natural account = Business Unit (MCU) + Object (OBJ) + Subsidiary (SUB). `F0911.GLAA` = amount (always positive); `F0911.GLDC` = debit/credit flag ('D'/'C'). `F0911.GLLT` = ledger type (AA = actual, BA = budget). Filter on `GLLT = 'AA'` for actuals. Currency: `F0911.GLCRCD` = transaction currency, `F0911.GLDL` = domestic amount. |

### 2.5 Oracle ERP Cloud / Oracle Financials Cloud

| Attribute | Detail |
|-----------|--------|
| Connection method | Oracle Fusion REST API (preferred); SOAP web services (legacy); OTBI (Oracle Transactional Business Intelligence) extracts |
| Auth | OAuth2 — Oracle IDCS (Identity Cloud Service) client credentials; or basic auth for on-premise |
| GL endpoint | REST: `/fscmRestApi/resources/11.13.18.05/generalLedgerJournals` and `/generalLedgerBalances`. SOAP: `GLService` / `JournalImportService` |
| Chart of Accounts | `/chartOfAccounts` REST resource; chart of accounts structure defined as value sets per segment |
| Dimensions | Oracle GL uses a flexfield structure — Code Combination (CCID) = Ledger + Company + Cost Center + Account + Product + Intercompany + Future1. Number of segments configurable. |
| Frequency | Oracle Business Events + Oracle Integration Cloud (OIC) for real-time push; scheduled REST polling fallback |
| FY convention | Oracle uses Accounting Calendar with period names (e.g., Jan-26, Feb-26). Periods explicitly defined per ledger. |
| Data model notes | Oracle GL is ledger-centric. Each ledger has a primary currency and optionally reporting currencies. Journals post to code combinations (CCID). `ENTERED_DR`/`ENTERED_CR` = transaction currency; `ACCOUNTED_DR`/`ACCOUNTED_CR` = functional currency. Intercompany: Oracle natively generates intercompany balancing lines — tag these for elimination. Consolidation: Oracle HFM or FSG reports. |

### 2.6 Odoo (Community / Enterprise)

| Attribute | Detail |
|-----------|--------|
| Connection method | Odoo JSON-RPC API (built-in); Odoo REST API (v16+ Enterprise); direct PostgreSQL access (self-hosted) |
| Auth | JSON-RPC: session auth (`/web/session/authenticate`) → session cookie or API key (v14+). Direct DB: PostgreSQL credentials. |
| GL endpoint | JSON-RPC: `account.move.line` model via `execute_kw` (read/search_read). REST (v16+): `/api/account.move.line` |
| Chart of Accounts | `account.account` model; code + name + account_type |
| Dimensions | Odoo uses Analytic Accounts (projects/departments) and Tags as dimensions. Multi-company via `company_id` field. |
| Frequency | Webhook via Odoo Automated Actions (limited); polling via JSON-RPC on schedule; real-time via Odoo bus (websocket, complex to integrate externally) |
| FY convention | Odoo fiscal year defined in `date.range` model or account.fiscalyear (older). Lock dates set per company. |
| Data model notes | `account.move` = journal entry header; `account.move.line` = journal line. Key fields: `account_id`, `date`, `debit`, `credit`, `company_id`, `currency_id`, `amount_currency`. Reconciled lines marked with `reconciled=True`. Filter `parent_state = 'posted'` for confirmed entries only. Odoo stores debits/credits as separate positive floats — no sign convention reversal needed. |

### 2.7 Tally Prime / Tally ERP 9

| Attribute | Detail |
|-----------|--------|
| Connection method | Tally XML Gateway (HTTP port 9000); Tally ODBC (read-only DB access); TDL (Tally Definition Language) custom reports exported as XML/CSV |
| Auth | Tally XML Gateway: no auth by default (local network only); basic auth configurable via Tally.ini; ODBC: Windows ODBC DSN |
| GL endpoint | XML Gateway: POST to `http://localhost:9000` with TDL XML request. Request `LEDGER`, `VOUCHER` collections. ODBC: `Vouchers` table, `LedgerEntries` table |
| Chart of Accounts | Tally ledger master (`LEDGER` collection); ledger belongs to a group (parent group hierarchy up to 6 levels) |
| Dimensions | Tally uses Cost Categories and Cost Centres as dimensions. Inventory and Job costing as additional dimensions. |
| Frequency | On-demand pull via XML gateway; scheduled batch export (Tally does not support push/webhooks natively) |
| FY convention | Tally financial year: April 1 – March 31 (fixed for Indian GAAP). Tally stores data per company per financial year as separate data files. |
| Data model notes | Tally ledger = closest to GL account. Voucher = transaction. `VoucherType` determines debit/credit nature. Key voucher types: Receipt, Payment, Journal, Sales, Purchase, Contra. Tally amounts: all positive; debit/credit inferred from voucher type and ledger group. Groups: Sundry Debtors, Sundry Creditors, Direct Expenses, Indirect Expenses, Capital Account, etc. Must map Tally groups → canonical account type. Tally ODBC is read-only and limited; XML gateway preferred. For cloud/remote access: Tally on Azure VM with VPN or Tally Prime Connected (cloud version, limited API). |

---

## 3. Features to Build (by Module)

### 3.1 Connector Framework

#### 3.1.1 Universal Connector Interface

Define a standard connector contract that every ERP adapter must implement:

- `connect(credentials)` — establish and verify connection
- `test_connection()` → status + latency
- `fetch_coa()` → list of accounts in source format
- `fetch_gl_entries(from_date, to_date, ledger_id?)` → paginated GL lines
- `fetch_dimensions()` → available dimension metadata
- `fetch_entities()` → companies/legal entities available
- `get_sync_cursor()` → last-synced bookmark (timestamp or journal ID)

Every connector returns data in a **raw source schema** (ERP-native fields). The normalization layer (§3.2) converts to canonical schema.

#### 3.1.2 Credential Vault

- Encrypted storage of all ERP credentials (OAuth tokens, API keys, JDBC passwords, SAP JCo parameters)
- Encryption at rest: AES-256 with per-tenant key stored in secrets manager (AWS Secrets Manager / Azure Key Vault / HashiCorp Vault)
- Token refresh: auto-refresh OAuth2 tokens before expiry; alert on failure
- Credential audit log: who created/updated/rotated credentials, when
- No plaintext credentials in DB, logs, or UI
- Separate credential scope per tenant (multi-tenant isolation)

#### 3.1.3 Connection Health Monitor

- Heartbeat check every 15 minutes per active connector
- Health states: `Connected`, `Degraded` (partial data), `Disconnected`, `Auth_Expired`
- Dashboard widget showing connector status per ERP per entity
- Alert channels: email, Slack, in-app notification on status change to `Disconnected`
- Latency tracking: p50/p95 response time per connector

#### 3.1.4 Field Mapping UI

- Visual mapper: source field (ERP column) → canonical field (i-finsights CoA field)
- Pre-built mapping templates per ERP (seeded defaults)
- Override capability: tenant-specific mapping overrides on top of defaults
- Mapping validation: detect unmapped mandatory fields, duplicate targets, type mismatches
- Account code mapping: source account → canonical account category (Revenue / COGS / OpEx / CapEx / Asset / Liability / Equity)
- Dimension mapping: source dimension value → canonical dimension (Department / Project / Vertical / Geography)
- Save/export mapping as JSON for audit and reuse across entities

#### 3.1.5 Incremental Sync (Delta Load)

- Track last-synced cursor per connector (journal entry ID, modified timestamp, or sequence number)
- Pull only new/modified entries since last cursor
- Handle late-arriving postings (entries posted with back-dated accounting date): configurable lookback window (default: 7 days)
- Deduplication: upsert on natural key (erp_source_id + journal_id + line_number)
- Change detection for master data (account renames, new cost centers): trigger CoA re-sync

#### 3.1.6 Full Historical Backfill

- One-time bulk import of historical GL data per connector
- Configurable backfill range (e.g., last 5 years)
- Chunked parallel processing to avoid timeout/memory issues
- Progress tracking with estimated time remaining
- Pause/resume capability for large datasets
- Validation report post-backfill: record count, period coverage, currency breakdown

---

### 3.2 Data Normalization Layer

#### 3.2.1 Currency Conversion

- Pull daily exchange rates from ECB (European Central Bank) or Open Exchange Rates API
- Store rates in `dim_exchange_rate` table (date, from_currency, to_currency, rate, source)
- Convert all transaction amounts to:
  - **Functional currency** (entity's primary currency)
  - **Reporting currency** (group consolidation currency — typically USD or EUR)
- Historical rate vs. average rate vs. spot rate: configurable per account type (balance sheet uses period-end rate; P&L uses period-average rate — IFRS/GAAP standard)
- Currency gain/loss calculation for consolidation
- Multi-currency triangle conversion (e.g., SAR → USD via EUR if direct rate unavailable)

#### 3.2.2 Fiscal Year Alignment

- Store fiscal year calendar per entity per ERP source
- Map ERP period numbers → calendar months → i-finsights standard period (YYYY-MM)
- Handle 4-4-5 calendars (common in retail): map weeks to months with weighted allocation
- Handle 13-period calendars (some manufacturing): map period 13 (adjustment) to December
- Enable cross-entity comparison normalized to calendar month regardless of ERP's native period numbering
- Fiscal year end detection: auto-detect from first sync; manual override available

#### 3.2.3 Account Code Normalization → Canonical CoA

- Canonical CoA structure:
  - Level 1: Financial Statement (P&L / Balance Sheet / Cash Flow)
  - Level 2: Category (Revenue / COGS / Gross Profit / OpEx / EBITDA / Interest / Tax / Net Income / Current Assets / Fixed Assets / Current Liabilities / Long-term Liabilities / Equity)
  - Level 3: Subcategory (e.g., OpEx → Salaries / Rent / Marketing / IT / Admin)
  - Level 4: Source account code (ERP-native)
- Pre-built mapping libraries per ERP (SAP standard CoA OP INT → canonical; Oracle standard chart → canonical)
- ML-assisted account classification: train on existing mapped accounts to suggest mappings for new accounts
- Unmapped account alert: flag GL entries with no canonical mapping; block them from consolidated reports until mapped

#### 3.2.4 Intercompany Elimination

- Define intercompany relationships: entity A ↔ entity B (elimination pair)
- Auto-detect intercompany transactions: match by amount + counterparty entity + period + description pattern
- Elimination rules: eliminate intercompany revenue/expense pairs; eliminate intercompany loans; eliminate intercompany investments vs. equity
- Elimination journal: auto-generate elimination entries for consolidated view
- Unmatched intercompany report: flag transactions that should eliminate but have no matching counterpart (difference > configurable threshold)

#### 3.2.5 Dimension Mapping

- Canonical dimensions: Department, Vertical (Business Unit), Project, Geography, Product Line, Legal Entity, ERP Source
- Map ERP-native dimensions to canonical:
  - SAP Cost Center → Department
  - BC Dimension 1 → Vertical
  - JDE Business Unit → Department
  - Odoo Analytic Account → Project
  - Tally Cost Centre → Department
- Dimension hierarchy: support rollup (e.g., Marketing + Sales → Commercial; US + Canada → North America)
- Unclassified dimension handling: route to "Unallocated" bucket; alert for mapping

---

### 3.3 Scheduler and Pipeline

#### 3.3.1 Configurable Sync Schedule

- Per-connector schedule options:
  - Real-time (webhook push — BC, D365F, S/4HANA Cloud)
  - Hourly (polling — Oracle Cloud, Odoo)
  - Daily at configurable time (JDE, ECC, Tally)
  - On-demand (manual trigger from UI)
- Business hours scheduling: option to run syncs only during off-peak hours
- Time zone awareness: schedule relative to ERP server timezone or UTC
- Sync queue: serialized queue per connector to prevent concurrent conflicting syncs

#### 3.3.2 Conflict Resolution

- Period lock detection: if ERP period is closed/locked, mark sync data as final; do not re-pull
- Overlapping sync detection: if two syncs overlap in time range, merge by taking the later run's data as authoritative
- Restatement handling: if prior-period entries change (restatement), detect and reprocess affected periods; notify CFO of restated periods
- Duplicate entry prevention: idempotent upsert on `(erp_source_id, entity_id, journal_entry_id, line_number)`

#### 3.3.3 Audit Trail

- Log every sync event: connector, entity, triggered_by (scheduler/manual/user), start_time, end_time, status, records_fetched, records_inserted, records_updated, records_rejected
- Store in `fact_sync_log` table (see §6)
- Immutable audit log: no deletes on sync log
- Who-what-when for credential changes, mapping changes, schedule changes
- Export audit log as CSV/PDF for compliance

#### 3.3.4 Failed Sync Alerts and Retry Logic

- Exponential backoff retry: 1 min → 5 min → 15 min → 1 hour → 4 hours (max 5 retries)
- Categorize failures: auth failure (no retry until credential fixed) / network timeout (retry) / data validation error (no retry, alert) / ERP API rate limit (retry after cool-down)
- Partial success handling: if 90% of records synced successfully, mark as `Partial` not `Failed`; report failed records separately
- Escalation: after 3 consecutive failures, escalate to admin email + in-app notification
- Dead letter queue: store failed records for manual review and replay

---

### 3.4 CFO Dashboard Enhancements

#### 3.4.1 Cross-ERP P&L Comparison

- Side-by-side P&L for entities running different ERPs
- Normalized to canonical CoA regardless of source ERP
- Period selector: month / quarter / YTD / custom range
- Variance column: absolute and percentage variance between entities or periods
- Drill-down from summary line to source ERP journal entries (with ERP source badge)

#### 3.4.2 Consolidated View

- Group consolidation across multiple ERPs and entities in a single P&L / Balance Sheet
- Intercompany elimination toggle (show pre-elimination vs. post-elimination)
- Minority interest calculation for partial ownership entities
- Consolidation currency selector (USD / EUR / GBP / local currency)
- Entity tree selector: choose which entities to include in consolidation perimeter
- Reconciliation waterfall: parent → subsidiary → elimination → consolidated total

#### 3.4.3 ERP-Specific Benchmarking

- Compare same-entity financials across ERP migration periods (e.g., pre-SAP vs. post-SAP)
- Peer benchmarking across entities using same ERP (e.g., all subsidiaries on Odoo vs. all on BC)
- KPI cards: Revenue per FTE, OpEx ratio, DSO, DPO — filterable by ERP source
- ERP data quality score: completeness % + dimension fill rate + mapping coverage %

#### 3.4.4 Data Freshness Indicator

- Per-ERP, per-entity badge showing: last sync time, next scheduled sync, sync status
- Staleness alert: flag dashboards where underlying data is older than configurable threshold (default: 48 hours)
- Data age tooltip on every chart/table: "Data as of [timestamp] from [ERP name]"
- Consolidated view freshness = oldest data source in consolidation

---

### 3.5 Reconciliation and Validation

#### 3.5.1 Cross-ERP Trial Balance Reconciliation

- Generate trial balance per entity per period from canonical GL data
- Compare against ERP-native trial balance (where API provides it)
- Highlight discrepancies: amount differences, missing accounts, period gaps
- Reconciliation sign-off workflow: Finance team marks reconciliation as approved per period
- Historical reconciliation archive: store reconciliation results per period

#### 3.5.2 Variance Alerts

- Configure variance rules: alert if account balance changes by >X% period-over-period
- Alert if same entity same period differs between two ERP syncs (data integrity alert)
- Unusual posting alert: entries outside normal business hours, round-number transactions above threshold, entries by inactive users
- Configurable alert thresholds per account category (P&L accounts vs. balance sheet accounts)

#### 3.5.3 Data Quality Scoring per ERP Source

- Score per dimension (0–100):
  - Completeness: % of GL lines with all mandatory fields populated
  - Dimension fill rate: % of lines with department/project/vertical mapped
  - Account mapping rate: % of source accounts mapped to canonical CoA
  - Currency coverage: % of lines with valid currency code
  - Timeliness: average sync lag vs. ERP posting date
- Overall ERP data quality score = weighted average
- Trend chart: quality score over time per ERP
- Remediation suggestions: "43 accounts unmapped — click to open field mapper"

#### 3.5.4 Missing GL Code Detection

- Compare active accounts in ERP CoA vs. accounts that have actually posted entries
- Alert on new accounts with no mapping
- Alert on accounts that had activity in prior periods but no activity this period (may indicate reclassification or error)
- Dormant account report: accounts with no activity for > 6 months

---

## 4. ERP-Specific Requirements

### 4.1 Microsoft Business Central

- Migrate from Excel export to BC REST API v2.0 (backward compatible with existing data)
- Register Azure AD app: `Financials.ReadWrite.All` permission scope
- Webhook subscription: subscribe to `generalLedgerEntries` entity change events
- Multi-company support: enumerate companies via `/companies` endpoint; sync all or selected
- Custom dimensions: BC supports up to 8 global/shortcut dimensions — map all to canonical
- Posted vs. draft: filter on `postingDate IS NOT NULL` for posted entries only
- Rollout: existing Excel data becomes baseline; API sync adds incremental from go-live date

### 4.2 Microsoft Dynamics 365 Finance

- D365F tenant on Azure: use same Azure AD tenant if possible for simpler OAuth2
- Business Events: configure `GeneralJournalEntryPosted` business event in D365F → send to i-finsights webhook endpoint
- Legal entity enumeration: `LegalEntities` OData entity; one connector instance per D365F environment
- Financial dimension framework: D365F dimensions are fully configurable — must read `DimensionAttributeValueCombination` to decode `LedgerDimension` values
- Intercompany: D365F auto-generates ICO vouchers — tag them with `intercompany=true` in canonical schema
- Dual-write consideration: if client uses Dataverse dual-write, can pull from Dataverse instead of D365F OData (lower latency)
- Budget integration: optionally pull `BudgetTransactionLine` for budget vs. actual in i-finsights

### 4.3 SAP ECC / S/4HANA

- S/4HANA Cloud: use SAP Integration Suite (BTP) as intermediary to avoid direct OData calls on production system
- ECC on-premise: deploy i-finsights SAP connector as ABAP RFC-enabled Z-function or use SAP PI/PO
- Ledger selection: always specify leading ledger (0L) unless client requests parallel ledger (e.g., IFRS ledger N1)
- Document splitting: S/4HANA document splitting generates additional line items for segment/profit center reporting — include split lines in pull
- Fiscal year variant: read `T009` to get period-to-month mapping; critical for non-calendar FY clients
- SAP company code vs. i-finsights entity: one-to-one mapping; if client has 50 company codes, create 50 entity mappings
- Currency keys: SAP `WAERS` = transaction currency, `HWAER` = local currency — both must be pulled
- Authorization: SAP basis team must create RFC user with `S_RFC`, `S_TABU_DIS` (read only) authorizations; no write access required
- Large dataset: BSEG can have billions of rows — mandatory date filter on `BUDAT` (posting date); use open SQL with index

### 4.4 JD Edwards EnterpriseOne

- Orchestrator Framework requires E9.2 Update 3+; for older versions fall back to JDBC
- JDBC connection: Oracle JDBC driver; connect to JDE Business Data schema (e.g., `JDE_PRODUCTION`)
- F0911 key fields: `GLKCO` (company), `GLAID` (account ID), `GLDGJ` (G/L date — Julian format), `GLAA` (amount), `GLDC` (debit/credit)
- Julian date conversion: JDE stores dates as century + YYYYDDD (e.g., 126100 = April 10, 2026) — must convert
- Business Unit / Object / Subsidiary: concatenate `GLMCU`+`GLOBJ`+`GLSUB` to form account code; look up in F0901 for description
- Ledger type: always filter `GLLT = 'AA'` for actual amounts; `'BA'` = budget, `'AU'` = units
- Multi-currency: JDE stores `GLAA` in domestic currency; `GLCRCD` + `GLCRA` for foreign currency amount
- Period mapping: read `F0010` (Company Constants) for fiscal date pattern; period 01 start date per company

### 4.5 Oracle ERP Cloud

- Oracle Integration Cloud (OIC) preferred middleware — Oracle-certified integration patterns
- REST API pagination: Oracle uses `offset`/`limit` with `hasMore` flag; implement robust pagination loop
- Code combination decoder: `CodeCombinationId` must be joined to `GlCodeCombinations` view to get segment values
- Segment structure: varies per client — read `FND_ID_FLEX_SEGMENTS` to understand segment names and order
- Reporting currency: Oracle stores `ENTERED_DR/CR` (transaction) and `ACCOUNTED_DR/CR` (functional) — always pull both
- Intercompany flag: `INTERCOMPANY_FLAG = 'Y'` on journal lines — tag accordingly
- Oracle period name: format is `Mon-YY` (e.g., `Apr-26`) — parse to YYYY-MM
- SaaS rate limits: Oracle Cloud REST API — default 1,000 requests/hour; implement rate limiter with token bucket

### 4.6 Odoo

- JSON-RPC endpoint: `POST /web/dataset/call_kw` with model `account.move.line`, method `search_read`
- Mandatory filter: `[['parent_state', '=', 'posted'], ['move_type', 'in', ['entry', 'out_invoice', 'in_invoice', 'out_refund', 'in_refund']]]`
- Multi-company: `company_id` field on every record; one Odoo instance may host multiple companies — enumerate via `res.company` model
- API key auth (v14+): `X-Openerp-Session-Id` header with API key; preferred over password auth
- Analytic accounts: pull `account.analytic.line` linked to move lines for project/department dimension
- Chart of Accounts: Odoo `account_type` field maps to: `asset_receivable`, `liability_payable`, `income`, `expense`, `equity`, `asset_current`, etc. — pre-built mapping to canonical account type
- Odoo SaaS (Odoo.com): REST API available in v16+; for v15 and below, JSON-RPC is the only option
- Volume consideration: Odoo does not have row-level change tracking natively — must use `write_date` field for delta sync

### 4.7 Tally Prime

- XML Gateway must be enabled in Tally.ini: `TDLName = ...; Port = 9000`
- Network access: Tally XML Gateway is typically localhost only — requires VPN or reverse proxy for remote access
- i-finsights Tally Agent: lightweight Python/Node agent installed on-premise with Tally; agent pushes data to i-finsights cloud API
- Voucher collection request: TDL XML to fetch vouchers with date filter — `<FETCH>LEDGERENTRIES.LIST</FETCH>`
- Ledger master sync: separate TDL request for `LEDGER` collection to get full CoA
- Amount sign convention: Tally does not use debit/credit flags consistently — determine by voucher effect:
  - Receipt voucher: cash/bank DR, income CR
  - Payment voucher: cash/bank CR, expense DR
  - Journal: explicit debit/credit in ledger entries
- Tally data files: each company-year is a separate `.900` data file — connector must know active data path
- Tally Prime Connected (cloud): REST API available for Tally SaaS subscribers — use if available; avoids on-premise agent
- Compliance: Tally is primary book of record for Indian GAAP/GST — data must be treated as authoritative for Indian entities

---

## 5. User Stories (Prioritized)

**US-01** (Priority: Critical)
As a **CTO / Architect**, I want a universal connector interface so that adding a new ERP in future requires only implementing a standard adapter, not rewriting the pipeline.

**US-02** (Priority: Critical)
As a **Finance Manager (SAP client)**, I want i-finsights to pull GL entries directly from SAP S/4HANA daily so that I no longer maintain manual Excel exports and risk data errors.

**US-03** (Priority: Critical)
As a **Group CFO**, I want a consolidated P&L across entities running BC, SAP, and Odoo so that I see one group view without waiting for Excel consolidation from each subsidiary.

**US-04** (Priority: High)
As a **Finance Controller**, I want a field mapping UI so that I can map my ERP's account codes to the canonical CoA without developer intervention.

**US-05** (Priority: High)
As a **Treasury Manager**, I want multi-currency GL data normalized to USD so that I can compare revenue and costs across entities in different functional currencies.

**US-06** (Priority: High)
As a **Finance Director**, I want a data freshness indicator on every dashboard so that I know whether the P&L I'm looking at reflects today's postings or last week's.

**US-07** (Priority: High)
As a **System Administrator**, I want credential vault with encrypted storage so that ERP API keys and passwords are never stored in plaintext.

**US-08** (Priority: High)
As a **Audit Manager**, I want a full sync audit log (what synced, when, by whom, how many records) so that I can demonstrate data lineage for external auditors.

**US-09** (Priority: Medium)
As a **Financial Analyst**, I want a cross-ERP trial balance reconciliation report so that I can confirm i-finsights data matches the ERP source before closing month-end.

**US-10** (Priority: Medium)
As a **Finance Manager (Tally client)**, I want a Tally on-premise agent so that I can sync GL data from Tally Prime even though it has no cloud API.

**US-11** (Priority: Medium)
As a **Finance Controller**, I want intercompany elimination in the consolidated view so that intercompany revenue and expenses do not inflate group P&L.

**US-12** (Priority: Medium)
As a **CFO**, I want failed sync alerts via email and in-app notification so that I know immediately if an ERP connection breaks and data is going stale.

**US-13** (Priority: Medium)
As a **Finance Analyst**, I want fiscal year alignment across ERPs so that Period 1 in JDE and January in BC are treated as the same period in comparative reports.

**US-14** (Priority: Low)
As a **Finance Manager**, I want a data quality score per ERP source so that I can prioritize data cleanup efforts on the lowest-quality connector.

**US-15** (Priority: Low)
As a **CFO**, I want ERP benchmarking KPIs (Revenue per FTE, OpEx ratio) filterable by ERP so that I can identify if operational efficiency correlates with the ERP system used.

---

## 6. Technical Architecture

### 6.1 New Database Tables

```sql
-- ERP source registry
dim_erp_source (
  erp_source_id     SERIAL PRIMARY KEY,
  tenant_id         UUID NOT NULL,
  erp_type          VARCHAR(50) NOT NULL,  -- 'BC', 'D365F', 'SAP_ECC', 'SAP_S4', 'JDE', 'ORACLE', 'ODOO', 'TALLY'
  erp_version       VARCHAR(50),
  entity_id         UUID NOT NULL,         -- links to dim_company
  display_name      VARCHAR(200),
  connection_status VARCHAR(20),           -- 'connected', 'disconnected', 'auth_expired', 'degraded'
  last_heartbeat_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
)

-- Sync execution log (immutable audit)
fact_sync_log (
  sync_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_source_id     INT REFERENCES dim_erp_source,
  sync_type         VARCHAR(20),           -- 'incremental', 'full', 'backfill', 'manual'
  triggered_by      VARCHAR(100),          -- 'scheduler', 'webhook', 'user:<user_id>'
  period_from       DATE,
  period_to         DATE,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  status            VARCHAR(20),           -- 'running', 'success', 'partial', 'failed'
  records_fetched   BIGINT,
  records_inserted  BIGINT,
  records_updated   BIGINT,
  records_rejected  BIGINT,
  error_message     TEXT,
  cursor_before     JSONB,
  cursor_after      JSONB
)

-- Account mapping: ERP source account → canonical account
dim_erp_mapping (
  mapping_id         SERIAL PRIMARY KEY,
  erp_source_id      INT REFERENCES dim_erp_source,
  source_account_code VARCHAR(100) NOT NULL,
  source_account_name VARCHAR(500),
  canonical_account_id INT REFERENCES dim_account,
  canonical_category  VARCHAR(50),         -- 'Revenue', 'COGS', 'OpEx', etc.
  dimension_type      VARCHAR(50),         -- 'account', 'department', 'project', 'geography'
  source_dimension_code VARCHAR(100),
  canonical_dimension_value VARCHAR(200),
  mapping_confidence  DECIMAL(5,2),        -- 0-100, ML-assisted
  mapped_by           VARCHAR(100),        -- 'auto', 'user:<user_id>', 'ml_model'
  mapped_at           TIMESTAMPTZ,
  is_active           BOOLEAN DEFAULT TRUE
)

-- Exchange rates
dim_exchange_rate (
  rate_id           SERIAL PRIMARY KEY,
  rate_date         DATE NOT NULL,
  from_currency     CHAR(3) NOT NULL,
  to_currency       CHAR(3) NOT NULL,
  rate              DECIMAL(20,8) NOT NULL,
  rate_type         VARCHAR(20),           -- 'spot', 'average', 'period_end'
  source            VARCHAR(50),           -- 'ECB', 'OXR', 'manual'
  UNIQUE(rate_date, from_currency, to_currency, rate_type)
)

-- Credential vault (references only — actual secrets in external vault)
dim_erp_credential (
  credential_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_source_id     INT REFERENCES dim_erp_source,
  credential_type   VARCHAR(50),           -- 'oauth2_client', 'api_key', 'jdbc', 'basic_auth'
  vault_secret_ref  VARCHAR(500),          -- reference key in secrets manager
  expires_at        TIMESTAMPTZ,
  last_rotated_at   TIMESTAMPTZ,
  created_by        VARCHAR(100)
)

-- Reconciliation results
fact_reconciliation (
  recon_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_source_id     INT REFERENCES dim_erp_source,
  entity_id         UUID,
  period            CHAR(7),               -- YYYY-MM
  account_code      VARCHAR(100),
  erp_balance       DECIMAL(20,4),
  ifinsights_balance DECIMAL(20,4),
  variance          DECIMAL(20,4),
  variance_pct      DECIMAL(10,4),
  status            VARCHAR(20),           -- 'matched', 'variance', 'missing_in_erp', 'missing_in_ifs'
  signed_off_by     VARCHAR(100),
  signed_off_at     TIMESTAMPTZ,
  run_at            TIMESTAMPTZ DEFAULT NOW()
)
```

### 6.2 Canonical GL Entry — Extended Schema

Extend `fact_gl_entries` with:
- `erp_source_id` — FK to `dim_erp_source`
- `erp_native_journal_id` — original journal/document number in source ERP
- `erp_native_line_number` — line number within source document
- `transaction_currency` — ISO currency code of original transaction
- `transaction_amount_dr` / `transaction_amount_cr` — amounts in transaction currency
- `functional_currency` — entity's functional currency
- `functional_amount_dr` / `functional_amount_cr` — amounts in functional currency
- `reporting_amount_dr` / `reporting_amount_cr` — amounts in group reporting currency (USD/EUR)
- `exchange_rate_used` — rate applied for reporting currency conversion
- `is_intercompany` — boolean flag
- `is_elimination_entry` — boolean flag
- `dimension_department` / `dimension_vertical` / `dimension_project` / `dimension_geography` — canonical dimension values
- `data_quality_score` — 0–100 completeness score for this record

### 6.3 New Backend Services

**connector_worker** (Python, async, one per ERP type)
- Implements universal connector interface
- Runs as Celery worker or asyncio task
- Scheduled via APScheduler or Celery Beat
- Publishes events to internal message bus on sync completion

**field_mapper_service** (Python FastAPI microservice or module)
- CRUD for `dim_erp_mapping`
- ML model endpoint: `POST /suggest_mapping` → returns top-3 canonical account suggestions
- Bulk mapping import/export (CSV/JSON)

**credential_vault_service** (Python)
- Thin wrapper over AWS Secrets Manager / Azure Key Vault
- Interface: `store_credential`, `retrieve_credential`, `rotate_credential`, `delete_credential`
- Token refresh scheduler for OAuth2 tokens

**reconciliation_worker** (Python)
- Triggered post-sync or on-demand
- Computes `fact_reconciliation` records
- Publishes variance alerts if thresholds exceeded

**exchange_rate_fetcher** (Python, daily cron)
- Pulls rates from ECB XML feed and/or Open Exchange Rates API
- Upserts into `dim_exchange_rate`

### 6.4 New Frontend Pages and Components

| Page / Component | Route | Description |
|-----------------|-------|-------------|
| Connector Management | `/settings/connectors` | List all ERP connectors, status badges, add/edit/delete |
| Add Connector Wizard | `/settings/connectors/new` | Step-by-step: select ERP type → enter credentials → test connection → configure schedule |
| Field Mapper | `/settings/connectors/:id/mapping` | Visual source → canonical field mapping UI |
| Sync History | `/settings/connectors/:id/sync-history` | List of sync runs with status, record counts, error details |
| Consolidated Dashboard | `/dashboard/consolidated` | Multi-ERP P&L / BS with entity tree selector |
| Data Quality | `/analytics/data-quality` | ERP quality scores, unmapped accounts, dimension fill rates |
| Reconciliation | `/analytics/reconciliation` | Trial balance recon per ERP, sign-off workflow |
| Freshness Widget | (component) | Reusable badge showing last sync time + status for any ERP source |

---

## 7. MVP Scope (Phase 1)

**Goal:** Prove the connector framework with two additional ERPs beyond BC. Demonstrate consolidated view.

### Phase 1 ERPs

| ERP | Rationale |
|-----|-----------|
| Microsoft Business Central | Already partially done; upgrade from Excel to REST API |
| SAP S/4HANA Cloud | Largest enterprise demand; OData API well-documented |
| Odoo | Open-source; many mid-market clients; simple JSON-RPC |

### Phase 1 Features

- Universal connector interface (BC + SAP S4 Cloud + Odoo)
- Credential vault (basic — environment variables or AWS Secrets Manager)
- Field mapping UI (manual mapping only; no ML in Phase 1)
- Incremental sync (daily schedule)
- Basic currency conversion (spot rate, reporting currency = USD)
- Fiscal year alignment (calendar year and April–March supported)
- Account code normalization (manual mapping; no auto-suggest)
- Consolidated P&L view (2–3 entities, post-elimination not required in Phase 1)
- Data freshness indicator on all dashboards
- Sync audit log (read-only view)
- Failed sync email alerts

### Phase 1 Out of Scope

- JDE, Oracle, Tally, D365F connectors (Phase 2)
- ML-assisted account mapping
- Intercompany elimination
- Reconciliation sign-off workflow
- Data quality scoring
- Full historical backfill UI (command-line script only)
- Real-time webhooks (Phase 2)

### Phase 1 Success Criteria

- Three ERP connectors operational and pulling daily GL data
- Zero manual Excel exports required for BC, SAP, Odoo entities
- Consolidated P&L rendered for group with entities on different ERPs
- Sync latency < 2 hours from ERP posting to i-finsights dashboard
- Zero credential plaintext in DB or logs

---

## 8. Acceptance Criteria

### Connector Framework

- AC-01: Given valid OAuth2 credentials, BC connector pulls all GL entries for specified date range within 5 minutes for up to 100,000 records.
- AC-02: Given SAP OData credentials, SAP connector pulls `GLAccountLineItem` for a 30-day range and returns data matching trial balance from SAP by ≤ 0.01 variance.
- AC-03: Given Odoo JSON-RPC credentials, Odoo connector pulls all posted `account.move.line` records for a company and matches Odoo Trial Balance report.
- AC-04: Credential vault stores no plaintext credentials in PostgreSQL; all secrets retrievable only via vault API with valid auth.
- AC-05: Connection health monitor detects disconnection within 20 minutes and sends alert.

### Data Normalization

- AC-06: All GL amounts converted to reporting currency (USD) using correct rate type (period-end for BS, period-average for P&L) per IFRS 21.
- AC-07: Fiscal year period mapping correctly assigns JDE Period 01 (April) to YYYY-04 canonical period for an April–March FY client.
- AC-08: Account mapping covers ≥ 95% of source accounts for any client after initial mapping session.

### Pipeline and Scheduler

- AC-09: Incremental sync runs within configured schedule window (±5 minutes tolerance).
- AC-10: Failed sync triggers retry within 1 minute; after 3 failures, admin alert sent within 5 minutes.
- AC-11: Sync audit log records every sync execution; log is immutable (no delete, no update).

### CFO Dashboard

- AC-12: Consolidated P&L renders correctly for 3 entities on 3 different ERPs; totals reconcile to sum of individual entities (no elimination in Phase 1).
- AC-13: Data freshness badge shows correct last-sync timestamp; updates within 60 seconds of sync completion.
- AC-14: Cross-ERP P&L comparison renders within 3 seconds for 12-month period.

### Reconciliation

- AC-15: Trial balance reconciliation report shows zero variance for accounts correctly mapped and synced; highlights variance accounts with amount and percentage.

---

## 9. Risks and Dependencies

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SAP on-premise access requires SAP Basis team involvement (firewall, RFC user, auth) | High | High | Provide SAP setup guide; add 2-week lead time for SAP clients in onboarding |
| Tally XML Gateway accessible only on local network | High | Medium | Build Tally on-premise agent as separate deployable; document VPN/proxy options |
| Oracle API rate limits throttle large historical pulls | Medium | Medium | Implement token bucket rate limiter; use OTBI bulk export for backfill |
| ERP API breaking changes (SAP, Oracle frequent version updates) | Medium | High | Version-pin API endpoints; integration test suite per ERP; monitor ERP release notes |
| JDE JDBC access may be blocked by DBA/security team | Medium | Medium | Offer Orchestrator Framework as alternative; document least-privilege DB user setup |
| Multi-currency conversion introduces rounding errors in consolidation | Low | Medium | Use DECIMAL(20,4) precision throughout; implement reconciliation check post-conversion |

### Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Client ERP downtime causes sync failures | High | Low | Retry logic + staleness alert; design dashboards to show last-good-data clearly |
| GL data volume from SAP ECC (billions of rows) causes pipeline OOM | Medium | High | Mandatory date-range chunking; streaming processing; no in-memory full load |
| Fiscal year configuration error causes period misalignment | Low | High | FY mapping validation step in connector setup wizard; show preview mapping before first sync |
| Credential expiry not detected before OAuth token expires | Medium | Medium | Token refresh 10 minutes before expiry; alert 24 hours before if refresh fails |

### Business Dependencies

| Dependency | Owner | Required For |
|-----------|-------|-------------|
| SAP OData service activation | Client SAP Basis team | SAP connector Phase 2 |
| BC Azure AD app registration | Client IT admin | BC REST API upgrade Phase 1 |
| Oracle IDCS client credentials | Client Oracle admin | Oracle connector Phase 2 |
| Tally network access / VPN | Client IT team | Tally connector Phase 2 |
| Exchange rate API subscription | DevOps (Neha_DevOps_006) | Multi-currency conversion Phase 1 |
| Secrets manager setup (AWS/Azure) | DevOps (Neha_DevOps_006) | Credential vault Phase 1 |
| Legal/compliance review of data residency | Ishaan_Security_007 | All connectors — client data must not leave agreed region |

### Data Governance Dependencies

- Data Processing Agreements (DPAs) with clients for ERP GL data ingestion
- GDPR / DPDPA compliance: GL data may contain personal references (vendor names, employee expense claims) — PII handling policy required
- Data residency: client's ERP data must stay in agreed cloud region (EU clients → EU data center)
- Retention policy: how long to retain synced GL data after client contract ends

---

*End of PRD_02 — Multi-ERP Data Source Integration v1.0*
