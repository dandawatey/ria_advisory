"""
test_erp_cf_004_field_mapping.py — TDD tests for Field Mapping API
Agent: Vikram_QA_005  |  Ticket: IC-16 / ERP-CF-004
RED phase.
"""
import pytest
import uuid


def test_imports():
    from routers.mapping import router
    assert router is not None


def test_mapping_service_import():
    from services.mapping_service import MappingService
    assert MappingService is not None


def test_mapping_service_instantiation():
    from services.mapping_service import MappingService
    svc = MappingService(db_query=None)
    assert svc is not None


def test_get_mappings_returns_list():
    """get_mappings returns all mappings for an ERP source."""
    from services.mapping_service import MappingService

    def fake_query(sql, params=None):
        return [
            {"mapping_id": 1, "erp_source_id": 1, "mapping_type": "account",
             "source_value": "4001", "canonical_account_no": "REV.001", "tenant_id": str(uuid.uuid4())}
        ]

    svc = MappingService(db_query=fake_query)
    mappings = svc.get_mappings(erp_source_id=1, tenant_id=uuid.uuid4())
    assert isinstance(mappings, list)
    assert len(mappings) == 1
    assert mappings[0]["source_value"] == "4001"


def test_upsert_mapping_calls_insert():
    """upsert_mapping inserts or updates a mapping rule."""
    from services.mapping_service import MappingService

    called = []

    def fake_query(sql, params=None):
        called.append(sql.upper())
        return [{"mapping_id": 1}]

    svc = MappingService(db_query=fake_query)
    svc.upsert_mapping(
        erp_source_id=1,
        mapping_type="account",
        source_value="4001",
        canonical_account_no="REV.001",
        tenant_id=uuid.uuid4()
    )
    assert any("INSERT" in s or "UPDATE" in s for s in called)


def test_delete_mapping_calls_delete():
    """delete_mapping removes mapping by ID."""
    from services.mapping_service import MappingService

    called = []

    def fake_query(sql, params=None):
        called.append(sql.upper())
        return []

    svc = MappingService(db_query=fake_query)
    svc.delete_mapping(mapping_id=1, tenant_id=uuid.uuid4())
    assert any("DELETE" in s for s in called)


def test_mapping_passes_tenant_id():
    """All queries pass tenant_id (Rule 05)."""
    from services.mapping_service import MappingService

    captured = []

    def fake_query(sql, params=None):
        if params:
            captured.extend(list(params) if isinstance(params, (list, tuple)) else [params])
        return []

    TENANT = uuid.uuid4()
    svc = MappingService(db_query=fake_query)
    svc.get_mappings(erp_source_id=1, tenant_id=TENANT)

    all_str = [str(p) for p in captured]
    assert any(str(TENANT) in s for s in all_str)


def test_bulk_import_mappings():
    """bulk_import processes a list of mapping rules."""
    from services.mapping_service import MappingService

    call_count = {"n": 0}

    def fake_query(sql, params=None):
        call_count["n"] += 1
        return [{"mapping_id": call_count["n"]}]

    svc = MappingService(db_query=fake_query)
    result = svc.bulk_import(
        erp_source_id=1,
        mappings=[
            {"mapping_type": "account", "source_value": "4001", "canonical_account_no": "REV.001"},
            {"mapping_type": "account", "source_value": "5001", "canonical_account_no": "COGS.001"},
        ],
        tenant_id=uuid.uuid4()
    )
    assert result["imported"] == 2
