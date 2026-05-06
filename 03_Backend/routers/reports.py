"""
Standard Finance Reports — Trial Balance, Balance Sheet, Expense Analysis, Department Spend,
KPI Ratios, Financial Health Score, Project Financials
GET /api/reports/*
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from database import query
from auth_utils import require_auth, get_allowed_company_ids

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _resolve_companies(
    requested: Optional[List[int]],
    current: dict,
) -> Optional[List[int]]:
    """
    Intersect caller-supplied company_id list with what the JWT tenant allows.
    Returns:
      None          → superadmin, no restriction (pass through to _where helpers)
      []            → tenant has no allowed companies — caller must return empty
      [1, 2, ...]   → effective company_id list for the query
    """
    allowed = get_allowed_company_ids(current)
    if allowed is None:          # superadmin — unrestricted
        return requested
    if not allowed:              # tenant has no companies configured
        return []
    if requested:
        effective = [c for c in requested if c in set(allowed)]
        return effective if effective else []
    return allowed

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
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = []
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
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
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = []
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
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
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = [
        "(cb.account_no LIKE '1%' OR cb.account_no LIKE '2%' OR cb.account_no LIKE '3%')"
    ]
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
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
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = []
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
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
    account_category: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = ["(ac.account_no LIKE '5%%' OR ac.account_no LIKE '6%%')"]
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
            ph = ", ".join(["%s"] * len(company_id))
            clauses.append(f"g.company_id IN ({ph})")
            params.extend(company_id)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if month:
        clauses.append("d.month = %s")
        params.append(month)
    if account_category:
        clauses.append("ac.account_category = %s")
        params.append(account_category)
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
    account_category: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = ["(ac.account_no LIKE '5%%' OR ac.account_no LIKE '6%%')"]
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
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
    if account_category:
        clauses.append("ac.account_category = %s")
        params.append(account_category)
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
    account_category: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = ["(ac.account_no LIKE '5%%' OR ac.account_no LIKE '6%%')"]
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
            ph = ", ".join(["%s"] * len(company_id))
            clauses.append(f"g.company_id IN ({ph})")
            params.extend(company_id)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if account_category:
        clauses.append("ac.account_category = %s")
        params.append(account_category)
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
    account_category: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = ["(ac.account_no LIKE '5%%' OR ac.account_no LIKE '6%%')"]
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
            ph = ", ".join(["%s"] * len(company_id))
            clauses.append(f"g.company_id IN ({ph})")
            params.extend(company_id)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if account_category:
        clauses.append("ac.account_category = %s")
        params.append(account_category)
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
    account_category: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = []
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
            ph = ", ".join(["%s"] * len(company_id))
            clauses.append(f"co.company_id IN ({ph})")
            params.extend(company_id)
    if year:
        clauses.append("ds.fiscal_year = %s")
        params.append(year)
    if department_code:
        clauses.append("ds.department_code = %s")
        params.append(department_code)
    if account_category:
        clauses.append("ds.account_category = %s")
        params.append(account_category)
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
    account_category: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    clauses: list = []
    params: list = []
    if company_id is not None:
        if not company_id:
            clauses.append("FALSE")
        else:
            ph = ", ".join(["%s"] * len(company_id))
            clauses.append(f"co.company_id IN ({ph})")
            params.extend(company_id)
    if year:
        clauses.append("ds.fiscal_year = %s")
        params.append(year)
    if account_category:
        clauses.append("ds.account_category = %s")
        params.append(account_category)
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


# ═══════════════════════════════════════════════════════════════════════════════
# KPI RATIO DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════

_GL_BASE = """
    FROM fact_gl_entries g
    JOIN dim_date    d  ON d.date_id     = g.date_id
    JOIN dim_account ac ON ac.account_no = g.account_no
    JOIN dim_company co ON co.company_id = g.company_id
