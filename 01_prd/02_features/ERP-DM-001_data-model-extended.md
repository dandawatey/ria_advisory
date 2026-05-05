# Feature: ERP-DM-001 — Extended Data Model (DB Schema + Migrations)

**Created:** 2026-04-29
**Ticket:** ERP-DM-001
**Type:** Feature
**Phase:** Phase 1 — MVP (core tables) + Phase 2 (quality/recon tables)
**Priority:** Critical — must land before all other ERP features
**Owner:** Meera_Architect_002
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Define all new PostgreSQL tables required by PRD_02. Write migration scripts. Extend `fact_gl_entries` with multi-ERP columns. Create all dimension, fact, and operational tables. Establish indexes and constraints. Seed reference data (canonical CoA, ERP type enum).

### Why
Every feature in PRD_02 depends on the data model. Data model must be defined and migrated before any connector, normalization, or dashboard code can run. This is the foundational ticket.

### Acceptance Criteria
- AC: All tables created via versioned migration (Alembic or sequential SQL scripts)
- AC: `fact_gl_entries` extended with all multi-ERP columns (no data loss to existing rows)
- AC: Unique constraint on `fact_gl_entries(erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number)` — deduplication key
- AC: All FK relationships enforced
- AC: Canonical CoA reference data seeded (4-level hierarchy, 50+ canonical accounts)
- AC: Migration reversible (down migrations for each up migration)

---

## P — Pseudocode

### Migration Structure
```
03_Backend/migrations/
  001_initial_schema.sql          ← existing (do not touch)
  002_multi_erp_sources.sql       ← Phase 1
  003_extend_fact_gl_entries.sql  ← Phase 1
  004_credential_vault.sql        ← Phase 1
  005_exchange_rates.sql          ← Phase 1
  006_sync_log_audit.sql          ← Phase 1
  007_erp_mapping.sql             ← Phase 1
  008_dimension_hierarchy.sql     ← Phase 1
  009_connector_health_log.sql    ← Phase 1
  010_data_quality_scoring.sql    ← Phase 2
  011_reconciliation.sql          ← Phase 2
  012_variance_rules.sql          ← Phase 2
  013_backfill_jobs.sql           ← Phase 2
  014_dead_letter_queue.sql       ← Phase 2
  015_ico_relationships.sql       ← Phase 2
```

