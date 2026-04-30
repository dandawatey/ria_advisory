"""
routers/cross_erp.py — Cross-ERP P&L Comparison endpoints
Agent: Rohan_Backend_003  |  Ticket: IC-18 / ERP-DS-001
Rule 05: tenant_id from JWT on all queries.
"""
import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query

from auth_utils import require_auth
from database import query
from services.cross_erp_pl import CrossERPPLService, PLRow

router = APIRouter(prefix="/api/erp/cross-erp", tags=["cross-erp"])


@router.get("/pl")
def get_cross_erp_pl(
    from_date: date = Query(..., description="Start date YYYY-MM-DD"),
    to_date:   date = Query(..., description="End date YYYY-MM-DD"),
    erp_source_ids: Optional[str] = Query(None, description="Comma-separated ERP source IDs; omit for all"),
    current: dict = Depends(require_auth),
):
    """P&L breakdown by ERP source and month."""
    tenant_id = uuid.UUID(current["tenant_id"])

    if erp_source_ids:
        try:
            ids = [int(i.strip()) for i in erp_source_ids.split(",") if i.strip()]
        except ValueError:
            ids = []
    else:
        rows = query(
            "SELECT erp_source_id FROM dim_erp_source WHERE tenant_id=%s AND is_active=TRUE",
            (str(tenant_id),)
        )
        ids = [r["erp_source_id"] for r in rows]

    if not ids:
        return []

    svc = CrossERPPLService(db_query=query)
    pl_rows = svc.get_pl(erp_source_ids=ids, from_date=from_date, to_date=to_date, tenant_id=tenant_id)
    return [
        {
            "erp_source_id": r.erp_source_id,
            "erp_name": r.erp_name,
            "period": r.period,
            "revenue": r.revenue,
            "cogs": r.cogs,
            "gross_profit": r.gross_profit,
            "opex": r.opex,
            "ebitda": r.ebitda,
        }
        for r in pl_rows
    ]


@router.get("/pl/summary")
def get_cross_erp_pl_summary(
    from_date: date = Query(...),
    to_date:   date = Query(...),
    erp_source_ids: Optional[str] = Query(None),
    current: dict = Depends(require_auth),
):
    """Aggregated P&L totals across all ERP sources."""
    tenant_id = uuid.UUID(current["tenant_id"])

    if erp_source_ids:
        try:
            ids = [int(i.strip()) for i in erp_source_ids.split(",") if i.strip()]
        except ValueError:
            ids = []
    else:
        rows = query(
            "SELECT erp_source_id FROM dim_erp_source WHERE tenant_id=%s AND is_active=TRUE",
            (str(tenant_id),)
        )
        ids = [r["erp_source_id"] for r in rows]

    if not ids:
        return {"total_revenue": 0, "total_cogs": 0, "total_opex": 0, "total_gross_profit": 0, "total_ebitda": 0}

    svc = CrossERPPLService(db_query=query)
    return svc.get_pl_summary(erp_source_ids=ids, from_date=from_date, to_date=to_date, tenant_id=tenant_id)