"""

def _gl_where(company_ids=None, year=None):
    clauses: list = ["g.account_no != '999999'"]
    params:  list = []
    if company_ids is not None:
        if not company_ids:
            clauses.append("FALSE")
        else:
            ph = ", ".join(["%s"] * len(company_ids))
            clauses.append(f"g.company_id IN ({ph})")
            params.extend(company_ids)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    return "WHERE " + " AND ".join(clauses), params


def _safe_pct(num, denom):
    if not denom: return None
    return round(float(num) / float(denom) * 100, 2)

def _safe_ratio(num, denom):
    if not denom: return None
    return round(float(num) / float(denom), 3)


@router.get("/kpi-ratios")
def kpi_ratios(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _gl_where(company_id, year)

    # P&L from fact_gl_entries
    pl = query(f"""
        SELECT
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)  AS opex,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR  ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR  ac.account_no LIKE '6%%'
                          OR  ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            )                                                                   AS net_income,
            COUNT(DISTINCT g.company_id)                                        AS entity_count
        {_GL_BASE} {wh}
    """, params)
    p = pl[0] if pl else {}

    # Balance sheet from fact_coa_balances
    bs_clauses: list = []
    bs_params:  list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        bs_clauses.append(f"company_id IN ({ph})")
        bs_params.extend(company_id)
    bs_wh = ("WHERE " + " AND ".join(bs_clauses)) if bs_clauses else ""
    bs = query(f"""
        SELECT
            SUM(CASE WHEN account_no LIKE '1%%' THEN balance ELSE 0 END) AS assets,
            SUM(CASE WHEN account_no LIKE '2%%' THEN balance ELSE 0 END) AS liabilities,
            SUM(CASE WHEN account_no LIKE '3%%' THEN balance ELSE 0 END) AS equity
        FROM fact_coa_balances {bs_wh}
    """, bs_params)
    b = bs[0] if bs else {}

    rev   = float(p.get("revenue")     or 0)
    cogs  = float(p.get("cogs")        or 0)
    opex  = float(p.get("opex")        or 0)
    net   = float(p.get("net_income")  or 0)
    ent   = int(p.get("entity_count")  or 1)
    assets = float(b.get("assets")      or 0)
    liab   = abs(float(b.get("liabilities") or 0))
    equity = abs(float(b.get("equity")  or 0))

    return {
        "revenue":             rev,
        "cogs":                cogs,
        "opex":                opex,
        "net_income":          net,
        "gross_margin_pct":    _safe_pct(rev - cogs, rev),
        "net_margin_pct":      _safe_pct(net, rev),
        "ebitda_margin_pct":   _safe_pct(rev - cogs - opex, rev),
        "opex_ratio_pct":      _safe_pct(opex, rev),
        "current_ratio":       _safe_ratio(assets, liab),
        "debt_equity":         _safe_ratio(liab, equity),
        "revenue_per_entity":  round(rev / ent, 0) if ent else None,
        "expense_per_entity":  round((cogs + opex) / ent, 0) if ent else None,
        "entity_count":        ent,
    }


@router.get("/kpi-ratios/trend")
def kpi_ratios_trend(
    company_id: Optional[List[int]] = Query(default=None),
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _gl_where(company_id)
    return query(f"""
        SELECT
            d.year,
            d.month,
            d.month_name,
            TO_CHAR(MIN(d.full_date), 'YYYY-MM') AS month_key,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END) AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END) AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS opex,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR  ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR  ac.account_no LIKE '6%%'
                          OR  ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            ) AS net_income
        {_GL_BASE} {wh}
        GROUP BY d.year, d.month, d.month_name
        ORDER BY d.year, d.month
    """, params)


@router.get("/kpi-ratios/by-entity")
def kpi_ratios_by_entity(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _gl_where(company_id, year)
    rows = query(f"""
        SELECT
            co.company_name,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)  AS opex,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR  ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR  ac.account_no LIKE '6%%'
                          OR  ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            ) AS net_income
        {_GL_BASE} {wh}
        GROUP BY co.company_name
        ORDER BY revenue DESC
    """, params)

    result = []
    for r in rows:
        rev  = float(r["revenue"] or 0)
        cogs = float(r["cogs"]    or 0)
        opex = float(r["opex"]    or 0)
        net  = float(r["net_income"] or 0)
        result.append({
            **r,
            "gross_margin_pct": _safe_pct(rev - cogs, rev),
            "net_margin_pct":   _safe_pct(net, rev),
            "opex_ratio_pct":   _safe_pct(opex, rev),
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# FINANCIAL HEALTH SCORE
# ═══════════════════════════════════════════════════════════════════════════════

def _score_metric(value, green_threshold, amber_threshold, higher_is_better=True):
    """Return 0–100 score for a single metric."""
    if value is None:
        return 50  # neutral when data missing
    if higher_is_better:
        if value >= green_threshold:  return 100
        if value >= amber_threshold:  return int(50 + 50 * (value - amber_threshold) / (green_threshold - amber_threshold))
        return max(0, int(50 * value / amber_threshold))
    else:  # lower is better (e.g. D/E ratio, OpEx ratio)
        if value <= green_threshold:  return 100
        if value <= amber_threshold:  return int(50 + 50 * (amber_threshold - value) / (amber_threshold - green_threshold))
        return max(0, int(50 * (1 - (value - amber_threshold) / amber_threshold)))


@router.get("/health-score")
def health_score(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    # Fetch base ratios (pass resolved list; kpi_ratios handles None/list)
    ratios = kpi_ratios(company_id=company_id, year=year, current=current)

    gross_margin = ratios.get("gross_margin_pct") or 0
    net_margin   = ratios.get("net_margin_pct")   or 0
    current_r    = ratios.get("current_ratio")    or 0
    de_ratio     = ratios.get("debt_equity")      or 0
    opex_ratio   = ratios.get("opex_ratio_pct")   or 0

    # Entity coverage (months present / 12 across companies)
    cov = query("""
        SELECT AVG(LEAST(months_present, 12) * 100.0 / 12) AS avg_coverage
        FROM (
            SELECT co.company_id, COUNT(DISTINCT d.year * 100 + d.month) AS months_present
            FROM fact_gl_entries g
            JOIN dim_company co ON co.company_id = g.company_id
            JOIN dim_date    d  ON d.date_id     = g.date_id
            GROUP BY co.company_id
        ) sub
    """)
    coverage_pct = float((cov[0].get("avg_coverage") or 0)) if cov else 50.0

    # Score each category
    categories = [
        {
            "name":          "Profitability",
            "weight":        25,
            "metric_label":  "Net Margin",
            "metric_value":  f"{net_margin:.1f}%",
            "raw_value":     net_margin,
            "score":         _score_metric(net_margin, 15, 5, higher_is_better=True),
            "status":        "green" if net_margin >= 15 else "amber" if net_margin >= 5 else "red",
        },
        {
            "name":          "Gross Efficiency",
            "weight":        20,
            "metric_label":  "Gross Margin",
            "metric_value":  f"{gross_margin:.1f}%",
            "raw_value":     gross_margin,
            "score":         _score_metric(gross_margin, 40, 20, higher_is_better=True),
            "status":        "green" if gross_margin >= 40 else "amber" if gross_margin >= 20 else "red",
        },
        {
            "name":          "Liquidity",
            "weight":        20,
            "metric_label":  "Current Ratio",
            "metric_value":  f"{current_r:.2f}×",
            "raw_value":     current_r,
            "score":         _score_metric(current_r, 2.0, 1.0, higher_is_better=True),
            "status":        "green" if current_r >= 2.0 else "amber" if current_r >= 1.0 else "red",
        },
        {
            "name":          "Leverage",
            "weight":        15,
            "metric_label":  "Debt / Equity",
            "metric_value":  f"{de_ratio:.2f}×" if de_ratio else "N/A",
            "raw_value":     de_ratio,
            "score":         _score_metric(de_ratio, 0.5, 2.0, higher_is_better=False),
            "status":        "green" if de_ratio <= 0.5 else "amber" if de_ratio <= 2.0 else "red",
        },
        {
            "name":          "OpEx Control",
            "weight":        10,
            "metric_label":  "OpEx Ratio",
            "metric_value":  f"{opex_ratio:.1f}%",
            "raw_value":     opex_ratio,
            "score":         _score_metric(opex_ratio, 10, 25, higher_is_better=False),
            "status":        "green" if opex_ratio <= 10 else "amber" if opex_ratio <= 25 else "red",
        },
        {
            "name":          "Data Coverage",
            "weight":        10,
            "metric_label":  "Entity Coverage",
            "metric_value":  f"{coverage_pct:.0f}%",
            "raw_value":     coverage_pct,
            "score":         _score_metric(coverage_pct, 80, 50, higher_is_better=True),
            "status":        "green" if coverage_pct >= 80 else "amber" if coverage_pct >= 50 else "red",
        },
    ]

    # Weighted overall score
    overall = sum(c["score"] * c["weight"] for c in categories) // 100

    # Grade
    grade = "A" if overall >= 85 else "B" if overall >= 70 else "C" if overall >= 55 else "D" if overall >= 40 else "F"

    # Drivers (positive + negative)
    drivers = []
    for c in sorted(categories, key=lambda x: -x["score"])[:3]:
        drivers.append({"type": "positive", "text": f'{c["name"]}: {c["metric_label"]} {c["metric_value"]} is {"strong" if c["status"] == "green" else "acceptable"}'})
    for c in sorted(categories, key=lambda x: x["score"])[:2]:
        if c["status"] != "green":
            drivers.append({"type": "negative", "text": f'{c["name"]}: {c["metric_label"]} {c["metric_value"]} needs improvement'})

    return {
        "overall_score": overall,
        "grade":         grade,
        "categories":    categories,
        "drivers":       drivers,
        "ratios":        ratios,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PROJECT-WISE FINANCIALS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/project-financials/summary")
def project_financials_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _gl_where(company_id, year)
    rows = query(f"""
        SELECT
            COUNT(DISTINCT p.project_no)                                        AS project_count,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS total_revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%'
                        OR  ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS total_spend,
            COUNT(*)                                                             AS entry_count
        {_GL_BASE}
        LEFT JOIN dim_project p ON p.project_id = g.project_id
        {wh}
    """, params)
    return rows[0] if rows else {}


@router.get("/project-financials")
def project_financials(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _gl_where(company_id, year)
    return query(f"""
        SELECT
            COALESCE(NULLIF(TRIM(p.project_no), ''), '(no project)') AS project_no,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)  AS opex,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR  ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR  ac.account_no LIKE '6%%'
                          OR  ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            )                                                                   AS net,
            COUNT(*)                                                             AS entry_count,
            COUNT(DISTINCT g.company_id)                                        AS entity_count
        {_GL_BASE}
        LEFT JOIN dim_project p ON p.project_id = g.project_id
        {wh}
        GROUP BY COALESCE(NULLIF(TRIM(p.project_no), ''), '(no project)')
        ORDER BY ABS(SUM(g.amount)) DESC
    """, params)


# ═══════════════════════════════════════════════════════════════════════════════
# VERTICAL ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

_VERT_BASE = """
    FROM fact_gl_entries g
    JOIN dim_date       d  ON d.date_id       = g.date_id
    JOIN dim_account    ac ON ac.account_no   = g.account_no
    JOIN dim_company    co ON co.company_id   = g.company_id
    JOIN dim_department dp ON dp.department_id = g.department_id
