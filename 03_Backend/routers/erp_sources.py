"""
routers/erp_sources.py — ERP Sources management endpoints
Agent: Rohan_Backend_003  |  Ticket: IC-15 / ERP-CF-003, IC-44
Lists ERP sources with health status for a tenant.
Rule 05: tenant_id from JWT on all queries.
IC-44 fix: removed non-existent is_active/sync_schedule columns;
           fixed sync_log_id → sync_id; added manual sync trigger.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
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
    is_active: bool

    class Config:
        from_attributes = True


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
            MAX(l.completed_at) AS last_sync_at
        FROM dim_erp_source s
        LEFT JOIN fact_sync_log l
            ON l.erp_source_id = s.erp_source_id
           AND l.status IN ('success', 'completed')
        WHERE s.tenant_id = %s
          AND s.connection_status != 'disabled'
        GROUP BY s.erp_source_id, s.tenant_id, s.erp_type, s.display_name,
                 s.connection_status, s.entity_id
        ORDER BY s.display_name
    """, (tenant_id,))
    return [
        ERPSourceOut(
            erp_source_id=r["erp_source_id"],
            tenant_id=str(r["tenant_id"]),
            erp_type=r["erp_type"],
            display_name=r["display_name"],
            connection_status=r["connection_status"] or "unknown",
            entity_id=str(r["entity_id"]) if r.get("entity_id") else None,
            last_sync_at=r.get("last_sync_at"),
            is_active=r["connection_status"] != "disabled",
        )
        for r in rows
    ]


@router.get("/{erp_source_id}", response_model=ERPSourceOut)
def get_erp_source(erp_source_id: int, current: dict = Depends(require_auth)):
    tenant_id = current.get("tenant_id")
    rows = query("""
        SELECT
            s.erp_source_id, s.tenant_id, s.erp_type, s.display_name,
            s.connection_status, s.entity_id,
            MAX(l.completed_at) AS last_sync_at
        FROM dim_erp_source s
        LEFT JOIN fact_sync_log l
            ON l.erp_source_id = s.erp_source_id
           AND l.status IN ('success', 'completed')
        WHERE s.erp_source_id = %s
          AND s.tenant_id = %s
        GROUP BY s.erp_source_id, s.tenant_id, s.erp_type, s.display_name,
                 s.connection_status, s.entity_id
    """, (erp_source_id, tenant_id))
    if not rows:
        raise HTTPException(status_code=404, detail="ERP source not found")
    r = rows[0]
    return ERPSourceOut(
        erp_source_id=r["erp_source_id"],
        tenant_id=str(r["tenant_id"]),
        erp_type=r["erp_type"],
        display_name=r["display_name"],
        connection_status=r["connection_status"] or "unknown",
        entity_id=str(r["entity_id"]) if r.get("entity_id") else None,
        last_sync_at=r.get("last_sync_at"),
        is_active=r["connection_status"] != "disabled",
    )


@router.get("/{erp_source_id}/sync-log")
def get_sync_log(erp_source_id: int, limit: int = 20, current: dict = Depends(require_auth)):
    tenant_id = current.get("tenant_id")
    rows = query(
        "SELECT erp_source_id FROM dim_erp_source WHERE erp_source_id=%s AND tenant_id=%s",
        (erp_source_id, tenant_id)
    )
    if not rows:
        raise HTTPException(status_code=404, detail="ERP source not found")
    logs = query("""
        SELECT sync_id, erp_source_id, status, sync_type,
               started_at, completed_at, records_fetched, records_inserted, records_updated,
               rows_fetched, rows_upserted, error_message, error_msg
        FROM fact_sync_log
        WHERE erp_source_id = %s
        ORDER BY started_at DESC
        LIMIT %s
    """, (erp_source_id, limit))
    return [
        {
            "sync_id":          str(r["sync_id"]),
            "erp_source_id":    r["erp_source_id"],
            "status":           r["status"],
            "sync_type":        r.get("sync_type"),
            "started_at":       r["started_at"].isoformat() if r.get("started_at") else None,
            "completed_at":     r["completed_at"].isoformat() if r.get("completed_at") else None,
            "records_fetched":  r.get("records_fetched") or r.get("rows_fetched"),
            "records_inserted": r.get("records_inserted") or r.get("rows_upserted"),
            "records_updated":  r.get("records_updated"),
            "error_message":    r.get("error_message") or r.get("error_msg"),
        }
        for r in logs
    ]


@router.post("/{erp_source_id}/sync")
def trigger_sync(
    erp_source_id: int,
    background_tasks: BackgroundTasks,
    current: dict = Depends(require_auth),
):
    """
    Manually trigger an immediate BC sync for a specific ERP source.
    Runs in background — returns sync_id immediately.
    IC-44: manual trigger for testing data pull.
    """
    tenant_id = current.get("tenant_id")

    # Verify ownership + BC type
    rows = query("""
        SELECT s.erp_source_id, s.erp_type, s.tenant_id::text AS tenant_id,
               t.bc_tenant_id, t.client_id, t.client_secret,
               t.environment, t.api_version
        FROM dim_erp_source s
        JOIN tenant_bc_config t ON t.tenant_id = s.tenant_id
        WHERE s.erp_source_id = %s
          AND s.tenant_id = %s
          AND s.erp_type = 'BC'
          AND t.auth_status = 'authenticated'
    """, (erp_source_id, tenant_id))

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="BC source not found or not authenticated. Check tenant_bc_config."
        )

    source = dict(rows[0])

    # Insert a 'running' sync_log to return an ID immediately
    log_rows = query(
        """
        INSERT INTO fact_sync_log (erp_source_id, status, sync_type, triggered_by, rows_fetched, rows_upserted)
        VALUES (%s, 'running', 'manual', 'api_trigger', 0, 0)
        RETURNING sync_id
        """,
        (erp_source_id,),
    )
    sync_id = str(log_rows[0]["sync_id"]) if log_rows else None

    # Run sync in background
    from workers.bc_sync_worker import _sync_one_source
    background_tasks.add_task(_sync_one_source, source)

    return {
        "ok": True,
        "sync_id": sync_id,
        "message": f"Sync triggered for erp_source_id={erp_source_id}. Check sync-log for status.",
    }
