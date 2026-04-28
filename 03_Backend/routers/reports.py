"""
Standard Finance Reports — Trial Balance, Balance Sheet, Expense Analysis, Department Spend
GET /api/reports/*
"""
from fastapi import APIRouter, Query
from typing import Optional, List
from database import query

router = APIRouter(prefix="/api/reports", tags=["reports"])

# ── Shared expense FROM + JOIN ─────────────────────────────────────────────────
_EXP_BASE = """
    FROM fact_gl_entries g
    JOIN dim_date    d  ON d.date_id     = g.date_id
    JOIN dim_account ac ON ac.account_no = g.account_no
    JOIN dim_company co ON co.company_id = g.company_id
"""


# ── Trial Balance ─────────────────────────────────────────────────────────────
@router.get("/trial-balance")
def trial_balance(
    company_id: Optional[List[int]] = Query(default=None),
    account_category: Optional[str] = None,
):
    clauses: list = []
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"co.company_id IN ({ph})")
        params.extend(company_id)
    if account_category:
        clauses.append("tb.account_category = %s")
        params.append(account_category)
    wh = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return query(f"""
        SELECT tb.company_name, tb.account_no, tb.account_name,
               tb.account_category, tb.income_balance,
               tb.total_debit, tb.total_credit, tb.net_balance
        FROM v_trial_balance tb
        JOIN dim_company co ON co.company_name = tb.company_name
        {wh}
        ORDER BY tb.company_name, tb.account_no
    """, params)


@router.get("/trial-balance/summary")
def trial_balance_summary(
    company_id: Optional[List[int]] = Query(default=None),
):
    clauses: list = []
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"co.company_id IN ({ph})")
        params.extend(company_id)
    wh = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = query(f"""
        SELECT
            SUM(tb.total_debit)  AS total_debit,
            SUM(tb.total_credit) AS total_credit,
            SUM(tb.net_balance)  AS net_balance,
            COUNT(DISTINCT tb.account_no) AS account_count,
            COUNT(DISTINCT tb.company_name) AS entity_count
        FROM v_trial_balance tb
        JOIN dim_company co ON co.company_name = tb.company_name
        {wh}
    """, params)
    return rows[0] if rows else {}


# ── Balance Sheet ─────────────────────────────────────────────────────────────
@router.get("/balance-sheet")
def balance_sheet(
    company_id: Optional[List[int]] = Query(default=None),
):
    clauses: list = [
        "(cb.account_no LIKE '1%' OR cb.account_no LIKE '2%' OR cb.account_no LIKE '3%')"
    ]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"co.company_id IN ({ph})")
        params.extend(company_id)
    wh = "WHERE " + " AND ".join(clauses)
    return query(f"""
        SELECT cb.company_name, cb.account_no, cb.account_name,
               cb.account_category, cb.account_subcategory,
               cb.income_balance, cb.net_change, cb.balance
        FROM v_coa_balances cb
        JOIN dim_company co ON co.company_name = cb.company_name
        {wh}
        ORDER BY cb.company_name, cb.account_no
    """, params)


@router.get("/balance-sheet/summary")
def balance_sheet_summary(
    company_id: Optional[List[int]] = Query(default=None),
):
    clauses: list = []
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"co.company_id IN ({ph})")
        params.extend(company_id)
    wh = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = query(f"""
        SELECT
            SUM(CASE WHEN cb.account_no LIKE '1%%' THEN cb.balance ELSE 0 END) AS total_assets,
            SUM(CASE WHEN cb.account_no LIKE '2%%' THEN cb.balance ELSE 0 END) AS total_liabilities,
            SUM(CASE WHEN cb.account_no LIKE '3%%' THEN cb.balance ELSE 0 END) AS total_equity,
            COUNT(DISTINCT cb.company_name) AS entity_count
        FROM v_coa_balances cb
        JOIN dim_company co ON co.company_name = cb.company_name
        WHERE (cb.account_no LIKE '1%%' OR cb.account_no LIKE '2%%' OR cb.account_no LIKE '3%%')
        {"AND " + " AND ".join(clauses) if clauses else ""}
    """, params)
    r = rows[0] if rows else {}
    assets = float(r.get("total_assets") or 0)
    liab   = float(r.get("total_liabilities") or 0)
    equity = float(r.get("total_equity") or 0)
    r["net_equity"]    = assets + equity - liab
    r["debt_equity"]   = round(liab / equity, 2) if equity else None
    return r


