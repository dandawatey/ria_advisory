"""
services/dimension_mapper.py — Dimension Mapping Service
Agent: Rohan_Backend_003  |  Ticket: IC-7 / ERP-DN-005
Maps ERP-native dimension codes → canonical dimensions.
Canonical dimension types: department, project, cost_centre, geography.
Rule 05: tenant_id filter on all queries.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

VALID_DIMENSION_TYPES = {"department", "project", "cost_centre", "geography"}

_MAPPING_SQL = """
    SELECT target_value AS canonical_code,
           target_label AS canonical_name
    FROM dim_erp_mapping
    WHERE erp_source_id  = %s
      AND source_value   = %s
      AND mapping_type   = %s
      AND tenant_id      = %s
    LIMIT 1
"""


@dataclass(frozen=True)
class CanonicalDimension:
    """Canonical dimension value."""
    dimension_type: str   # department | project | cost_centre | geography
    code: str
    name: str


class DimensionMapper:
    """
    Map ERP-native dimension codes to canonical dimension values.

    Usage:
        mapper = DimensionMapper(db_query=database.query)
        dim = mapper.map_dimension(erp_source_id=1, dimension_type="department",
                                   erp_code="BC-FIN-01", tenant_id=tid)
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    # ── Public API ────────────────────────────────────────────────────────────

    def map_dimension(
        self,
        erp_source_id: int,
        dimension_type: str,
        erp_code: str,
        tenant_id: uuid.UUID,
    ) -> Optional[CanonicalDimension]:
        """Return CanonicalDimension or None if no mapping found."""
        if dimension_type not in VALID_DIMENSION_TYPES:
            raise ValueError(
                f"Invalid dimension_type {dimension_type!r}. "
                f"Must be one of: {sorted(VALID_DIMENSION_TYPES)}"
            )

        rows = self._query(
            _MAPPING_SQL,
            (erp_source_id, erp_code, dimension_type, str(tenant_id))
        )
        if not rows:
            return None

        return CanonicalDimension(
            dimension_type=dimension_type,
            code=rows[0]["canonical_code"],
            name=rows[0]["canonical_name"],
        )

    def map_batch(
        self,
        erp_source_id: int,
        dimension_type: str,
        erp_codes: List[str],
        tenant_id: uuid.UUID,
    ) -> Dict[str, Optional[CanonicalDimension]]:
        """Map a list of ERP codes. Returns dict keyed by erp_code."""
        return {
            code: self.map_dimension(erp_source_id, dimension_type, code, tenant_id)
            for code in erp_codes
        }
