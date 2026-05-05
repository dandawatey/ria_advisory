"""
services/freshness_service.py — Data Freshness Service
Agent: Rohan_Backend_003  |  Ticket: IC-17 / ERP-DS-004
Returns freshness status for ERP data sources based on last completed sync.
Thresholds: fresh < 24h, stale >= 24h, never_synced = no completed sync.
Rule 05: tenant_id on all queries.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, List, Optional

logger = logging.getLogger(__name__)

FRESH_THRESHOLD_HOURS = 24

_FRESHNESS_SQL = """
    SELECT
        s.erp_source_id,
        s.erp_name,
        MAX(l.completed_at) AS last_completed_at
    FROM dim_erp_source s
    LEFT JOIN fact_sync_log l
        ON l.erp_source_id = s.erp_source_id
        AND l.status IN ('completed', 'success')
    WHERE s.erp_source_id = ANY(%s)
      AND s.tenant_id = %s
    GROUP BY s.erp_source_id, s.erp_name
"""


@dataclass
class FreshnessStatus:
    erp_source_id: int
    erp_name: str
    status: str            # fresh | stale | never_synced
    last_sync_at: Optional[datetime]
    hours_stale: Optional[float]


class DataFreshnessService:
    """
    Reports data freshness for ERP sources.

    Usage:
        svc = DataFreshnessService(db_query=database.query)
        freshness = svc.get_freshness(erp_source_ids=[1, 2], tenant_id=tid)
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    def get_freshness(
        self,
        erp_source_ids: List[int],
        tenant_id: uuid.UUID,
    ) -> List[FreshnessStatus]:
        """Return freshness status for each requested ERP source."""
        tid = str(tenant_id)
        rows = self._query(_FRESHNESS_SQL, (erp_source_ids, tid))
        return [self._build_status(r) for r in rows]

    def _build_status(self, row: dict) -> FreshnessStatus:
        last_sync = row.get("last_completed_at")
        if last_sync is None:
            return FreshnessStatus(
                erp_source_id=row["erp_source_id"],
                erp_name=row["erp_name"],
                status="never_synced",
                last_sync_at=None,
                hours_stale=None,
            )
        now = datetime.utcnow()
        delta = now - last_sync
        hours_stale = delta.total_seconds() / 3600
        status = "fresh" if hours_stale < FRESH_THRESHOLD_HOURS else "stale"
        return FreshnessStatus(
            erp_source_id=row["erp_source_id"],
            erp_name=row["erp_name"],
            status=status,
            last_sync_at=last_sync,
            hours_stale=round(hours_stale, 2),
        )
