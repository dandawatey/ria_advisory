"""
test_erp_dn_001_currency.py — TDD tests for CurrencyService
Agent: Vikram_QA_005  |  Ticket: IC-4 / ERP-DN-001
RED phase: all tests must FAIL before implementation is written.
"""
import pytest
from decimal import Decimal
from datetime import date


# ── Import test ───────────────────────────────────────────────────────────────

def test_imports():
    """CurrencyService must be importable from services.currency."""
    from services.currency import CurrencyService
    assert CurrencyService is not None


def test_instantiation():
    """CurrencyService instantiates with a DB connection factory."""
    from services.currency import CurrencyService
    svc = CurrencyService(db_query=None)
    assert svc is not None


# ── make_ref / rate_types ─────────────────────────────────────────────────────

def test_rate_type_constants():
    """IFRS 21 rate type constants must be defined."""
    from services.currency import RATE_SPOT, RATE_AVERAGE, RATE_CLOSING
    assert RATE_SPOT == "spot"
    assert RATE_AVERAGE == "average"
    assert RATE_CLOSING == "closing"


# ── get_rate — direct pair ────────────────────────────────────────────────────

def test_get_rate_direct_pair(monkeypatch):
    """get_rate returns Decimal when direct pair found in dim_exchange_rate."""
    from services.currency import CurrencyService

    def fake_query(sql, params=None):
        return [{"rate": Decimal("3.67")}]

    svc = CurrencyService(db_query=fake_query)
    rate = svc.get_rate("USD", "AED", date(2024, 1, 15), "spot")
    assert rate == Decimal("3.67")


def test_get_rate_returns_none_when_missing(monkeypatch):
    """get_rate returns None when pair not found and no cross-rate possible."""
    from services.currency import CurrencyService

    def fake_query(sql, params=None):
        return []

    svc = CurrencyService(db_query=fake_query)
    rate = svc.get_rate("XYZ", "ABC", date(2024, 1, 15), "spot")
    assert rate is None


def test_get_rate_same_currency():
    """get_rate returns 1.0 for same-currency pairs (no DB hit needed)."""
    from services.currency import CurrencyService

    call_count = {"n": 0}

    def fake_query(sql, params=None):
        call_count["n"] += 1
        return []

    svc = CurrencyService(db_query=fake_query)
    rate = svc.get_rate("USD", "USD", date(2024, 1, 15), "spot")
    assert rate == Decimal("1")
    assert call_count["n"] == 0  # No DB hit for same-currency


# ── convert ───────────────────────────────────────────────────────────────────

def test_convert_applies_rate(monkeypatch):
    """convert multiplies amount by retrieved rate."""
    from services.currency import CurrencyService

    def fake_query(sql, params=None):
        return [{"rate": Decimal("3.67")}]

    svc = CurrencyService(db_query=fake_query)
    result = svc.convert(Decimal("1000.00"), "USD", "AED", date(2024, 1, 15), "spot")
    assert result == Decimal("3670.00")


def test_convert_same_currency_no_change():
    """convert returns same amount for same-currency (no rate lookup)."""
    from services.currency import CurrencyService

    svc = CurrencyService(db_query=None)
    result = svc.convert(Decimal("500.00"), "AED", "AED", date(2024, 1, 15), "spot")
    assert result == Decimal("500.00")


def test_convert_returns_none_when_rate_missing():
    """convert returns None when rate not found."""
    from services.currency import CurrencyService

    def fake_query(sql, params=None):
        return []

    svc = CurrencyService(db_query=fake_query)
    result = svc.convert(Decimal("100.00"), "XYZ", "ABC", date(2024, 1, 15), "spot")
    assert result is None


# ── precision ─────────────────────────────────────────────────────────────────

def test_convert_result_is_decimal():
    """convert always returns Decimal (not float) for financial precision."""
    from services.currency import CurrencyService

    def fake_query(sql, params=None):
        return [{"rate": Decimal("1.23456789")}]

    svc = CurrencyService(db_query=fake_query)
    result = svc.convert(Decimal("100.00"), "USD", "EUR", date(2024, 1, 15), "average")
    assert isinstance(result, Decimal)
