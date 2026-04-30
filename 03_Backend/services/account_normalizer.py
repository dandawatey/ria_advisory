"""
services/account_normalizer.py — Account Code Normalization Service
Agent: Rohan_Backend_003  |  Ticket: IC-6 / ERP-DN-003
Maps ERP-native account codes → canonical 4-level CoA (dim_account).
Uses dim_erp_mapping for explicit mappings; falls back to direct match.
Rule 05: tenant_id filter on all queries.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from typing import Callable, Dict, Optional

logger = logging.getLogger(__name__)

_MAPPING_SQL = """
    SELECT canonical_account_no
    FROM dim_erp_mapping
    WHERE erp_source_id  = %s
      AND source_value   = %s
      AND mapping_type   = 'account'
      AND tenant_id      = %s
    LIMIT 1
"""

_ACCOUNT_SQL = """
    SELECT account_no, account_name, l1_category, l2_category, l3_category
    FROM dim_account
    WHERE account_no = %s
    LIMIT 1
"""


@dataclass(frozen=True)
class CanonicalAccount:
    """Normalized account from the canonical 4-level CoA."""
    account_no: str
    account_name: str
    l1: str   # Financial Statement (P&L / Balance Sheet / Cash Flow)
    l2: str   # Category (Revenue / COGS / OpEx / ...)
    l3: str   # Subcategory


class AccountNormalizer:
    """
    Normalize ERP-native account codes to canonical CoA.

    Usage:
        norm = AccountNormalizer(db_query=database.query)
        account = norm.normalize(erp_source_id=1, erp_account_code="4001", tenant_id=tid)
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    # ── Public API ────────────────────────────────────────────────────────────

    def normalize(
        self,
        erp_source_id: int,
        erp_account_code: str,
        tenant_id: uuid.UUID,
    ) -> Optional[CanonicalAccount]:
        """Return CanonicalAccount or None if unmapped."""
        # Step 1: check explicit mapping in dim_erp_mapping
        rows = self._query(_MAPPING_SQL, (erp_source_id, erp_account_code, str(tenant_id)))
        if rows:
            canonical_no = rows[0]["canonical_account_no"]
            return self._fetch_account(canonical_no)

        # Step 2: fallback — try direct match by account_no
        return self._fetch_account(erp_account_code)

    def normalize_batch(
        self,
        erp_source_id: int,
        erp_account_codes: list,
        tenant_id: uuid.UUID,
    ) -> Dict[str, Optional[CanonicalAccount]]:
        """Normalize a list of codes. Returns dict keyed by erp_account_code."""
        return {
            code: self.normalize(erp_source_id, code, tenant_id)
            for code in erp_account_codes
        }

    # ── Private ───────────────────────────────────────────────────────────────

    def _fetch_account(self, account_no: str) -> Optional[CanonicalAccount]:
        rows = self._query(_ACCOUNT_SQL, (account_no,))
        if not rows:
            return None
        r = rows[0]
        return CanonicalAccount(
            account_no=r["account_no"],
            account_name=r["account_name"],
            l1=r["l1_category"],
            l2=r["l2_category"],
            l3=r["l3_category"],
        )
