"""
routers/freshness.py — Data Freshness API endpoints
Agent: Rohan_Backend_003  |  Ticket: IC-17 / ERP-DS-004
Returns freshness status for ERP data sources.
Rule 05: tenant_id from JWT on all queries.
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime

from auth_utils import require_auth
from database import query
from services.freshness_service import DataFreshnessService

router = APIRouter(prefix="/api/erp/freshness", tags=["freshness"])


class FreshnessOut(BaseModel):
    erp_source_id: int
    erp_name: str
    status: str
    last_sync_at: Optional[datetime]
    hours_stale: Optional[float]


@router.get("", response_model=List[FreshnessOut])
def get_all_freshness(current: dict = Depends(require_auth)):
    """Return freshness for all active ERP sources belonging to the tenant."""
    tenant_id = uuid.UUID(current["tenant_id"])
    # Get all active erp_source_ids for this tenant
    rows = query(
        "SELECT erp_source_id FROM dim_erp_source WHERE tenant_id=%s AND is_active=TRUE",
        (str(tenant_id),)
    )
    erp_ids = [r["erp_source_id"] for r in rows]
    if not erp_ids:
        return []
    svc = DataFreshnessService(db_query=query)
    statuses = svc.get_freshness(erp_source_ids=erp_ids, tenant_id=tenant_id)
    return [
        FreshnessOut(
            erp_source_id=s.erp_source_id,
            erp_name=s.erp_name,
            status=s.status,
            last_sync_at=s.last_sync_at,
            hours_stale=s.hours_stale,
        )
        for s in statuses
    ]


@router.get("/by-ids", response_model=List[FreshnessOut])
def get_freshness_by_ids(
    erp_source_ids: str,
    current: dict = Depends(require_auth),
):
    """Return freshness for a comma-separated list of ERP source IDs."""
    tenant_id = uuid.UUID(current["tenant_id"])
    try:
        ids = [int(i.strip()) for i in erp_source_ids.split(",") if i.strip()]
    except ValueError:
        ids = []
    if not ids:
        return []
    svc = DataFreshnessService(db_query=query)
    statuses = svc.get_freshness(erp_source_ids=ids, tenant_id=tenant_id)
    return [
        FreshnessOut(
            erp_source_id=s.erp_source_id,
            erp_name=s.erp_name,
            status=s.status,
            last_sync_at=s.last_sync_at,
            hours_stale=s.hours_stale,
        )
        for s in statuses
    ]
