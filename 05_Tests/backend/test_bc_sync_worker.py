"""
test_bc_sync_worker.py — TDD tests for BC Scheduled Sync Worker
Agent: Vikram_QA_005  |  Ticket: IC-40
RED phase: all tests must FAIL before implementation exists.

Run: pytest 05_Tests/backend/test_bc_sync_worker.py
"""
import pytest
import uuid
from datetime import date
from unittest.mock import patch, MagicMock, call


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_query():
    """Reusable fake DB query callable — returns [] by default."""
    return MagicMock(return_value=[])


@pytest.fixture
def active_bc_source():
    """One active BC source row as returned by the DB join query."""
    return {
        "erp_source_id": 1,
        "tenant_id": str(uuid.uuid4()),
        "bc_tenant_id": "contoso-bc-tenant-id",
        "client_id": "app-client-id",
        "client_secret": "s3cr3t",
        "company_id": "CRONUS",
        "environment": "production",
        "is_active": True,
    }


@pytest.fixture
def three_gl_rows():
    """Three minimal GL entry dicts from BC OData."""
    return {
        "value": [
            {
                "id": "row-1",
                "journalEntryNo": "G00001",
                "lineNumber": 1,
                "accountNumber": "4001",
                "amount": 1000.00,
                "creditAmount": 0.0,
                "debitAmount": 1000.00,
                "currencyCode": "AED",
                "postingDate": "2026-03-15",
                "description": "Test entry A",
            },
            {
                "id": "row-2",
                "journalEntryNo": "G00001",
                "lineNumber": 2,
                "accountNumber": "1001",
                "amount": -1000.00,
                "creditAmount": 1000.00,
                "debitAmount": 0.0,
                "currencyCode": "AED",
                "postingDate": "2026-03-15",
                "description": "Test entry B",
            },
            {
                "id": "row-3",
                "journalEntryNo": "G00002",
                "lineNumber": 1,
                "accountNumber": "6001",
                "amount": 500.00,
                "creditAmount": 0.0,
                "debitAmount": 500.00,
                "currencyCode": "USD",
                "postingDate": "2026-03-20",
                "description": "Test entry C",
            },
        ]
    }


# ---------------------------------------------------------------------------
# 1. Scheduler start / stop
# ---------------------------------------------------------------------------

def test_start_stop_scheduler():
    """Scheduler starts without error, has exactly 1 job, stops cleanly."""
    from workers.bc_sync_worker import start_scheduler, stop_scheduler

    scheduler = start_scheduler(interval_minutes=15)
    try:
        jobs = scheduler.get_jobs()
        assert len(jobs) == 1, f"Expected 1 job, got {len(jobs)}"
    finally:
        stop_scheduler(scheduler)
        assert not scheduler.running, "Scheduler should not be running after stop"


# ---------------------------------------------------------------------------
# 2. run_bc_sync with no sources
# ---------------------------------------------------------------------------

def test_run_bc_sync_no_sources(mock_query):
    """No active BC sources → run completes silently, no sync_log writes."""
    mock_query.return_value = []

    with patch("workers.bc_sync_worker.query", mock_query):
        from workers.bc_sync_worker import run_bc_sync
        run_bc_sync()  # must not raise

    # Confirm no INSERT into fact_sync_log occurred
    sql_calls = [str(c) for c in mock_query.call_args_list]
    sync_log_inserts = [c for c in sql_calls if "fact_sync_log" in c and "INSERT" in c.upper()]
    assert len(sync_log_inserts) == 0, "Should not write sync_log for empty source list"


# ---------------------------------------------------------------------------
# 3. OAuth failure → fact_sync_log status='failed'
# ---------------------------------------------------------------------------

