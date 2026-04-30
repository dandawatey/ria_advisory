"""
test_erp_cf_005_incremental_sync.py — TDD tests for IncrementalSyncService
Agent: Vikram_QA_005  |  Ticket: IC-8 / ERP-CF-005
RED phase: all tests must FAIL before implementation.
"""
import pytest
import uuid
from datetime import date, datetime
from decimal import Decimal


def test_imports():
    from services.incremental_sync import IncrementalSyncService
    assert IncrementalSyncService is not None


def test_sync_cursor_import():
    from services.incremental_sync import SyncState
    s = SyncState(erp_source_id=1, last_cursor=None, last_sync_at=None)
    assert s.erp_source_id == 1


def test_instantiation():
    from services.incremental_sync import IncrementalSyncService
    svc = IncrementalSyncService(db_query=None)
    assert svc is not None


def test_get_sync_state_returns_none_for_new_source():
    """New ERP source has no sync state — returns SyncState with None cursor."""
    from services.incremental_sync import IncrementalSyncService

    def fake_query(sql, params=None):
        return []

    svc = IncrementalSyncService(db_query=fake_query)
    state = svc.get_sync_state(erp_source_id=99, tenant_id=uuid.uuid4())
    assert state is not None
    assert state.last_cursor is None


def test_get_sync_state_returns_saved_cursor():
    """Returns last saved cursor from fact_sync_log."""
    from services.incremental_sync import IncrementalSyncService

    def fake_query(sql, params=None):
        return [{"sync_cursor": "2024-01-15T00:00:00", "completed_at": datetime(2024, 1, 15)}]

    svc = IncrementalSyncService(db_query=fake_query)
    state = svc.get_sync_state(erp_source_id=1, tenant_id=uuid.uuid4())
    assert state.last_cursor == "2024-01-15T00:00:00"


def test_build_date_range_full_sync():
    """Full sync (no cursor): from_date=2020-01-01, to_date=today."""
    from services.incremental_sync import IncrementalSyncService

    svc = IncrementalSyncService(db_query=None)
    from_date, to_date = svc.build_date_range(last_cursor=None, default_from=date(2020, 1, 1))
    assert from_date == date(2020, 1, 1)
    assert to_date == date.today()


def test_build_date_range_incremental():
    """Incremental sync: from_date = cursor date, to_date = today."""
    from services.incremental_sync import IncrementalSyncService

    svc = IncrementalSyncService(db_query=None)
    from_date, to_date = svc.build_date_range(
        last_cursor="2024-06-01T00:00:00",
        default_from=date(2020, 1, 1)
    )
    assert from_date == date(2024, 6, 1)
    assert to_date == date.today()


def test_upsert_gl_entry_calls_query():
    """upsert_gl_entry executes INSERT ... ON CONFLICT DO UPDATE."""
    from services.incremental_sync import IncrementalSyncService

    called = []

    def fake_query(sql, params=None):
        called.append(sql)
        return []

    svc = IncrementalSyncService(db_query=fake_query)
    svc.upsert_gl_entry(
        erp_source_id=1,
        entity_id=uuid.uuid4(),
        journal_id="J001",
        line_number="1",
        account_no="4001",
        amount=Decimal("1000.00"),
        currency="AED",
        posting_date=date(2024, 1, 15),
        tenant_id=uuid.uuid4()
    )
    assert len(called) == 1
    assert "ON CONFLICT" in called[0] or "upsert" in called[0].lower() or "INSERT" in called[0]


def test_save_cursor_calls_query():
    """save_cursor writes new cursor to fact_sync_log."""
    from services.incremental_sync import IncrementalSyncService

    called = []

    def fake_query(sql, params=None):
        called.append(sql)
        return []

    svc = IncrementalSyncService(db_query=fake_query)
    svc.save_cursor(
        erp_source_id=1,
        sync_log_id=uuid.uuid4(),
        cursor_value="2024-06-30T23:59:59",
        tenant_id=uuid.uuid4()
    )
    assert len(called) >= 1
