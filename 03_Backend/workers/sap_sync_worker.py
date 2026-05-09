"""
SAP S/4 Scheduled Sync Worker (ICFO-65-S3)

Pattern: APScheduler background job running every 30 minutes
Flow: Fetch GL (incremental) → Normalize → Promote → Log

Runs with: `SCHEDULE_SAP_SYNC=true`
"""

import os
import logging
from datetime import datetime, date, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from database import query

logger = logging.getLogger(__name__)


def run_sap_sync():
    """
    Main SAP sync job: fetch GL entries → normalize → promote → log

    Called every 30 minutes by APScheduler.
    Fetches incremental GL changes since last completed sync.
    """
    try:
        # 1. Get all active SAP sources
        sql = """
        SELECT erp_source_id, erp_type, host, client_id
        FROM dim_erp_source
        WHERE erp_type = 'SAP_S4' AND active = true
        """
        sap_sources = query(sql)

        if not sap_sources:
            logger.info("No active SAP sources configured. Skipping SAP sync.")
            return

        for source in sap_sources:
            _sync_single_sap_source(source)

    except Exception as e:
        logger.error(f"SAP sync worker failed: {str(e)}")


def _sync_single_sap_source(source):
    """
    Sync a single SAP source: fetch → normalize → promote

    Args:
        source: Dict with erp_source_id, erp_type, host, client_id
    """
    source_id = source.get('erp_source_id')

    try:
        # 2. Get last completed sync timestamp
        sql = """
        SELECT MAX(started_at)
        FROM fact_sync_log
        WHERE erp_source_id = %s AND status = 'completed'
        """
        result = query(sql, [source_id])
        last_sync_date = result[0][0] if result and result[0][0] else date(2020, 1, 1)

        # 3. Log sync start
        sync_id = _log_sync_start(source_id, 'incremental', last_sync_date)

        # 4. Connect to SAP
        from connectors.sap_connector import SAPConnector
        from connectors.vault import get_vault_secret

        creds = get_vault_secret(f"erp/{source_id}")
        connector = SAPConnector()
        connector.connect(creds)

        # 5. Fetch GL entries (generator pattern, prevents memory overload)
        # Timeout: 30 seconds per request
        entries_fetched = 0
        for entry in connector.fetch_gl_entries(from_date=last_sync_date, to_date=date.today()):
            # Normalize and insert to fact_gl_normalized
            _insert_to_fact_gl_normalized(entry)
            entries_fetched += 1

            # Batch size: log every 1000 entries
            if entries_fetched % 1000 == 0:
                logger.info(f"SAP {source_id}: fetched {entries_fetched} entries")

        # 6. Promote GL entries from fact_gl_normalized → fact_gl_entries
        _promote_gl_entries(source_id, sync_id)

        # 7. Log success
        sql = """
        UPDATE fact_sync_log
        SET status = 'completed', row_count = %s, completed_at = NOW()
        WHERE sync_id = %s
        """
        query(sql, [entries_fetched, sync_id])

        logger.info(f"SAP sync {sync_id}: completed. Fetched {entries_fetched} entries.")

    except Exception as e:
        # Log error to fact_sync_log
        logger.error(f"SAP sync for {source_id} failed: {str(e)}")
        _log_sync_error(sync_id, str(e))


def _insert_to_fact_gl_normalized(entry):
    """
    Insert normalized GL entry to fact_gl_normalized

    Args:
        entry: Dict with normalized GL fields (debit_amount, credit_amount, account_code, etc.)
    """
    sql = """
    INSERT INTO fact_gl_normalized
    (erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number,
     debit_amount, credit_amount, account_code, posting_date, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
    ON CONFLICT (erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number)
    DO UPDATE SET
      debit_amount = EXCLUDED.debit_amount,
      credit_amount = EXCLUDED.credit_amount,
      account_code = EXCLUDED.account_code,
      posting_date = EXCLUDED.posting_date,
      updated_at = NOW()
    """
    query(sql, [
        entry.get('erp_source_id'),
        entry.get('entity_id'),
        entry.get('erp_native_journal_id'),
        entry.get('erp_native_line_number'),
        entry.get('debit_amount'),
        entry.get('credit_amount'),
        entry.get('account_code'),
        entry.get('posting_date'),
    ])


def _promote_gl_entries(source_id, sync_id):
    """
    Promote GL entries: fact_gl_normalized → fact_gl_entries
    Deduplicates by natural key. Uses ON CONFLICT for idempotent upsert.

    Args:
        source_id: ERP source ID
        sync_id: Sync log ID for audit trail
    """
    sql = """
    INSERT INTO fact_gl_entries
    (erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number,
     debit_amount, credit_amount, account_code, posting_date, created_at)
    SELECT
      erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number,
      debit_amount, credit_amount, account_code, posting_date, NOW()
    FROM fact_gl_normalized
    WHERE erp_source_id = %s
    ON CONFLICT (erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number)
    DO UPDATE SET
      debit_amount = EXCLUDED.debit_amount,
      credit_amount = EXCLUDED.credit_amount,
      account_code = EXCLUDED.account_code,
      posting_date = EXCLUDED.posting_date,
      updated_at = NOW()
    """
    query(sql, [source_id])
    logger.info(f"Promoted GL entries for source {source_id}")


def _log_sync_start(source_id, sync_type, from_date):
    """
    Log sync start to fact_sync_log

    Returns:
        sync_id (UUID)
    """
    sql = """
    INSERT INTO fact_sync_log
    (erp_source_id, sync_type, from_date, started_at, status)
    VALUES (%s, %s, %s, NOW(), 'in_progress')
    RETURNING sync_id
    """
    result = query(sql, [source_id, sync_type, from_date])
    sync_id = result[0]['sync_id'] if result else None
    return sync_id


def _log_sync_error(sync_id, error_msg):
    """
    Log sync error to fact_sync_log
    """
    sql = """
    UPDATE fact_sync_log
    SET status = 'failed', error_msg = %s, completed_at = NOW()
    WHERE sync_id = %s
    """
    query(sql, [error_msg, sync_id])


# ─────────────────────────────────────────────────────────────────────────────
# APScheduler Registration
# ─────────────────────────────────────────────────────────────────────────────

scheduler = BackgroundScheduler()


def start_sap_scheduler():
    """
    Start SAP sync scheduler (called from main.py on app startup)
    """
    # Check env var
    if os.getenv("SCHEDULE_SAP_SYNC") != "true":
        logger.info("SAP sync scheduler disabled (SCHEDULE_SAP_SYNC not set)")
        return

    # Get interval from env (default: 30 minutes)
    interval_minutes = int(os.getenv("SAP_SYNC_INTERVAL_MINUTES", "30"))

    # Add job to scheduler
    scheduler.add_job(
        run_sap_sync,
        IntervalTrigger(minutes=interval_minutes),
        id='sap_sync',
        name='SAP GL Sync (every 30 min)',
        replace_existing=True
    )

    # Start scheduler if not already running
    if not scheduler.running:
        scheduler.start()

    logger.info(f"SAP sync scheduler started (interval: {interval_minutes} min)")


def stop_sap_scheduler():
    """
    Stop SAP sync scheduler (called on app shutdown)
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("SAP sync scheduler stopped")
