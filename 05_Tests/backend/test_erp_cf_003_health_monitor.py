"""
test_erp_cf_003_health_monitor.py — TDD tests for ConnectionHealthMonitor
Agent: Vikram_QA_005  |  Ticket: IC-15 / ERP-CF-003
RED phase.
"""
import pytest
import uuid
from datetime import datetime


def test_imports():
    from services.health_monitor import ConnectionHealthMonitor
    assert ConnectionHealthMonitor is not None


def test_health_snapshot_import():
    from services.health_monitor import HealthSnapshot
    snap = HealthSnapshot(erp_source_id=1, status="connected", latency_ms=45, checked_at=datetime.utcnow())
    assert snap.status == "connected"


def test_instantiation():
    from services.health_monitor import ConnectionHealthMonitor
    mon = ConnectionHealthMonitor(db_query=None)
    assert mon is not None


def test_record_health_calls_insert():
    """record_health writes to fact_connector_health_log."""
    from services.health_monitor import ConnectionHealthMonitor, HealthSnapshot

    sqls = []

    def fake_query(sql, params=None):
        sqls.append(sql)
        return []

    mon = ConnectionHealthMonitor(db_query=fake_query)
    mon.record_health(HealthSnapshot(
        erp_source_id=1,
        status="connected",
        latency_ms=42,
        checked_at=datetime.utcnow(),
    ), tenant_id=uuid.uuid4())

    assert any("fact_connector_health_log" in s for s in sqls)
    assert any("INSERT" in s for s in sqls)


def test_get_latest_health_returns_snapshot():
    """get_latest_health returns most recent snapshot for ERP source."""
    from services.health_monitor import ConnectionHealthMonitor, HealthSnapshot

    def fake_query(sql, params=None):
        return [{"erp_source_id": 1, "status": "connected", "latency_ms": 50, "checked_at": datetime.utcnow(), "error_message": None}]

    mon = ConnectionHealthMonitor(db_query=fake_query)
    snap = mon.get_latest_health(erp_source_id=1, tenant_id=uuid.uuid4())
    assert isinstance(snap, HealthSnapshot)
    assert snap.status == "connected"


def test_get_latest_health_returns_none_when_no_data():
    """Returns None when no health record exists for ERP source."""
    from services.health_monitor import ConnectionHealthMonitor

    def fake_query(sql, params=None):
        return []

    mon = ConnectionHealthMonitor(db_query=fake_query)
    snap = mon.get_latest_health(erp_source_id=99, tenant_id=uuid.uuid4())
    assert snap is None


def test_is_degraded_threshold():
    """is_degraded returns True when latency > 5000ms or status != connected."""
    from services.health_monitor import ConnectionHealthMonitor, HealthSnapshot

    mon = ConnectionHealthMonitor(db_query=None)
    high_latency = HealthSnapshot(erp_source_id=1, status="connected", latency_ms=6000, checked_at=datetime.utcnow())
    assert mon.is_degraded(high_latency) is True

    auth_expired = HealthSnapshot(erp_source_id=1, status="auth_expired", latency_ms=100, checked_at=datetime.utcnow())
    assert mon.is_degraded(auth_expired) is True

    healthy = HealthSnapshot(erp_source_id=1, status="connected", latency_ms=200, checked_at=datetime.utcnow())
    assert mon.is_degraded(healthy) is False


def test_health_passes_tenant_id():
    """All queries pass tenant_id (Rule 05)."""
    from services.health_monitor import ConnectionHealthMonitor

    captured = []

    def fake_query(sql, params=None):
        if params:
            captured.extend(list(params) if isinstance(params, (list, tuple)) else [params])
        return []

    TENANT = uuid.uuid4()
    mon = ConnectionHealthMonitor(db_query=fake_query)
    mon.get_latest_health(erp_source_id=1, tenant_id=TENANT)

    all_str = [str(p) for p in captured]
    assert any(str(TENANT) in s for s in all_str)
