"""
test_erp_sp_001_scheduler.py — TDD tests for SyncSchedulerService
Agent: Vikram_QA_005  |  Ticket: IC-14 / ERP-SP-001
RED phase.
"""
import pytest
import uuid


def test_imports():
    from services.sync_scheduler import SyncSchedulerService
    assert SyncSchedulerService is not None


def test_schedule_config_import():
    from services.sync_scheduler import ScheduleConfig
    sc = ScheduleConfig(erp_source_id=1, cron_expression="0 2 * * *", is_enabled=True, tenant_id=uuid.uuid4())
    assert sc.cron_expression == "0 2 * * *"


def test_instantiation():
    from services.sync_scheduler import SyncSchedulerService
    svc = SyncSchedulerService(db_query=None)
    assert svc is not None


def test_save_schedule_calls_upsert():
    """save_schedule writes schedule config to dim_erp_source."""
    from services.sync_scheduler import SyncSchedulerService, ScheduleConfig

    called = []

    def fake_query(sql, params=None):
        called.append(sql)
        return []

    svc = SyncSchedulerService(db_query=fake_query)
    svc.save_schedule(ScheduleConfig(
        erp_source_id=1,
        cron_expression="0 2 * * *",
        is_enabled=True,
        tenant_id=uuid.uuid4()
    ))
    assert len(called) >= 1
    assert any("UPDATE" in s or "INSERT" in s for s in called)


def test_get_enabled_schedules_returns_list():
    """get_enabled_schedules returns all active schedules."""
    from services.sync_scheduler import SyncSchedulerService

    def fake_query(sql, params=None):
        return [
            {"erp_source_id": 1, "sync_schedule": "0 2 * * *", "tenant_id": str(uuid.uuid4())},
            {"erp_source_id": 2, "sync_schedule": "0 6 * * *", "tenant_id": str(uuid.uuid4())},
        ]

    svc = SyncSchedulerService(db_query=fake_query)
    schedules = svc.get_enabled_schedules()
    assert isinstance(schedules, list)
    assert len(schedules) == 2


def test_is_due_cron_expression():
    """is_due returns True when cron expression matches current time."""
    from services.sync_scheduler import SyncSchedulerService
    from datetime import datetime

    svc = SyncSchedulerService(db_query=None)
    # "* * * * *" = every minute — always due
    assert svc.is_due("* * * * *", at=datetime(2024, 6, 1, 2, 0)) is True


def test_is_due_cron_specific_hour():
    """is_due returns False when hour doesn't match."""
    from services.sync_scheduler import SyncSchedulerService
    from datetime import datetime

    svc = SyncSchedulerService(db_query=None)
    # "0 3 * * *" = 3am — check at 2am should be False
    assert svc.is_due("0 3 * * *", at=datetime(2024, 6, 1, 2, 0)) is False


def test_parse_cron_invalid_raises():
    """Invalid cron expression raises ValueError."""
    from services.sync_scheduler import SyncSchedulerService

    svc = SyncSchedulerService(db_query=None)
    with pytest.raises(ValueError):
        svc.is_due("not-a-cron", at=None)
