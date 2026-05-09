"""Dashboard / KPI aggregation endpoints. Uses star schema (fact_gl_entries + dimensions)."""

from fastapi import APIRouter, Depends
from database import query
from auth_utils import require_auth
from decimal import Decimal
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# NOTE: In BC General Ledger, revenue accounts (4xx) are credits → negative amounts.
# Expenses (5xx/6xx) are debits → positive amounts.
# We flip sign on revenue so the frontend sees positive revenue figures.


@router.get("/kpis")
def get_kpis(current: dict = Depends(require_auth)):
    rows = query("""
        SELECT
            -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END)  AS total_revenue,
             SUM(CASE WHEN gl_account_no LIKE '5%%' THEN amount ELSE 0 END)  AS total_cogs,
             SUM(CASE WHEN gl_account_no LIKE '6%%' THEN amount ELSE 0 END)  AS total_opex,
             SUM(CASE WHEN gl_account_no LIKE '1%%' THEN amount ELSE 0 END)  AS total_assets,
            -SUM(CASE WHEN gl_account_no LIKE '2%%' THEN amount ELSE 0 END)  AS total_liabilities,
            COUNT(DISTINCT subsidiary_code)                                    AS entity_count,
            COUNT(*)                                                           AS total_entries
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
    """)
    return rows[0] if rows else {}


@router.get("/entities")
def get_entity_summary(current: dict = Depends(require_auth)):
    return query("""
        SELECT
            subsidiary_code                                                           AS code,
            subsidiary_name                                                           AS name,
            -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END)         AS revenue,
             SUM(CASE WHEN gl_account_no LIKE '5%%'
                       OR gl_account_no LIKE '6%%' THEN amount ELSE 0 END)           AS expenses,
            -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END)
              - SUM(CASE WHEN gl_account_no LIKE '5%%'
                          OR gl_account_no LIKE '6%%' THEN amount ELSE 0 END)         AS net_income,
            COUNT(*)                                                                   AS entry_count
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
        GROUP BY subsidiary_code, subsidiary_name
        ORDER BY -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) DESC
    """)


@router.get("/pl-trend")
def get_pl_trend(current: dict = Depends(require_auth)):
    return query("""
        SELECT
            TO_CHAR(DATE_TRUNC('month', posting_date), 'YYYY-MM') AS month,
            -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END) AS revenue,
             SUM(CASE WHEN gl_account_no LIKE '5%%'
                       OR gl_account_no LIKE '6%%' THEN amount ELSE 0 END)  AS expenses
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
          AND posting_date IS NOT NULL
        GROUP BY DATE_TRUNC('month', posting_date)
        ORDER BY DATE_TRUNC('month', posting_date)
    """)


@router.get("/departments")
def get_department_breakdown(current: dict = Depends(require_auth)):
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


@router.get("/pl-by-account-type")
def pl_by_account_type(current: dict = Depends(require_auth)):
    """Consolidated P&L grouped by account category across all entities."""
    return query("""
        SELECT
            CASE
                WHEN gl_account_no LIKE '1%%' THEN 'Assets'
                WHEN gl_account_no LIKE '2%%' THEN 'Liabilities'
                WHEN gl_account_no LIKE '3%%' THEN 'Equity'
                WHEN gl_account_no LIKE '4%%' THEN 'Revenue'
                WHEN gl_account_no LIKE '5%%' THEN 'COGS'
                WHEN gl_account_no LIKE '6%%' THEN 'Operating Expenses'
                WHEN gl_account_no LIKE '7%%' THEN 'Other Income'
                WHEN gl_account_no LIKE '8%%' THEN 'Tax'
                ELSE 'Other'
            END                         AS account_category,
            gl_account_no               AS account_no,
            MAX(gl_account_name)        AS account_name,
            SUM(amount)                 AS total_amount,
            COUNT(*)                    AS entry_count
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
        GROUP BY account_category, gl_account_no
        ORDER BY account_category, gl_account_no
    """)


# ── Star Schema Functions (ICFO-65-S2) ──────────────────────────────────────

