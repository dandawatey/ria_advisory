"""
services/health_monitor.py — Connection Health Monitor
Agent: Rohan_Backend_003  |  Ticket: IC-15 / ERP-CF-003
Records connector health snapshots to fact_connector_health_log.
Degraded threshold: latency > 5000ms or status != connected.
Rule 05: tenant_id on all queries.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Optional

logger = logging.getLogger(__name__)

DEGRADED_LATENCY_MS = 5000

_INSERT_HEALTH_SQL = """
    INSERT INTO fact_connector_health_log (
        erp_source_id, status, latency_ms, checked_at, error_message, tenant_id
    ) VALUES (%s, %s, %s, %s, %s, %s)
"""

_LATEST_HEALTH_SQL = """
    SELECT erp_source_id, status, latency_ms, checked_at, error_message
    FROM fact_connector_health_log
    WHERE erp_source_id = %s
      AND tenant_id     = %s
    ORDER BY checked_at DESC
    LIMIT 1
"""


@dataclass
class HealthSnapshot:
    erp_source_id: int
    status: str           # connected | degraded | disconnected | auth_expired
    latency_ms: Optional[int]
    checked_at: datetime
    error_message: Optional[str] = None


class ConnectionHealthMonitor:
    """
    Records and retrieves ERP connector health status.

    Usage:
        mon = ConnectionHealthMonitor(db_query=database.query)
        snap = HealthSnapshot(erp_source_id=1, status="connected", latency_ms=50, checked_at=datetime.utcnow())
        mon.record_health(snap, tenant_id=tid)
        latest = mon.get_latest_health(erp_source_id=1, tenant_id=tid)
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    def record_health(self, snapshot: HealthSnapshot, tenant_id: uuid.UUID) -> None:
        """Append health record to fact_connector_health_log."""
        self._query(
            _INSERT_HEALTH_SQL,
            (
                snapshot.erp_source_id,
                snapshot.status,
                snapshot.latency_ms,
                snapshot.checked_at,
                snapshot.error_message,
                str(tenant_id),
            )
        )

    def get_latest_health(
        self,
        erp_source_id: int,
        tenant_id: uuid.UUID,
    ) -> Optional[HealthSnapshot]:
        """Return most recent health snapshot, or None."""
        rows = self._query(_LATEST_HEALTH_SQL, (erp_source_id, str(tenant_id)))
        if not rows:
            return None
        r = rows[0]
        return HealthSnapshot(
            erp_source_id=r["erp_source_id"],
            status=r["status"],
            latency_ms=r["latency_ms"],
            checked_at=r["checked_at"],
            error_message=r.get("error_message"),
        )

    def is_degraded(self, snapshot: HealthSnapshot) -> bool:
        """Return True if health is degraded (high latency or non-connected status)."""
        if snapshot.status != "connected":
            return True
        if snapshot.latency_ms and snapshot.latency_ms > DEGRADED_LATENCY_MS:
            return True
        return False