### Phase 1 Tables (SQL)
```sql
-- 002: ERP Source Registry
CREATE TABLE dim_erp_source (
  erp_source_id     SERIAL PRIMARY KEY,
  tenant_id         UUID NOT NULL,
  erp_type          VARCHAR(50) NOT NULL
                    CHECK (erp_type IN ('BC','D365F','SAP_ECC','SAP_S4','JDE','ORACLE','ODOO','TALLY')),
  erp_version       VARCHAR(50),
  entity_id         UUID NOT NULL,
  display_name      VARCHAR(200),
  connection_status VARCHAR(20) DEFAULT 'disconnected'
                    CHECK (connection_status IN ('connected','degraded','disconnected','auth_expired','disabled')),
  last_heartbeat_at TIMESTAMPTZ,
  last_synced_at    TIMESTAMPTZ,
  sync_cursor       JSONB,
  schedule_config   JSONB,
  fy_calendar       JSONB,
  config_json       JSONB,
  staleness_threshold_hours INT DEFAULT 48,
  locked_periods    JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_erp_source_tenant ON dim_erp_source(tenant_id);
CREATE INDEX idx_erp_source_entity ON dim_erp_source(entity_id);

-- 003: Extend fact_gl_entries (ADD COLUMNS — no data loss)
ALTER TABLE fact_gl_entries
  ADD COLUMN IF NOT EXISTS erp_source_id          INT REFERENCES dim_erp_source,
  ADD COLUMN IF NOT EXISTS erp_native_journal_id  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS erp_native_line_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS transaction_currency   CHAR(3),
  ADD COLUMN IF NOT EXISTS transaction_amount_dr  DECIMAL(20,4),
  ADD COLUMN IF NOT EXISTS transaction_amount_cr  DECIMAL(20,4),
  ADD COLUMN IF NOT EXISTS functional_currency    CHAR(3),
  ADD COLUMN IF NOT EXISTS functional_amount_dr   DECIMAL(20,4),
  ADD COLUMN IF NOT EXISTS functional_amount_cr   DECIMAL(20,4),
  ADD COLUMN IF NOT EXISTS reporting_amount_dr    DECIMAL(20,4),
  ADD COLUMN IF NOT EXISTS reporting_amount_cr    DECIMAL(20,4),
  ADD COLUMN IF NOT EXISTS exchange_rate_used     DECIMAL(20,8),
  ADD COLUMN IF NOT EXISTS is_intercompany        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_elimination_entry   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_final               BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_superseded          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dimension_department   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS dimension_vertical     VARCHAR(200),
  ADD COLUMN IF NOT EXISTS dimension_project      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS dimension_geography    VARCHAR(200),
  ADD COLUMN IF NOT EXISTS data_quality_score     DECIMAL(5,2);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gl_entry_natural_key
  ON fact_gl_entries(erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number)
  WHERE erp_source_id IS NOT NULL;

CREATE INDEX idx_gl_erp_source_period ON fact_gl_entries(erp_source_id, period);
CREATE INDEX idx_gl_erp_source_account ON fact_gl_entries(erp_source_id, source_account_code);

-- 004: Credential Vault references
CREATE TABLE dim_erp_credential (
  credential_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_source_id     INT NOT NULL REFERENCES dim_erp_source ON DELETE CASCADE,
  credential_type   VARCHAR(50) NOT NULL,
  vault_secret_ref  VARCHAR(500) NOT NULL,
  expires_at        TIMESTAMPTZ,
  last_rotated_at   TIMESTAMPTZ,
  created_by        VARCHAR(100),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 005: Exchange Rates
CREATE TABLE dim_exchange_rate (
  rate_id       SERIAL PRIMARY KEY,
  rate_date     DATE NOT NULL,
  from_currency CHAR(3) NOT NULL,
  to_currency   CHAR(3) NOT NULL,
  rate          DECIMAL(20,8) NOT NULL,
  rate_type     VARCHAR(20) NOT NULL DEFAULT 'spot',
  source        VARCHAR(50),
  UNIQUE(rate_date, from_currency, to_currency, rate_type)
);
CREATE INDEX idx_exchange_rate_lookup ON dim_exchange_rate(from_currency, to_currency, rate_date, rate_type);

-- 006: Sync Audit Log (immutable — no DELETE granted)
CREATE TABLE fact_sync_log (
  sync_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_source_id    INT REFERENCES dim_erp_source,
  sync_type        VARCHAR(20) NOT NULL,
  triggered_by     VARCHAR(100),
  period_from      DATE,
  period_to        DATE,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  status           VARCHAR(20) NOT NULL DEFAULT 'running'
                   CHECK (status IN ('running','success','partial','failed')),
  records_fetched  BIGINT DEFAULT 0,
  records_inserted BIGINT DEFAULT 0,
  records_updated  BIGINT DEFAULT 0,
  records_rejected BIGINT DEFAULT 0,
  error_message    TEXT,
  cursor_before    JSONB,
  cursor_after     JSONB
);
-- REVOKE DELETE ON fact_sync_log FROM app_user;  -- set in DB init script

-- 007: ERP Account + Dimension Mapping
CREATE TABLE dim_erp_mapping (
  mapping_id              SERIAL PRIMARY KEY,
  erp_source_id           INT NOT NULL REFERENCES dim_erp_source ON DELETE CASCADE,
  source_account_code     VARCHAR(100) NOT NULL,
  source_account_name     VARCHAR(500),
  canonical_account_id    INT REFERENCES dim_account,
  canonical_category      VARCHAR(50),
  canonical_l1            VARCHAR(50),
  canonical_l2            VARCHAR(50),
  canonical_l3            VARCHAR(100),
  dimension_type          VARCHAR(50) DEFAULT 'account',
  source_dimension_code   VARCHAR(100),
  canonical_dimension_value VARCHAR(200),
  mapping_confidence      DECIMAL(5,2),
  mapped_by               VARCHAR(100),
  mapped_at               TIMESTAMPTZ DEFAULT NOW(),
  is_active               BOOLEAN DEFAULT TRUE,
  UNIQUE(erp_source_id, source_account_code, dimension_type)
);
CREATE INDEX idx_mapping_lookup ON dim_erp_mapping(erp_source_id, source_account_code, dimension_type);

-- 008: Dimension Hierarchy
CREATE TABLE dim_dimension_hierarchy (
  hierarchy_id   SERIAL PRIMARY KEY,
  tenant_id      UUID NOT NULL,
  canonical_dim  VARCHAR(50) NOT NULL,
  value          VARCHAR(200) NOT NULL,
  parent_value   VARCHAR(200),
  level_num      INT NOT NULL DEFAULT 1,
  UNIQUE(tenant_id, canonical_dim, value)
);

-- 009: Connector Health Log
CREATE TABLE fact_connector_health_log (
  log_id        SERIAL PRIMARY KEY,
  erp_source_id INT REFERENCES dim_erp_source,
  checked_at    TIMESTAMPTZ DEFAULT NOW(),
  status        VARCHAR(20),
  latency_ms    INT,
  error_msg     TEXT
);
CREATE INDEX idx_health_log_erp ON fact_connector_health_log(erp_source_id, checked_at DESC);

-- Alerts table (shared by health monitor + failed sync + variance)
CREATE TABLE fact_connector_alerts (
  alert_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_source_id INT REFERENCES dim_erp_source,
  tenant_id     UUID NOT NULL,
  alert_type    VARCHAR(50) NOT NULL,
  severity      VARCHAR(20) DEFAULT 'warning',
  details       JSONB,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_alerts_tenant ON fact_connector_alerts(tenant_id, is_read, created_at DESC);

-- Quarantine (unmapped accounts)
CREATE TABLE fact_gl_quarantine (
  quarantine_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_source_id    INT REFERENCES dim_erp_source,
  raw_journal_id   VARCHAR(100),
  source_account   VARCHAR(100),
  reason           VARCHAR(50),
  raw_record_json  JSONB,
  quarantined_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

-- Audit log for config changes
CREATE TABLE fact_audit_log (
  log_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  VARCHAR(50),
  entity_id    VARCHAR(100),
  field        VARCHAR(100),
  old_value    TEXT,
  new_value    TEXT,
  changed_by   VARCHAR(100),
  changed_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Canonical CoA Seed Data (Sample)
```sql
-- Seed canonical CoA in dim_account (extend existing table)
INSERT INTO dim_account (canonical_l1, canonical_l2, canonical_l3, account_name) VALUES
  ('P&L', 'Revenue', 'Product Revenue', 'Product Revenue'),
  ('P&L', 'Revenue', 'Service Revenue', 'Service Revenue'),
  ('P&L', 'COGS', 'Direct Materials', 'Direct Materials'),
  ('P&L', 'COGS', 'Direct Labor', 'Direct Labor'),
  ('P&L', 'OpEx', 'Salaries', 'Salaries & Wages'),
  ('P&L', 'OpEx', 'Rent', 'Rent & Occupancy'),
  ('P&L', 'OpEx', 'Marketing', 'Marketing & Advertising'),
  ('P&L', 'OpEx', 'IT', 'IT & Technology'),
  ('P&L', 'OpEx', 'Admin', 'General & Administrative'),
  ('P&L', 'Interest', 'Interest Expense', 'Interest Expense'),
  ('P&L', 'Tax', 'Income Tax', 'Income Tax Expense'),
  ('Balance Sheet', 'Current Assets', 'Cash', 'Cash & Cash Equivalents'),
  ('Balance Sheet', 'Current Assets', 'Receivables', 'Accounts Receivable'),
  ('Balance Sheet', 'Fixed Assets', 'PPE', 'Property Plant & Equipment'),
  ('Balance Sheet', 'Current Liabilities', 'Payables', 'Accounts Payable'),
  ('Balance Sheet', 'Long-term Liabilities', 'Long-term Debt', 'Long-term Debt'),
  ('Balance Sheet', 'Equity', 'Retained Earnings', 'Retained Earnings')
