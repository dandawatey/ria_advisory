"""
test_erp_dn_003_account_normalizer.py — TDD tests for AccountNormalizer
Agent: Vikram_QA_005  |  Ticket: IC-6 / ERP-DN-003
RED phase: all tests must FAIL before implementation is written.
"""
import pytest
import uuid


# ── Import test ───────────────────────────────────────────────────────────────

def test_imports():
    """AccountNormalizer must be importable from services.account_normalizer."""
    from services.account_normalizer import AccountNormalizer
    assert AccountNormalizer is not None


def test_canonical_account_namedtuple():
    """CanonicalAccount must have account_no, account_name, l1, l2, l3 fields."""
    from services.account_normalizer import CanonicalAccount
    ca = CanonicalAccount(
        account_no="REV.001",
        account_name="Revenue",
        l1="P&L",
        l2="Revenue",
        l3="Product Revenue"
    )
    assert ca.account_no == "REV.001"
    assert ca.l1 == "P&L"


def test_instantiation():
    """AccountNormalizer instantiates with a db_query callable."""
    from services.account_normalizer import AccountNormalizer
    norm = AccountNormalizer(db_query=None)
    assert norm is not None


# ── normalize — via dim_erp_mapping ──────────────────────────────────────────

def test_normalize_found_via_mapping(monkeypatch):
    """normalize returns CanonicalAccount when dim_erp_mapping has the entry."""
    from services.account_normalizer import AccountNormalizer, CanonicalAccount

    TENANT = uuid.uuid4()

    def fake_query(sql, params=None):
        # First call: dim_erp_mapping lookup → returns canonical_account_no
        if "dim_erp_mapping" in sql:
            return [{"canonical_account_no": "REV.PROD.001"}]
        # Second call: dim_account lookup
        if "dim_account" in sql:
            return [{
                "account_no": "REV.PROD.001",
                "account_name": "Product Revenue",
                "l1_category": "P&L",
                "l2_category": "Revenue",
                "l3_category": "Product Revenue"
            }]
        return []

    norm = AccountNormalizer(db_query=fake_query)
    result = norm.normalize(
        erp_source_id=1,
        erp_account_code="4001",
        tenant_id=TENANT
    )
    assert isinstance(result, CanonicalAccount)
    assert result.account_no == "REV.PROD.001"
    assert result.l1 == "P&L"


def test_normalize_returns_none_when_unmapped(monkeypatch):
    """normalize returns None when no mapping exists for ERP account code."""
    from services.account_normalizer import AccountNormalizer

    def fake_query(sql, params=None):
        return []

    norm = AccountNormalizer(db_query=fake_query)
    result = norm.normalize(erp_source_id=1, erp_account_code="9999-UNKNOWN", tenant_id=uuid.uuid4())
    assert result is None


def test_normalize_direct_match_fallback(monkeypatch):
    """normalize falls back to direct dim_account match when mapping absent."""
    from services.account_normalizer import AccountNormalizer, CanonicalAccount

    call_log = []

    def fake_query(sql, params=None):
        call_log.append(sql)
        if "dim_erp_mapping" in sql:
            return []  # no mapping
        if "dim_account" in sql:
            return [{
                "account_no": "5001",
                "account_name": "Cost of Goods Sold",
                "l1_category": "P&L",
                "l2_category": "COGS",
                "l3_category": "Direct Costs"
            }]
        return []

    norm = AccountNormalizer(db_query=fake_query)
    result = norm.normalize(erp_source_id=1, erp_account_code="5001", tenant_id=uuid.uuid4())
    assert result is not None
    assert result.account_no == "5001"
    assert result.l2 == "COGS"


# ── tenant isolation ──────────────────────────────────────────────────────────

def test_normalize_passes_tenant_id_to_query(monkeypatch):
    """normalize passes tenant_id as query parameter (multi-tenant isolation)."""
    from services.account_normalizer import AccountNormalizer

    captured_params = []

    def fake_query(sql, params=None):
        if params:
            captured_params.append(params)
        return []

    TENANT = uuid.uuid4()
    norm = AccountNormalizer(db_query=fake_query)
    norm.normalize(erp_source_id=1, erp_account_code="4001", tenant_id=TENANT)

    all_params = [str(p) for params in captured_params for p in (params if isinstance(params, (list, tuple)) else [params])]
    assert any(str(TENANT) in p for p in all_params), "tenant_id must be passed in query params"


# ── batch normalize ───────────────────────────────────────────────────────────

def test_normalize_batch_returns_dict(monkeypatch):
    """normalize_batch returns dict keyed by erp_account_code."""
    from services.account_normalizer import AccountNormalizer

    def fake_query(sql, params=None):
        return []

    norm = AccountNormalizer(db_query=fake_query)
    result = norm.normalize_batch(
        erp_source_id=1,
        erp_account_codes=["4001", "5001"],
        tenant_id=uuid.uuid4()
    )
    assert isinstance(result, dict)
    assert "4001" in result
    assert "5001" in result
