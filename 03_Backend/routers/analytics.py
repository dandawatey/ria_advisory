"""
Analytics & Insights endpoints.
All revenue (4xx) sums are negated at SQL layer → frontend always receives positive revenue.
Expenses (5xx/6xx) remain positive.
"""

from fastapi import APIRouter, Query
from typing import Optional
from database import query

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ── 1. Monthly P&L Waterfall ──────────────────────────────────────────────────

@router.get("/pl-waterfall")
def pl_waterfall(subsidiary: Optional[str] = None):
    """Monthly Revenue / COGS / OpEx / Net Income — all entities or one."""
    filters = ["gl_account_no NOT IN ('999999')", "posting_date IS NOT NULL"]
    params: list = []
    if subsidiary:
        filters.append("subsidiary_code = %s")
        params.append(subsidiary.upper())
    where = " AND ".join(filters)
    return query(f"""
        SELECT
            TO_CHAR(DATE_TRUNC('month', posting_date), 'YYYY-MM') AS month,
            -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) AS revenue,
             SUM(CASE WHEN gl_account_no LIKE '5%%' THEN amount ELSE 0 END) AS cogs,
             SUM(CASE WHEN gl_account_no LIKE '6%%' THEN amount ELSE 0 END) AS opex,
            -SUM(CASE WHEN gl_account_no LIKE '7%%' THEN amount ELSE 0 END) AS other_income,
             SUM(CASE WHEN gl_account_no LIKE '8%%' THEN amount ELSE 0 END) AS tax,
            (
              -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END)
              -SUM(CASE WHEN gl_account_no LIKE '7%%' THEN amount ELSE 0 END)
            )
            - SUM(CASE WHEN gl_account_no LIKE '5%%'
                        OR gl_account_no LIKE '6%%'
                        OR gl_account_no LIKE '8%%' THEN amount ELSE 0 END) AS net_income
        FROM gl_unified
        WHERE {where}
        GROUP BY DATE_TRUNC('month', posting_date)
        ORDER BY DATE_TRUNC('month', posting_date)
    """, params)


# ── 2. Entity Contribution (revenue ranking + gross margin) ───────────────────

@router.get("/entity-contribution")
def entity_contribution():
    return query("""
        SELECT
            subsidiary_code,
            subsidiary_name,
            -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN gl_account_no LIKE '5%%' THEN amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN gl_account_no LIKE '6%%' THEN amount ELSE 0 END)  AS opex,
            CASE
                WHEN SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) = 0 THEN NULL
                ELSE ROUND(
                    100.0
                    * (-SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END)
                        - SUM(CASE WHEN gl_account_no LIKE '5%%' THEN amount ELSE 0 END))
                    / NULLIF(-SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END), 0),
                2)
            END AS gross_margin_pct,
            ROUND(
                100.0
                * (-SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END))
                / NULLIF(SUM(SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END))
                         OVER (), 0),
            2) AS revenue_share_pct
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
        GROUP BY subsidiary_code, subsidiary_name
        ORDER BY revenue DESC
    """)


# ── 3. Department Spend Heat Map ──────────────────────────────────────────────

@router.get("/department-heatmap")
def department_heatmap(
    subsidiary: Optional[str] = None,
    month: Optional[str] = None,
):
    filters = [
        "gl_account_no NOT IN ('999999')",
        "department_code IS NOT NULL",
        "department_code != ''",
        "posting_date IS NOT NULL",
    ]
    params: list = []
    if subsidiary:
        filters.append("subsidiary_code = %s")
        params.append(subsidiary.upper())
    if month:
        filters.append("DATE_TRUNC('month', posting_date) = DATE_TRUNC('month', %s::date)")
        params.append(f"{month}-01")
    where = " AND ".join(filters)
    return query(f"""
        SELECT
            department_code,
            vertical_code,
            TO_CHAR(DATE_TRUNC('month', posting_date), 'YYYY-MM') AS month,
            SUM(CASE WHEN gl_account_no LIKE '5%%' THEN amount ELSE 0 END) AS cogs,
            SUM(CASE WHEN gl_account_no LIKE '6%%' THEN amount ELSE 0 END) AS opex,
            SUM(CASE WHEN gl_account_no LIKE '5%%'
                      OR gl_account_no LIKE '6%%' THEN amount ELSE 0 END)  AS total_spend,
            COUNT(*) AS entry_count
        FROM gl_unified
        WHERE {where}
        GROUP BY department_code, vertical_code, DATE_TRUNC('month', posting_date)
        ORDER BY ABS(SUM(CASE WHEN gl_account_no LIKE '5%%'
                               OR gl_account_no LIKE '6%%' THEN amount ELSE 0 END)) DESC
        LIMIT 200
    """, params)


