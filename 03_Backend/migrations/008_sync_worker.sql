-- 008: BC Scheduled Sync Worker — fact_sync_log extensions
-- IC-40 | Agent: Rohan_Backend_003
-- Adds watermark + row count + error_msg columns to fact_sync_log (idempotent).

-- ── New columns on fact_sync_log ─────────────────────────────────────────────
ALTER TABLE fact_sync_log ADD COLUMN IF NOT EXISTS rows_fetched    INTEGER     DEFAULT 0;
ALTER TABLE fact_sync_log ADD COLUMN IF NOT EXISTS rows_upserted   INTEGER     DEFAULT 0;
ALTER TABLE fact_sync_log ADD COLUMN IF NOT EXISTS watermark_from  TIMESTAMPTZ;
ALTER TABLE fact_sync_log ADD COLUMN IF NOT EXISTS watermark_to    TIMESTAMPTZ;
ALTER TABLE fact_sync_log ADD COLUMN IF NOT EXISTS error_msg       TEXT;

-- ── Index for watermark lookups ───────────────────────────────────────────────
-- Used by bc_sync_worker: SELECT MAX(watermark_to) WHERE status='completed'
CREATE INDEX IF NOT EXISTS idx_sync_log_watermark
    ON fact_sync_log (erp_source_id, status, completed_at);

-- ── Extend status check constraint to include 'completed' ────────────────────
-- erp_sources router and freshness service already use 'completed'; add it.
ALTER TABLE fact_sync_log DROP CONSTRAINT IF EXISTS fact_sync_log_status_check;
ALTER TABLE fact_sync_log ADD CONSTRAINT fact_sync_log_status_check
    CHECK (status IN ('running', 'success', 'completed', 'partial', 'failed'));
