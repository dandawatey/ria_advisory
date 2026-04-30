"""
test_con_bc_connector.py — TDD tests for Business Central connector
Agent: Vikram_QA_005  |  Ticket: IC-11 / CON-BC
RED phase.
"""
import pytest
from datetime import date
from unittest.mock import MagicMock, patch


def test_imports():
    from connectors.bc_connector import BCConnector
    assert BCConnector is not None


def test_extends_erp_connector():
    from connectors.bc_connector import BCConnector
    from connectors.base import ERPConnector
    assert issubclass(BCConnector, ERPConnector)


def test_instantiation():
    from connectors.bc_connector import BCConnector
    conn = BCConnector()
    assert conn is not None


def test_connect_stores_no_credential_on_self():
    """connect() must not store client_secret on self (Rule 05 / Rule 07)."""
    from connectors.bc_connector import BCConnector
    conn = BCConnector()
    with patch("connectors.bc_connector.requests") as mock_req:
        mock_req.post.return_value = MagicMock(status_code=200, json=lambda: {"access_token": "tok"})
        conn.connect({"tenant_id": "t", "client_id": "c", "client_secret": "s", "environment": "production", "company_id": "co"})
    assert not hasattr(conn, "client_secret")
    assert not getattr(conn, "_client_secret", None)


def test_test_connection_returns_connection_status():
    from connectors.bc_connector import BCConnector
    from connectors.schemas import ConnectionStatus, ERPConnectionStatus

    conn = BCConnector()
    conn._access_token = "tok"
    conn._base_url = "https://fake"

    with patch("connectors.bc_connector.requests") as mock_req:
        mock_req.get.return_value = MagicMock(status_code=200, elapsed=MagicMock(microseconds=50000))
        status = conn.test_connection()

    assert isinstance(status, ConnectionStatus)
    assert status.status in ERPConnectionStatus.__members__.values()


def test_fetch_gl_entries_is_generator():
    """fetch_gl_entries must yield (generator) not return list."""
    from connectors.bc_connector import BCConnector
    import inspect

    conn = BCConnector()
    conn._access_token = "tok"
    conn._base_url = "https://fake"

    with patch("connectors.bc_connector.requests") as mock_req:
        mock_req.get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"value": [], "@odata.nextLink": None}
        )
        result = conn.fetch_gl_entries(date(2024, 1, 1), date(2024, 1, 31))
        assert inspect.isgenerator(result)


def test_fetch_gl_entries_filters_posted_only():
    """BC connector must include $filter=postingDate ne null (Rule 07)."""
    from connectors.bc_connector import BCConnector

    conn = BCConnector()
    conn._access_token = "tok"
    conn._base_url = "https://fake"

    called_urls = []
    with patch("connectors.bc_connector.requests") as mock_req:
        mock_req.get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"value": [], "@odata.nextLink": None}
        )
        mock_req.get.side_effect = lambda url, **kw: (called_urls.append(url), MagicMock(
            status_code=200, json=lambda: {"value": [], "@odata.nextLink": None}
        ))[1]
        list(conn.fetch_gl_entries(date(2024, 1, 1), date(2024, 1, 31)))

    assert any("postingDate" in u or "filter" in u.lower() for u in called_urls), \
        "BC connector must filter posted entries"


def test_fetch_coa_returns_list():
    from connectors.bc_connector import BCConnector
    from connectors.schemas import RawAccount

    conn = BCConnector()
    conn._access_token = "tok"
    conn._base_url = "https://fake"

    with patch("connectors.bc_connector.requests") as mock_req:
        mock_req.get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"value": [{"number": "4001", "displayName": "Revenue", "accountType": "Posting", "blocked": False}]}
        )
        accounts = conn.fetch_coa()

    assert isinstance(accounts, list)
    assert len(accounts) == 1
    assert isinstance(accounts[0], RawAccount)
