"""
connectors/bc_connector.py — Microsoft Business Central REST Connector
Agent: Rohan_Backend_003  |  Ticket: IC-11 / CON-BC
OData v4 API. OAuth2 client credentials.
Rule 07: posted-only filter, batch=1000, debit-positive already separated.
Rule 05: credentials not stored beyond connect() session.
"""
from __future__ import annotations
import logging
from datetime import date, datetime
from typing import Iterator

import requests as requests

from connectors.base import (
    ERPConnector, ConnectorAuthError, ConnectorTimeoutError, DataValidationError
)
from connectors.schemas import (
    RawGLLine, RawAccount, RawDimension, RawEntity,
    ConnectionStatus, ERPConnectionStatus, SyncCursor
)

logger = logging.getLogger(__name__)

BC_BATCH_SIZE = 1000
BC_TIMEOUT_S = 30
BC_TEST_TIMEOUT_S = 10


class BCConnector(ERPConnector):
    """Business Central OData connector (OAuth2 client credentials)."""

    def __init__(self):
        self._access_token: str | None = None
        self._base_url: str | None = None
        self._company_id: str | None = None

    # ── ERPConnector interface ────────────────────────────────────────────────

    def connect(self, credentials: dict) -> None:
        """Authenticate via OAuth2 client credentials. Store token only."""
        token_url = (
            f"https://login.microsoftonline.com/{credentials['tenant_id']}"
            "/oauth2/v2.0/token"
        )
        resp = requests.post(token_url, data={
            "grant_type": "client_credentials",
            "client_id": credentials["client_id"],
            "client_secret": credentials["client_secret"],
            "scope": "https://api.businesscentral.dynamics.com/.default",
        }, timeout=BC_TEST_TIMEOUT_S)
        if resp.status_code != 200:
            raise ConnectorAuthError(f"BC OAuth2 failed: {resp.status_code} {resp.text[:200]}")

        self._access_token = resp.json()["access_token"]
        env = credentials.get("environment", "production")
        self._company_id = credentials["company_id"]
        self._base_url = (
            f"https://api.businesscentral.dynamics.com/v2.0/{credentials['tenant_id']}"
            f"/{env}/api/v2.0/companies({self._company_id})"
        )
        # client_secret is intentionally not stored on self

    def test_connection(self) -> ConnectionStatus:
        start = datetime.utcnow()
        try:
            resp = requests.get(
                f"{self._base_url}/company",
                headers=self._headers(),
                timeout=BC_TEST_TIMEOUT_S,
            )
            latency_ms = int(resp.elapsed.microseconds / 1000)
            if resp.status_code == 401:
                return ConnectionStatus(status=ERPConnectionStatus.auth_expired, latency_ms=latency_ms)
            if resp.status_code == 200:
                return ConnectionStatus(status=ERPConnectionStatus.connected, latency_ms=latency_ms)
            return ConnectionStatus(status=ERPConnectionStatus.degraded, latency_ms=latency_ms)
        except requests.Timeout:
            raise ConnectorTimeoutError("BC test_connection timed out")

    def fetch_gl_entries(self, from_date: date, to_date: date) -> Iterator[RawGLLine]:
        """Generator. Paginates OData, filters posted-only (postingDate ne null)."""
        url = (
            f"{self._base_url}/generalLedgerEntries"
            f"?$filter=postingDate ge {from_date} and postingDate le {to_date}"
            f" and postingDate ne null"
            f"&$top={BC_BATCH_SIZE}"
        )
        while url:
            resp = requests.get(url, headers=self._headers(), timeout=BC_TIMEOUT_S)
            if resp.status_code == 401:
                raise ConnectorAuthError("BC token expired during fetch")
            resp.raise_for_status()
            data = resp.json()
            for row in data.get("value", []):
                try:
                    yield self._normalize_entry(row)
                except Exception as e:
                    raise DataValidationError(f"BC GL row validation: {e}") from e
            url = data.get("@odata.nextLink")

    def fetch_coa(self) -> list[RawAccount]:
        resp = requests.get(f"{self._base_url}/accounts", headers=self._headers(), timeout=BC_TIMEOUT_S)
        resp.raise_for_status()
        return [
            RawAccount(
                account_code=a["number"],
                account_name=a["displayName"],
                account_type=a.get("accountType"),
                is_blocked=a.get("blocked", False),
            )
            for a in resp.json().get("value", [])
        ]

    def fetch_dimensions(self) -> list[RawDimension]:
        resp = requests.get(f"{self._base_url}/dimensions", headers=self._headers(), timeout=BC_TIMEOUT_S)
        resp.raise_for_status()
        return [
            RawDimension(
                dimension_type="department",
                code=d["code"],
                name=d["displayName"],
            )
            for d in resp.json().get("value", [])
        ]

    def fetch_entities(self) -> list[RawEntity]:
        resp = requests.get(f"{self._base_url}/company", headers=self._headers(), timeout=BC_TIMEOUT_S)
        resp.raise_for_status()
        c = resp.json()
        return [RawEntity(entity_id=str(c["id"]), entity_name=c["name"], currency=c.get("currencyCode", "USD"))]

    def get_sync_cursor(self) -> SyncCursor:
        return SyncCursor(cursor_value=None, cursor_type="timestamp")

    # ── Private ───────────────────────────────────────────────────────────────

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._access_token}", "Accept": "application/json"}

    def _normalize_entry(self, row: dict) -> RawGLLine:
        return RawGLLine(
            journal_id=str(row.get("documentNumber", row.get("id", ""))),
            line_number=str(row.get("id", "")),
            account_code=str(row.get("accountNumber", "")),
            account_name=row.get("accountName"),
            debit_amount=float(row.get("debitAmount", 0)),
            credit_amount=float(row.get("creditAmount", 0)),
            currency=row.get("currencyCode", "USD")[:3] or "USD",
            posting_date=date.fromisoformat(str(row["postingDate"])[:10]),
            description=row.get("description"),
            department_code=row.get("departmentCode"),
        )
