"""
test_erp_cf_001_connector_abc.py — TDD tests for ERPConnector ABC
Agent: Vikram_QA_005  |  Ticket: IC-2 / IC-24
RED: all fail before implementation exists
GREEN: all pass after base.py + schemas.py written
"""
import pytest
import inspect
from datetime import date


# ── AC-01: Import works ──────────────────────────────────────────────────────

def test_imports():
    from connectors.base import ERPConnector
    from connectors.schemas import (
        RawGLLine, RawAccount, RawDimension, RawEntity,
        ConnectionStatus, SyncCursor
    )
    assert ERPConnector is not None


# ── AC-02: ABC cannot be instantiated directly ───────────────────────────────

def test_direct_instantiation_raises_type_error():
    from connectors.base import ERPConnector
    with pytest.raises(TypeError):
        ERPConnector()


# ── AC-03: Subclass missing required method raises TypeError ─────────────────

def test_subclass_missing_method_raises():
    from connectors.base import ERPConnector

    class IncompleteConnector(ERPConnector):
        def connect(self, credentials): pass
        def test_connection(self): pass
        def fetch_coa(self): pass
        # fetch_gl_entries MISSING intentionally
        def fetch_dimensions(self): pass
        def fetch_entities(self): pass
        def get_sync_cursor(self): pass

    with pytest.raises(TypeError):
        IncompleteConnector()


# ── AC-04: fetch_gl_entries must be a generator ──────────────────────────────

def test_fetch_gl_entries_is_generator():
    from connectors.base import ERPConnector
    from connectors.schemas import RawGLLine, ConnectionStatus, SyncCursor

    class MinimalConnector(ERPConnector):
        def connect(self, credentials): pass
        def test_connection(self): return ConnectionStatus(status="connected", latency_ms=5)
        def fetch_coa(self): return []
        def fetch_gl_entries(self, from_date, to_date):
            yield RawGLLine(
                journal_id="J1", line_number="1",
                account_code="ACC001", account_name="Test",
                debit_amount=100.0, credit_amount=0.0,
                currency="AED", posting_date=date.today(),
                description="test"
            )
        def fetch_dimensions(self): return []
        def fetch_entities(self): return []
        def get_sync_cursor(self): return SyncCursor(cursor_value=None)

    connector = MinimalConnector()
    result = connector.fetch_gl_entries(date.today(), date.today())
    assert inspect.isgenerator(result), "fetch_gl_entries must return a generator"


# ── AC-05: ConnectionStatus schema validation ─────────────────────────────────

def test_connection_status_valid_values():
    from connectors.schemas import ConnectionStatus
    cs = ConnectionStatus(status="connected", latency_ms=42)
    assert cs.status == "connected"
    assert cs.latency_ms == 42


def test_connection_status_rejects_invalid():
    from connectors.schemas import ConnectionStatus
    with pytest.raises(Exception):
        ConnectionStatus(status="unknown_status")


# ── AC-06: RawGLLine schema fields ────────────────────────────────────────────

def test_raw_gl_line_debit_positive():
    from connectors.schemas import RawGLLine
    line = RawGLLine(
        journal_id="JNL-001",
        line_number="1",
        account_code="1000",
        account_name="Cash",
        debit_amount=500.0,
        credit_amount=0.0,
        currency="USD",
        posting_date=date(2024, 1, 31),
        description="Test entry"
    )
    assert line.debit_amount == 500.0
    assert line.credit_amount == 0.0


def test_raw_gl_line_requires_posting_date():
    from connectors.schemas import RawGLLine
    with pytest.raises(Exception):
        RawGLLine(
            journal_id="J1", line_number="1",
            account_code="1000", account_name="Cash",
            debit_amount=0.0, credit_amount=100.0,
            currency="USD"
            # posting_date MISSING
        )


# ── AC-07: SyncCursor can hold None (fresh sync) ─────────────────────────────

def test_sync_cursor_allows_none():
    from connectors.schemas import SyncCursor
    cursor = SyncCursor(cursor_value=None)
    assert cursor.cursor_value is None


def test_sync_cursor_holds_dict():
    from connectors.schemas import SyncCursor
    cursor = SyncCursor(cursor_value={"last_modified": "2024-01-31T00:00:00Z"})
    assert cursor.cursor_value["last_modified"] == "2024-01-31T00:00:00Z"


# ── AC-08: All 7 abstract methods declared ───────────────────────────────────

def test_all_abstract_methods_declared():
    from connectors.base import ERPConnector
    required = {
        "connect", "test_connection", "fetch_coa",
        "fetch_gl_entries", "fetch_dimensions",
        "fetch_entities", "get_sync_cursor"
    }
    abstract = {
        name for name, method in inspect.getmembers(ERPConnector, predicate=inspect.isfunction)
        if getattr(method, "__isabstractmethod__", False)
    }
    assert required == abstract, f"Missing abstract methods: {required - abstract}"
