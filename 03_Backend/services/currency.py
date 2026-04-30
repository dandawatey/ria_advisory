"""
services/currency.py — Currency Conversion Service
Agent: Rohan_Backend_003  |  Ticket: IC-4 / ERP-DN-001
IFRS 21 compliant: spot, average, closing rate types.
Rule 06: All financial amounts use Decimal (never float).
"""
from __future__ import annotations
import logging
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import Callable, Optional

logger = logging.getLogger(__name__)

RATE_SPOT = "spot"
RATE_AVERAGE = "average"
RATE_CLOSING = "closing"

SUPPORTED_RATE_TYPES = {RATE_SPOT, RATE_AVERAGE, RATE_CLOSING}

_GET_RATE_SQL = """
    SELECT rate
    FROM dim_exchange_rate
    WHERE from_currency = %s
      AND to_currency   = %s
      AND rate_date     = %s
      AND rate_type     = %s
    ORDER BY rate_date DESC
    LIMIT 1
"""


class CurrencyService:
    """
    Convert financial amounts between currencies using dim_exchange_rate.

    Usage:
        svc = CurrencyService(db_query=database.query)
        rate = svc.get_rate("USD", "AED", date(2024, 1, 15), RATE_SPOT)
        amount_aed = svc.convert(Decimal("1000"), "USD", "AED", date(2024, 1, 15), RATE_AVERAGE)
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    # ── Public API ────────────────────────────────────────────────────────────

    def get_rate(
        self,
        from_currency: str,
        to_currency: str,
        rate_date: date,
        rate_type: str = RATE_SPOT,
    ) -> Optional[Decimal]:
        """Return exchange rate as Decimal, or None if not found."""
        if from_currency == to_currency:
            return Decimal("1")

        rows = self._query(_GET_RATE_SQL, (from_currency, to_currency, rate_date, rate_type))
        if rows:
            return Decimal(str(rows[0]["rate"]))

        # Try inverse rate as fallback
        rows_inv = self._query(_GET_RATE_SQL, (to_currency, from_currency, rate_date, rate_type))
        if rows_inv:
            inv = Decimal(str(rows_inv[0]["rate"]))
            if inv != 0:
                return (Decimal("1") / inv).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

        logger.warning(
            "No rate found: %s→%s on %s (%s)", from_currency, to_currency, rate_date, rate_type
        )
        return None

    def convert(
        self,
        amount: Decimal,
        from_currency: str,
        to_currency: str,
        rate_date: date,
        rate_type: str = RATE_SPOT,
    ) -> Optional[Decimal]:
        """Convert amount to target currency. Returns None if rate not found."""
        if from_currency == to_currency:
            return Decimal(str(amount))

        rate = self.get_rate(from_currency, to_currency, rate_date, rate_type)
        if rate is None:
            return None

        return (Decimal(str(amount)) * rate).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