# ── Expense Analysis ──────────────────────────────────────────────────────────
@router.get("/expense/summary")
def expense_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month: Optional[int] = None,
):
    clauses: list = ["(ac.account_no LIKE '5%%' OR ac.account_no LIKE '6%%')"]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"g.company_id IN ({ph})")
        params.extend(company_id)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if month:
        clauses.append("d.month = %s")
        params.append(month)
    wh = "WHERE " + " AND ".join(clauses)
    rows = query(f"""
        SELECT
            SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END) AS total_cogs,
            SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS total_opex,
            SUM(g.amount)                                                      AS total_expenses,
            COUNT(*)                                                           AS entry_count,
            COUNT(DISTINCT g.company_id)                                      AS entity_count
        {_EXP_BASE} {wh}
    """, params)
    return rows[0] if rows else {}


@router.get("/expense")
def expense_accounts(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month: Optional[int] = None,
    account_prefix: Optional[str] = None,
):
    clauses: list = ["(ac.account_no LIKE '5%%' OR ac.account_no LIKE '6%%')"]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"g.company_id IN ({ph})")
        params.extend(company_id)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if month:
        clauses.append("d.month = %s")
        params.append(month)
    if account_prefix:
        clauses.append("ac.account_no LIKE %s")
        params.append(f"{account_prefix}%")
    wh = "WHERE " + " AND ".join(clauses)
    return query(f"""
        SELECT
            ac.account_no        AS gl_account_no,
            ac.account_name      AS gl_account_name,
            ac.account_category,
            ac.account_subcategory,
            SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END) AS cogs,
            SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS opex,
            SUM(g.amount)        AS total_amount,
            COUNT(*)             AS entry_count,
            COUNT(DISTINCT g.company_id) AS entity_count
        {_EXP_BASE} {wh}
        GROUP BY ac.account_no, ac.account_name, ac.account_category, ac.account_subcategory
        ORDER BY ABS(SUM(g.amount)) DESC
        LIMIT 50
    """, params)


@router.get("/expense/by-entity")
def expense_by_entity(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    clauses: list = ["(ac.account_no LIKE '5%%' OR ac.account_no LIKE '6%%')"]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"g.company_id IN ({ph})")
        params.extend(company_id)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    wh = "WHERE " + " AND ".join(clauses)
    return query(f"""
        SELECT
            co.company_name,
            SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END) AS cogs,
            SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS opex,
            SUM(g.amount) AS total_amount
        {_EXP_BASE} {wh}
        GROUP BY co.company_name
        ORDER BY SUM(g.amount) DESC
    """, params)


@router.get("/expense/by-month")
def expense_by_month(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    clauses: list = ["(ac.account_no LIKE '5%%' OR ac.account_no LIKE '6%%')"]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"g.company_id IN ({ph})")
        params.extend(company_id)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    wh = "WHERE " + " AND ".join(clauses)
    return query(f"""
        SELECT
            d.year, d.month, d.month_name,
            SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END) AS cogs,
            SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS opex,
            SUM(g.amount)  AS total_amount,
            COUNT(*)       AS entry_count
        {_EXP_BASE} {wh}
        GROUP BY d.year, d.month, d.month_name
        ORDER BY d.year, d.month
    """, params)


# ── Department Spend ──────────────────────────────────────────────────────────
@router.get("/dept-spend")
def dept_spend(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    department_code: Optional[str] = None,
):
    clauses: list = []
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"co.company_id IN ({ph})")
        params.extend(company_id)
    if year:
        clauses.append("ds.fiscal_year = %s")
        params.append(year)
    if department_code:
        clauses.append("ds.department_code = %s")
        params.append(department_code)
    wh = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return query(f"""
        SELECT ds.company_name, ds.department_code, ds.vertical_code,
               ds.fiscal_year, ds.fiscal_period, ds.account_category,
               ds.total_amount, ds.entry_count
        FROM v_dept_spend ds
        JOIN dim_company co ON co.company_name = ds.company_name
        {wh}
        ORDER BY ds.company_name, ds.fiscal_year, ds.fiscal_period,
                 ABS(ds.total_amount) DESC
    """, params)


@router.get("/dept-spend/summary")
def dept_spend_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    clauses: list = []
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"co.company_id IN ({ph})")
        params.extend(company_id)
    if year:
        clauses.append("ds.fiscal_year = %s")
        params.append(year)
    wh = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = query(f"""
        SELECT
            SUM(ABS(ds.total_amount)) AS total_spend,
            COUNT(DISTINCT ds.department_code) AS dept_count,
            COUNT(DISTINCT ds.vertical_code)   AS vertical_count,
            COUNT(DISTINCT ds.company_name)    AS entity_count
        FROM v_dept_spend ds
        JOIN dim_company co ON co.company_name = ds.company_name
        {wh}
    """, params)
    return rows[0] if rows else {}