def test_sync_one_source_auth_failure(active_bc_source):
    """OAuth POST returns 401 → fact_sync_log updated with status='failed', error_msg has 'Auth'."""
    sync_log_calls = []

    def fake_query(sql, params=None):
        sql_upper = sql.upper()
        if "fact_sync_log" in sql.lower():
            sync_log_calls.append({"sql": sql, "params": params})
        # Return sync_log_id on initial INSERT
        if "INSERT" in sql_upper and "fact_sync_log" in sql.lower():
            return [{"sync_id": str(uuid.uuid4())}]
        return []

    mock_oauth_response = MagicMock()
    mock_oauth_response.status_code = 401
    mock_oauth_response.json.return_value = {"error": "unauthorized_client"}
    mock_oauth_response.text = "401 Unauthorized"

    with patch("workers.bc_sync_worker.query", fake_query), \
         patch("httpx.post", return_value=mock_oauth_response):
        from workers.bc_sync_worker import _sync_one_source
        _sync_one_source(active_bc_source)

    # Must have at least one UPDATE/INSERT on fact_sync_log with status=failed
    failed_updates = [
        c for c in sync_log_calls
        if "failed" in str(c.get("params", "")).lower()
        or "failed" in str(c.get("sql", "")).lower()
    ]
    assert len(failed_updates) >= 1, "Expected fact_sync_log status='failed' on auth error"

    # error_msg must mention Auth
    all_param_strs = " ".join(str(c.get("params", "")) for c in sync_log_calls)
    assert "auth" in all_param_strs.lower() or "Auth" in all_param_strs, \
        "error_msg should contain 'Auth' keyword"


# ---------------------------------------------------------------------------
# 4. Successful sync → status='completed', rows_fetched=3
# ---------------------------------------------------------------------------

def test_sync_one_source_success(active_bc_source, three_gl_rows):
    """Full happy-path: OAuth OK + 3 GL rows → status='completed', rows_fetched=3."""
    sync_log_params = []

    def fake_query(sql, params=None):
        if "INSERT" in sql.upper() and "fact_sync_log" in sql.lower():
            sync_log_params.append(("insert", params))
            return [{"sync_id": str(uuid.uuid4())}]
        if "UPDATE" in sql.upper() and "fact_sync_log" in sql.lower():
            sync_log_params.append(("update", params))
        # watermark query
        if "SELECT" in sql.upper() and "fact_sync_log" in sql.lower():
            return []
        return []

    mock_oauth = MagicMock()
    mock_oauth.status_code = 200
    mock_oauth.json.return_value = {"access_token": "tok123", "token_type": "Bearer"}

    mock_odata = MagicMock()
    mock_odata.status_code = 200
    mock_odata.json.return_value = three_gl_rows

    with patch("workers.bc_sync_worker.query", fake_query), \
         patch("httpx.post", return_value=mock_oauth), \
         patch("httpx.get", return_value=mock_odata):
        from workers.bc_sync_worker import _sync_one_source
        _sync_one_source(active_bc_source)

    # Verify completed status in one of the sync_log calls
    all_params_str = " ".join(str(p) for _, p in sync_log_params)
    assert "completed" in all_params_str.lower(), \
        "fact_sync_log should contain status='completed'"

    # Verify rows_fetched = 3
    assert "3" in all_params_str or 3 in [
        v for _, p in sync_log_params if p for v in (p.values() if isinstance(p, dict) else p)
    ], "rows_fetched should be 3"


# ---------------------------------------------------------------------------
# 5. Idempotent upsert — no duplicate rows on second run
# ---------------------------------------------------------------------------

