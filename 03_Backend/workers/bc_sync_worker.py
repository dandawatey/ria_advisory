"""
workers/bc_sync_worker.py — BC Scheduled Sync Worker
IC-40 | Agent: Rohan_Backend_003 | Reviewer: Kabir_Reviewer_010

Polls all active BC ERP sources on a configurable interval.
Watermark-based incremental load → upserts into fact_gl_normalized.
Rule 05: Never log credentials — only IDs.
Rule 06: Parameterized queries, DECIMAL amounts.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database import query  # type: ignore[import]

logger = logging.getLogger(__name__)

# ── SQL constants ────────────────────────────────────────────────────────────

_ACTIVE_BC_SOURCES_SQL = """
    SELECT
        s.erp_source_id,
        s.tenant_id::text  AS tenant_id,
        t.bc_tenant_id,
        t.client_id,
        t.client_secret,
        t.environment,
        t.api_version
    FROM dim_erp_source s
    JOIN tenant_bc_config t
        ON t.tenant_id = s.tenant_id::text
    WHERE s.erp_type    = 'BC'
      AND s.is_active   = TRUE
      AND t.auth_status = 'authenticated'
"""

_WATERMARK_SQL = """
    SELECT MAX(watermark_to) AS last_watermark
    FROM fact_sync_log
    WHERE erp_source_id = %s
      AND status        = 'completed'
"""

_INSERT_SYNC_LOG_SQL = """
    INSERT INTO fact_sync_log (
        erp_source_id, status, sync_type,
        triggered_by, rows_fetched, rows_upserted
    ) VALUES (%s, 'running', 'incremental', 'bc_sync_worker', 0, 0)
    RETURNING sync_id
"""

_UPDATE_SYNC_LOG_DONE_SQL = """
    UPDATE fact_sync_log
    SET status        = %s,
        completed_at  = NOW(),
        rows_fetched  = %s,
        rows_upserted = %s,
        watermark_from = %s,
        watermark_to  = %s,
        error_msg     = %s
    WHERE sync_id = %s
"""

# Uses natural key on fact_gl_normalized: (tenant_id, source_erp, source_id, source_line)
_UPSERT_GL_SQL = """
    INSERT INTO fact_gl_normalized (
        tenant_id, source_erp, source_id, source_line,
        posting_date, account_code, entity_code,
        debit_amount, credit_amount,
        currency, description, raw_payload, ingested_at
    ) VALUES (%s, 'BC', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, NOW())
    ON CONFLICT (tenant_id, source_erp, source_id, source_line)
    DO UPDATE SET
        posting_date  = EXCLUDED.posting_date,
        account_code  = EXCLUDED.account_code,
        debit_amount  = EXCLUDED.debit_amount,
        credit_amount = EXCLUDED.credit_amount,
        description   = EXCLUDED.description,
        raw_payload   = EXCLUDED.raw_payload,
        ingested_at   = NOW()