def get_dashboard_pl(
    db,
    date_from: str,
    date_to: str,
    tenant_id: str,
    entity_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Fetch P&L metrics from star schema (fact_gl_entries + dim_account).

    Args:
        db: Database connection (supports query() method)
        date_from: ISO 8601 date string (YYYY-MM-DD)
        date_to: ISO 8601 date string
        tenant_id: Tenant UUID
        entity_ids: Optional list of entity IDs to filter

    Returns: Dict with revenue, cogs, gross_margin_pct, opex, ebitda
    """
    # Build WHERE clause for entity filter
    entity_filter = ""
    if entity_ids:
        entity_placeholders = ",".join([f"'{eid}'" for eid in entity_ids])
        entity_filter = f"AND fe.company_id IN ({entity_placeholders})"

    sql = f"""
    SELECT
        COALESCE(SUM(CASE WHEN da.l2_category = 'Revenue' THEN fe.debit_amount - fe.credit_amount ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN da.l2_category = 'COGS' THEN fe.credit_amount - fe.debit_amount ELSE 0 END), 0) as cogs,
        COALESCE(SUM(CASE WHEN da.l2_category = 'OpEx' THEN fe.credit_amount - fe.debit_amount ELSE 0 END), 0) as opex
    FROM fact_gl_entries fe
    LEFT JOIN dim_account da ON fe.account_code = da.account_code
    WHERE fe.posting_date BETWEEN %s AND %s
      AND fe.tenant_id = %s
      {entity_filter}
    """

    try:
        result = db.query(sql, (date_from, date_to, tenant_id))
        if result and len(result) > 0:
            row = result[0]
            revenue = Decimal(str(row.get("revenue") or 0))
            cogs = Decimal(str(row.get("cogs") or 0))
            opex = Decimal(str(row.get("opex") or 0))
            gross_margin_pct = ((revenue - cogs) / revenue * 100) if revenue != 0 else Decimal("0.00")
            ebitda = revenue - cogs - opex

            return {
                "revenue": revenue,
                "cogs": cogs,
                "gross_margin_pct": gross_margin_pct,
                "opex": opex,
                "ebitda": ebitda,
            }
    except Exception:
        pass

    # Return zero-filled response on error or empty result
    return {
        "revenue": Decimal("0.00"),
        "cogs": Decimal("0.00"),
        "gross_margin_pct": Decimal("0.00"),
        "opex": Decimal("0.00"),
        "ebitda": Decimal("0.00"),
    }


def consolidate_entities(db, entity_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Consolidate multi-entity P&L data (sum across entities).

    Args:
        db: Database connection (unused in this implementation)
        entity_data: List of entity dicts with revenue, cogs, etc.

    Returns: Dict with total_revenue, total_cogs, entities
    """
    total_revenue = Decimal("0.00")
    total_cogs = Decimal("0.00")

    for entity in entity_data:
        total_revenue += Decimal(str(entity.get("revenue") or 0))
        total_cogs += Decimal(str(entity.get("cogs") or 0))

    return {
        "total_revenue": total_revenue,
        "total_cogs": total_cogs,
        "entities": entity_data,
    }


def consolidate_balances(db, entity_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Consolidate multi-entity balance sheet data (sum across entities).

    Args:
        db: Database connection (unused in this implementation)
        entity_data: List of entity dicts with balance sheet fields

    Returns: Dict with total_current_assets and other balance fields
    """
    total_current_assets = Decimal("0.00")

    for entity in entity_data:
        current_assets = entity.get("current_assets")
        if current_assets is not None:
            total_current_assets += Decimal(str(current_assets))

    return {
        "total_current_assets": total_current_assets,
    }


def get_dashboard(
    db,
    date_from: str,
    date_to: str,
    tenant_id: str,
) -> Dict[str, Any]:
    """
    Fetch comprehensive dashboard data from star schema.

    Returns: Dict with period_start, period_end, pl, balances, metrics, timestamp, entities
    """
    from datetime import datetime

    pl = get_dashboard_pl(db, date_from, date_to, tenant_id)

    return {
        "period_start": date_from,
        "period_end": date_to,
        "pl": pl,
        "balances": {},
        "metrics": {
            "gross_margin_pct": pl.get("gross_margin_pct", Decimal("0.00")),
            "ebitda": pl.get("ebitda", Decimal("0.00")),
        },
        "timestamp": datetime.now().isoformat(),
        "entities": [],
    }
