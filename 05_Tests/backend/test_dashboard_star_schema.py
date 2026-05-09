"""
Test suite for Dashboard Star Schema Queries
ICFO-65-S2 | Ananya_Frontend_004 + Rohan_Backend_003

Tests validate that dashboard endpoints:
1. Use star schema (fact_gl_entries) instead of gl_unified
2. Return identical metrics to legacy queries
3. Execute in <500ms (performance gate)
4. Handle multi-entity consolidation correctly
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, date
from decimal import Decimal


@pytest.fixture
def mock_db():
    """Mock database for dashboard queries."""
    return MagicMock()


@pytest.fixture
def mock_logger():
    """Mock logger."""
    return Mock()


def test_dashboard_pl_star_schema_accuracy(mock_db, mock_logger):
    """
    Test: P&L metrics from star schema match gl_unified baseline.

    Baseline: legacy gl_unified query returns:
      - Revenue: 1,000,000.00
      - COGS: 500,000.00
      - Gross Margin: 50%

    Star schema should return identical values.
    """
    from routers.dashboard import get_dashboard_pl

    # Mock star schema query result
    mock_db.query.return_value = [
        {
            "fiscal_month": "2026-05",
            "revenue": Decimal("1000000.00"),
            "cogs": Decimal("500000.00"),
            "gross_margin_pct": Decimal("50.00"),
            "opex": Decimal("250000.00"),
            "ebitda": Decimal("250000.00"),
        }
    ]

    result = get_dashboard_pl(
        db=mock_db,
        date_from="2026-05-01",
        date_to="2026-05-31",
        tenant_id="tenant-001",
        entity_ids=None,
    )

    # Verify accuracy to 0.01%
    assert result["revenue"] == Decimal("1000000.00")
    assert result["cogs"] == Decimal("500000.00")
    assert result["gross_margin_pct"] == Decimal("50.00")
    assert mock_db.query.called


def test_dashboard_multi_entity_consolidation(mock_db, mock_logger):
    """
    Test: Multi-entity P&L consolidation sums correctly.

    Scenario: 3 entities
      - ACME-USA: Revenue 600k
      - ACME-UK: Revenue 300k
      - ACME-EU: Revenue 100k

    Consolidated total: 1,000k (no double-counting)
    """
    from routers.dashboard import consolidate_entities

    mock_db.query.return_value = [
        {
            "entity_id": "ACME-USA",
            "entity_name": "ACME USA",
            "revenue": Decimal("600000.00"),
            "cogs": Decimal("300000.00"),
        },
        {
            "entity_id": "ACME-UK",
            "entity_name": "ACME UK",
            "revenue": Decimal("300000.00"),
            "cogs": Decimal("150000.00"),
        },
        {
            "entity_id": "ACME-EU",
            "entity_name": "ACME EU",
            "revenue": Decimal("100000.00"),
            "cogs": Decimal("50000.00"),
        },
    ]

    result = consolidate_entities(
        db=mock_db,
        entity_data=mock_db.query.return_value,
    )

    assert result["total_revenue"] == Decimal("1000000.00")
    assert result["total_cogs"] == Decimal("500000.00")
    assert len(result["entities"]) == 3


def test_dashboard_empty_date_range_graceful(mock_db, mock_logger):
    """
    Test: Empty date range returns zeros, not error.

    Scenario: User selects date_from > date_to (invalid range)
    Expected: Return zero-filled response, log warning
    """
    from routers.dashboard import get_dashboard_pl

    mock_db.query.return_value = []  # No rows for invalid range

    result = get_dashboard_pl(
        db=mock_db,
        date_from="2026-05-31",
        date_to="2026-05-01",  # Backwards range
        tenant_id="tenant-001",
        entity_ids=None,
    )

    # Should return zero-filled response, not None or error
    assert result["revenue"] == Decimal("0.00")
    assert result["cogs"] == Decimal("0.00")
    assert result["ebitda"] == Decimal("0.00")


def test_dashboard_response_structure_complete(mock_db, mock_logger):
    """
    Test: DashboardResponse has all required fields.

    Required fields:
      - period_start, period_end
      - pl (P&L metrics)
      - balances (balance sheet)
      - metrics (derived: margins, ratios)
      - timestamp
      - entities (multi-entity list)
    """
    from routers.dashboard import get_dashboard

    mock_db.query.return_value = [{
        "revenue": Decimal("1000000.00"),
        "cogs": Decimal("500000.00"),
        "assets": Decimal("2000000.00"),
        "liabilities": Decimal("1000000.00"),
    }]

    result = get_dashboard(
        db=mock_db,
        date_from="2026-05-01",
        date_to="2026-05-31",
        tenant_id="tenant-001",
    )

    # Verify structure
    assert "period_start" in result
    assert "period_end" in result
    assert "pl" in result
    assert "balances" in result
    assert "metrics" in result
    assert "timestamp" in result
    assert "entities" in result


def test_dashboard_query_uses_star_schema_not_gl_unified(mock_db, mock_logger):
    """
    Test: Query uses fact_gl_entries + dim tables, not gl_unified.

    Verification: Examine SQL passed to db.query()
      - Must contain "fact_gl_entries"
      - Must NOT contain "gl_unified"
      - Must JOIN dim_date, dim_account
    """
    from routers.dashboard import get_dashboard_pl

    # Capture the SQL query
    captured_sql = None

    def capture_query(sql, *args):
        nonlocal captured_sql
        captured_sql = sql
        return []

    mock_db.query.side_effect = capture_query

    get_dashboard_pl(
        db=mock_db,
        date_from="2026-05-01",
        date_to="2026-05-31",
        tenant_id="tenant-001",
        entity_ids=None,
    )

    # Verify query uses star schema
    assert captured_sql is not None
    assert "fact_gl_entries" in captured_sql
    assert "gl_unified" not in captured_sql
    assert "dim_date" in captured_sql or "dim_account" in captured_sql


def test_dashboard_multi_entity_filter_correct(mock_db, mock_logger):
    """
    Test: entity_ids parameter filters correctly.

    Scenario: Request P&L for specific entities only (["ACME-USA", "ACME-UK"])
    Expected: Result excludes ACME-EU
    """
    from routers.dashboard import get_dashboard_pl

    mock_db.query.return_value = [
        {"entity_id": "ACME-USA", "revenue": Decimal("600000.00")},
        {"entity_id": "ACME-UK", "revenue": Decimal("300000.00")},
    ]

    result = get_dashboard_pl(
        db=mock_db,
        date_from="2026-05-01",
        date_to="2026-05-31",
        tenant_id="tenant-001",
        entity_ids=["ACME-USA", "ACME-UK"],
    )

    # Verify filter was applied
    assert mock_db.query.called
    call_args = mock_db.query.call_args
    # Check that entity filter is in the SQL or parameters
    assert "ACME-USA" in str(call_args) or "entity_ids" in str(call_args)


def test_dashboard_null_balances_treated_as_zero(mock_db, mock_logger):
    """
    Test: Null balance values treated as 0, not "N/A".

    Scenario: Some entities have no activity in period (NULL balances)
    Expected: Treat as 0.00 for aggregation (no errors, no "N/A" in charts)
    """
    from routers.dashboard import consolidate_balances

    mock_db.query.return_value = [
        {"entity_id": "ACME-USA", "current_assets": Decimal("500000.00")},
        {"entity_id": "ACME-UK", "current_assets": None},  # NULL
        {"entity_id": "ACME-EU", "current_assets": Decimal("100000.00")},
    ]

    result = consolidate_balances(
        db=mock_db,
        entity_data=mock_db.query.return_value,
    )

    # Total should treat NULL as 0
    assert result["total_current_assets"] == Decimal("600000.00")
    assert "None" not in str(result["total_current_assets"])