# ── 4. Rolling Revenue Trend per Entity ───────────────────────────────────────

@router.get("/rolling-trend")
def rolling_trend(subsidiary: Optional[str] = None):
    filters = ["gl_account_no NOT IN ('999999')", "posting_date IS NOT NULL"]
    params: list = []
    if subsidiary:
        filters.append("subsidiary_code = %s")
        params.append(subsidiary.upper())
    where = " AND ".join(filters)
    return query(f"""
        SELECT
            subsidiary_code,
            subsidiary_name,
            TO_CHAR(DATE_TRUNC('month', posting_date), 'YYYY-MM')           AS month,
            -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) AS revenue,
             SUM(CASE WHEN gl_account_no LIKE '5%%'
                       OR gl_account_no LIKE '6%%' THEN amount ELSE 0 END)  AS expenses
        FROM gl_unified
        WHERE {where}
        GROUP BY subsidiary_code, subsidiary_name, DATE_TRUNC('month', posting_date)
        ORDER BY subsidiary_code, DATE_TRUNC('month', posting_date)
    """, params)


# ── 5. Top GL Accounts by Absolute Movement ───────────────────────────────────

@router.get("/top-accounts")
def top_accounts(
    account_prefix: str = Query(default="", description="e.g. '4', '6', '' for all"),
    subsidiary: Optional[str] = None,
    month: Optional[str] = None,
    limit: int = Query(default=20, le=50),
):
    filters = ["gl_account_no NOT IN ('999999')"]
    params: list = []
    prefix = account_prefix.strip()
    if prefix:
        filters.append("gl_account_no LIKE %s")
        params.append(f"{prefix}%")
    if subsidiary:
        filters.append("subsidiary_code = %s")
        params.append(subsidiary.upper())
    if month:
        filters.append("DATE_TRUNC('month', posting_date) = DATE_TRUNC('month', %s::date)")
        params.append(f"{month}-01")
    where = " AND ".join(filters)
    params.append(limit)
    return query(f"""
        SELECT
            gl_account_no,
            MAX(gl_account_name)  AS gl_account_name,
            CASE WHEN gl_account_no LIKE '4%%' THEN -SUM(amount)
                 ELSE SUM(amount) END   AS display_amount,
            ABS(SUM(amount))            AS abs_amount,
            COUNT(*)                    AS entry_count,
            COUNT(DISTINCT subsidiary_code) AS entity_count
        FROM gl_unified
        WHERE {where}
        GROUP BY gl_account_no
        ORDER BY ABS(SUM(amount)) DESC
        LIMIT %s
    """, params)


# ── 6. Document Type Mix ──────────────────────────────────────────────────────

@router.get("/doc-type-mix")
def doc_type_mix(
    subsidiary: Optional[str] = None,
    month: Optional[str] = None,
):
    filters = ["gl_account_no NOT IN ('999999')"]
    params: list = []
    if subsidiary:
        filters.append("subsidiary_code = %s")
        params.append(subsidiary.upper())
    if month:
        filters.append("DATE_TRUNC('month', posting_date) = DATE_TRUNC('month', %s::date)")
        params.append(f"{month}-01")
    where = " AND ".join(filters)
    return query(f"""
        SELECT
            COALESCE(NULLIF(TRIM(document_type), ''), 'Unspecified') AS document_type,
            COUNT(*)                                                   AS entry_count,
            SUM(ABS(amount))                                          AS total_absolute_value,
            ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)       AS pct_of_entries
        FROM gl_unified
        WHERE {where}
        GROUP BY COALESCE(NULLIF(TRIM(document_type), ''), 'Unspecified')
        ORDER BY entry_count DESC
    """, params)


# ── 7. Suspense Account Monitor ───────────────────────────────────────────────

@router.get("/suspense-monitor")
def suspense_monitor():
    return query("""
        SELECT
            subsidiary_code,
            subsidiary_name,
            COUNT(*)          AS entry_count,
            SUM(amount)       AS net_balance,
            MIN(posting_date) AS earliest,
            MAX(posting_date) AS latest
        FROM gl_unified
        WHERE gl_account_no = '999999'
        GROUP BY subsidiary_code, subsidiary_name
        ORDER BY ABS(SUM(amount)) DESC
    """)


