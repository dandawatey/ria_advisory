"""Dashboard / KPI aggregation endpoints."""

from fastapi import APIRouter
from database import query

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/kpis")
def get_kpis():
    """Top-line KPIs across all entities for the most recent loaded period."""
    rows = query("""
        SELECT
            SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) AS total_revenue,
            SUM(CASE WHEN gl_account_no LIKE '5%%' THEN amount ELSE 0 END) AS total_cogs,
            SUM(CASE WHEN gl_account_no LIKE '6%%' THEN amount ELSE 0 END) AS total_opex,
            SUM(CASE WHEN gl_account_no LIKE '1%%' THEN amount ELSE 0 END) AS total_assets,
            SUM(CASE WHEN gl_account_no LIKE '2%%' THEN amount ELSE 0 END) AS total_liabilities,
            COUNT(DISTINCT subsidiary_code)                                  AS entity_count,
            COUNT(*)                                                          AS total_entries
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
    """)
    return rows[0] if rows else {}


@router.get("/entities")
def get_entity_summary():
    """Revenue, expenses and entry count per subsidiary."""
    return query("""
        SELECT
            subsidiary_code                                                      AS code,
            subsidiary_name                                                      AS name,
            SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END)     AS revenue,
            SUM(CASE WHEN gl_account_no LIKE '5%%'
                      OR gl_account_no LIKE '6%%' THEN amount ELSE 0 END)       AS expenses,
            SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END)
              - ABS(SUM(CASE WHEN gl_account_no LIKE '5%%'
                              OR gl_account_no LIKE '6%%' THEN amount ELSE 0 END))
                                                                                 AS net_income,
            COUNT(*)                                                              AS entry_count
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
        GROUP BY subsidiary_code, subsidiary_name
        ORDER BY ABS(revenue) DESC
    """)


@router.get("/pl-trend")
def get_pl_trend():
    """Monthly P&L trend across all entities."""
    return query("""
        SELECT
            TO_CHAR(DATE_TRUNC('month', posting_date), 'YYYY-MM') AS month,
            SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) AS revenue,
            SUM(CASE WHEN gl_account_no LIKE '5%%'
                      OR gl_account_no LIKE '6%%' THEN amount ELSE 0 END)  AS expenses
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
          AND posting_date IS NOT NULL
        GROUP BY DATE_TRUNC('month', posting_date)
        ORDER BY DATE_TRUNC('month', posting_date)
    """)


@router.get("/departments")
def get_department_breakdown():
    """Spend by department across all entities."""
    return query("""
        SELECT
            department_code,
            vertical_code,
            SUM(amount)  AS total_amount,
            COUNT(*)     AS entry_count
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
          AND department_code IS NOT NULL
          AND department_code != ''
        GROUP BY department_code, vertical_code
        ORDER BY ABS(SUM(amount)) DESC
        LIMIT 50
    """)
