"""
services/sync_alerts.py — Sync Alert Service + Retry Policy
Agent: Rohan_Backend_003  |  Ticket: IC-10 / ERP-SP-004
Exponential backoff retry; ConnectorAuthError never retries.
Alerts written to fact_connector_alerts.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from typing import Callable, List, Optional

from connectors.base import (
    ConnectorAuthError, ConnectorTimeoutError,
    ConnectorRateLimitError, DataValidationError
)

logger = logging.getLogger(__name__)

_INSERT_ALERT_SQL = """
    INSERT INTO fact_connector_alerts (
        erp_source_id, alert_type, message, tenant_id, raised_at, resolved_at
    ) VALUES (%s, %s, %s, %s, NOW(), NULL)
    RETURNING alert_id
"""

_PENDING_ALERTS_SQL = """
    SELECT alert_id, alert_type, message
    FROM fact_connector_alerts
    WHERE erp_source_id = %s
      AND tenant_id     = %s
      AND resolved_at IS NULL
    ORDER BY raised_at DESC
"""

# Error types that should never trigger a retry
_NO_RETRY_ERRORS = (ConnectorAuthError, DataValidationError)


@dataclass(frozen=True)
class RetryPolicy:
    max_retries: int
    backoff_base_seconds: int


@dataclass
class AlertRecord:
    alert_id: str
    alert_type: str
    message: str


class SyncAlertService:
    """
    Retry decision engine and alert logger for sync failures.

    Usage:
        svc = SyncAlertService(db_query=database.query)
        if svc.should_retry(error, attempt=1, policy=RetryPolicy(3, 30)):
            time.sleep(svc.get_backoff_seconds(attempt=1, policy=...))
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    def should_retry(self, error: Exception, attempt: int, policy: RetryPolicy) -> bool:
        """Return True if this error+attempt warrants a retry."""
        if isinstance(error, _NO_RETRY_ERRORS):
            return False
        return attempt <= policy.max_retries

    def get_backoff_seconds(
        self,
        attempt: int,
        policy: RetryPolicy,
        error: Optional[Exception] = None,
    ) -> int:
        """Return seconds to wait before retry attempt.
        RateLimitError: use retry_after_seconds from exception.
        Others: exponential backoff = base * 2^(attempt-1).
        """
        if isinstance(error, ConnectorRateLimitError):
            return error.retry_after_seconds
        return policy.backoff_base_seconds * (2 ** (attempt - 1))

    def log_alert(
        self,
        erp_source_id: int,
        alert_type: str,
        message: str,
        tenant_id: uuid.UUID,
    ) -> str:
        """Write alert to fact_connector_alerts. Returns alert_id."""
        rows = self._query(
            _INSERT_ALERT_SQL,
            (erp_source_id, alert_type, message, str(tenant_id))
        )
        alert_id = rows[0]["alert_id"] if rows else str(uuid.uuid4())
        logger.warning("SyncAlert[%s] erp_source=%s: %s", alert_type, erp_source_id, message)
        return str(alert_id)

    def get_pending_alerts(
        self,
        erp_source_id: int,
        tenant_id: uuid.UUID,
    ) -> List[AlertRecord]:
        """Return unresolved alerts for an ERP source."""
        rows = self._query(_PENDING_ALERTS_SQL, (erp_source_id, str(tenant_id)))
        return [
            AlertRecord(
                alert_id=str(r["alert_id"]),
                alert_type=r["alert_type"],
                message=r["message"],
            )
            for r in rows
        ]
