"""
test_con_sap_connector.py — TDD tests for SAP S/4HANA connector
Agent: Vikram_QA_005  |  Ticket: IC-12 / CON-SAP
RED phase.
"""
import pytest
from datetime import date
from unittest.mock import MagicMock, patch


def test_imports():
    from connectors.sap_connector import SAPConnector
    assert SAPConnector is not None


def test_extends_erp_connector():
    from connectors.sap_connector import SAPConnector
    from connectors.base import ERPConnector
    assert issubclass(SAPConnector, ERPConnector)


def test_instantiation():
    from connectors.sap_connector import SAPConnector
    conn = SAPConnector()
    assert conn is not None


def test_connect_no_secret_on_self():
    """connect() must not store password on self."""
    from connectors.sap_connector import SAPConnector
    conn = SAPConnector()
    with patch("connectors.sap_connector.requests") as mock_req:
        mock_req.get.return_value = MagicMock(status_code=200)
        conn.connect({"base_url": "https://sap", "username": "user", "password": "pass"})
    assert not hasattr(conn, "password")
    assert not getattr(conn, "_password", None)


def test_fetch_gl_entries_is_generator():
    from connectors.sap_connector import SAPConnector
    import inspect

    conn = SAPConnector()
    conn._base_url = "https://sap"
    conn._session = MagicMock()
    conn._session.get.return_value = MagicMock(
        status_code=200,
        json=lambda: {"d": {"results": []}, "d": {"__next": None, "results": []}}
    )

    with patch("connectors.sap_connector.requests") as mock_req:
        mock_req.Session.return_value = conn._session
        result = conn.fetch_gl_entries(date(2024, 1, 1), date(2024, 1, 31))
        assert inspect.isgenerator(result)


def test_sap_debit_credit_normalization():
    """SAP GLDC S=debit, H=credit → debit-positive normal form (Rule 07)."""
    from connectors.sap_connector import SAPConnector
    conn = SAPConnector()
    # Debit entry: GLDC='S', positive amount
    debit_line = conn._normalize_entry({
        "LedgerGLLineItem": "001",
        "AccountingDocument": "J001",
        "AccountingDocumentItem": "1",
        "GLAccount": "4001",
        "AmountInCompanyCodeCurrency": "1000.00",
        "DebitCreditCode": "S",
        "CompanyCodeCurrency": "AED",
        "PostingDate": "2024-01-15",
    })
    assert debit_line.debit_amount == 1000.00
    assert debit_line.credit_amount == 0.0

    # Credit entry: GLDC='H'
    credit_line = conn._normalize_entry({
        "LedgerGLLineItem": "002",
        "AccountingDocument": "J001",
        "AccountingDocumentItem": "2",
        "GLAccount": "4001",
        "AmountInCompanyCodeCurrency": "500.00",
        "DebitCreditCode": "H",
        "CompanyCodeCurrency": "AED",
        "PostingDate": "2024-01-15",
    })
    assert credit_line.credit_amount == 500.00
    assert credit_line.debit_amount == 0.0


def test_sap_leading_ledger_filter():
    """SAP connector must filter Ledger eq '0L' (Rule 07)."""
    from connectors.sap_connector import SAPConnector

    conn = SAPConnector()
    conn._base_url = "https://sap"
    called_urls = []

    with patch("connectors.sap_connector.requests") as mock_req:
        mock_req.get.side_effect = lambda url, **kw: (
            called_urls.append(url),
            MagicMock(status_code=200, json=lambda: {"d": {"results": [], "__next": None}})
        )[1]
        list(conn.fetch_gl_entries(date(2024, 1, 1), date(2024, 1, 31)))

    assert any("0L" in u or "Ledger" in u for u in called_urls), "SAP must filter leading ledger 0L"