def test_sync_idempotent_upsert(active_bc_source, three_gl_rows):
    """Second sync run with same data must use ON CONFLICT upsert — no duplicates."""
    upsert_sqls = []

    def fake_query(sql, params=None):
        if "ON CONFLICT" in sql.upper():
            upsert_sqls.append(sql)
        if "INSERT" in sql.upper() and "fact_sync_log" in sql.lower():
            return [{"sync_id": str(uuid.uuid4())}]
        return []

    mock_oauth = MagicMock()
    mock_oauth.status_code = 200
    mock_oauth.json.return_value = {"access_token": "tok123", "token_type": "Bearer"}

    mock_odata = MagicMock()
    mock_odata.status_code = 200
    mock_odata.json.return_value = three_gl_rows

    with patch("workers.bc_sync_worker.query", fake_query), \
         patch("httpx.post", return_value=mock_oauth), \
         patch("httpx.get", return_value=mock_odata):
        from workers.bc_sync_worker import _sync_one_source
        _sync_one_source(active_bc_source)
        _sync_one_source(active_bc_source)  # second run

    # ON CONFLICT must appear in upsert calls (both runs)
    assert len(upsert_sqls) >= 3, \
        "Expected ON CONFLICT upsert SQL for each GL row (3+ calls per run)"
    for sql in upsert_sqls:
        assert "ON CONFLICT" in sql.upper(), f"Missing ON CONFLICT in: {sql[:80]}"


# ---------------------------------------------------------------------------
# 6. Watermark incremental — filter includes postingDate ge <watermark>
# ---------------------------------------------------------------------------

def test_watermark_incremental(active_bc_source, three_gl_rows):
    """Previous sync watermark_to='2026-04-01' → OData request includes postingDate ge 2026-04-01."""
    odata_urls = []

    def fake_query(sql, params=None):
        if "SELECT" in sql.upper() and "fact_sync_log" in sql.lower():
            # Return a previous completed run — key matches worker's _WATERMARK_SQL alias
            from datetime import datetime, timezone
            return [{"last_watermark": datetime(2026, 4, 1, tzinfo=timezone.utc)}]
        if "INSERT" in sql.upper() and "fact_sync_log" in sql.lower():
            return [{"sync_id": str(uuid.uuid4())}]
        return []

    mock_oauth = MagicMock()
    mock_oauth.status_code = 200
    mock_oauth.json.return_value = {"access_token": "tok123", "token_type": "Bearer"}

    def mock_get(url, **kwargs):
        odata_urls.append(url)
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = three_gl_rows
        return resp

    with patch("workers.bc_sync_worker.query", fake_query), \
         patch("httpx.post", return_value=mock_oauth), \
         patch("httpx.get", side_effect=mock_get):
        from workers.bc_sync_worker import _sync_one_source
        _sync_one_source(active_bc_source)

    assert len(odata_urls) >= 1, "Expected at least one OData GET call"
    combined = " ".join(odata_urls)
    assert "2026-04-01" in combined, \
        f"OData URL should contain watermark date '2026-04-01'. Got: {combined[:300]}"
    assert "postingDate" in combined or "posting_date" in combined.lower(), \
        f"OData URL should filter on postingDate. Got: {combined[:300]}"


# ---------------------------------------------------------------------------
# 7. Network error → fact_sync_log status='failed'
# ---------------------------------------------------------------------------

def test_sync_one_source_network_error(active_bc_source):
    """httpx raises ConnectionError → fact_sync_log updated with status='failed'."""
    sync_log_calls = []

    def fake_query(sql, params=None):
        if "fact_sync_log" in sql.lower():
            sync_log_calls.append({"sql": sql, "params": params})
        if "INSERT" in sql.upper() and "fact_sync_log" in sql.lower():
            return [{"sync_id": str(uuid.uuid4())}]
        return []

    with patch("workers.bc_sync_worker.query", fake_query), \
         patch("httpx.post", side_effect=ConnectionError("Connection refused")):
        from workers.bc_sync_worker import _sync_one_source
        _sync_one_source(active_bc_source)  # must NOT raise — worker handles error gracefully

    failed_entries = [
        c for c in sync_log_calls
        if "failed" in str(c.get("params", "")).lower()
        or "failed" in str(c.get("sql", "")).lower()
    ]
    assert len(failed_entries) >= 1, \
        "Expected fact_sync_log status='failed' on network ConnectionError"
