"""
Analytics & Insights — Star Schema Edition
Revenue (4xx) negated → frontend receives positive revenue. Expenses (5xx/6xx) positive.

Filter params (shared across endpoints):
  company_id  : List[int]  — supports multi-company (omit = all)
  year        : int        — calendar year (omit = all years)
  month_from  : str        — 'YYYY-MM' inclusive start
  month_to    : str        — 'YYYY-MM' inclusive end
"""
from fastapi import APIRouter, Query
from typing import Optional, List
from database import query

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# ── Base JOIN snippet reused by most queries ──────────────────────────────────
_BASE = """
    FROM fact_gl_entries g
    JOIN dim_date      d   ON d.date_id      = g.date_id
    JOIN dim_account   ac  ON ac.account_no  = g.account_no
    JOIN dim_company   co  ON co.company_id  = g.company_id
    LEFT JOIN dim_document doc ON doc.document_id = g.document_id
"""

def _where(company_ids=None, year=None, month_from=None, month_to=None,
           extra=None, account_prefix=None, doc_type=None):
    """Build WHERE + params for the standard GL query pattern.

    New params:
      account_prefix : str  — e.g. '4' → ac.account_no LIKE '4%'
      doc_type       : str  — e.g. 'Invoice' → dim_document.document_type match
    """
    clauses = ["ac.account_no != '999999'"]
    params: list = []
    if company_ids:
        ph = ", ".join(["%s"] * len(company_ids))
        clauses.append(f"g.company_id IN ({ph})")
        params.extend(company_ids)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if month_from:
        y, m = month_from.split("-")
        clauses.append("(d.year * 100 + d.month) >= %s")
        params.append(int(y) * 100 + int(m))
    if month_to:
        y, m = month_to.split("-")
        clauses.append("(d.year * 100 + d.month) <= %s")
        params.append(int(y) * 100 + int(m))
    if account_prefix:
        clauses.append("ac.account_no LIKE %s")
        params.append(f"{account_prefix}%")
    if doc_type:
        clauses.append("TRIM(COALESCE(doc.document_type, '')) = %s")
        params.append(doc_type)
    if extra:
        clauses.append(extra)
    return "WHERE " + " AND ".join(clauses), params


# ── 0. Filter options (dropdown data for the filter panel) ────────────────────
@router.get("/filters")
def get_filters():
    companies = query("SELECT company_id, company_name FROM dim_company ORDER BY company_name")
    periods   = query("""
        SELECT DISTINCT d.year,
               d.month,
               TO_CHAR(MIN(d.full_date), 'YYYY-MM') AS month_key,
               d.month_name
        FROM dim_date d
        JOIN fact_gl_entries g ON g.date_id = d.date_id
        GROUP BY d.year, d.month, d.month_name
        ORDER BY d.year, d.month
    """)
    years = sorted({p["year"] for p in periods}, reverse=True)
    currencies = query("SELECT currency_code, currency_name FROM dim_currency ORDER BY currency_code")
    return {"companies": companies, "years": years, "months": periods, "currencies": currencies}


# ── 0b. KPI summary tiles ─────────────────────────────────────────────────────
@router.get("/kpi-summary")
def kpi_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _where(company_id, year, month_from, month_to, account_prefix=account_prefix, doc_type=doc_type)
    rows = query(f"""
        SELECT
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)  AS opex,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR ac.account_no LIKE '6%%'
                          OR ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            )                                                                    AS net_income,
            COUNT(*)                                                             AS entry_count,
            COUNT(DISTINCT g.company_id)                                        AS entity_count
        {_BASE} {wh}
    """, params)
    return rows[0] if rows else {}


