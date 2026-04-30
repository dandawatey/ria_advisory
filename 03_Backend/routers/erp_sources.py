"""
routers/erp_sources.py — ERP Sources management endpoints
Agent: Rohan_Backend_003  |  Ticket: IC-15 / ERP-CF-003
Lists ERP sources with health status for a tenant.
Rule 05: tenant_id from JWT on all queries.
"""
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth_utils import require_auth
from database import query

router = APIRouter(prefix="/api/erp/sources", tags=["erp"])


class ERPSourceOut(BaseModel):
    erp_source_id: int
    tenant_id: str
    erp_type: str
    display_name: str
    connection_status: str
    entity_id: Optional[str]
    last_sync_at: Optional[datetime]
    sync_schedule: Optional[str]
    is_active: bool


@router.get("", response_model=List[ERPSourceOut])
def list_erp_sources(current: dict = Depends(require_auth)):
    tenant_id = current.get("tenant_id")
    rows = query("""
        SELECT
            s.erp_source_id,
            s.tenant_id,
            s.erp_type,
            s.display_name,
            s.connection_status,
            s.entity_id,
            MAX(l.completed_at) AS last_sync_at,
            s.sync_schedule,
            s.is_active
        FROM dim_erp_source s
        LEFT JOIN fact_sync_log l
            ON l.erp_source_id = s.erp_source_id
           AND l.status IN ('success', 'completed')
        WHERE s.tenant_id = %s
          AND s.is_active = TRUE
        GROUP BY s.erp_source_id, s.tenant_id, s.erp_type, s.display_name,
                 s.connection_status, s.entity_id, s.sync_schedule, s.is_active
        ORDER BY s.display_name
    """, (tenant_id,))
    return [
        ERPSourceOut(
            erp_source_id=r["erp_source_id"],
            tenant_id=str(r["tenant_id"]),
            erp_type=r["erp_type"],
            display_name=r["display_name"],
            connection_status=r["connection_status"] or "unknown",
            entity_id=r.get("entity_id"),
            last_sync_at=r.get("last_sync_at"),
            sync_schedule=r.get("sync_schedule"),
            is_active=bool(r["is_active"]),
        )
        for r in rows
    ]


@router.get("/{erp_source_id}", response_model=ERPSourceOut)
def get_erp_source(erp_source_id: int, current: dict = Depends(require_auth)):
    tenant_id = current.get("tenant_id")
    rows = query("""
        SELECT
            s.erp_source_id, s.tenant_id, s.erp_type, s.display_name,
            s.connection_status, s.entity_id, s.sync_schedule, s.is_active,
            MAX(l.completed_at) AS last_sync_at
        FROM dim_erp_source s
        LEFT JOIN fact_sync_log l
            ON l.erp_source_id = s.erp_source_id
           AND l.status IN ('success', 'completed')
        WHERE s.erp_source_id = %s
          AND s.tenant_id = %s
        GROUP BY s.erp_source_id, s.tenant_id, s.erp_type, s.display_name,
                 s.connection_status, s.entity_id, s.sync_schedule, s.is_active
    """, (erp_source_id, tenant_id))
    if not rows:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="ERP source not found")
    r = rows[0]
    return ERPSourceOut(
        erp_source_id=r["erp_source_id"],
        tenant_id=str(r["tenant_id"]),
        erp_type=r["erp_type"],
        display_name=r["display_name"],
        connection_status=r["connection_status"] or "unknown",
        entity_id=r.get("entity_id"),
        last_sync_at=r.get("last_sync_at"),
        sync_schedule=r.get("sync_schedule"),
        is_active=bool(r["is_active"]),
    )


@router.get("/{erp_source_id}/sync-log")
def get_sync_log(erp_source_id: int, limit: int = 20, current: dict = Depends(require_auth)):
    tenant_id = current.get("tenant_id")
    # Verify ownership
    rows = query(
        "SELECT erp_source_id FROM dim_erp_source WHERE erp_source_id=%s AND tenant_id=%s",
        (erp_source_id, tenant_id)
    )
    if not rows:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="ERP source not found")
    logs = query("""
        SELECT sync_log_id, erp_source_id, status, sync_type,
               started_at, completed_at, records_fetched, records_inserted, records_updated,
               error_message
        FROM fact_sync_log
        WHERE erp_source_id = %s
        ORDER BY started_at DESC
        LIMIT %s
    """, (erp_source_id, limit))
    return [
        {
            "sync_log_id": r["sync_log_id"],
            "erp_source_id": r["erp_source_id"],
            "status": r["status"],
            "sync_type": r.get("sync_type"),
            "started_at": r.get("started_at").isoformat() if r.get("started_at") else None,
            "completed_at": r.get("completed_at").isoformat() if r.get("completed_at") else None,
            "records_fetched": r.get("records_fetched"),
            "records_inserted": r.get("records_inserted"),
            "records_updated": r.get("records_updated"),
            "error_message": r.get("error_message"),
        }
        for r in logs
    ]
