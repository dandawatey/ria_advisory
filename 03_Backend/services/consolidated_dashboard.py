"""
services/consolidated_dashboard.py — Consolidated Dashboard Service
Agent: Rohan_Backend_003  |  Ticket: IC-19 / ERP-DS-002
Aggregates P&L + trend data across ALL ERP sources for a tenant.
Rule 05: tenant_id on all queries.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

_SUMMARY_SQL = """
    SELECT
        SUM(CASE WHEN f.account_no LIKE '401%' OR f.account_no LIKE '402%'
                 THEN ABS(f.transaction_amount_cr) ELSE 0 END) AS total_revenue,
        SUM(CASE WHEN f.account_no LIKE '50%'
                 THEN f.transaction_amount_dr ELSE 0 END) AS total_cogs,
        SUM(CASE WHEN f.account_no LIKE '6%'
                 THEN f.transaction_amount_dr ELSE 0 END) AS total_opex,
        COUNT(DISTINCT f.erp_source_id) AS source_count
    FROM fact_gl_entries f
    JOIN dim_date d ON d.date_id = f.date_id
    JOIN dim_erp_source s ON s.erp_source_id = f.erp_source_id
    WHERE d.full_date BETWEEN %s AND %s
      AND s.tenant_id = %s
"""

_MONTHLY_TREND_SQL = """
    SELECT
        TO_CHAR(d.full_date, 'YYYY-MM') AS period,
        SUM(CASE WHEN f.account_no LIKE '401%' OR f.account_no LIKE '402%'
                 THEN ABS(f.transaction_amount_cr) ELSE 0 END) AS revenue,
        SUM(CASE WHEN f.account_no LIKE '50%'
                 THEN f.transaction_amount_dr ELSE 0 END) AS cogs,
        SUM(CASE WHEN f.account_no LIKE '6%'
                 THEN f.transaction_amount_dr ELSE 0 END) AS opex
    FROM fact_gl_entries f
    JOIN dim_date d ON d.date_id = f.date_id
    JOIN dim_erp_source s ON s.erp_source_id = f.erp_source_id
    WHERE d.full_date BETWEEN %s AND %s
      AND s.tenant_id = %s
    GROUP BY period
    ORDER BY period
"""

_BY_ERP_SQL = """
    SELECT
        f.erp_source_id,
        s.display_name AS erp_name,
        SUM(CASE WHEN f.account_no LIKE '401%' OR f.account_no LIKE '402%'
                 THEN ABS(f.transaction_amount_cr) ELSE 0 END) AS revenue,
        SUM(CASE WHEN f.account_no LIKE '50%'
                 THEN f.transaction_amount_dr ELSE 0 END) AS cogs,
        SUM(CASE WHEN f.account_no LIKE '6%'
                 THEN f.transaction_amount_dr ELSE 0 END) AS opex
    FROM fact_gl_entries f
    JOIN dim_date d ON d.date_id = f.date_id
    JOIN dim_erp_source s ON s.erp_source_id = f.erp_source_id
    WHERE d.full_date BETWEEN %s AND %s
      AND s.tenant_id = %s
    GROUP BY f.erp_source_id, s.display_name
    ORDER BY revenue DESC
"""


@dataclass
class DashboardSummary:
    total_revenue: float
    total_cogs: float
    total_opex: float
    gross_profit: float
    ebitda: float
    erp_sources_count: int
    period: str


class ConsolidatedDashboardService:
    """
    Consolidated financial dashboard across all ERP sources.

    Usage:
        svc = ConsolidatedDashboardService(db_query=database.query)
        summary = svc.get_summary(from_date, to_date, tenant_id)
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    def get_summary(self, from_date: date, to_date: date, tenant_id: uuid.UUID) -> DashboardSummary:
        """Aggregate totals across all ERP sources for the period."""
        rows = self._query(_SUMMARY_SQL, (from_date, to_date, str(tenant_id)))
        r = rows[0] if rows else {}
        rev = float(r.get("total_revenue") or 0)
        cogs = float(r.get("total_cogs") or 0)
        opex = float(r.get("total_opex") or 0)
        gross = rev - cogs
        ebitda = gross - opex
        period = f"{from_date} → {to_date}"
        return DashboardSummary(
            total_revenue=rev,
            total_cogs=cogs,
            total_opex=opex,
            gross_profit=gross,
            ebitda=ebitda,
            erp_sources_count=int(r.get("source_count") or 0),
            period=period,
        )

    def get_monthly_trend(self, from_date: date, to_date: date, tenant_id: uuid.UUID) -> List[Dict]:
        """Monthly revenue/ebitda trend."""
        rows = self._query(_MONTHLY_TREND_SQL, (from_date, to_date, str(tenant_id)))
        result = []
        for r in rows:
            rev = float(r.get("revenue") or 0)
            cogs = float(r.get("cogs") or 0)
            opex = float(r.get("opex") or 0)
            result.append({
                "period": r["period"],
                "revenue": rev,
                "ebitda": rev - cogs - opex,
            })
        return result

    def get_by_erp_source(self, from_date: date, to_date: date, tenant_id: uuid.UUID) -> List[Dict]:
        """Revenue + EBITDA breakdown per ERP source."""
        rows = self._query(_BY_ERP_SQL, (from_date, to_date, str(tenant_id)))
        result = []
        for r in rows:
            rev = float(r.get("revenue") or 0)
            cogs = float(r.get("cogs") or 0)
            opex = float(r.get("opex") or 0)
            result.append({
                "erp_source_id": r["erp_source_id"],
                "erp_name": r["erp_name"],
                "revenue": rev,
                "ebitda": rev - cogs - opex,
            })
        return result