# ── 1. Monthly P&L Waterfall ──────────────────────────────────────────────────
@router.get("/pl-waterfall")
def pl_waterfall(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _where(company_id, year, month_from, month_to, account_prefix=account_prefix, doc_type=doc_type)
    return query(f"""
        SELECT
            TO_CHAR(MIN(d.full_date), 'YYYY-MM')                                AS month,
            d.month_name,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)  AS opex,
            -SUM(CASE WHEN ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)  AS other_income,
             SUM(CASE WHEN ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)  AS tax,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR ac.account_no LIKE '6%%'
                          OR ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            )                                                                    AS net_income
        {_BASE} {wh}
        GROUP BY d.year, d.month, d.month_name
        ORDER BY d.year, d.month
    """, params)


# ── 2. Entity Contribution ────────────────────────────────────────────────────
@router.get("/entity-contribution")
def entity_contribution(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _where(company_id, year, month_from=month_from, month_to=month_to, account_prefix=account_prefix, doc_type=doc_type)
    return query(f"""
        SELECT
            co.company_id,
            co.company_name,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)   AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)   AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)   AS opex,
            CASE
                WHEN SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END) = 0 THEN NULL
                ELSE ROUND(100.0 *
                    ( -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)
                      - SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END) )
                    / NULLIF(-SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END), 0),
                2)
            END AS gross_margin_pct,
            ROUND(100.0 *
                ( -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END) )
                / NULLIF(SUM(SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)) OVER (), 0),
            2) AS revenue_share_pct
        {_BASE} {wh}
        GROUP BY co.company_id, co.company_name
        ORDER BY revenue DESC
    """, params)


# ── 3. Department Spend Heat Map ──────────────────────────────────────────────
@router.get("/department-heatmap")
def department_heatmap(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _where(company_id, year, month_from, month_to, extra="dp.department_code IS NOT NULL", account_prefix=account_prefix, doc_type=doc_type)
    return query(f"""
        SELECT
            dp.department_code,
            dp.vertical_code,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END) AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS opex,
             SUM(CASE WHEN ac.account_no LIKE '5%%'
                        OR ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS total_spend,
            COUNT(*) AS entry_count
        {_BASE}
        JOIN dim_department dp ON dp.department_id = g.department_id
        {wh}
        GROUP BY dp.department_code, dp.vertical_code
        ORDER BY ABS(SUM(CASE WHEN ac.account_no LIKE '5%%'
                               OR ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)) DESC
        LIMIT 20
    """, params)


# ── 4. Rolling Revenue Trend ──────────────────────────────────────────────────
@router.get("/rolling-trend")
def rolling_trend(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _where(company_id, year, month_from, month_to, account_prefix=account_prefix, doc_type=doc_type)
    return query(f"""
        SELECT
            co.company_id,
            co.company_name,
            TO_CHAR(MIN(d.full_date), 'YYYY-MM')                               AS month,
            d.month_name,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%'
                        OR ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)  AS expenses
        {_BASE} {wh}
        GROUP BY co.company_id, co.company_name, d.year, d.month, d.month_name
        ORDER BY co.company_id, d.year, d.month
    """, params)


# ── 5. Top GL Accounts ────────────────────────────────────────────────────────
@router.get("/top-accounts")
def top_accounts(
    account_prefix: str = Query(default=""),
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    limit: int = Query(default=20, le=50),
):
    prefix = account_prefix.strip()
    extra  = f"ac.account_no LIKE '{prefix}%%'" if prefix else None
    wh, params = _where(company_id, year, month_from, month_to, extra=extra)
    params.append(limit)
    return query(f"""
        SELECT
            ac.account_no       AS gl_account_no,
            ac.account_name     AS gl_account_name,
            ac.account_category,
            CASE WHEN ac.account_no LIKE '4%%' THEN -SUM(g.amount)
                 ELSE SUM(g.amount) END              AS display_amount,
            ABS(SUM(g.amount))                       AS abs_amount,
            COUNT(*)                                 AS entry_count,
            COUNT(DISTINCT g.company_id)             AS entity_count
        {_BASE} {wh}
        GROUP BY ac.account_no, ac.account_name, ac.account_category
        ORDER BY ABS(SUM(g.amount)) DESC
        LIMIT %s
    """, params)


# ── 6. Document Type Mix ──────────────────────────────────────────────────────
@router.get("/doc-type-mix")
def doc_type_mix(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
):
    wh, params = _where(company_id, year, month_from, month_to, account_prefix=account_prefix)
    return query(f"""
        SELECT
            COALESCE(NULLIF(TRIM(doc.document_type), ''), 'Unspecified') AS document_type,
            COUNT(*)                                                       AS entry_count,
            SUM(ABS(g.amount))                                            AS total_absolute_value,
            ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)           AS pct_of_entries
        {_BASE}
        {wh}
        GROUP BY COALESCE(NULLIF(TRIM(doc.document_type), ''), 'Unspecified')
        ORDER BY entry_count DESC
    """, params)


# ── 7. Suspense Monitor ───────────────────────────────────────────────────────
@router.get("/suspense-monitor")
def suspense_monitor():
    return query("""
        SELECT
            co.company_id,
            co.company_name,
            COUNT(*)          AS entry_count,
            SUM(g.amount)     AS net_balance,
            MIN(d.full_date)  AS earliest,
            MAX(d.full_date)  AS latest
        FROM fact_gl_entries g
        JOIN dim_company co ON co.company_id = g.company_id
        JOIN dim_date    d  ON d.date_id     = g.date_id
        WHERE g.account_no = '999999'
        GROUP BY co.company_id, co.company_name
        ORDER BY ABS(SUM(g.amount)) DESC
    """)


# ── 8. Month-over-Month Change ────────────────────────────────────────────────
@router.get("/mom-change")
def mom_change(
    current_month: Optional[str] = None,
    prior_month: Optional[str] = None,
):
    if not current_month or not prior_month:
        recent = query("""
            SELECT TO_CHAR(MIN(d.full_date), 'YYYY-MM') AS m,
                   d.year * 100 + d.month               AS ym
            FROM dim_date d
            JOIN fact_gl_entries g ON g.date_id = d.date_id
            GROUP BY d.year, d.month
            ORDER BY ym DESC LIMIT 2
        """)
        months = [r["m"] for r in recent]
        current_month = months[0] if months else "2026-03"
        prior_month   = months[1] if len(months) > 1 else "2026-02"

    def _ym(s): y, m = s.split("-"); return int(y) * 100 + int(m)
    return query("""
        WITH cur AS (
            SELECT co.company_id, co.company_name,
                   -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END) AS revenue,
                    SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS opex
            FROM fact_gl_entries g
            JOIN dim_date    d  ON d.date_id     = g.date_id
            JOIN dim_account ac ON ac.account_no = g.account_no
            JOIN dim_company co ON co.company_id = g.company_id
            WHERE ac.account_no != '999999' AND d.year * 100 + d.month = %s
            GROUP BY co.company_id, co.company_name
        ),
        pri AS (
            SELECT co.company_id,
                   -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END) AS revenue,
                    SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS opex
            FROM fact_gl_entries g
            JOIN dim_date    d  ON d.date_id     = g.date_id
            JOIN dim_account ac ON ac.account_no = g.account_no
            JOIN dim_company co ON co.company_id = g.company_id
            WHERE ac.account_no != '999999' AND d.year * 100 + d.month = %s
            GROUP BY co.company_id
        )
        SELECT c.company_id, c.company_name,
               c.revenue                            AS current_revenue,
               COALESCE(p.revenue, 0)               AS prior_revenue,
               c.revenue - COALESCE(p.revenue, 0)   AS revenue_delta,
               CASE WHEN COALESCE(p.revenue, 0) = 0 THEN NULL
                    ELSE ROUND(100.0*(c.revenue - p.revenue)/NULLIF(ABS(p.revenue),0), 2)
               END                                  AS revenue_delta_pct,
               c.opex                               AS current_opex,
               COALESCE(p.opex, 0)                  AS prior_opex,
               c.opex - COALESCE(p.opex, 0)         AS opex_delta
        FROM cur c LEFT JOIN pri p USING (company_id)
        ORDER BY revenue_delta DESC
    """, [_ym(current_month), _ym(prior_month)])


# ── 9. Vertical / BU P&L ─────────────────────────────────────────────────────
@router.get("/vertical-pl")
def vertical_pl(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _where(company_id, year, month_from, month_to, account_prefix=account_prefix, doc_type=doc_type)
    return query(f"""
        SELECT
            COALESCE(NULLIF(TRIM(dp.vertical_code), ''), 'Unassigned') AS vertical_code,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END) AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END) AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END) AS opex,
            COUNT(*)                                                           AS entry_count,
            COUNT(DISTINCT g.company_id)                                      AS entity_count
        {_BASE}
        JOIN dim_department dp ON dp.department_id = g.department_id
        {wh}
        GROUP BY COALESCE(NULLIF(TRIM(dp.vertical_code), ''), 'Unassigned')
        ORDER BY revenue DESC
    """, params)


# ── 10. Account Category Summary ─────────────────────────────────────────────
@router.get("/account-summary")
def account_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _where(company_id, year, month_from, month_to, account_prefix=account_prefix, doc_type=doc_type)
    return query(f"""
        SELECT
            COALESCE(ac.account_category, 'Other')            AS category,
            COUNT(DISTINCT ac.account_no)                     AS account_count,
            COUNT(*)                                          AS entry_count,
            SUM(g.amount)                                     AS raw_sum,
            SUM(CASE WHEN ac.account_no LIKE '4%%' OR ac.account_no LIKE '7%%'
                      THEN -g.amount ELSE g.amount END)        AS display_amount
        {_BASE} {wh}
        GROUP BY COALESCE(ac.account_category, 'Other')
        ORDER BY ABS(SUM(g.amount)) DESC
    """, params)


# ── 11. Completeness Summary ──────────────────────────────────────────────────
@router.get("/completeness-summary")
def completeness_summary():
    rows = query("""
        SELECT
            COUNT(*)                                                                     AS total_entries,
            COUNT(*) FILTER (WHERE g.account_no = '999999')                             AS suspense_entries,
            SUM(CASE WHEN g.account_no = '999999' THEN g.amount ELSE 0 END)             AS suspense_net,
            COUNT(*) FILTER (WHERE dp.department_code IS NULL)                          AS no_dept_entries,
            COUNT(*) FILTER (WHERE dp.vertical_code IS NULL)                            AS no_vertical_entries,
            COUNT(*) FILTER (WHERE ac.account_name IS NULL OR ac.account_name = '')     AS unnamed_account_entries
        FROM fact_gl_entries g
        JOIN dim_account    ac ON ac.account_no    = g.account_no
        JOIN dim_department dp ON dp.department_id = g.department_id
    """)
    return rows[0] if rows else {}


# ── 12. Entity Coverage ───────────────────────────────────────────────────────
@router.get("/entity-coverage")
def entity_coverage():
    return query("""
        SELECT
            co.company_id,
            co.company_name,
            COUNT(DISTINCT (d.year * 100 + d.month))   AS months_present,
            MIN(d.full_date)                            AS from_date,
            MAX(d.full_date)                            AS to_date,
            COUNT(*)                                    AS total_entries,
            ROUND(100.0 * COUNT(DISTINCT (d.year * 100 + d.month)) / 12.0, 2) AS coverage_pct
        FROM fact_gl_entries g
        JOIN dim_company co ON co.company_id = g.company_id
        JOIN dim_date    d  ON d.date_id     = g.date_id
        GROUP BY co.company_id, co.company_name
        ORDER BY months_present DESC, co.company_name
    """)


# ── 13. Monthly Entry Volume ──────────────────────────────────────────────────
@router.get("/monthly-volume")
def monthly_volume():
    return query("""
        SELECT
            TO_CHAR(MIN(d.full_date), 'YYYY-MM') AS month,
            d.year,
            d.month                               AS month_num,
            COUNT(*)                              AS entry_count
        FROM fact_gl_entries g
        JOIN dim_date d ON d.date_id = g.date_id
        GROUP BY d.year, d.month
        ORDER BY d.year, d.month
    """)


# ── 14. Expense Accounts ──────────────────────────────────────────────────────
@router.get("/expense-accounts")
def expense_accounts(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    extra = "(ac.account_no LIKE '5%%' OR ac.account_no LIKE '6%%')"
    wh, params = _where(company_id, year, month_from, month_to, extra=extra, account_prefix=account_prefix, doc_type=doc_type)
    return query(f"""
        SELECT
            ac.account_no       AS gl_account_no,
            ac.account_name     AS gl_account_name,
            ac.account_subcategory,
            SUM(g.amount)       AS total_amount,
            COUNT(*)            AS entry_count,
            COUNT(DISTINCT g.company_id) AS entity_count
        {_BASE} {wh}
        GROUP BY ac.account_no, ac.account_name, ac.account_subcategory
        ORDER BY ABS(SUM(g.amount)) DESC
        LIMIT 30
    """, params)


# ── 15. Currency Split ────────────────────────────────────────────────────────
@router.get("/pl-yoy")
def pl_yoy(
    company_id: Optional[List[int]] = Query(default=None),
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    """Year-over-Year P&L summary — one row per calendar year."""
    wh, params = _where(company_id, account_prefix=account_prefix, doc_type=doc_type)
    return query(f"""
        SELECT
            d.year,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END)   AS revenue,
             SUM(CASE WHEN ac.account_no LIKE '5%%' THEN g.amount ELSE 0 END)   AS cogs,
             SUM(CASE WHEN ac.account_no LIKE '6%%' THEN g.amount ELSE 0 END)   AS opex,
            -SUM(CASE WHEN ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)   AS other_income,
             SUM(CASE WHEN ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)   AS tax,
            (
              -SUM(CASE WHEN ac.account_no LIKE '4%%'
                         OR  ac.account_no LIKE '7%%' THEN g.amount ELSE 0 END)
              - SUM(CASE WHEN ac.account_no LIKE '5%%'
                          OR  ac.account_no LIKE '6%%'
                          OR  ac.account_no LIKE '8%%' THEN g.amount ELSE 0 END)
            ) AS net_income,
            COUNT(*) AS entry_count
        {_BASE} {wh}
        GROUP BY d.year
        ORDER BY d.year
    """, params)


@router.get("/currency-split")
def currency_split(
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _where(year=year, month_from=month_from, month_to=month_to, account_prefix=account_prefix, doc_type=doc_type)
    return query(f"""
        SELECT
            cu.currency_code,
            cu.currency_name,
            COUNT(DISTINCT g.company_id)                                       AS entity_count,
            COUNT(*)                                                            AS entry_count,
            -SUM(CASE WHEN ac.account_no LIKE '4%%' THEN g.amount ELSE 0 END) AS revenue,
             SUM(ABS(g.amount))                                                AS total_volume
        {_BASE}
        JOIN dim_currency cu ON cu.currency_id = g.currency_id
        {wh}
        GROUP BY cu.currency_code, cu.currency_name
        ORDER BY total_volume DESC
    """, params)