ON CONFLICT DO NOTHING;
```

---

## A — Architecture

### New Files
- `03_Backend/migrations/002_multi_erp_sources.sql`
- `03_Backend/migrations/003_extend_fact_gl_entries.sql`
- `03_Backend/migrations/004_credential_vault.sql`
- `03_Backend/migrations/005_exchange_rates.sql`
- `03_Backend/migrations/006_sync_log_audit.sql`
- `03_Backend/migrations/007_erp_mapping.sql`
- `03_Backend/migrations/008_dimension_hierarchy.sql`
- `03_Backend/migrations/009_connector_health_log.sql`
- `03_Backend/migrations/seed_canonical_coa.sql`
- `03_Backend/db_migrate.py` — migration runner script

### Modified Files
- `03_Backend/database.py` — add migration runner call on startup
- `03_Backend/main.py` — ensure migrations run before app serves requests

### DB / API changes
All above. Existing `fact_gl_entries` extended via `ADD COLUMN IF NOT EXISTS` — zero data loss.

---

## R — Refinement

### Edge Cases
- Migration 003 (`ADD COLUMN`): new columns nullable — existing BC Excel rows have NULL for multi-ERP columns (expected; queries filter by `erp_source_id IS NOT NULL` for new data)
- Unique index on natural key: only applies when `erp_source_id IS NOT NULL` — preserves existing data without unique constraint violations
- FK `dim_erp_mapping.canonical_account_id → dim_account`: `dim_account` must exist first — migration order enforced

### Security
- `REVOKE DELETE ON fact_sync_log, fact_audit_log FROM app_user` in DB init — immutable tables
- No secrets in any DB table — only vault references

### Performance
- Index on `(erp_source_id, period)` on `fact_gl_entries` — critical for all dashboard queries
- Index on `(from_currency, to_currency, rate_date)` on `dim_exchange_rate` — critical for bulk conversion

---

## C — Completion

### Done Criteria (Phase 1)
- [ ] Migrations 002–009 run successfully on fresh DB
- [ ] `fact_gl_entries` extended with all 16 new columns
- [ ] Unique constraint on natural key working (upsert test)
- [ ] All FK constraints enforced
- [ ] `dim_exchange_rate` seed: today's EUR rates loaded
- [ ] Canonical CoA seeded (17+ standard accounts)
- [ ] `fact_sync_log` immutable (DELETE permission revoked)
- [ ] Migration runner in `db_migrate.py` idempotent (runs twice = no error)

### Test Plan
- Run all migrations on clean DB → verify all tables created
- Run migrations again (idempotent) → verify no error
- INSERT into `fact_gl_entries` with new columns → verify constraint works
- INSERT two identical (erp_source_id, entity_id, journal_id, line_no) → verify unique conflict
- Attempt DELETE on fact_sync_log → expect permission denied
- Verify existing Excel GL data (erp_source_id IS NULL) unaffected by migration
