"""
services/fiscal_year.py — Fiscal Year Alignment Service
Agent: Rohan_Backend_003  |  Ticket: IC-5 / ERP-DN-002
Handles non-calendar fiscal years (Apr-Mar, Jul-Jun, Oct-Sep, etc.)
"""
from __future__ import annotations
import calendar
import logging
from dataclasses import dataclass
from datetime import date
from typing import Tuple

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FiscalPeriod:
    """Canonical fiscal period for a given calendar date."""
    year: int        # Fiscal year label (start year of the FY)
    period_no: int   # 1–12
    start_date: date
    end_date: date


class FiscalYearService:
    """
    Maps calendar dates to fiscal periods for any fiscal year start month.

    Convention: the fiscal year is identified by the calendar year in which
    it STARTS. E.g. Apr-2024 to Mar-2025 = FY 2024.

    Usage:
        svc = FiscalYearService(fiscal_year_start_month=4)
        fp = svc.get_period(date(2025, 1, 15))
        # → FiscalPeriod(year=2024, period_no=10, ...)
    """

    def __init__(self, fiscal_year_start_month: int = 1):
        if not 1 <= fiscal_year_start_month <= 12:
            raise ValueError(f"fiscal_year_start_month must be 1–12, got {fiscal_year_start_month}")
        self.start_month = fiscal_year_start_month

    # ── Public API ────────────────────────────────────────────────────────────

    def get_period(self, calendar_date: date) -> FiscalPeriod:
        """Return the FiscalPeriod containing this calendar date."""
        fy_year, period_no = self._date_to_fy(calendar_date)
        # Compute calendar month for this period
        cal_month = ((self.start_month - 1 + period_no - 1) % 12) + 1
        # Year for this period's calendar month
        if self.start_month == 1:
            cal_year = fy_year
        else:
            # Periods 1..N start in fy_year; later periods roll into fy_year+1
            first_cal_month = self.start_month
            # How many months into fy_year+1 is this period?
            months_from_start = period_no - 1
            raw_month = first_cal_month + months_from_start
            if raw_month > 12:
                cal_year = fy_year + 1
            else:
                cal_year = fy_year

        start_date = date(cal_year, cal_month, 1)
        last_day = calendar.monthrange(cal_year, cal_month)[1]
        end_date = date(cal_year, cal_month, last_day)

        return FiscalPeriod(
            year=fy_year,
            period_no=period_no,
            start_date=start_date,
            end_date=end_date,
        )

    def get_fiscal_year_dates(self, fiscal_year: int) -> Tuple[date, date]:
        """Return (start_date, end_date) for the given fiscal year."""
        start = date(fiscal_year, self.start_month, 1)
        # End = last day of month 12 periods later
        end_cal_month = ((self.start_month - 1 + 11) % 12) + 1
        if end_cal_month < self.start_month:
            end_cal_year = fiscal_year + 1
        else:
            end_cal_year = fiscal_year
        last_day = calendar.monthrange(end_cal_year, end_cal_month)[1]
        end = date(end_cal_year, end_cal_month, last_day)
        return start, end

    # ── Private ───────────────────────────────────────────────────────────────

    def _date_to_fy(self, d: date) -> Tuple[int, int]:
        """Return (fiscal_year, period_no) for a date."""
        cal_month = d.month
        cal_year = d.year
        start = self.start_month

        if cal_month >= start:
            fy_year = cal_year
            period_no = cal_month - start + 1
        else:
            fy_year = cal_year - 1
            period_no = 12 - (start - cal_month) + 1

        return fy_year, period_no
