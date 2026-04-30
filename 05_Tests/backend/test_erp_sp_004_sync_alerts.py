"""
test_erp_sp_004_sync_alerts.py — TDD tests for SyncAlertService + RetryPolicy
Agent: Vikram_QA_005  |  Ticket: IC-10 / ERP-SP-004
RED phase: all tests must FAIL before implementation.
"""
import pytest
import uuid
from datetime import datetime


def test_imports():
    from services.sync_alerts import SyncAlertService
    assert SyncAlertService is not None


def test_retry_policy_import():
    from services.sync_alerts import RetryPolicy
    rp = RetryPolicy(max_retries=3, backoff_base_seconds=60)
    assert rp.max_retries == 3
    assert rp.backoff_base_seconds == 60


def test_instantiation():
    from services.sync_alerts import SyncAlertService
    svc = SyncAlertService(db_query=None)
    assert svc is not None


def test_should_retry_timeout_error():
    """ConnectorTimeoutError → should retry."""
    from services.sync_alerts import SyncAlertService, RetryPolicy
    from connectors.base import ConnectorTimeoutError

    svc = SyncAlertService(db_query=None)
    policy = RetryPolicy(max_retries=3, backoff_base_seconds=30)
    assert svc.should_retry(ConnectorTimeoutError("timeout"), attempt=1, policy=policy) is True


def test_should_retry_auth_error_never():
    """ConnectorAuthError → never retry."""
    from services.sync_alerts import SyncAlertService, RetryPolicy
    from connectors.base import ConnectorAuthError

    svc = SyncAlertService(db_query=None)
    policy = RetryPolicy(max_retries=3, backoff_base_seconds=30)
    assert svc.should_retry(ConnectorAuthError("bad creds"), attempt=1, policy=policy) is False


def test_should_retry_max_exceeded():
    """After max_retries exhausted → no more retries."""
    from services.sync_alerts import SyncAlertService, RetryPolicy
    from connectors.base import ConnectorTimeoutError

    svc = SyncAlertService(db_query=None)
    policy = RetryPolicy(max_retries=3, backoff_base_seconds=30)
    assert svc.should_retry(ConnectorTimeoutError("timeout"), attempt=4, policy=policy) is False


def test_backoff_seconds_exponential():
    """Backoff is exponential: base * 2^(attempt-1)."""
    from services.sync_alerts import SyncAlertService, RetryPolicy

    svc = SyncAlertService(db_query=None)
    policy = RetryPolicy(max_retries=5, backoff_base_seconds=30)
    assert svc.get_backoff_seconds(attempt=1, policy=policy) == 30
    assert svc.get_backoff_seconds(attempt=2, policy=policy) == 60
    assert svc.get_backoff_seconds(attempt=3, policy=policy) == 120


def test_rate_limit_uses_retry_after():
    """ConnectorRateLimitError: backoff = retry_after_seconds from exception."""
    from services.sync_alerts import SyncAlertService, RetryPolicy
    from connectors.base import ConnectorRateLimitError

    svc = SyncAlertService(db_query=None)
    policy = RetryPolicy(max_retries=3, backoff_base_seconds=30)
    err = ConnectorRateLimitError("rate limit", retry_after_seconds=120)
    backoff = svc.get_backoff_seconds(attempt=1, policy=policy, error=err)
    assert backoff == 120


def test_log_alert_calls_insert():
    """log_alert inserts into fact_connector_alerts."""
    from services.sync_alerts import SyncAlertService

    sqls = []

    def fake_query(sql, params=None):
        sqls.append(sql)
        return [{"alert_id": str(uuid.uuid4())}]

    svc = SyncAlertService(db_query=fake_query)
    svc.log_alert(
        erp_source_id=1,
        alert_type="sync_failed",
        message="Connector timeout after 3 retries",
        tenant_id=uuid.uuid4()
    )
    assert any("fact_connector_alerts" in sql for sql in sqls)
    assert any("INSERT" in sql for sql in sqls)


def test_get_pending_alerts_returns_list():
    """get_pending_alerts returns unresolved alerts for an ERP source."""
    from services.sync_alerts import SyncAlertService

    def fake_query(sql, params=None):
        return [{"alert_id": str(uuid.uuid4()), "alert_type": "sync_failed", "message": "err"}]

    svc = SyncAlertService(db_query=fake_query)
    alerts = svc.get_pending_alerts(erp_source_id=1, tenant_id=uuid.uuid4())
    assert isinstance(alerts, list)
    assert len(alerts) == 1
