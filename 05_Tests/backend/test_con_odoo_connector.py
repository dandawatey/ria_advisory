"""
test_con_odoo_connector.py — TDD tests for Odoo JSON-RPC connector
Agent: Vikram_QA_005  |  Ticket: IC-13 / CON-ODOO
RED phase.
"""
import pytest
from datetime import date
from unittest.mock import MagicMock, patch


def test_imports():
    from connectors.odoo_connector import OdooConnector
    assert OdooConnector is not None


def test_extends_erp_connector():
    from connectors.odoo_connector import OdooConnector
    from connectors.base import ERPConnector
    assert issubclass(OdooConnector, ERPConnector)


def test_instantiation():
    from connectors.odoo_connector import OdooConnector
    conn = OdooConnector()
    assert conn is not None


def test_connect_no_password_on_self():
    """connect() must not store password on self (Rule 05 / Rule 07)."""
    from connectors.odoo_connector import OdooConnector
    conn = OdooConnector()
    with patch("connectors.odoo_connector.xmlrpc") as mock_xml:
        mock_xml.client.ServerProxy.return_value.call.return_value = 1
        try:
            conn.connect({"url": "http://odoo", "database": "db", "username": "user", "password": "pass"})
        except Exception:
            pass
    assert not hasattr(conn, "password")
    assert not getattr(conn, "_password", None)


def test_fetch_gl_entries_is_generator():
    from connectors.odoo_connector import OdooConnector
    import inspect

    conn = OdooConnector()
    conn._uid = 1
    conn._db = "testdb"
    conn._url = "http://odoo"
    conn._api_key = "key"

    with patch("connectors.odoo_connector.xmlrpc") as mock_xml:
        mock_proxy = MagicMock()
        mock_proxy.execute_kw.return_value = []
        mock_xml.ServerProxy.return_value = mock_proxy
        result = conn.fetch_gl_entries(date(2024, 1, 1), date(2024, 1, 31))
        assert inspect.isgenerator(result)


def test_odoo_filters_posted_only():
    """Odoo connector must filter parent_state='posted' (Rule 07)."""
    from connectors.odoo_connector import OdooConnector

    conn = OdooConnector()
    conn._uid = 1
    conn._db = "testdb"
    conn._url = "http://odoo"
    conn._api_key = "key"

    captured_domains = []

    def fake_execute(db, uid, api_key, model, method, domain, fields, **kw):
        captured_domains.append(domain)
        return []

    with patch("connectors.odoo_connector.xmlrpc") as mock_xml:
        mock_proxy = MagicMock()
        mock_proxy.execute_kw.side_effect = fake_execute
        mock_xml.ServerProxy.return_value = mock_proxy
        list(conn.fetch_gl_entries(date(2024, 1, 1), date(2024, 1, 31)))

    all_domain_str = str(captured_domains)
    assert "posted" in all_domain_str, "Odoo must filter parent_state=posted"


def test_odoo_gl_lines_debit_positive():
    """Odoo has separate debit/credit fields — already normalized (Rule 07)."""
    from connectors.odoo_connector import OdooConnector
    conn = OdooConnector()
    line = conn._normalize_entry({
        "id": 1,
        "move_id": [100, "J001"],
        "sequence": 1,
        "account_id": [200, "4001 Revenue"],
        "debit": 500.0,
        "credit": 0.0,
        "currency_id": [1, "AED"],
        "date": "2024-01-15",
        "name": "Invoice",
    })
    assert line.debit_amount == 500.0
    assert line.credit_amount == 0.0
