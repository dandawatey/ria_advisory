-- Migration 009 — Multi-tenant isolation: add tenant_id to fact_gl_entries
-- IC-45 | Agent: Kiran_Data_008 | Reviewer: Kabir_Reviewer_010
-- Rule 06: ADD COLUMN only, idempotent, no data loss.
-- Rule 05: Every table with client data must have tenant_id UUID NOT NULL.
--
-- Backfill strategy:
--   1. Rows with erp_source_id: derive from dim_erp_source.tenant_id
--   2. Rows without erp_source_id (seed/ETL data): derive from dim_company.tenant_id

-- ── Step 1: Add column (nullable first — populate then constrain) ─────────────
ALTER TABLE fact_gl_entries
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- ── Step 2: Backfill from erp_source_id (covers new BC synced rows) ──────────
UPDATE fact_gl_entries g
SET    tenant_id = s.tenant_id
FROM   dim_erp_source s
WHERE  g.erp_source_id = s.erp_source_id
  AND  g.tenant_id IS NULL;

-- ── Step 3: Backfill from dim_company (covers legacy ETL seed data) ───────────
UPDATE fact_gl_entries g
SET    tenant_id = c.tenant_id
FROM   dim_company c
WHERE  g.company_id = c.company_id
  AND  g.tenant_id IS NULL;

-- ── Step 4: Add index for query performance ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gl_entries_tenant_date
    ON fact_gl_entries (tenant_id, date_id);

CREATE INDEX IF NOT EXISTS idx_gl_entries_tenant_account
    ON fact_gl_entries (tenant_id, account_no);

-- ── Step 5: Verify — count of still-null tenant_id rows ───────────────────────
-- Safe to add NOT NULL constraint only if this returns 0.
DO $$
DECLARE
    null_count INT;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM fact_gl_entries
    WHERE tenant_id IS NULL;

    IF null_count = 0 THEN
        -- All rows backfilled — enforce constraint
        ALTER TABLE fact_gl_entries
            ALTER COLUMN tenant_id SET NOT NULL;
        RAISE NOTICE 'Migration 009: tenant_id NOT NULL constraint applied. All rows backfilled.';
    ELSE
        RAISE WARNING 'Migration 009: % rows still have NULL tenant_id — NOT NULL constraint NOT applied. Investigate orphaned rows.', null_count;
    END IF;
END $$;

-- ── Down migration (reference) ────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_gl_entries_tenant_date;
-- DROP INDEX IF EXISTS idx_gl_entries_tenant_account;
-- ALTER TABLE fact_gl_entries DROP COLUMN IF EXISTS tenant_id;
