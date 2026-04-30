"""
test_erp_ds_001_cross_erp_pl.py — TDD tests for CrossERPPLService
Agent: Vikram_QA_005  |  Ticket: IC-18 / ERP-DS-001
RED phase.
"""
import pytest
import uuid
from datetime import date


def test_imports():
    from services.cross_erp_pl import CrossERPPLService
    assert CrossERPPLService is not None


def test_pl_row_import():
    from services.cross_erp_pl import PLRow
    row = PLRow(
        erp_source_id=1, erp_name="BC", period="2024-Q1",
        revenue=100000.0, cogs=35000.0, gross_profit=65000.0,
        opex=30000.0, ebitda=35000.0
    )
    assert row.ebitda == 35000.0


def test_instantiation():
    from services.cross_erp_pl import CrossERPPLService
    svc = CrossERPPLService(db_query=None)
    assert svc is not None


def test_get_pl_returns_list():
    """get_pl returns PLRow list for requested ERP sources + date range."""
    from services.cross_erp_pl import CrossERPPLService

    def fake_query(sql, params=None):
        return [
            {"erp_source_id": 11, "erp_name": "BC", "period": "2024-01",
             "revenue": 500000.0, "cogs": 175000.0, "opex": 150000.0},
            {"erp_source_id": 12, "erp_name": "BC", "period": "2024-01",
             "revenue": 220000.0, "cogs": 77000.0, "opex": 66000.0},
        ]

    svc = CrossERPPLService(db_query=fake_query)
    result = svc.get_pl(
        erp_source_ids=[11, 12],
        from_date=date(2024, 1, 1),
        to_date=date(2024, 3, 31),
        tenant_id=uuid.uuid4()
    )
    assert isinstance(result, list)
    assert len(result) == 2
    assert result[0].gross_profit == 325000.0  # 500000 - 175000


def test_gross_profit_calculated():
    """gross_profit = revenue - cogs."""
    from services.cross_erp_pl import CrossERPPLService

    def fake_query(sql, params=None):
        return [{"erp_source_id": 1, "erp_name": "BC", "period": "2024-01",
                 "revenue": 1000.0, "cogs": 400.0, "opex": 200.0}]

    svc = CrossERPPLService(db_query=fake_query)
    result = svc.get_pl(erp_source_ids=[1], from_date=date(2024, 1, 1), to_date=date(2024, 12, 31), tenant_id=uuid.uuid4())
    assert result[0].gross_profit == 600.0
    assert result[0].ebitda == 400.0  # gross_profit - opex


def test_get_pl_passes_tenant_id():
    """Query uses tenant_id (Rule 05)."""
    from services.cross_erp_pl import CrossERPPLService

    captured = []

    def fake_query(sql, params=None):
        if params:
            captured.extend(list(params) if isinstance(params, (list, tuple)) else [params])
        return []

    TENANT = uuid.uuid4()
    svc = CrossERPPLService(db_query=fake_query)
    svc.get_pl(erp_source_ids=[1], from_date=date(2024, 1, 1), to_date=date(2024, 12, 31), tenant_id=TENANT)
    all_str = [str(p) for p in captured]
    assert any(str(TENANT) in s for s in all_str)


def test_get_pl_summary_totals():
    """get_pl_summary returns aggregated totals across all ERP sources."""
    from services.cross_erp_pl import CrossERPPLService

    def fake_query(sql, params=None):
        return [
            {"erp_source_id": 11, "erp_name": "BC", "period": "2024-01", "revenue": 500.0, "cogs": 200.0, "opex": 150.0},
            {"erp_source_id": 12, "erp_name": "SAP", "period": "2024-01", "revenue": 300.0, "cogs": 100.0, "opex": 90.0},
        ]

    svc = CrossERPPLService(db_query=fake_query)
    summary = svc.get_pl_summary(erp_source_ids=[11, 12], from_date=date(2024, 1, 1), to_date=date(2024, 12, 31), tenant_id=uuid.uuid4())
    assert summary["total_revenue"] == 800.0
    assert summary["total_ebitda"] == 260.0  # (500-200-150) + (300-100-90)
