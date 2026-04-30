"""
services/cross_erp_pl.py — Cross-ERP P&L Comparison Service
Agent: Rohan_Backend_003  |  Ticket: IC-18 / ERP-DS-001
Queries fact_gl_entries grouped by ERP source and period.
Revenue = credits on 401xxx accounts; COGS = debits on 501xxx; OpEx = debits on 6xxxxx.
Rule 05: tenant_id on all queries.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

_PL_SQL = """
    SELECT
        f.erp_source_id,
        s.display_name AS erp_name,
        TO_CHAR(d.full_date, 'YYYY-MM') AS period,
        SUM(CASE WHEN f.account_no LIKE '401%' OR f.account_no LIKE '402%'
                 THEN ABS(f.transaction_amount_cr) ELSE 0 END) AS revenue,
        SUM(CASE WHEN f.account_no LIKE '50%'
                 THEN f.transaction_amount_dr ELSE 0 END) AS cogs,
        SUM(CASE WHEN f.account_no LIKE '6%'
                 THEN f.transaction_amount_dr ELSE 0 END) AS opex
    FROM fact_gl_entries f
    JOIN dim_erp_source s ON s.erp_source_id = f.erp_source_id
    JOIN dim_date d ON d.date_id = f.date_id
    WHERE f.erp_source_id = ANY(%s)
      AND d.full_date BETWEEN %s AND %s
      AND s.tenant_id = %s
    GROUP BY f.erp_source_id, s.display_name, period
    ORDER BY period, f.erp_source_id
"""


@dataclass
class PLRow:
    erp_source_id: int
    erp_name: str
    period: str          # YYYY-MM
    revenue: float
    cogs: float
    gross_profit: float
    opex: float
    ebitda: float


class CrossERPPLService:
    """
    P&L comparison across multiple ERP sources.

    Usage:
        svc = CrossERPPLService(db_query=database.query)
        rows = svc.get_pl(erp_source_ids=[11,12], from_date=..., to_date=..., tenant_id=...)
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    def get_pl(
        self,
        erp_source_ids: List[int],
        from_date: date,
        to_date: date,
        tenant_id: uuid.UUID,
    ) -> List[PLRow]:
        rows = self._query(_PL_SQL, (erp_source_ids, from_date, to_date, str(tenant_id)))
        return [self._build_row(r) for r in rows]

    def get_pl_summary(
        self,
        erp_source_ids: List[int],
        from_date: date,
        to_date: date,
        tenant_id: uuid.UUID,
    ) -> Dict:
        """Aggregate totals across all ERP sources and periods."""
        rows = self.get_pl(erp_source_ids, from_date, to_date, tenant_id)
        total_revenue = sum(r.revenue for r in rows)
        total_cogs = sum(r.cogs for r in rows)
        total_opex = sum(r.opex for r in rows)
        total_gross = total_revenue - total_cogs
        total_ebitda = total_gross - total_opex
        return {
            "total_revenue": total_revenue,
            "total_cogs": total_cogs,
            "total_opex": total_opex,
            "total_gross_profit": total_gross,
            "total_ebitda": total_ebitda,
        }

    def _build_row(self, r: dict) -> PLRow:
        rev = float(r.get("revenue") or 0)
        cogs = float(r.get("cogs") or 0)
        opex = float(r.get("opex") or 0)
        gross = rev - cogs
        ebitda = gross - opex
        return PLRow(
            erp_source_id=r["erp_source_id"],
            erp_name=r["erp_name"],
            period=r["period"],
            revenue=rev,
            cogs=cogs,
            gross_profit=gross,
            opex=opex,
            ebitda=ebitda,
        )