"""


# ── OAuth helper ─────────────────────────────────────────────────────────────

def _get_bc_token(bc_tenant_id: str, client_id: str, client_secret: str) -> Optional[str]:
    """
    Request client_credentials token from Azure AD for BC.
    Returns access_token string or None on failure.
    Never logs client_secret.
    """
    token_url = (
        f"https://login.microsoftonline.com/{bc_tenant_id}/oauth2/v2.0/token"
    )
    try:
        resp = httpx.post(
            token_url,
            data={
                "grant_type":    "client_credentials",
                "client_id":     client_id,
                "client_secret": client_secret,
                "scope":         "https://api.businesscentral.dynamics.com/.default",
            },
            timeout=10.0,
        )
        if resp.status_code == 200:
            return resp.json().get("access_token")
        logger.warning(
            "BC OAuth failed for bc_tenant_id=%s status=%s",
            bc_tenant_id, resp.status_code,
        )
        return None
    except httpx.TimeoutException:
        logger.warning("BC OAuth timeout for bc_tenant_id=%s", bc_tenant_id)
        return None
    except Exception as exc:
        logger.warning("BC OAuth error for bc_tenant_id=%s: %s", bc_tenant_id, exc)
        return None


# ── GL fetch helper ──────────────────────────────────────────────────────────

def _fetch_gl_entries(
    token: str,
    environment: str,
    bc_tenant_id: str,
    api_version: str,
    watermark_from: datetime,
) -> List[Dict[str, Any]]:
    """
    Fetch general ledger entries from BC OData API.
    Filters posted entries with postingDate >= watermark_from.
    Returns list of raw entry dicts (empty list on error).
    Paginates with $top=1000 until no @odata.nextLink.
    """
    base_url = (
        f"https://api.businesscentral.dynamics.com/{environment}/"
        f"{bc_tenant_id}/api/{api_version}"
    )
    # First, get companies list for this BC tenant
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    try:
        comp_resp = httpx.get(
            f"{base_url}/companies",
            headers=headers,
            timeout=30.0,
        )
        if comp_resp.status_code != 200:
            logger.warning("BC companies fetch failed status=%s", comp_resp.status_code)
            return []
        companies = comp_resp.json().get("value", [])
    except Exception as exc:
        logger.warning("BC companies fetch error: %s", exc)
        return []

    all_entries: List[Dict[str, Any]] = []
    date_filter = watermark_from.strftime("%Y-%m-%d")

    for company in companies:
        company_id = company.get("id")
        if not company_id:
            continue

        url = (
            f"{base_url}/companies({company_id})/generalLedgerEntries"
            f"?$filter=postingDate ge {date_filter}"
            f"&$select=id,postingDate,accountNumber,documentNumber,"
            f"description,amount,debitAmount,creditAmount"
            f"&$top=1000"
        )

        while url:
            try:
                resp = httpx.get(url, headers=headers, timeout=30.0)
                if resp.status_code != 200:
                    logger.warning(
                        "BC GL fetch failed company_id=%s status=%s",
                        company_id, resp.status_code,
                    )
                    break
                payload = resp.json()
                entries = payload.get("value", [])
                for entry in entries:
                    entry["_company_id"] = company_id
                all_entries.extend(entries)
                url = payload.get("@odata.nextLink")  # None if no more pages
            except httpx.TimeoutException:
                logger.warning("BC GL fetch timeout company_id=%s", company_id)
                break
            except Exception as exc:
                logger.warning("BC GL fetch error company_id=%s: %s", company_id, exc)
                break

    return all_entries


# ── Core sync function ───────────────────────────────────────────────────────

def _sync_one_source(source: Dict[str, Any]) -> None:
    """
    Sync one BC ERP source end-to-end.
    Inserts running sync_log → fetches GL → upserts → updates sync_log.
    Catches all exceptions and records failure in sync_log.
    """
    import json

    erp_source_id: int = source["erp_source_id"]
    tenant_id: str = source["tenant_id"]

    logger.info("BC sync start erp_source_id=%s tenant=%s", erp_source_id, tenant_id)

    # 1. Insert running sync_log row
    try:
        log_rows = query(_INSERT_SYNC_LOG_SQL, (erp_source_id,))
        sync_log_id = log_rows[0]["sync_id"] if log_rows else None
    except Exception as exc:
        logger.error(
            "BC sync: failed to insert sync_log erp_source_id=%s: %s",
            erp_source_id, exc,
        )
        return

    def _fail(msg: str) -> None:
        """Update sync_log to failed state."""
        try:
            query(
                _UPDATE_SYNC_LOG_DONE_SQL,
                ("failed", 0, 0, None, None, msg, sync_log_id),
            )
        except Exception as db_exc:
            logger.error(
                "BC sync: could not record failure in sync_log erp_source_id=%s: %s",
                erp_source_id, db_exc,
            )

    # 2. Determine watermark
    try:
        wm_rows = query(_WATERMARK_SQL, (erp_source_id,))
        last_watermark = wm_rows[0]["last_watermark"] if wm_rows else None
    except Exception as exc:
        logger.warning(
            "BC sync: watermark query failed erp_source_id=%s: %s, defaulting to 90d",
            erp_source_id, exc,
        )
        last_watermark = None

    if last_watermark is None:
        watermark_from = datetime.now(tz=timezone.utc) - timedelta(days=90)
    else:
        # last_watermark may be a naive or aware datetime from psycopg2
        if hasattr(last_watermark, "tzinfo") and last_watermark.tzinfo is None:
            watermark_from = last_watermark.replace(tzinfo=timezone.utc)
        else:
            watermark_from = last_watermark

    # 3. Get OAuth token
    token = _get_bc_token(
        bc_tenant_id=source["bc_tenant_id"],
        client_id=source["client_id"],
        client_secret=source["client_secret"],
    )
    if not token:
        _fail("OAuth token request failed — check BC credentials")
        return

    # 4. Fetch GL entries from BC
    try:
        raw_entries = _fetch_gl_entries(
            token=token,
            environment=source.get("environment", "production"),
            bc_tenant_id=source["bc_tenant_id"],
            api_version=source.get("api_version", "v2.0"),
            watermark_from=watermark_from,
        )
    except Exception as exc:
        _fail(f"GL fetch error: {exc}")
        return

    rows_fetched = len(raw_entries)

    # 5. Upsert into fact_gl_normalized
    rows_upserted = 0
    max_posting_date: Optional[datetime] = None

    for entry in raw_entries:
        try:
            posting_date_str = entry.get("postingDate")
            if not posting_date_str:
                continue

            # Parse posting date
            try:
                posting_date = datetime.fromisoformat(posting_date_str).date()
            except ValueError:
                posting_date = datetime.strptime(posting_date_str, "%Y-%m-%d").date()

            # Track max posting date for watermark_to
            entry_dt = datetime.combine(posting_date, datetime.min.time()).replace(
                tzinfo=timezone.utc
            )
            if max_posting_date is None or entry_dt > max_posting_date:
                max_posting_date = entry_dt

            source_id: str = str(entry.get("id", ""))
            source_line: int = 0  # BC GL entries are flat (no sub-lines)
            account_code: str = entry.get("accountNumber") or ""
            company_id: str = entry.get("_company_id") or ""
            debit_amount = Decimal(str(entry.get("debitAmount") or 0))
            credit_amount = Decimal(str(entry.get("creditAmount") or 0))
            description: str = entry.get("description") or ""
            raw_payload: str = json.dumps(entry)

            query(
                _UPSERT_GL_SQL,
                (
                    tenant_id,
                    source_id,
                    source_line,
                    posting_date,
                    account_code,
                    company_id,
                    str(debit_amount),
                    str(credit_amount),
                    "AED",          # default currency — override when multi-currency
                    description,
                    raw_payload,
                ),
            )
            rows_upserted += 1

        except Exception as row_exc:
            logger.warning(
                "BC sync: upsert failed erp_source_id=%s entry_id=%s: %s",
                erp_source_id, entry.get("id"), row_exc,
            )
            # Continue processing remaining entries

    # 6. Finalize sync_log
    watermark_to = max_posting_date or datetime.now(tz=timezone.utc)
    try:
        query(
            _UPDATE_SYNC_LOG_DONE_SQL,
            (
                "completed",
                rows_fetched,
                rows_upserted,
                watermark_from,
                watermark_to,
                None,
                sync_log_id,
            ),
        )
    except Exception as exc:
        logger.error(
            "BC sync: failed to finalize sync_log erp_source_id=%s: %s",
            erp_source_id, exc,
        )
        return

    logger.info(
        "BC sync done erp_source_id=%s tenant=%s fetched=%d upserted=%d",
        erp_source_id, tenant_id, rows_fetched, rows_upserted,
    )


# ── Scheduler job ────────────────────────────────────────────────────────────

def run_bc_sync() -> None:
    """
    Scheduled job: fetch all active, authenticated BC sources and sync each.
    Called by APScheduler on every interval tick.
    """
    logger.info("BC sync job triggered")
    try:
        sources = query(_ACTIVE_BC_SOURCES_SQL, ())
    except Exception as exc:
        logger.error("BC sync: failed to query active sources: %s", exc)
        return

    if not sources:
        logger.info("BC sync: no active authenticated BC sources found")
        return

    logger.info("BC sync: processing %d source(s)", len(sources))
    for source in sources:
        try:
            _sync_one_source(source)
        except Exception as exc:
            logger.error(
                "BC sync: unhandled error erp_source_id=%s: %s",
                source.get("erp_source_id"), exc,
            )


# ── Public API ───────────────────────────────────────────────────────────────

def start_scheduler(interval_minutes: int = 15) -> BackgroundScheduler:
    """
    Create, configure, and start the APScheduler BackgroundScheduler.
    Adds run_bc_sync on an IntervalTrigger.
    Returns the running scheduler instance (caller must call stop_scheduler on shutdown).
    """
    scheduler = BackgroundScheduler(
        job_defaults={
            "coalesce": True,          # if job missed ticks, run once not many
            "max_instances": 1,        # prevent overlapping runs
            "misfire_grace_time": 60,  # seconds
        }
    )
    scheduler.add_job(
        run_bc_sync,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="bc_sync_job",
        name="BC Dynamics Scheduled Sync",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "BC sync scheduler started — interval=%d min", interval_minutes
    )
    return scheduler


def stop_scheduler(scheduler: BackgroundScheduler) -> None:
    """
    Gracefully shut down the APScheduler instance.
    Waits for any running jobs to complete before stopping.
    """
    try:
        if scheduler.running:
            scheduler.shutdown(wait=True)
            logger.info("BC sync scheduler stopped")
    except Exception as exc:
        logger.warning("BC sync scheduler shutdown error (non-fatal): %s", exc)
