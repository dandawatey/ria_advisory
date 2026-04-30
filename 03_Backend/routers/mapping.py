"""
routers/mapping.py — Field Mapping API endpoints
Agent: Rohan_Backend_003  |  Ticket: IC-16 / ERP-CF-004
Full CRUD for dim_erp_mapping.
Rule 05: tenant_id from JWT on all queries.
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth_utils import require_auth
from database import query
from services.mapping_service import MappingService

router = APIRouter(prefix="/api/erp/mapping", tags=["mapping"])


class MappingUpsert(BaseModel):
    erp_source_id: int
    mapping_type: str
    source_value: str
    canonical_account_no: Optional[str] = None
    target_value: Optional[str] = None
    target_label: Optional[str] = None


class BulkImportItem(BaseModel):
    mapping_type: str
    source_value: str
    canonical_account_no: Optional[str] = None
    target_value: Optional[str] = None
    target_label: Optional[str] = None


@router.get("/{erp_source_id}")
def get_mappings(erp_source_id: int, current: dict = Depends(require_auth)):
    tenant_id = uuid.UUID(current["tenant_id"])
    svc = MappingService(db_query=query)
    return svc.get_mappings(erp_source_id=erp_source_id, tenant_id=tenant_id)


@router.post("", status_code=201)
def upsert_mapping(req: MappingUpsert, current: dict = Depends(require_auth)):
    tenant_id = uuid.UUID(current["tenant_id"])
    svc = MappingService(db_query=query)
    mapping_id = svc.upsert_mapping(
        erp_source_id=req.erp_source_id,
        mapping_type=req.mapping_type,
        source_value=req.source_value,
        tenant_id=tenant_id,
        canonical_account_no=req.canonical_account_no,
        target_value=req.target_value,
        target_label=req.target_label,
    )
    return {"mapping_id": mapping_id}


@router.delete("/{mapping_id}", status_code=204)
def delete_mapping(mapping_id: int, current: dict = Depends(require_auth)):
    tenant_id = uuid.UUID(current["tenant_id"])
    svc = MappingService(db_query=query)
    svc.delete_mapping(mapping_id=mapping_id, tenant_id=tenant_id)


@router.post("/{erp_source_id}/bulk-import")
def bulk_import(
    erp_source_id: int,
    items: List[BulkImportItem],
    current: dict = Depends(require_auth),
):
    tenant_id = uuid.UUID(current["tenant_id"])
    svc = MappingService(db_query=query)
    result = svc.bulk_import(
        erp_source_id=erp_source_id,
        mappings=[m.dict() for m in items],
        tenant_id=tenant_id,
    )
    return result
