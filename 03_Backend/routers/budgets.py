"""
Budgets router — budget vs actual variance analysis.
"""
from typing import Optional, List
from fastapi import APIRouter, Query
from pydantic import BaseModel
from database import query

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_pct(num, denom):
    if not denom:
        return None
    return round(float(num) / float(denom) * 100, 1)


def _budget_where(company_ids=None, year=None, category=None):
    clauses, params = [], []
    if company_ids:
        ph = ", ".join(["%s"] * len(company_ids))
        clauses.append(f"b.company_id IN ({ph})")
        params.extend(company_ids)
    if year:
        clauses.append("b.fiscal_year = %s")
        params.append(year)
    if category:
        clauses.append("b.account_category = %s")
        params.append(category)
    wh = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return wh, params


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/summary")
def budget_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    category: Optional[str] = None,
):
    """Total budget vs actual by account category."""
    wh, params = _budget_where(company_ids=company_id, year=year, category=category)

    # Build GL WHERE matching budget filters
    gl_clauses = ["ac.account_category IN ('Income','Expense','Assets','Liabilities')"]
    gl_params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        gl_clauses.append(f"g.company_id IN ({ph})")
        gl_params.extend(company_id)
    if year:
        gl_clauses.append("d.year = %s")
        gl_params.append(year)
    if category:
        gl_clauses.append("ac.account_category = %s")
        gl_params.append(category)
    gl_wh = "WHERE " + " AND ".join(gl_clauses)

    rows = query(f"""
        WITH actuals AS (
            SELECT
                g.company_id,
                ac.account_category,
                ROUND(ABS(SUM(g.amount)), 2) AS actual_amount
            FROM fact_gl_entries g
            JOIN dim_account ac ON ac.account_no = g.account_no
            JOIN dim_date    d  ON d.date_id     = g.date_id
            {gl_wh}
            GROUP BY g.company_id, ac.account_category
        ),
        budget_totals AS (
            SELECT
                b.company_id,
                b.account_category,
                SUM(b.budget_amount) AS total_budget
            FROM budgets b
            {wh}
            GROUP BY b.company_id, b.account_category
        )
        SELECT
            co.company_name,
            COALESCE(bt.account_category, a.account_category) AS account_category,
            COALESCE(bt.total_budget, 0)  AS budget_amount,
            COALESCE(a.actual_amount, 0)  AS actual_amount,
            COALESCE(bt.total_budget, 0) - COALESCE(a.actual_amount, 0) AS variance,
            CASE WHEN COALESCE(bt.total_budget, 0) > 0
                 THEN ROUND(COALESCE(a.actual_amount, 0) / bt.total_budget * 100, 1)
                 ELSE NULL END AS utilization_pct
        FROM budget_totals bt
        FULL OUTER JOIN actuals a
            ON a.company_id = bt.company_id AND a.account_category = bt.account_category
        JOIN dim_company co
            ON co.company_id = COALESCE(bt.company_id, a.company_id)
        ORDER BY co.company_name, account_category
    """, params + gl_params)
    return rows


