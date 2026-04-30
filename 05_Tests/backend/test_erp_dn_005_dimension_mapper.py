"""
test_erp_dn_005_dimension_mapper.py — TDD tests for DimensionMapper
Agent: Vikram_QA_005  |  Ticket: IC-7 / ERP-DN-005
RED phase: all tests must FAIL before implementation is written.
"""
import pytest
import uuid


# ── Import test ───────────────────────────────────────────────────────────────

def test_imports():
    """DimensionMapper must be importable from services.dimension_mapper."""
    from services.dimension_mapper import DimensionMapper
    assert DimensionMapper is not None


def test_canonical_dimension_namedtuple():
    """CanonicalDimension must have dimension_type, code, name fields."""
    from services.dimension_mapper import CanonicalDimension
    cd = CanonicalDimension(dimension_type="department", code="DEPT-001", name="Finance")
    assert cd.dimension_type == "department"
    assert cd.code == "DEPT-001"
    assert cd.name == "Finance"


def test_instantiation():
    """DimensionMapper instantiates with db_query callable."""
    from services.dimension_mapper import DimensionMapper
    mapper = DimensionMapper(db_query=None)
    assert mapper is not None


# ── map_dimension — happy path ─────────────────────────────────────────────────

def test_map_dimension_found(monkeypatch):
    """map_dimension returns CanonicalDimension when mapping exists."""
    from services.dimension_mapper import DimensionMapper, CanonicalDimension

    def fake_query(sql, params=None):
        return [{
            "canonical_code": "DEPT-FIN",
            "canonical_name": "Finance Department"
        }]

    mapper = DimensionMapper(db_query=fake_query)
    result = mapper.map_dimension(
        erp_source_id=1,
        dimension_type="department",
        erp_code="BC-FIN-01",
        tenant_id=uuid.uuid4()
    )
    assert isinstance(result, CanonicalDimension)
    assert result.code == "DEPT-FIN"
    assert result.name == "Finance Department"
    assert result.dimension_type == "department"


def test_map_dimension_not_found_returns_none():
    """map_dimension returns None when no mapping in dim_erp_mapping."""
    from services.dimension_mapper import DimensionMapper

    def fake_query(sql, params=None):
        return []

    mapper = DimensionMapper(db_query=fake_query)
    result = mapper.map_dimension(
        erp_source_id=1,
        dimension_type="department",
        erp_code="UNKNOWN-999",
        tenant_id=uuid.uuid4()
    )
    assert result is None


# ── dimension type validation ─────────────────────────────────────────────────

def test_map_dimension_valid_types():
    """All 4 canonical dimension types are accepted."""
    from services.dimension_mapper import DimensionMapper, VALID_DIMENSION_TYPES
    for t in ["department", "project", "cost_centre", "geography"]:
        assert t in VALID_DIMENSION_TYPES


def test_map_dimension_invalid_type_raises():
    """map_dimension raises ValueError for unsupported dimension_type."""
    from services.dimension_mapper import DimensionMapper

    def fake_query(sql, params=None):
        return []

    mapper = DimensionMapper(db_query=fake_query)
    with pytest.raises(ValueError, match="dimension_type"):
        mapper.map_dimension(
            erp_source_id=1,
            dimension_type="unknown_type",
            erp_code="X",
            tenant_id=uuid.uuid4()
        )


# ── tenant isolation ──────────────────────────────────────────────────────────

def test_map_dimension_passes_tenant_id(monkeypatch):
    """map_dimension passes tenant_id as param (Rule 05 multi-tenant)."""
    from services.dimension_mapper import DimensionMapper

    captured = []

    def fake_query(sql, params=None):
        if params:
            captured.append(params)
        return []

    TENANT = uuid.uuid4()
    mapper = DimensionMapper(db_query=fake_query)
    mapper.map_dimension(erp_source_id=1, dimension_type="project", erp_code="P-001", tenant_id=TENANT)

    all_vals = [str(v) for params in captured for v in (params if isinstance(params, (list, tuple)) else [params])]
    assert any(str(TENANT) in v for v in all_vals), "tenant_id must be in query params"


# ── batch mapping ─────────────────────────────────────────────────────────────

def test_map_batch_returns_dict():
    """map_batch returns dict keyed by erp_code."""
    from services.dimension_mapper import DimensionMapper

    def fake_query(sql, params=None):
        return []

    mapper = DimensionMapper(db_query=fake_query)
    result = mapper.map_batch(
        erp_source_id=1,
        dimension_type="department",
        erp_codes=["A", "B", "C"],
        tenant_id=uuid.uuid4()
    )
    assert isinstance(result, dict)
    assert "A" in result
    assert "B" in result
    assert "C" in result


# ── erp_source_id isolation ───────────────────────────────────────────────────

def test_map_dimension_passes_erp_source_id(monkeypatch):
    """map_dimension passes erp_source_id to query (different ERPs can map same code differently)."""
    from services.dimension_mapper import DimensionMapper

    captured = []

    def fake_query(sql, params=None):
        if params:
            captured.append(list(params) if isinstance(params, (list, tuple)) else [params])
        return []

    mapper = DimensionMapper(db_query=fake_query)
    mapper.map_dimension(erp_source_id=42, dimension_type="project", erp_code="P-001", tenant_id=uuid.uuid4())

    all_vals = [str(v) for params in captured for v in params]
    assert any("42" in v for v in all_vals), "erp_source_id must be in query params"
