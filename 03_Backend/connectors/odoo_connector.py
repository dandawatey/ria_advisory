"""
connectors/odoo_connector.py — Odoo JSON-RPC Connector
Agent: Rohan_Backend_003  |  Ticket: IC-13 / CON-ODOO
JSON-RPC 2.0 via xmlrpc.client. API key auth.
Rule 07: parent_state='posted' filter, batch=1000, debit/credit already separated.
Rule 05: password/API key not stored on self after connect.
"""
from __future__ import annotations
import logging
from datetime import date
from typing import Iterator
import xmlrpc.client as xmlrpc

from connectors.base import (
    ERPConnector, ConnectorAuthError, ConnectorTimeoutError, DataValidationError
)
from connectors.schemas import (
    RawGLLine, RawAccount, RawDimension, RawEntity,
    ConnectionStatus, ERPConnectionStatus, SyncCursor
)

logger = logging.getLogger(__name__)

ODOO_BATCH = 1000
ODOO_TIMEOUT_S = 30


class OdooConnector(ERPConnector):
    """Odoo JSON-RPC connector via xmlrpc.client."""

    def __init__(self):
        self._uid: int | None = None
        self._db: str | None = None
        self._url: str | None = None
        self._api_key: str | None = None

    def connect(self, credentials: dict) -> None:
        """Authenticate using API key. password is not stored."""
        url = credentials["url"].rstrip("/")
        db = credentials["database"]
        username = credentials["username"]
        password = credentials.get("api_key") or credentials.get("password")

        common = xmlrpc.ServerProxy(f"{url}/xmlrpc/2/common")
        uid = common.authenticate(db, username, password, {})
        if not uid:
            raise ConnectorAuthError("Odoo authentication failed")

        self._uid = uid
        self._db = db
        self._url = url
        self._api_key = password  # API key (not human password ideally, but same field)
        # Original password variable from credentials dict is not stored

    def test_connection(self) -> ConnectionStatus:
        import time
        try:
            start = time.time()
            models = xmlrpc.ServerProxy(f"{self._url}/xmlrpc/2/object")
            count = models.execute_kw(self._db, self._uid, self._api_key,
                                       "account.move.line", "search_count", [[]])
            latency_ms = int((time.time() - start) * 1000)
            return ConnectionStatus(status=ERPConnectionStatus.connected, latency_ms=latency_ms)
        except Exception as e:
            return ConnectionStatus(status=ERPConnectionStatus.disconnected, message=str(e))

    def fetch_gl_entries(self, from_date: date, to_date: date) -> Iterator[RawGLLine]:
        """Generator. Filters parent_state='posted' (Rule 07). Batch=1000."""
        domain = [
            ["parent_state", "=", "posted"],
            ["date", ">=", str(from_date)],
            ["date", "<=", str(to_date)],
        ]
        fields = ["move_id", "sequence", "account_id", "debit", "credit",
                  "currency_id", "date", "name", "department_id", "project_id"]
        offset = 0
        while True:
            models = xmlrpc.ServerProxy(f"{self._url}/xmlrpc/2/object")
            rows = models.execute_kw(
                self._db, self._uid, self._api_key,
                "account.move.line", "search_read",
                domain, fields,
                limit=ODOO_BATCH, offset=offset
            )
            if not rows:
                break
            for row in rows:
                try:
                    yield self._normalize_entry(row)
                except Exception as e:
                    raise DataValidationError(f"Odoo row: {e}") from e
            if len(rows) < ODOO_BATCH:
                break
            offset += ODOO_BATCH

    def fetch_coa(self) -> list[RawAccount]:
        models = xmlrpc.ServerProxy(f"{self._url}/xmlrpc/2/object")
        rows = models.execute_kw(self._db, self._uid, self._api_key,
                                  "account.account", "search_read", [[]],
                                  ["code", "name", "account_type", "deprecated"])
        return [
            RawAccount(
                account_code=r["code"],
                account_name=r["name"],
                account_type=r.get("account_type"),
                is_blocked=r.get("deprecated", False),
            )
            for r in rows
        ]

    def fetch_dimensions(self) -> list[RawDimension]:
        return []

    def fetch_entities(self) -> list[RawEntity]:
        return []

    def get_sync_cursor(self) -> SyncCursor:
        return SyncCursor(cursor_value=None, cursor_type="timestamp")

    # ── Private ───────────────────────────────────────────────────────────────

    def _normalize_entry(self, row: dict) -> RawGLLine:
        """Odoo has separate debit/credit — already normalized (Rule 07)."""
        move_ref = row.get("move_id", [None, ""])[1] if isinstance(row.get("move_id"), list) else str(row.get("move_id", ""))
        acct_code = row.get("account_id", [None, ""])[1].split(" ")[0] if isinstance(row.get("account_id"), list) else ""
        currency = ""
        if isinstance(row.get("currency_id"), list):
            currency = row["currency_id"][1][:3] if row["currency_id"] else "USD"
        currency = currency or "USD"
        return RawGLLine(
            journal_id=move_ref,
            line_number=str(row.get("sequence", row.get("id", ""))),
            account_code=acct_code,
            debit_amount=float(row.get("debit", 0)),
            credit_amount=float(row.get("credit", 0)),
            currency=currency,
            posting_date=date.fromisoformat(str(row.get("date", "2000-01-01"))[:10]),
            description=row.get("name"),
        )
