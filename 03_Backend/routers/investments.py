"""
Investments router — investment portfolio tracking and performance.
"""
from typing import Optional, List
from fastapi import APIRouter, Query
from pydantic import BaseModel
from datetime import date
from database import query

router = APIRouter(prefix="/api/investments", tags=["investments"])


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/portfolio")
def portfolio_summary(
    company_id: Optional[List[int]] = Query(default=None),
    status: Optional[str] = None,
):
    """Single-row portfolio KPIs: total invested, current value, return, ROI %."""
    clauses = ["1=1"]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"company_id IN ({ph})")
        params.extend(company_id)
    if status:
        clauses.append("status = %s")
        params.append(status)
    wh = "WHERE " + " AND ".join(clauses)

    rows = query(f"""
        SELECT
            COUNT(*)                                       AS holding_count,
            ROUND(SUM(invested_amount), 2)                 AS total_invested,
            ROUND(SUM(COALESCE(current_value, invested_amount)), 2) AS current_value,
            ROUND(SUM(COALESCE(return_amount, 0)), 2)      AS total_return,
            CASE WHEN SUM(invested_amount) > 0
                 THEN ROUND(SUM(COALESCE(return_amount, 0)) / SUM(invested_amount) * 100, 2)
                 ELSE NULL END                             AS roi_pct
        FROM investments
        {wh}
    """, params)
    return rows[0] if rows else {
        "holding_count": 0, "total_invested": 0,
        "current_value": 0, "total_return": 0, "roi_pct": None
    }


@router.get("/by-type")
def investments_by_type(
    company_id: Optional[List[int]] = Query(default=None),
    status: Optional[str] = None,
):
    """Breakdown by investment type with totals and ROI."""
    clauses = ["1=1"]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"company_id IN ({ph})")
        params.extend(company_id)
    if status:
        clauses.append("status = %s")
        params.append(status)
    wh = "WHERE " + " AND ".join(clauses)

    rows = query(f"""
        SELECT
            investment_type,
            COUNT(*)                                       AS holding_count,
            ROUND(SUM(invested_amount), 2)                 AS total_invested,
            ROUND(SUM(COALESCE(current_value, invested_amount)), 2) AS current_value,
            ROUND(SUM(COALESCE(return_amount, 0)), 2)      AS total_return,
            CASE WHEN SUM(invested_amount) > 0
                 THEN ROUND(SUM(COALESCE(return_amount, 0)) / SUM(invested_amount) * 100, 2)
                 ELSE NULL END                             AS roi_pct,
            ROUND(SUM(invested_amount) * 100.0 /
                  NULLIF(SUM(SUM(invested_amount)) OVER (), 0), 1) AS weight_pct
        FROM investments
        {wh}
        GROUP BY investment_type
        ORDER BY total_invested DESC
    """, params)
    return rows


@router.get("/by-entity")
def investments_by_entity(
    company_id: Optional[List[int]] = Query(default=None),
    status: Optional[str] = None,
):
    """Investment totals per entity."""
    clauses = ["1=1"]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"i.company_id IN ({ph})")
        params.extend(company_id)
    if status:
        clauses.append("i.status = %s")
        params.append(status)
    wh = "WHERE " + " AND ".join(clauses)

    rows = query(f"""
        SELECT
            co.company_name,
            COUNT(i.id)                                    AS holding_count,
            ROUND(SUM(i.invested_amount), 2)               AS total_invested,
            ROUND(SUM(COALESCE(i.current_value, i.invested_amount)), 2) AS current_value,
            ROUND(SUM(COALESCE(i.return_amount, 0)), 2)    AS total_return,
            CASE WHEN SUM(i.invested_amount) > 0
                 THEN ROUND(SUM(COALESCE(i.return_amount, 0)) / SUM(i.invested_amount) * 100, 2)
                 ELSE NULL END                             AS roi_pct
        FROM investments i
        JOIN dim_company co ON co.company_id = i.company_id
        {wh}
        GROUP BY co.company_name
        ORDER BY total_invested DESC
    """, params)
    return rows


@router.get("/list")
def investments_list(
    company_id: Optional[List[int]] = Query(default=None),
    investment_type: Optional[str] = None,
    status: Optional[str] = None,
):
    """Full list of investment holdings."""
    clauses = ["1=1"]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"i.company_id IN ({ph})")
        params.extend(company_id)
    if investment_type:
        clauses.append("i.investment_type = %s")
        params.append(investment_type)
    if status:
        clauses.append("i.status = %s")
        params.append(status)
    wh = "WHERE " + " AND ".join(clauses)

    rows = query(f"""
        SELECT
            i.id,
            co.company_name,
            i.investment_name,
            i.investment_type,
            i.asset_class,
            i.currency_code,
            i.invested_amount,
            COALESCE(i.current_value, i.invested_amount) AS current_value,
            COALESCE(i.return_amount, 0)                  AS return_amount,
            CASE WHEN i.invested_amount > 0
                 THEN ROUND(COALESCE(i.return_amount, 0) / i.invested_amount * 100, 2)
                 ELSE NULL END                             AS roi_pct,
            i.investment_date,
            i.maturity_date,
            i.status,
            i.notes
        FROM investments i
        JOIN dim_company co ON co.company_id = i.company_id
        {wh}
        ORDER BY i.invested_amount DESC
    """, params)
    return rows


class InvestmentCreate(BaseModel):
    company_id:      int
    investment_name: str
    investment_type: str
    asset_class:     Optional[str] = None
    currency_code:   str = "USD"
    invested_amount: float
    current_value:   Optional[float] = None
    return_amount:   Optional[float] = None
    investment_date: date
    maturity_date:   Optional[date] = None
    status:          str = "active"
    notes:           Optional[str] = None


@router.post("/", status_code=201)
def add_investment(req: InvestmentCreate):
    """Add a new investment record."""
    ret = req.return_amount
    if ret is None and req.current_value is not None:
        ret = round(req.current_value - req.invested_amount, 2)
    query("""
        INSERT INTO investments
          (company_id, investment_name, investment_type, asset_class, currency_code,
           invested_amount, current_value, return_amount, investment_date, maturity_date, status, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (req.company_id, req.investment_name, req.investment_type, req.asset_class,
          req.currency_code, req.invested_amount, req.current_value, ret,
          req.investment_date, req.maturity_date, req.status, req.notes))
    return {"status": "ok"}