"""
_VERT_EXCL = "AND dp.vertical_code IS NOT NULL AND dp.vertical_code NOT IN ('OPENBAL', 'PREJUNE2025')"


def _vert_where(company_ids=None, year=None):
    clauses = [f"g.account_no != '999999' {_VERT_EXCL}"]
    params: list = []
    if company_ids is not None:
        if not company_ids:
            clauses.append("FALSE")
        else:
            ph = ", ".join(["%s"] * len(company_ids))
            clauses.append(f"g.company_id IN ({ph})")
            params.extend(company_ids)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    return "WHERE " + " AND ".join(clauses), params


@router.get("/vertical-analytics")
def vertical_analytics(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _vert_where(company_id, year)
    rows = query(f"""
        SELECT
            dp.vertical_code,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)  AS opex,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR  ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR  ac.account_no LIKE '6%%'
                          OR  ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            )                                                                   AS net,
            COUNT(DISTINCT g.company_id)                                        AS entity_count,
            COUNT(*)                                                             AS entry_count
        {_VERT_BASE} {wh}
        GROUP BY dp.vertical_code
        ORDER BY revenue DESC
    """, params)

    result = []
    for r in rows:
        rev  = float(r["revenue"] or 0)
        cogs = float(r["cogs"]    or 0)
        opex = float(r["opex"]    or 0)
        net  = float(r["net"]     or 0)
        result.append({
            **r,
            "gross_margin_pct": _safe_pct(rev - cogs, rev),
            "net_margin_pct":   _safe_pct(net, rev),
            "opex_ratio_pct":   _safe_pct(opex, rev),
            "total_spend":      round(cogs + opex, 2),
        })
    return result


@router.get("/vertical-analytics/departments")
def vertical_departments(
    vertical_code: Optional[str] = None,
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _vert_where(company_id, year)
    if vertical_code:
        wh += " AND dp.vertical_code = %s"
        params.append(vertical_code)
    rows = query(f"""
        SELECT
            dp.department_code,
            dp.vertical_code,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)  AS opex,
            COUNT(*)                                                             AS entry_count
        {_VERT_BASE} {wh}
        GROUP BY dp.department_code, dp.vertical_code
        ORDER BY revenue DESC
    """, params)

    result = []
    for r in rows:
        rev  = float(r["revenue"] or 0)
        cogs = float(r["cogs"]    or 0)
        opex = float(r["opex"]    or 0)
        result.append({
            **r,
            "gross_margin_pct": _safe_pct(rev - cogs, rev),
            "opex_ratio_pct":   _safe_pct(opex, rev),
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# ENTITY / COMPANY COMPARISON
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/entity-comparison")
def entity_comparison(
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    allowed = _resolve_companies(None, current)
    wh, params = _gl_where(company_ids=allowed, year=year)
    rows = query(f"""
        SELECT
            co.company_name,
            co.company_id,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)  AS opex,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR  ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR  ac.account_no LIKE '6%%'
                          OR  ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            )                                                                   AS net,
            COUNT(*)                                                             AS entry_count
        {_GL_BASE} {wh}
        GROUP BY co.company_name, co.company_id
        ORDER BY revenue DESC
    """, params)

    total_rev = sum(float(r["revenue"] or 0) for r in rows)

    result = []
    for r in rows:
        rev  = float(r["revenue"] or 0)
        cogs = float(r["cogs"]    or 0)
        opex = float(r["opex"]    or 0)
        net  = float(r["net"]     or 0)
        result.append({
            **r,
            "gross_margin_pct":  _safe_pct(rev - cogs, rev),
            "net_margin_pct":    _safe_pct(net, rev),
            "opex_ratio_pct":    _safe_pct(opex, rev),
            "revenue_share_pct": _safe_pct(rev, total_rev),
            "total_spend":       round(cogs + opex, 2),
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# CASH FLOW STATEMENT  (GL-flow indirect method)
# ═══════════════════════════════════════════════════════════════════════════════

def _cf_from_rows(rows: list) -> dict:
    """Convert raw account-class GL flows into a structured CF statement."""
    f = {r["account_class"]: float(r["net_amount"] or 0) for r in rows}

    # ── Operating activities ────────────────────────────────────────────────
    revenue       =  f.get("4", 0)          # -SUM(4xx) = inflow
    cogs          = -f.get("5", 0)          # -SUM(5xx) = outflow (negated back)
    opex          = -f.get("6", 0)
    other_income  =  f.get("7", 0)
    other_expense = -f.get("8", 0)
    net_income    = revenue - abs(cogs) - abs(opex) + other_income - abs(other_expense)
    operating_cf  = net_income

    # ── Investing activities ────────────────────────────────────────────────
    # 1xx asset account movements — net debit = cash spent on assets
    asset_movement  = f.get("1", 0)         # raw GL sum of 1xx entries
    investing_cf    = -asset_movement       # asset purchase = cash outflow

    # ── Financing activities ────────────────────────────────────────────────
    # 2xx liabilities + 3xx equity — new liabilities/equity = cash inflow
    liab_movement   = f.get("2", 0)
    equity_movement = f.get("3", 0)
    financing_cf    = -(liab_movement + equity_movement)

    net_change = operating_cf + investing_cf + financing_cf

    return {
        "operating": {
            "revenue_received":    round(revenue, 2),
            "cogs_paid":           round(cogs, 2),
            "opex_paid":           round(opex, 2),
            "other_income":        round(other_income, 2),
            "other_expense":       round(other_expense, 2),
            "total":               round(operating_cf, 2),
        },
        "investing": {
            "asset_movements":     round(-asset_movement, 2),
            "total":               round(investing_cf, 2),
        },
        "financing": {
            "liability_movements": round(-liab_movement, 2),
            "equity_movements":    round(-equity_movement, 2),
            "total":               round(financing_cf, 2),
        },
        "net_change": round(net_change, 2),
    }


@router.get("/cash-flow")
def cash_flow(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _gl_where(company_id, year)
    rows = query(f"""
        SELECT
            LEFT(g.account_no, 1)         AS account_class,
            -SUM(g.amount)                AS net_amount
        {_GL_BASE} {wh}
        GROUP BY LEFT(g.account_no, 1)
    """, params)
    return _cf_from_rows(rows)


@router.get("/cash-flow/trend")
def cash_flow_trend(
    company_id: Optional[List[int]] = Query(default=None),
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _gl_where(company_id)
    rows = query(f"""
        SELECT
            d.year,
            LEFT(g.account_no, 1)         AS account_class,
            -SUM(g.amount)                AS net_amount
        {_GL_BASE} {wh}
        GROUP BY d.year, LEFT(g.account_no, 1)
        ORDER BY d.year
    """, params)

    # Group by year
    by_year: dict = {}
    for r in rows:
        yr = r["year"]
        if yr not in by_year:
            by_year[yr] = []
        by_year[yr].append(r)

    result = []
    for yr in sorted(by_year.keys()):
        cf = _cf_from_rows(by_year[yr])
        result.append({
            "year":         yr,
            "operating_cf": cf["operating"]["total"],
            "investing_cf": cf["investing"]["total"],
            "financing_cf": cf["financing"]["total"],
            "net_change":   cf["net_change"],
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# CFO RATIOS DASHBOARD  (comprehensive — 20 ratios across 4 categories)
# ═══════════════════════════════════════════════════════════════════════════════

def _r2(v):
    """Round to 2dp; return None if falsy."""
    return round(float(v), 2) if v is not None else None


@router.get("/cfo-ratios")
def cfo_ratios(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _gl_where(company_id, year)

    # ── P&L block ────────────────────────────────────────────────────────────
    pl = query(f"""
        SELECT
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)        AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)        AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)        AS opex,
            -SUM(CASE WHEN ac.account_category = 'Interest' THEN g.amount ELSE 0 END) AS interest_expense,
            -SUM(CASE WHEN ac.account_category = 'Tax'      THEN g.amount ELSE 0 END) AS tax_expense,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR  ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR  ac.account_no LIKE '6%%'
                          OR  ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            )                                                                         AS net_income,
            COUNT(DISTINCT g.company_id)                                              AS entity_count
        {_GL_BASE} {wh}
    """, params)
    p = pl[0] if pl else {}

    rev      = float(p.get("revenue")          or 0)
    cogs     = float(p.get("cogs")             or 0)
    opex     = float(p.get("opex")             or 0)
    interest = abs(float(p.get("interest_expense") or 0))
    net      = float(p.get("net_income")       or 0)
    ebitda   = rev - cogs - opex

    # ── Balance sheet block ───────────────────────────────────────────────────
    bs_clauses: list = []
    bs_params:  list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        bs_clauses.append(f"company_id IN ({ph})")
        bs_params.extend(company_id)
    bs_wh = ("WHERE " + " AND ".join(bs_clauses)) if bs_clauses else ""

    bs = query(f"""
        SELECT
            SUM(CASE WHEN account_no LIKE '1%%' THEN balance ELSE 0 END)        AS total_assets,
            SUM(CASE WHEN account_no LIKE '2%%' THEN balance ELSE 0 END)        AS total_liabilities,
            SUM(CASE WHEN account_no LIKE '3%%' THEN balance ELSE 0 END)        AS total_equity
        FROM fact_coa_balances {bs_wh}
    """, bs_params)
    b = bs[0] if bs else {}

    # Category-level balance sheet (for current vs long-term split)
    cat_bs = query(f"""
        SELECT
            SUM(CASE WHEN account_category = 'Current Assets'     THEN balance ELSE 0 END) AS current_assets,
            SUM(CASE WHEN account_category = 'Current Liabilities' THEN balance ELSE 0 END) AS current_liabilities,
            SUM(CASE WHEN account_category = 'Cash Flow'           THEN balance ELSE 0 END) AS cash,
            SUM(CASE WHEN account_category = 'Investments'         THEN balance ELSE 0 END) AS investments
        FROM fact_coa_balances {bs_wh}
    """, bs_params)
    cb = cat_bs[0] if cat_bs else {}

    # Receivables: accounts receivable from balance sheet
    rec_rows = query(f"""
        SELECT SUM(balance) AS receivables
        FROM fact_coa_balances
        {"WHERE " + " AND ".join(bs_clauses + ["(account_name ILIKE '%%receivable%%' OR account_name ILIKE '%%debtor%%')"])
         if bs_clauses else
         "WHERE (account_name ILIKE '%%receivable%%' OR account_name ILIKE '%%debtor%%')"}
    """, bs_params)
    receivables = abs(float((rec_rows[0] or {}).get("receivables") or 0))

    total_assets = abs(float(b.get("total_assets")      or 0))
    total_liab   = abs(float(b.get("total_liabilities") or 0))
    total_equity = abs(float(b.get("total_equity")      or 0))
    curr_assets  = abs(float(cb.get("current_assets")      or 0)) or total_assets * 0.45
    curr_liab    = abs(float(cb.get("current_liabilities") or 0)) or total_liab  * 0.60
    cash         = abs(float(cb.get("cash")                or 0))
    investments  = abs(float(cb.get("investments")         or 0))
    inventory    = cogs * 0.10   # estimated — no inventory dimension in current schema

    # ── Ratio calculations ────────────────────────────────────────────────────
    def pct(n, d):   return _r2(n / d * 100) if d else None
    def rat(n, d):   return _r2(n / d)       if d else None
    def days(n, d):  return _r2(n / d * 365) if d else None

    gross_profit = rev - cogs

    ratios = {
        # ── Liquidity ─────────────────────────────────────────────────────────
        "current_ratio":        rat(curr_assets, curr_liab),
        "quick_ratio":          rat(curr_assets - inventory, curr_liab),
        "cash_ratio":           rat(cash, curr_liab),
        "working_capital":      _r2(curr_assets - curr_liab),

        # ── Profitability ─────────────────────────────────────────────────────
        "gross_margin_pct":     pct(gross_profit, rev),
        "ebitda_margin_pct":    pct(ebitda, rev),
        "net_margin_pct":       pct(net, rev),
        "roa_pct":              pct(net, total_assets),
        "roe_pct":              pct(net, total_equity),

        # ── Efficiency ────────────────────────────────────────────────────────
        "asset_turnover":       rat(rev, total_assets),
        "cost_to_income_pct":   pct(cogs + opex, rev),
        "dso_days":             days(receivables, rev),
        "opex_ratio_pct":       pct(opex, rev),

        # ── Leverage ──────────────────────────────────────────────────────────
        "debt_equity":          rat(total_liab, total_equity),
        "debt_ratio":           rat(total_liab, total_assets),
        "interest_coverage":    rat(ebitda, interest),
        "debt_to_ebitda":       rat(total_liab, ebitda) if ebitda > 0 else None,

        # ── Absolute figures (for context) ────────────────────────────────────
        "revenue":              _r2(rev),
        "ebitda":               _r2(ebitda),
        "net_income":           _r2(net),
        "total_assets":         _r2(total_assets),
        "total_liabilities":    _r2(total_liab),
        "total_equity":         _r2(total_equity),
        "entity_count":         int(p.get("entity_count") or 1),
    }
    return ratios


@router.get("/cfo-ratios/by-entity")
def cfo_ratios_by_entity(
    year: Optional[int] = None,
    current: dict = Depends(require_auth),
):
    allowed = _resolve_companies(None, current)
    wh, params = _gl_where(company_ids=allowed, year=year)
    rows = query(f"""
        SELECT
            co.company_name,
            co.company_id,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END) AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END) AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS opex,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR  ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR  ac.account_no LIKE '6%%'
                          OR  ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            ) AS net_income
        {_GL_BASE} {wh}
        GROUP BY co.company_name, co.company_id
        ORDER BY revenue DESC
    """, params)

    result = []
    for r in rows:
        rv   = float(r["revenue"]   or 0)
        cg   = float(r["cogs"]      or 0)
        ox   = float(r["opex"]      or 0)
        ni   = float(r["net_income"] or 0)
        eb   = rv - cg - ox
        result.append({
            **r,
            "gross_margin_pct":  _safe_pct(rv - cg, rv),
            "ebitda_margin_pct": _safe_pct(eb, rv),
            "net_margin_pct":    _safe_pct(ni, rv),
            "cost_to_income_pct": _safe_pct(cg + ox, rv),
        })
    return result


# ── Revenue Report helpers ─────────────────────────────────────────────────────

def _rev_where(company_ids=None, year=None, month_from=None, month_to=None):
    """WHERE clause scoped to revenue accounts (4xx) with optional filters."""
    clauses: list = [
        "g.account_no != '999999'",
        "ac.account_no LIKE '4%%'",
    ]
    params: list = []
    if company_ids is not None:
        if not company_ids:
            clauses.append("FALSE")           # tenant has no allowed companies
        else:
            ph = ", ".join(["%s"] * len(company_ids))
            clauses.append(f"g.company_id IN ({ph})")
            params.extend(company_ids)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if month_from:
        clauses.append("TO_CHAR(d.full_date, 'YYYY-MM') >= %s")
        params.append(month_from)
    if month_to:
        clauses.append("TO_CHAR(d.full_date, 'YYYY-MM') <= %s")
        params.append(month_to)
    return "WHERE " + " AND ".join(clauses), params


# ── Revenue endpoints ──────────────────────────────────────────────────────────

@router.get("/revenue/summary")
def revenue_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _rev_where(company_id, year, month_from, month_to)
    rows = query(f"""
        SELECT
            -SUM(g.amount)                       AS total_revenue,
            COUNT(DISTINCT d.year * 100 + d.month) AS month_count,
            COUNT(DISTINCT co.company_id)         AS entity_count,
            COUNT(*)                              AS entry_count
        {_GL_BASE} {wh}
    """, params)

    total = float(rows[0]["total_revenue"] or 0) if rows else 0.0
    month_count = int(rows[0]["month_count"] or 0) if rows else 0

    # Prior-year total for YoY (same filters but year-1)
    prior_total = 0.0
    if year:
        wh2, p2 = _rev_where(company_id, year - 1, month_from, month_to)
        pr = query(f"SELECT -SUM(g.amount) AS rev {_GL_BASE} {wh2}", p2)
        prior_total = float(pr[0]["rev"] or 0) if pr else 0.0

    return {
        "total_revenue":      round(total, 2),
        "prior_year_revenue": round(prior_total, 2),
        "yoy_growth_pct":     _safe_pct(total - prior_total, prior_total) if prior_total else None,
        "avg_monthly_revenue": round(total / month_count, 2) if month_count else 0.0,
        "month_count":   int(rows[0]["month_count"] or 0) if rows else 0,
        "entity_count":  int(rows[0]["entity_count"] or 0) if rows else 0,
        "entry_count":   int(rows[0]["entry_count"] or 0) if rows else 0,
    }


@router.get("/revenue/by-month")
def revenue_by_month(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _rev_where(company_id, year, month_from, month_to)
    rows = query(f"""
        SELECT
            d.year,
            d.month,
            d.month_name,
            d.quarter,
            -SUM(g.amount)                        AS revenue,
            COUNT(DISTINCT co.company_id)         AS entity_count,
            COUNT(*)                              AS entry_count
        {_GL_BASE} {wh}
        GROUP BY d.year, d.month, d.month_name, d.quarter
        ORDER BY d.year, d.month
    """, params)
    return [
        {**r, "revenue": round(float(r["revenue"] or 0), 2)}
        for r in rows
    ]


@router.get("/revenue/by-entity")
def revenue_by_entity(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _rev_where(company_id, year, month_from, month_to)
    rows = query(f"""
        SELECT
            co.company_name,
            co.company_id,
            -SUM(g.amount)   AS revenue,
            COUNT(*)         AS entry_count
        {_GL_BASE} {wh}
        GROUP BY co.company_name, co.company_id
        ORDER BY revenue DESC
    """, params)

    total = sum(float(r["revenue"] or 0) for r in rows)
    return [
        {
            **r,
            "revenue":          round(float(r["revenue"] or 0), 2),
            "revenue_share_pct": _safe_pct(float(r["revenue"] or 0), total),
        }
        for r in rows
    ]


@router.get("/revenue/by-account")
def revenue_by_account(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _rev_where(company_id, year, month_from, month_to)
    rows = query(f"""
        SELECT
            ac.account_no,
            ac.account_name,
            -SUM(g.amount)                AS revenue,
            COUNT(DISTINCT co.company_id) AS entity_count,
            COUNT(*)                      AS entry_count
        {_GL_BASE} {wh}
        GROUP BY ac.account_no, ac.account_name
        ORDER BY revenue DESC
    """, params)

    total = sum(float(r["revenue"] or 0) for r in rows)
    return [
        {
            **r,
            "revenue":          round(float(r["revenue"] or 0), 2),
            "revenue_share_pct": _safe_pct(float(r["revenue"] or 0), total),
        }
        for r in rows
    ]


# ── UBR helpers ────────────────────────────────────────────────────────────────

_UBR_BASE = """
    FROM fact_gl_entries g
    JOIN dim_date     d  ON d.date_id      = g.date_id
    JOIN dim_account  ac ON ac.account_no  = g.account_no
    JOIN dim_company  co ON co.company_id  = g.company_id
    LEFT JOIN dim_document dd ON dd.document_id = g.document_id
