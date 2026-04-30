"""
test_erp_ds_004_freshness.py — TDD tests for DataFreshnessService
Agent: Vikram_QA_005  |  Ticket: IC-17 / ERP-DS-004
RED phase.
"""
import pytest
import uuid
from datetime import datetime, timedelta


def test_imports():
    from services.freshness_service import DataFreshnessService
    assert DataFreshnessService is not None


def test_freshness_status_import():
    from services.freshness_service import FreshnessStatus
    fs = FreshnessStatus(
        erp_source_id=1,
        erp_name="Business Central",
        status="fresh",
        last_sync_at=datetime.utcnow(),
        hours_stale=0.5
    )
    assert fs.status == "fresh"


def test_instantiation():
    from services.freshness_service import DataFreshnessService
    svc = DataFreshnessService(db_query=None)
    assert svc is not None


def test_get_freshness_returns_list():
    """get_freshness returns FreshnessStatus list for given ERP source IDs."""
    from services.freshness_service import DataFreshnessService

    now = datetime.utcnow()

    def fake_query(sql, params=None):
        return [
            {"erp_source_id": 1, "erp_name": "BC", "last_completed_at": now - timedelta(hours=1)},
            {"erp_source_id": 2, "erp_name": "SAP", "last_completed_at": now - timedelta(hours=25)},
        ]

    svc = DataFreshnessService(db_query=fake_query)
    result = svc.get_freshness(erp_source_ids=[1, 2], tenant_id=uuid.uuid4())
    assert isinstance(result, list)
    assert len(result) == 2


def test_freshness_status_fresh():
    """Status is 'fresh' when last sync < 24 hours ago."""
    from services.freshness_service import DataFreshnessService

    now = datetime.utcnow()

    def fake_query(sql, params=None):
        return [{"erp_source_id": 1, "erp_name": "BC", "last_completed_at": now - timedelta(hours=2)}]

    svc = DataFreshnessService(db_query=fake_query)
    result = svc.get_freshness(erp_source_ids=[1], tenant_id=uuid.uuid4())
    assert result[0].status == "fresh"


def test_freshness_status_stale():
    """Status is 'stale' when last sync > 24 hours ago."""
    from services.freshness_service import DataFreshnessService

    now = datetime.utcnow()

    def fake_query(sql, params=None):
        return [{"erp_source_id": 1, "erp_name": "BC", "last_completed_at": now - timedelta(hours=30)}]

    svc = DataFreshnessService(db_query=fake_query)
    result = svc.get_freshness(erp_source_ids=[1], tenant_id=uuid.uuid4())
    assert result[0].status == "stale"


def test_freshness_status_never_synced():
    """Status is 'never_synced' when no completed sync exists."""
    from services.freshness_service import DataFreshnessService

    def fake_query(sql, params=None):
        return [{"erp_source_id": 1, "erp_name": "BC", "last_completed_at": None}]

    svc = DataFreshnessService(db_query=fake_query)
    result = svc.get_freshness(erp_source_ids=[1], tenant_id=uuid.uuid4())
    assert result[0].status == "never_synced"


def test_freshness_hours_stale_calculation():
    """hours_stale is calculated correctly from last_completed_at."""
    from services.freshness_service import DataFreshnessService

    now = datetime.utcnow()
    last_sync = now - timedelta(hours=5, minutes=30)

    def fake_query(sql, params=None):
        return [{"erp_source_id": 1, "erp_name": "BC", "last_completed_at": last_sync}]

    svc = DataFreshnessService(db_query=fake_query)
    result = svc.get_freshness(erp_source_ids=[1], tenant_id=uuid.uuid4())
    assert 5.4 < result[0].hours_stale < 5.6


def test_freshness_passes_tenant_id():
    """get_freshness passes tenant_id (Rule 05)."""
    from services.freshness_service import DataFreshnessService

    captured = []

    def fake_query(sql, params=None):
        if params:
            captured.extend(list(params) if isinstance(params, (list, tuple)) else [params])
        return []

    TENANT = uuid.uuid4()
    svc = DataFreshnessService(db_query=fake_query)
    svc.get_freshness(erp_source_ids=[1, 2], tenant_id=TENANT)

    all_str = [str(p) for p in captured]
    assert any(str(TENANT) in s for s in all_str)
