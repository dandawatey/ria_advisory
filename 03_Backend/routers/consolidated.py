"""
routers/consolidated.py — Consolidated Dashboard endpoints
Agent: Rohan_Backend_003  |  Ticket: IC-19 / ERP-DS-002
Rule 05: tenant_id from JWT on all queries.
"""
import uuid
from datetime import date
from fastapi import APIRouter, Depends, Query

from auth_utils import require_auth
from database import query
from services.consolidated_dashboard import ConsolidatedDashboardService

router = APIRouter(prefix="/api/erp/consolidated", tags=["consolidated"])


@router.get("/summary")
def get_consolidated_summary(
    from_date: date = Query(...),
    to_date:   date = Query(...),
    current: dict = Depends(require_auth),
):
    """Aggregated P&L KPIs across all ERP sources for the tenant."""
    tenant_id = uuid.UUID(current["tenant_id"])
    svc = ConsolidatedDashboardService(db_query=query)
    s = svc.get_summary(from_date=from_date, to_date=to_date, tenant_id=tenant_id)
    return {
        "total_revenue":    s.total_revenue,
        "total_cogs":       s.total_cogs,
        "total_opex":       s.total_opex,
        "gross_profit":     s.gross_profit,
        "ebitda":           s.ebitda,
        "erp_sources_count": s.erp_sources_count,
        "period":           s.period,
    }


@router.get("/trend")
def get_monthly_trend(
    from_date: date = Query(...),
    to_date:   date = Query(...),
    current: dict = Depends(require_auth),
):
    """Monthly revenue/EBITDA trend across all ERP sources."""
    tenant_id = uuid.UUID(current["tenant_id"])
    svc = ConsolidatedDashboardService(db_query=query)
    return svc.get_monthly_trend(from_date=from_date, to_date=to_date, tenant_id=tenant_id)


@router.get("/by-source")
def get_by_erp_source(
    from_date: date = Query(...),
    to_date:   date = Query(...),
    current: dict = Depends(require_auth),
):
    """Revenue + EBITDA per ERP source, ordered by revenue."""
    tenant_id = uuid.UUID(current["tenant_id"])
    svc = ConsolidatedDashboardService(db_query=query)
    return svc.get_by_erp_source(from_date=from_date, to_date=to_date, tenant_id=tenant_id)
