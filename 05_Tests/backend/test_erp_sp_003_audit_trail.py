"""
test_erp_sp_003_audit_trail.py — TDD tests for AuditTrailService
Agent: Vikram_QA_005  |  Ticket: IC-9 / ERP-SP-003
RED phase: all tests must FAIL before implementation.
"""
import pytest
import uuid
from datetime import datetime


def test_imports():
    from services.audit_trail import AuditTrailService
    assert AuditTrailService is not None


def test_audit_event_import():
    from services.audit_trail import AuditEvent
    ev = AuditEvent(
        event_type="sync_started",
        actor="system",
        resource_type="erp_source",
        resource_id="1",
        tenant_id=uuid.uuid4()
    )
    assert ev.event_type == "sync_started"


def test_instantiation():
    from services.audit_trail import AuditTrailService
    svc = AuditTrailService(db_query=None)
    assert svc is not None


def test_log_event_calls_insert():
    """log_event inserts into fact_audit_log."""
    from services.audit_trail import AuditTrailService, AuditEvent

    called = []

    def fake_query(sql, params=None):
        called.append(sql.upper())
        return [{"audit_log_id": str(uuid.uuid4())}]

    svc = AuditTrailService(db_query=fake_query)
    ev = AuditEvent(
        event_type="sync_started",
        actor="system",
        resource_type="erp_source",
        resource_id="1",
        tenant_id=uuid.uuid4()
    )
    audit_id = svc.log_event(ev)
    assert audit_id is not None
    assert any("INSERT" in sql for sql in called)


def test_log_event_uses_fact_audit_log():
    """log_event targets fact_audit_log table."""
    from services.audit_trail import AuditTrailService, AuditEvent

    sqls = []

    def fake_query(sql, params=None):
        sqls.append(sql)
        return [{"audit_log_id": str(uuid.uuid4())}]

    svc = AuditTrailService(db_query=fake_query)
    svc.log_event(AuditEvent(
        event_type="mapping_updated",
        actor="Ananya",
        resource_type="dim_erp_mapping",
        resource_id="42",
        tenant_id=uuid.uuid4()
    ))
    assert any("fact_audit_log" in sql for sql in sqls)


def test_log_event_passes_tenant_id():
    """log_event passes tenant_id in params (Rule 05 multi-tenant)."""
    from services.audit_trail import AuditTrailService, AuditEvent

    captured_params = []

    def fake_query(sql, params=None):
        if params:
            captured_params.extend(list(params) if isinstance(params, (list, tuple)) else [params])
        return [{"audit_log_id": str(uuid.uuid4())}]

    TENANT = uuid.uuid4()
    svc = AuditTrailService(db_query=fake_query)
    svc.log_event(AuditEvent(
        event_type="sync_completed",
        actor="system",
        resource_type="erp_source",
        resource_id="1",
        tenant_id=TENANT
    ))
    all_str = [str(p) for p in captured_params]
    assert any(str(TENANT) in s for s in all_str)


def test_get_audit_log_returns_list():
    """get_audit_log returns list of AuditEvent for resource."""
    from services.audit_trail import AuditTrailService

    def fake_query(sql, params=None):
        return [
            {
                "audit_log_id": str(uuid.uuid4()),
                "event_type": "sync_started",
                "actor": "system",
                "resource_type": "erp_source",
                "resource_id": "1",
                "tenant_id": str(uuid.uuid4()),
                "occurred_at": datetime.utcnow(),
                "details": None
            }
        ]

    svc = AuditTrailService(db_query=fake_query)
    log = svc.get_audit_log(
        resource_type="erp_source",
        resource_id="1",
        tenant_id=uuid.uuid4()
    )
    assert isinstance(log, list)
    assert len(log) == 1
    assert log[0].event_type == "sync_started"


def test_audit_log_no_delete():
    """AuditTrailService has no delete method — immutable table (Rule 06)."""
    from services.audit_trail import AuditTrailService
    svc = AuditTrailService(db_query=None)
    assert not hasattr(svc, "delete_event")
    assert not hasattr(svc, "delete")
