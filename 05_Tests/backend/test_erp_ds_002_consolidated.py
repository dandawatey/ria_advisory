"""
test_erp_ds_002_consolidated.py — TDD tests for ConsolidatedDashboardService
Agent: Vikram_QA_005  |  Ticket: IC-19 / ERP-DS-002
RED phase.
"""
import pytest
import uuid
from datetime import date


def test_imports():
    from services.consolidated_dashboard import ConsolidatedDashboardService
    assert ConsolidatedDashboardService is not None


def test_dashboard_summary_import():
    from services.consolidated_dashboard import DashboardSummary
    ds = DashboardSummary(
        total_revenue=1000000.0, total_cogs=350000.0, total_opex=300000.0,
        gross_profit=650000.0, ebitda=350000.0, erp_sources_count=3,
        period="2024-Q1"
    )
    assert ds.gross_profit == 650000.0


def test_instantiation():
    from services.consolidated_dashboard import ConsolidatedDashboardService
    svc = ConsolidatedDashboardService(db_query=None)
    assert svc is not None


def test_get_summary_returns_summary():
    """get_summary returns DashboardSummary for the given period."""
    from services.consolidated_dashboard import ConsolidatedDashboardService, DashboardSummary

    def fake_query(sql, params=None):
        return [{"total_revenue": 800000.0, "total_cogs": 280000.0, "total_opex": 240000.0, "source_count": 3}]

    svc = ConsolidatedDashboardService(db_query=fake_query)
    summary = svc.get_summary(
        from_date=date(2024, 1, 1),
        to_date=date(2024, 3, 31),
        tenant_id=uuid.uuid4()
    )
    assert isinstance(summary, DashboardSummary)
    assert summary.total_revenue == 800000.0
    assert summary.gross_profit == 520000.0  # 800000 - 280000
    assert summary.ebitda == 280000.0        # 520000 - 240000
    assert summary.erp_sources_count == 3


def test_get_monthly_trend_returns_list():
    """get_monthly_trend returns list of monthly revenue/ebitda data."""
    from services.consolidated_dashboard import ConsolidatedDashboardService

    def fake_query(sql, params=None):
        return [
            {"period": "2024-01", "revenue": 400000.0, "ebitda": 140000.0},
            {"period": "2024-02", "revenue": 420000.0, "ebitda": 147000.0},
            {"period": "2024-03", "revenue": 440000.0, "ebitda": 154000.0},
        ]

    svc = ConsolidatedDashboardService(db_query=fake_query)
    trend = svc.get_monthly_trend(
        from_date=date(2024, 1, 1),
        to_date=date(2024, 3, 31),
        tenant_id=uuid.uuid4()
    )
    assert isinstance(trend, list)
    assert len(trend) == 3
    assert trend[0]["period"] == "2024-01"


def test_get_by_erp_source():
    """get_by_erp_source returns breakdown per ERP source."""
    from services.consolidated_dashboard import ConsolidatedDashboardService

    def fake_query(sql, params=None):
        return [
            {"erp_source_id": 11, "erp_name": "iSource Innovation LLC", "revenue": 500000.0, "ebitda": 175000.0},
            {"erp_source_id": 12, "erp_name": "iSource MENA", "revenue": 220000.0, "ebitda": 77000.0},
        ]

    svc = ConsolidatedDashboardService(db_query=fake_query)
    breakdown = svc.get_by_erp_source(
        from_date=date(2024, 1, 1),
        to_date=date(2024, 12, 31),
        tenant_id=uuid.uuid4()
    )
    assert isinstance(breakdown, list)
    assert len(breakdown) == 2
    assert breakdown[0]["erp_name"] == "iSource Innovation LLC"


def test_passes_tenant_id():
    """All queries pass tenant_id (Rule 05)."""
    from services.consolidated_dashboard import ConsolidatedDashboardService

    captured = []

    def fake_query(sql, params=None):
        if params:
            captured.extend(list(params) if isinstance(params, (list, tuple)) else [params])
        return [{"total_revenue": 0.0, "total_cogs": 0.0, "total_opex": 0.0, "source_count": 0}]

    TENANT = uuid.uuid4()
    svc = ConsolidatedDashboardService(db_query=fake_query)
    svc.get_summary(from_date=date(2024, 1, 1), to_date=date(2024, 12, 31), tenant_id=TENANT)
    all_str = [str(p) for p in captured]
    assert any(str(TENANT) in s for s in all_str)
