"""
services/audit_trail.py — Audit Trail Service
Agent: Rohan_Backend_003  |  Ticket: IC-9 / ERP-SP-003
Immutable append-only audit log (fact_audit_log — Rule 06: no DELETE/UPDATE).
Rule 05: tenant_id on all queries. No delete method exposed.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, List, Optional

logger = logging.getLogger(__name__)

_INSERT_SQL = """
    INSERT INTO fact_audit_log (
        event_type, actor, resource_type, resource_id,
        tenant_id, occurred_at, details
    ) VALUES (%s, %s, %s, %s, %s, NOW(), %s)
    RETURNING audit_log_id
"""

_SELECT_SQL = """
    SELECT audit_log_id, event_type, actor, resource_type,
           resource_id, tenant_id, occurred_at, details
    FROM fact_audit_log
    WHERE resource_type = %s
      AND resource_id   = %s
      AND tenant_id     = %s
    ORDER BY occurred_at DESC
"""


@dataclass
class AuditEvent:
    event_type: str      # sync_started | sync_completed | sync_failed | mapping_updated | credential_rotated
    actor: str           # system | user_id | agent_id
    resource_type: str   # erp_source | dim_erp_mapping | dim_erp_credential
    resource_id: str
    tenant_id: uuid.UUID
    details: Optional[dict] = None
    occurred_at: Optional[datetime] = None
    audit_log_id: Optional[str] = None


class AuditTrailService:
    """
    Append-only audit log for all system events.
    NO delete or update methods — immutable by design (Rule 06).

    Usage:
        svc = AuditTrailService(db_query=database.query)
        svc.log_event(AuditEvent(event_type="sync_started", ...))
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    def log_event(self, event: AuditEvent) -> str:
        """Append event to fact_audit_log. Returns audit_log_id."""
        import json
        details_json = json.dumps(event.details) if event.details else None
        rows = self._query(
            _INSERT_SQL,
            (
                event.event_type,
                event.actor,
                event.resource_type,
                event.resource_id,
                str(event.tenant_id),
                details_json,
            )
        )
        audit_id = rows[0]["audit_log_id"] if rows else str(uuid.uuid4())
        logger.info("AuditTrail: %s on %s/%s by %s", event.event_type, event.resource_type, event.resource_id, event.actor)
        return str(audit_id)

    def get_audit_log(
        self,
        resource_type: str,
        resource_id: str,
        tenant_id: uuid.UUID,
    ) -> List[AuditEvent]:
        """Return all audit events for a resource, newest first."""
        rows = self._query(_SELECT_SQL, (resource_type, resource_id, str(tenant_id)))
        return [
            AuditEvent(
                event_type=r["event_type"],
                actor=r["actor"],
                resource_type=r["resource_type"],
                resource_id=r["resource_id"],
                tenant_id=uuid.UUID(str(r["tenant_id"])),
                occurred_at=r["occurred_at"],
                audit_log_id=str(r["audit_log_id"]),
            )
            for r in rows
        ]
    # No delete / update methods — fact_audit_log is immutable (Rule 06)