"""

def _ubr_where(company_ids=None, year=None, month_from=None, month_to=None):
    """WHERE clause scoped to revenue accounts (4xx) — same as _rev_where."""
    return _rev_where(company_ids, year, month_from, month_to)


# ── UBR endpoints ──────────────────────────────────────────────────────────────

@router.get("/ubr/summary")
def ubr_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _ubr_where(company_id, year, month_from, month_to)
    rows = query(f"""
        SELECT
            -SUM(g.amount) AS total_revenue,
            -SUM(CASE WHEN dd.document_type ILIKE '%%Invoice%%' THEN g.amount ELSE 0 END)
                           AS billed_revenue,
            -SUM(CASE WHEN dd.document_type NOT ILIKE '%%Invoice%%' OR dd.document_type IS NULL
                      THEN g.amount ELSE 0 END)
                           AS ubr_amount,
            COUNT(DISTINCT co.company_id) AS entity_count,
            COUNT(*) AS entry_count
        {_UBR_BASE} {wh}
    """, params)

    r = rows[0] if rows else {}
    total  = round(float(r.get("total_revenue")  or 0), 2)
    billed = round(float(r.get("billed_revenue") or 0), 2)
    ubr    = round(float(r.get("ubr_amount")     or 0), 2)
    return {
        "total_revenue":  total,
        "billed_revenue": billed,
        "ubr_amount":     ubr,
        "ubr_pct":        _safe_pct(ubr, total),
        "entity_count":   int(r.get("entity_count") or 0),
        "entry_count":    int(r.get("entry_count")  or 0),
    }


@router.get("/ubr/by-month")
def ubr_by_month(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _ubr_where(company_id, year, month_from, month_to)
    rows = query(f"""
        SELECT
            d.year,
            d.month,
            d.month_name,
            d.quarter,
            -SUM(g.amount)               AS total_revenue,
            -SUM(CASE WHEN dd.document_type ILIKE '%%Invoice%%' THEN g.amount ELSE 0 END)
                                         AS billed,
            -SUM(CASE WHEN dd.document_type NOT ILIKE '%%Invoice%%' OR dd.document_type IS NULL
                      THEN g.amount ELSE 0 END)
                                         AS ubr
        {_UBR_BASE} {wh}
        GROUP BY d.year, d.month, d.month_name, d.quarter
        ORDER BY d.year, d.month
    """, params)
    return [
        {
            **r,
            "total_revenue": round(float(r["total_revenue"] or 0), 2),
            "billed":        round(float(r["billed"]        or 0), 2),
            "ubr":           round(float(r["ubr"]           or 0), 2),
        }
        for r in rows
    ]


@router.get("/ubr/by-entity")
def ubr_by_entity(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _ubr_where(company_id, year, month_from, month_to)
    rows = query(f"""
        SELECT
            co.company_name,
            co.company_id,
            -SUM(g.amount)               AS total_revenue,
            -SUM(CASE WHEN dd.document_type ILIKE '%%Invoice%%' THEN g.amount ELSE 0 END)
                                         AS billed_revenue,
            -SUM(CASE WHEN dd.document_type NOT ILIKE '%%Invoice%%' OR dd.document_type IS NULL
                      THEN g.amount ELSE 0 END)
                                         AS ubr_amount
        {_UBR_BASE} {wh}
        GROUP BY co.company_name, co.company_id
        ORDER BY total_revenue DESC
    """, params)
    return [
        {
            **r,
            "total_revenue":  round(float(r["total_revenue"]  or 0), 2),
            "billed_revenue": round(float(r["billed_revenue"] or 0), 2),
            "ubr_amount":     round(float(r["ubr_amount"]     or 0), 2),
            "ubr_pct":        _safe_pct(float(r["ubr_amount"] or 0), float(r["total_revenue"] or 0)),
        }
        for r in rows
    ]


@router.get("/ubr/by-account")
def ubr_by_account(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    current: dict = Depends(require_auth),
):
    company_id = _resolve_companies(company_id, current)
    wh, params = _ubr_where(company_id, year, month_from, month_to)
    rows = query(f"""
        SELECT
            ac.account_no,
            ac.account_name,
            -SUM(g.amount)               AS total_revenue,
            -SUM(CASE WHEN dd.document_type ILIKE '%%Invoice%%' THEN g.amount ELSE 0 END)
                                         AS billed_revenue,
            -SUM(CASE WHEN dd.document_type NOT ILIKE '%%Invoice%%' OR dd.document_type IS NULL
                      THEN g.amount ELSE 0 END)
                                         AS ubr_amount,
            COUNT(*)                     AS entry_count
        {_UBR_BASE} {wh}
        GROUP BY ac.account_no, ac.account_name
        ORDER BY total_revenue DESC
    """, params)
    return [
        {
            **r,
            "total_revenue":  round(float(r["total_revenue"]  or 0), 2),
            "billed_revenue": round(float(r["billed_revenue"] or 0), 2),
            "ubr_amount":     round(float(r["ubr_amount"]     or 0), 2),
            "ubr_pct":        _safe_pct(float(r["ubr_amount"] or 0), float(r["total_revenue"] or 0)),
        }
        for r in rows
    ]
