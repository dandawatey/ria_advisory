"""
test_erp_dn_002_fiscal_year.py — TDD tests for FiscalYearService
Agent: Vikram_QA_005  |  Ticket: IC-5 / ERP-DN-002
RED phase: all tests must FAIL before implementation is written.
"""
import pytest
from datetime import date


# ── Import test ───────────────────────────────────────────────────────────────

def test_imports():
    """FiscalYearService must be importable from services.fiscal_year."""
    from services.fiscal_year import FiscalYearService
    assert FiscalYearService is not None


def test_fiscal_period_namedtuple():
    """FiscalPeriod must be importable and have year/period_no/start_date/end_date."""
    from services.fiscal_year import FiscalPeriod
    fp = FiscalPeriod(year=2024, period_no=1, start_date=date(2024, 1, 1), end_date=date(2024, 1, 31))
    assert fp.year == 2024
    assert fp.period_no == 1


def test_instantiation():
    """FiscalYearService instantiates with fiscal_year_start_month."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=1)
    assert svc is not None


# ── Calendar fiscal year (Jan=1) ──────────────────────────────────────────────

def test_calendar_fy_period_january():
    """Jan FY: Jan 2024 → FY 2024, Period 1."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=1)
    fp = svc.get_period(date(2024, 1, 15))
    assert fp.year == 2024
    assert fp.period_no == 1


def test_calendar_fy_period_december():
    """Jan FY: Dec 2024 → FY 2024, Period 12."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=1)
    fp = svc.get_period(date(2024, 12, 31))
    assert fp.year == 2024
    assert fp.period_no == 12


# ── Apr-Mar fiscal year (UAE/India style) ─────────────────────────────────────

def test_apr_fy_april_is_period_1():
    """Apr FY: Apr 2024 → FY 2024, Period 1 (FY Apr 2024 – Mar 2025)."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=4)
    fp = svc.get_period(date(2024, 4, 1))
    assert fp.year == 2024
    assert fp.period_no == 1


def test_apr_fy_march_is_period_12():
    """Apr FY: Mar 2025 → FY 2024, Period 12."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=4)
    fp = svc.get_period(date(2025, 3, 31))
    assert fp.year == 2024
    assert fp.period_no == 12


def test_apr_fy_january_is_period_10():
    """Apr FY: Jan 2025 → FY 2024, Period 10."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=4)
    fp = svc.get_period(date(2025, 1, 15))
    assert fp.year == 2024
    assert fp.period_no == 10


# ── Jul-Jun fiscal year ───────────────────────────────────────────────────────

def test_jul_fy_july_is_period_1():
    """Jul FY: Jul 2024 → FY 2024, Period 1."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=7)
    fp = svc.get_period(date(2024, 7, 1))
    assert fp.year == 2024
    assert fp.period_no == 1


def test_jul_fy_june_is_period_12():
    """Jul FY: Jun 2025 → FY 2024, Period 12."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=7)
    fp = svc.get_period(date(2025, 6, 30))
    assert fp.year == 2024
    assert fp.period_no == 12


# ── get_fiscal_year_dates ─────────────────────────────────────────────────────

def test_get_fiscal_year_dates_calendar():
    """Jan FY 2024: start=2024-01-01, end=2024-12-31."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=1)
    start, end = svc.get_fiscal_year_dates(2024)
    assert start == date(2024, 1, 1)
    assert end == date(2024, 12, 31)


def test_get_fiscal_year_dates_apr():
    """Apr FY 2024: start=2024-04-01, end=2025-03-31."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=4)
    start, end = svc.get_fiscal_year_dates(2024)
    assert start == date(2024, 4, 1)
    assert end == date(2025, 3, 31)


# ── period boundary dates ─────────────────────────────────────────────────────

def test_period_start_date():
    """Period start_date is first day of that month."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=1)
    fp = svc.get_period(date(2024, 3, 15))
    assert fp.start_date == date(2024, 3, 1)


def test_period_end_date():
    """Period end_date is last day of that month."""
    from services.fiscal_year import FiscalYearService
    svc = FiscalYearService(fiscal_year_start_month=1)
    fp = svc.get_period(date(2024, 2, 10))
    assert fp.end_date == date(2024, 2, 29)  # 2024 is leap year