# ── 8. Month-over-Month Change ────────────────────────────────────────────────

@router.get("/mom-change")
def mom_change(
    current_month: Optional[str] = None,
    prior_month: Optional[str] = None,
):
    # Default to the two most recent months in the data
    if not current_month or not prior_month:
        recent = query("""
            SELECT DISTINCT TO_CHAR(DATE_TRUNC('month', posting_date), 'YYYY-MM') AS m
            FROM gl_unified
            WHERE posting_date IS NOT NULL
            ORDER BY m DESC LIMIT 2
        """)
        months = [r["m"] for r in recent]
        current_month = months[0] if months else "2026-03"
        prior_month   = months[1] if len(months) > 1 else "2026-02"

    return query("""
        WITH current AS (
            SELECT subsidiary_code, subsidiary_name,
                   -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) AS revenue,
                    SUM(CASE WHEN gl_account_no LIKE '6%%' THEN amount ELSE 0 END) AS opex
            FROM gl_unified
            WHERE gl_account_no NOT IN ('999999')
              AND DATE_TRUNC('month', posting_date) = DATE_TRUNC('month', %s::date)
            GROUP BY subsidiary_code, subsidiary_name
        ),
        prior AS (
            SELECT subsidiary_code,
                   -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) AS revenue,
                    SUM(CASE WHEN gl_account_no LIKE '6%%' THEN amount ELSE 0 END) AS opex
            FROM gl_unified
            WHERE gl_account_no NOT IN ('999999')
              AND DATE_TRUNC('month', posting_date) = DATE_TRUNC('month', %s::date)
            GROUP BY subsidiary_code
        )
        SELECT
            c.subsidiary_code,
            c.subsidiary_name,
            c.revenue                            AS current_revenue,
            COALESCE(p.revenue, 0)               AS prior_revenue,
            c.revenue - COALESCE(p.revenue, 0)   AS revenue_delta,
            CASE WHEN COALESCE(p.revenue, 0) = 0 THEN NULL
                 ELSE ROUND(100.0*(c.revenue - p.revenue)/ABS(p.revenue), 2)
            END                                  AS revenue_delta_pct,
            c.opex                               AS current_opex,
            COALESCE(p.opex, 0)                  AS prior_opex,
            c.opex - COALESCE(p.opex, 0)         AS opex_delta
        FROM current c
        LEFT JOIN prior p USING (subsidiary_code)
        ORDER BY revenue_delta DESC
    """, [f"{current_month}-01", f"{prior_month}-01"])


# ── 9. Vertical / Business Unit P&L ──────────────────────────────────────────

@router.get("/vertical-pl")
def vertical_pl(subsidiary: Optional[str] = None):
    filters = ["gl_account_no NOT IN ('999999')"]
    params: list = []
    if subsidiary:
        filters.append("subsidiary_code = %s")
        params.append(subsidiary.upper())
    where = " AND ".join(filters)
    return query(f"""
        SELECT
            COALESCE(NULLIF(TRIM(vertical_code), ''), 'Unassigned') AS vertical_code,
            -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) AS revenue,
             SUM(CASE WHEN gl_account_no LIKE '5%%' THEN amount ELSE 0 END) AS cogs,
             SUM(CASE WHEN gl_account_no LIKE '6%%' THEN amount ELSE 0 END) AS opex,
             COUNT(*)                                                         AS entry_count,
             COUNT(DISTINCT subsidiary_code)                                  AS entity_count
        FROM gl_unified
        WHERE {where}
        GROUP BY COALESCE(NULLIF(TRIM(vertical_code), ''), 'Unassigned')
        ORDER BY revenue DESC
    """, params)


# ── 10. Account Category Summary (single-call insight tile data) ──────────────