@router.get("/kpis")
def budget_kpis(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    """Single-row KPI summary: total budget, total actual, variance, utilization %."""
    gl_clauses = ["ac.account_category IN ('Income','Expense','Assets','Liabilities')"]
    gl_params: list = []
    b_clauses: list = []
    b_params: list = []

    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        gl_clauses.append(f"g.company_id IN ({ph})")
        gl_params.extend(company_id)
        b_clauses.append(f"b.company_id IN ({ph})")
        b_params.extend(company_id)
    if year:
        gl_clauses.append("d.year = %s")
        gl_params.append(year)
        b_clauses.append("b.fiscal_year = %s")
        b_params.append(year)

    gl_wh = "WHERE " + " AND ".join(gl_clauses)
    b_wh  = ("WHERE " + " AND ".join(b_clauses)) if b_clauses else ""

    rows = query(f"""
        WITH actuals AS (
            SELECT ROUND(ABS(SUM(g.amount)), 2) AS total_actual
            FROM fact_gl_entries g
            JOIN dim_account ac ON ac.account_no = g.account_no
            JOIN dim_date    d  ON d.date_id     = g.date_id
            {gl_wh}
        ),
        budgeted AS (
            SELECT ROUND(SUM(b.budget_amount), 2) AS total_budget
            FROM budgets b {b_wh}
        )
        SELECT
            COALESCE(budgeted.total_budget, 0) AS total_budget,
            COALESCE(actuals.total_actual,  0) AS total_actual,
            COALESCE(budgeted.total_budget, 0) - COALESCE(actuals.total_actual, 0) AS variance,
            CASE WHEN COALESCE(budgeted.total_budget, 0) > 0
                 THEN ROUND(COALESCE(actuals.total_actual, 0) / budgeted.total_budget * 100, 1)
                 ELSE NULL END AS utilization_pct
        FROM budgeted, actuals
    """, gl_params + b_params)
    return rows[0] if rows else {"total_budget": 0, "total_actual": 0, "variance": 0, "utilization_pct": None}


@router.get("/by-period")
def budget_by_period(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    category: Optional[str] = None,
):
    """Monthly budget vs actual trend (12 periods)."""
    gl_clauses = ["ac.account_category IN ('Income','Expense','Assets','Liabilities')"]
    gl_params: list = []
    b_clauses: list = []
    b_params: list = []

    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        gl_clauses.append(f"g.company_id IN ({ph})")
        gl_params.extend(company_id)
        b_clauses.append(f"b.company_id IN ({ph})")
        b_params.extend(company_id)
    if year:
        gl_clauses.append("d.year = %s")
        gl_params.append(year)
        b_clauses.append("b.fiscal_year = %s")
        b_params.append(year)
    if category:
        gl_clauses.append("ac.account_category = %s")
        gl_params.append(category)
        b_clauses.append("b.account_category = %s")
        b_params.append(category)

    gl_wh = "WHERE " + " AND ".join(gl_clauses)
    b_wh  = ("WHERE " + " AND ".join(b_clauses)) if b_clauses else ""

    rows = query(f"""
        WITH actuals AS (
            SELECT
                d.year, d.month, d.month_name,
                ROUND(ABS(SUM(g.amount)), 2) AS actual_amount
            FROM fact_gl_entries g
            JOIN dim_account ac ON ac.account_no = g.account_no
            JOIN dim_date    d  ON d.date_id     = g.date_id
            {gl_wh}
            GROUP BY d.year, d.month, d.month_name
        ),
        budgeted AS (
            SELECT
                b.fiscal_year AS year, b.fiscal_period AS month,
                SUM(b.budget_amount) AS budget_amount
            FROM budgets b {b_wh}
            GROUP BY b.fiscal_year, b.fiscal_period
        )
        SELECT
            COALESCE(b.year, a.year)   AS year,
            COALESCE(b.month, a.month) AS month,
            a.month_name,
            COALESCE(b.budget_amount, 0) AS budget_amount,
            COALESCE(a.actual_amount,  0) AS actual_amount,
            COALESCE(b.budget_amount, 0) - COALESCE(a.actual_amount, 0) AS variance
        FROM budgeted b
        FULL OUTER JOIN actuals a ON a.year = b.year AND a.month = b.month
        ORDER BY year, month
    """, b_params + gl_params)
    return rows


@router.get("/by-entity")
def budget_by_entity(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    category: Optional[str] = None,
):
    """Budget vs actual totals per entity."""
    gl_clauses = ["ac.account_category IN ('Income','Expense','Assets','Liabilities')"]
    gl_params: list = []
    b_clauses: list = []
    b_params: list = []

    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        gl_clauses.append(f"g.company_id IN ({ph})")
        gl_params.extend(company_id)
        b_clauses.append(f"b.company_id IN ({ph})")
        b_params.extend(company_id)
    if year:
        gl_clauses.append("d.year = %s")
        gl_params.append(year)
        b_clauses.append("b.fiscal_year = %s")
        b_params.append(year)
    if category:
        gl_clauses.append("ac.account_category = %s")
        gl_params.append(category)
        b_clauses.append("b.account_category = %s")
        b_params.append(category)

    gl_wh = "WHERE " + " AND ".join(gl_clauses)
    b_wh  = ("WHERE " + " AND ".join(b_clauses)) if b_clauses else ""

    rows = query(f"""
        WITH actuals AS (
            SELECT g.company_id, ROUND(ABS(SUM(g.amount)), 2) AS actual_amount
            FROM fact_gl_entries g
            JOIN dim_account ac ON ac.account_no = g.account_no
            JOIN dim_date    d  ON d.date_id     = g.date_id
            {gl_wh}
            GROUP BY g.company_id
        ),
        budgeted AS (
            SELECT b.company_id, ROUND(SUM(b.budget_amount), 2) AS budget_amount
            FROM budgets b {b_wh}
            GROUP BY b.company_id
        )
        SELECT
            co.company_name,
            COALESCE(bt.budget_amount, 0) AS budget_amount,
            COALESCE(a.actual_amount,  0) AS actual_amount,
            COALESCE(bt.budget_amount, 0) - COALESCE(a.actual_amount, 0) AS variance,
            CASE WHEN COALESCE(bt.budget_amount, 0) > 0
                 THEN ROUND(COALESCE(a.actual_amount, 0) / bt.budget_amount * 100, 1)
                 ELSE NULL END AS utilization_pct
        FROM budgeted bt
        FULL OUTER JOIN actuals a ON a.company_id = bt.company_id
        JOIN dim_company co ON co.company_id = COALESCE(bt.company_id, a.company_id)
        ORDER BY budget_amount DESC
    """, b_params + gl_params)
    return rows


@router.get("/by-category")
def budget_by_category(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    """Budget vs actual totals per account category."""
    gl_clauses = ["ac.account_category IN ('Income','Expense','Assets','Liabilities')"]
    gl_params: list = []
    b_clauses: list = []
    b_params: list = []

    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        gl_clauses.append(f"g.company_id IN ({ph})")
        gl_params.extend(company_id)
        b_clauses.append(f"b.company_id IN ({ph})")
        b_params.extend(company_id)
    if year:
        gl_clauses.append("d.year = %s")
        gl_params.append(year)
        b_clauses.append("b.fiscal_year = %s")
        b_params.append(year)

    gl_wh = "WHERE " + " AND ".join(gl_clauses)
    b_wh  = ("WHERE " + " AND ".join(b_clauses)) if b_clauses else ""

    rows = query(f"""
        WITH actuals AS (
            SELECT ac.account_category, ROUND(ABS(SUM(g.amount)), 2) AS actual_amount
            FROM fact_gl_entries g
            JOIN dim_account ac ON ac.account_no = g.account_no
            JOIN dim_date    d  ON d.date_id     = g.date_id
            {gl_wh}
            GROUP BY ac.account_category
        ),
        budgeted AS (
            SELECT b.account_category, ROUND(SUM(b.budget_amount), 2) AS budget_amount
            FROM budgets b {b_wh}
            GROUP BY b.account_category
        )
        SELECT
            COALESCE(bt.account_category, a.account_category) AS account_category,
            COALESCE(bt.budget_amount, 0) AS budget_amount,
            COALESCE(a.actual_amount,  0) AS actual_amount,
            COALESCE(bt.budget_amount, 0) - COALESCE(a.actual_amount, 0) AS variance,
            CASE WHEN COALESCE(bt.budget_amount, 0) > 0
                 THEN ROUND(COALESCE(a.actual_amount, 0) / bt.budget_amount * 100, 1)
                 ELSE NULL END AS utilization_pct
        FROM budgeted bt
        FULL OUTER JOIN actuals a ON a.account_category = bt.account_category
        ORDER BY budget_amount DESC
    """, b_params + gl_params)
    return rows


class BudgetLine(BaseModel):
    company_id:       int
    account_category: str
    fiscal_year:      int
    fiscal_period:    int
    budget_amount:    float
    notes:            str = ""


@router.post("/", status_code=201)
def upsert_budget(req: BudgetLine):
    """Create or update a budget line."""
    query("""
        INSERT INTO budgets (company_id, account_category, fiscal_year, fiscal_period, budget_amount, notes, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (company_id, account_category, fiscal_year, fiscal_period)
        DO UPDATE SET budget_amount = EXCLUDED.budget_amount,
                      notes        = EXCLUDED.notes,
                      updated_at   = NOW()
    """, (req.company_id, req.account_category, req.fiscal_year, req.fiscal_period, req.budget_amount, req.notes))
    return {"status": "ok"}
