"""
services/mapping_service.py — Field Mapping Service
Agent: Rohan_Backend_003  |  Ticket: IC-16 / ERP-CF-004
CRUD operations on dim_erp_mapping table.
Rule 05: tenant_id on all queries. Parameterized SQL only.
"""
from __future__ import annotations
import logging
import uuid
from typing import Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

_GET_MAPPINGS_SQL = """
    SELECT mapping_id, erp_source_id, mapping_type, source_value,
           canonical_account_no, target_value, target_label, tenant_id
    FROM dim_erp_mapping
    WHERE erp_source_id = %s
      AND tenant_id     = %s
    ORDER BY mapping_type, source_value
"""

_UPSERT_MAPPING_SQL = """
    INSERT INTO dim_erp_mapping (
        erp_source_id, mapping_type, source_value, canonical_account_no,
        target_value, target_label, tenant_id
    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (erp_source_id, mapping_type, source_value, tenant_id)
    DO UPDATE SET
        canonical_account_no = EXCLUDED.canonical_account_no,
        target_value         = EXCLUDED.target_value,
        target_label         = EXCLUDED.target_label,
        updated_at           = NOW()
    RETURNING mapping_id
"""

_DELETE_MAPPING_SQL = """
    DELETE FROM dim_erp_mapping
    WHERE mapping_id = %s
      AND tenant_id  = %s
"""


class MappingService:
    """
    CRUD service for dim_erp_mapping — the ERP field-to-canonical mapping rules.

    Usage:
        svc = MappingService(db_query=database.query)
        mappings = svc.get_mappings(erp_source_id=1, tenant_id=tid)
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    def get_mappings(self, erp_source_id: int, tenant_id: uuid.UUID) -> List[dict]:
        """Return all mapping rules for an ERP source."""
        rows = self._query(_GET_MAPPINGS_SQL, (erp_source_id, str(tenant_id)))
        return [dict(r) for r in rows]

    def upsert_mapping(
        self,
        erp_source_id: int,
        mapping_type: str,
        source_value: str,
        tenant_id: uuid.UUID,
        canonical_account_no: Optional[str] = None,
        target_value: Optional[str] = None,
        target_label: Optional[str] = None,
    ) -> int:
        """Insert or update a mapping rule. Returns mapping_id."""
        rows = self._query(
            _UPSERT_MAPPING_SQL,
            (
                erp_source_id, mapping_type, source_value,
                canonical_account_no, target_value, target_label,
                str(tenant_id)
            )
        )
        return rows[0]["mapping_id"] if rows else 0

    def delete_mapping(self, mapping_id: int, tenant_id: uuid.UUID) -> None:
        """Delete a mapping rule by ID (tenant-scoped)."""
        self._query(_DELETE_MAPPING_SQL, (mapping_id, str(tenant_id)))

    def bulk_import(
        self,
        erp_source_id: int,
        mappings: List[Dict],
        tenant_id: uuid.UUID,
    ) -> Dict:
        """Import a list of mapping dicts. Returns {'imported': N}."""
        count = 0
        for m in mappings:
            self.upsert_mapping(
                erp_source_id=erp_source_id,
                mapping_type=m.get("mapping_type", "account"),
                source_value=m["source_value"],
                canonical_account_no=m.get("canonical_account_no"),
                target_value=m.get("target_value"),
                target_label=m.get("target_label"),
                tenant_id=tenant_id,
            )
            count += 1
        return {"imported": count}