@router.get("/account-summary")
def account_summary(subsidiary: Optional[str] = None):
    """Aggregated totals per account category — used for insight tiles."""
    filters = ["gl_account_no NOT IN ('999999')"]
    params: list = []
    if subsidiary:
        filters.append("subsidiary_code = %s")
        params.append(subsidiary.upper())
    where = " AND ".join(filters)
    return query(f"""
        SELECT
            CASE
                WHEN gl_account_no LIKE '1%%' THEN 'Assets'
                WHEN gl_account_no LIKE '2%%' THEN 'Liabilities'
                WHEN gl_account_no LIKE '3%%' THEN 'Equity'
                WHEN gl_account_no LIKE '4%%' THEN 'Revenue'
                WHEN gl_account_no LIKE '5%%' THEN 'COGS'
                WHEN gl_account_no LIKE '6%%' THEN 'OpEx'
                WHEN gl_account_no LIKE '7%%' THEN 'Other Income'
                WHEN gl_account_no LIKE '8%%' THEN 'Tax'
                ELSE 'Other'
            END                         AS category,
            COUNT(DISTINCT gl_account_no) AS account_count,
            COUNT(*)                    AS entry_count,
            SUM(amount)                 AS raw_sum,
            CASE WHEN gl_account_no LIKE '4%%' OR gl_account_no LIKE '7%%'
                 THEN -SUM(amount) ELSE SUM(amount) END AS display_amount
        FROM gl_unified
        WHERE {where}
        GROUP BY category
        ORDER BY ABS(SUM(amount)) DESC
    """, params)


# ── 11. Completeness Summary ──────────────────────────────────────────────────

@router.get("/completeness-summary")
def completeness_summary():
    """Single-row completeness scorecard across all GL entries."""
    rows = query("""
        SELECT
            COUNT(*)                                                                     AS total_entries,
            COUNT(*) FILTER (WHERE gl_account_name IS NULL)                             AS unnamed_account_entries,
            COUNT(*) FILTER (WHERE department_code IS NULL OR department_code = '')     AS no_dept_entries,
            COUNT(*) FILTER (WHERE vertical_code IS NULL OR vertical_code = '')         AS no_vertical_entries,
            COUNT(*) FILTER (WHERE gl_account_no = '999999')                            AS suspense_entries,
            SUM(CASE WHEN gl_account_no = '999999' THEN amount ELSE 0 END)              AS suspense_net
        FROM gl_unified
    """)
    return rows[0] if rows else {}


# ── 12. Entity Coverage (months present per subsidiary) ───────────────────────

@router.get("/entity-coverage")
def entity_coverage():
    """Per-subsidiary month coverage — how many of 12 possible months have data."""
    return query("""
        SELECT
            subsidiary_code,
            subsidiary_name,
            COUNT(DISTINCT DATE_TRUNC('month', posting_date)) AS months_present,
            MIN(posting_date)                                  AS from_date,
            MAX(posting_date)                                  AS to_date,
            COUNT(*)                                           AS total_entries,
            ROUND(100.0 * COUNT(DISTINCT DATE_TRUNC('month', posting_date)) / 12.0, 2) AS coverage_pct
        FROM gl_unified
        WHERE posting_date IS NOT NULL
        GROUP BY subsidiary_code, subsidiary_name
        ORDER BY months_present DESC, subsidiary_code
    """)


# ── 13. Monthly Entry Volume ───────────────────────────────────────────────────

@router.get("/monthly-volume")
def monthly_volume():
    """Entry count per month — used to highlight partial/open months."""
    return query("""
        SELECT
            TO_CHAR(DATE_TRUNC('month', posting_date), 'YYYY-MM') AS month,
            COUNT(*) AS entry_count
        FROM gl_unified
        WHERE posting_date IS NOT NULL
        GROUP BY DATE_TRUNC('month', posting_date)
        ORDER BY DATE_TRUNC('month', posting_date)
    """)


# ── 14. Expense Accounts (top 30 COGS + OpEx by absolute value) ───────────────

@router.get("/expense-accounts")
def expense_accounts(subsidiary: Optional[str] = None):
    """Top 30 GL accounts in 5xx/6xx by absolute spend magnitude."""
    filters = [
        "(gl_account_no LIKE '5%%' OR gl_account_no LIKE '6%%')",
        "gl_account_no NOT IN ('999999')",
    ]
    params: list = []
    if subsidiary:
        filters.append("subsidiary_code = %s")
        params.append(subsidiary.upper())
    where = " AND ".join(filters)
    return query(f"""
        SELECT
            gl_account_no,
            MAX(gl_account_name)            AS gl_account_name,
            SUM(amount)                     AS total_amount,
            COUNT(*)                        AS entry_count,
            COUNT(DISTINCT subsidiary_code) AS entity_count
        FROM gl_unified
        WHERE {where}
        GROUP BY gl_account_no
        ORDER BY ABS(SUM(amount)) DESC
        LIMIT 30
    """, params)
