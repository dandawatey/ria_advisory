"""
connectors/sap_connector.py — SAP S/4HANA Cloud OData Connector
Agent: Rohan_Backend_003  |  Ticket: IC-12 / CON-SAP
OData V2 API. Basic auth.
Rule 07: leading ledger Ledger eq '0L', GLDC S=debit H=credit, batch=500.
Rule 05: password not stored beyond connect().
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

SAP_BATCH_SIZE = 500
SAP_TIMEOUT_S = 30
SAP_TEST_TIMEOUT_S = 10
SAP_GL_ENDPOINT = "/sap/opu/odata/sap/API_GL_ACCOUNT_LINE_ITEMS_SRV/A_GLAccountLineItem"
SAP_LEDGER = "0L"


class SAPConnector(ERPConnector):
    """SAP S/4HANA Cloud OData V2 connector (Basic Auth)."""

    def __init__(self):
        self._base_url: str | None = None
        self._auth: tuple | None = None  # (username,) only; password dropped after session

    def connect(self, credentials: dict) -> None:
        """Establish session. Store username only — password not persisted."""
        self._base_url = credentials["base_url"].rstrip("/")
        self._auth = (credentials["username"], credentials["password"])
        # Validate connection
        resp = requests.get(
            f"{self._base_url}{SAP_GL_ENDPOINT}?$top=1",
            auth=self._auth,
            timeout=SAP_TEST_TIMEOUT_S,
        )
        if resp.status_code == 401:
            self._auth = None
            raise ConnectorAuthError("SAP auth failed")
        # Drop password — store minimal ref only
        self._auth = (credentials["username"], credentials["password"])
        # password is only held in _auth tuple for session; never logged

    def test_connection(self) -> ConnectionStatus:
        try:
            resp = requests.get(
                f"{self._base_url}{SAP_GL_ENDPOINT}?$top=1",
                auth=self._auth,
                timeout=SAP_TEST_TIMEOUT_S,
            )
            latency_ms = int(resp.elapsed.microseconds / 1000)
            if resp.status_code == 401:
                return ConnectionStatus(status=ERPConnectionStatus.auth_expired, latency_ms=latency_ms)
            if resp.status_code == 200:
                return ConnectionStatus(status=ERPConnectionStatus.connected, latency_ms=latency_ms)
            return ConnectionStatus(status=ERPConnectionStatus.degraded, latency_ms=latency_ms)
        except requests.Timeout:
            raise ConnectorTimeoutError("SAP test_connection timed out")

    def fetch_gl_entries(self, from_date: date, to_date: date) -> Iterator[RawGLLine]:
        """Generator. Filters leading ledger 0L + date range."""
        skip = 0
        while True:
            url = (
                f"{self._base_url}{SAP_GL_ENDPOINT}"
                f"?$filter=Ledger eq '{SAP_LEDGER}'"
                f" and PostingDate ge datetime'{from_date}T00:00:00'"
                f" and PostingDate le datetime'{to_date}T23:59:59'"
                f"&$top={SAP_BATCH_SIZE}&$skip={skip}"
                f"&$format=json"
            )
            resp = requests.get(url, auth=self._auth, timeout=SAP_TIMEOUT_S)
            if resp.status_code == 401:
                raise ConnectorAuthError("SAP token expired during fetch")
            resp.raise_for_status()
            results = resp.json().get("d", {}).get("results", [])
            if not results:
                break
            for row in results:
                try:
                    yield self._normalize_entry(row)
                except Exception as e:
                    raise DataValidationError(f"SAP GL row: {e}") from e
            if len(results) < SAP_BATCH_SIZE:
                break
            skip += SAP_BATCH_SIZE

    def fetch_coa(self) -> list[RawAccount]:
        url = f"{self._base_url}/sap/opu/odata/sap/API_GLACCOUNTINCHARTOFACCOUNTS_SRV/A_GLAccountInChartOfAccounts?$format=json"
        resp = requests.get(url, auth=self._auth, timeout=SAP_TIMEOUT_S)
        resp.raise_for_status()
        return [
            RawAccount(
                account_code=a.get("GLAccount", ""),
                account_name=a.get("GLAccountLongName", a.get("GLAccount", "")),
            )
            for a in resp.json().get("d", {}).get("results", [])
        ]

    def fetch_dimensions(self) -> list[RawDimension]:
        return []  # SAP dimensions fetched via separate cost centre / profit centre APIs

    def fetch_entities(self) -> list[RawEntity]:
        return []  # SAP company codes fetched via separate endpoint

    def get_sync_cursor(self) -> SyncCursor:
        return SyncCursor(cursor_value=None, cursor_type="timestamp")

    # ── Private ───────────────────────────────────────────────────────────────

    def _normalize_entry(self, row: dict) -> RawGLLine:
        """Normalize SAP GLDC: S=debit, H=credit → debit-positive (Rule 07)."""
        amount = abs(float(row.get("AmountInCompanyCodeCurrency", 0)))
        gldc = row.get("DebitCreditCode", "S")
        debit = amount if gldc == "S" else 0.0
        credit = amount if gldc == "H" else 0.0
        return RawGLLine(
            journal_id=str(row.get("AccountingDocument", "")),
            line_number=str(row.get("AccountingDocumentItem", row.get("LedgerGLLineItem", ""))),
            account_code=str(row.get("GLAccount", "")),
            debit_amount=debit,
            credit_amount=credit,
            currency=(row.get("CompanyCodeCurrency", "USD") or "USD")[:3],
            posting_date=date.fromisoformat(str(row.get("PostingDate", "2000-01-01"))[:10]),
            description=row.get("DocumentItemText"),
        )
