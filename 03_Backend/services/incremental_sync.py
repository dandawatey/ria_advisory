"""
services/incremental_sync.py — Incremental Sync Service
Agent: Rohan_Backend_003  |  Ticket: IC-8 / ERP-CF-005
Delta load with cursor tracking + upsert into fact_gl_entries.
Natural key deduplication: (erp_source_id, entity_id, journal_id, line_number).
Rule 06: DECIMAL amounts, parameterized queries only.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Callable, Optional, Tuple

logger = logging.getLogger(__name__)

_GET_CURSOR_SQL = """
    SELECT sync_cursor, completed_at
    FROM fact_sync_log
    WHERE erp_source_id = %s
      AND tenant_id     = %s
      AND status        = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1
"""

_UPSERT_GL_SQL = """
    INSERT INTO fact_gl_entries (
        erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number,
        account_no, amount, currency, posting_date, tenant_id
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT ON CONSTRAINT uq_gl_entry_natural_key
    DO UPDATE SET
        account_no   = EXCLUDED.account_no,
        amount       = EXCLUDED.amount,
        currency     = EXCLUDED.currency,
        posting_date = EXCLUDED.posting_date,
        updated_at   = NOW()
"""

_SAVE_CURSOR_SQL = """
    UPDATE fact_sync_log
    SET sync_cursor = %s, updated_at = NOW()
    WHERE sync_log_id = %s
      AND tenant_id   = %s
"""


@dataclass
class SyncState:
    erp_source_id: int
    last_cursor: Optional[str]
    last_sync_at: Optional[datetime]


class IncrementalSyncService:
    """
    Manages incremental GL data sync using cursor-based delta load.

    Usage:
        svc = IncrementalSyncService(db_query=database.query)
        state = svc.get_sync_state(erp_source_id=1, tenant_id=tid)
        from_date, to_date = svc.build_date_range(state.last_cursor, date(2020, 1, 1))
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    def get_sync_state(self, erp_source_id: int, tenant_id: uuid.UUID) -> SyncState:
        """Return latest sync cursor from fact_sync_log, or None cursor for fresh source."""
        rows = self._query(_GET_CURSOR_SQL, (erp_source_id, str(tenant_id)))
        if rows:
            return SyncState(
                erp_source_id=erp_source_id,
                last_cursor=rows[0]["sync_cursor"],
                last_sync_at=rows[0]["completed_at"],
            )
        return SyncState(erp_source_id=erp_source_id, last_cursor=None, last_sync_at=None)

    def build_date_range(
        self,
        last_cursor: Optional[str],
        default_from: date,
    ) -> Tuple[date, date]:
        """Return (from_date, to_date) for next sync window."""
        to_date = date.today()
        if last_cursor is None:
            return default_from, to_date
        # Parse cursor as ISO datetime or date
        try:
            from_date = datetime.fromisoformat(last_cursor).date()
        except ValueError:
            from_date = date.fromisoformat(last_cursor)
        return from_date, to_date

    def upsert_gl_entry(
        self,
        erp_source_id: int,
        entity_id: uuid.UUID,
        journal_id: str,
        line_number: str,
        account_no: str,
        amount: Decimal,
        currency: str,
        posting_date: date,
        tenant_id: uuid.UUID,
    ) -> None:
        """Upsert a single GL line using the natural key deduplication constraint."""
        self._query(
            _UPSERT_GL_SQL,
            (
                erp_source_id, str(entity_id), journal_id, line_number,
                account_no, str(amount), currency, posting_date, str(tenant_id)
            )
        )

    def save_cursor(
        self,
        erp_source_id: int,
        sync_log_id: uuid.UUID,
        cursor_value: str,
        tenant_id: uuid.UUID,
    ) -> None:
        """Persist cursor to fact_sync_log after successful sync."""
        self._query(_SAVE_CURSOR_SQL, (cursor_value, str(sync_log_id), str(tenant_id)))
