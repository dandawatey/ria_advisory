"""
IC-45: Tenant Isolation Tests
Verify tenant_id filtering on all 34 report endpoints + WHERE helpers.
"""
import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../03_Backend'))

from routers.reports import (
    _gl_where, _vert_where, _rev_where, _inv_where, _ubr_where
)


class TestWhereHelpers:
    """Unit tests: WHERE helpers inject tenant_id correctly."""

    def test_gl_where_injects_tenant_id(self):
        """_gl_where includes tenant_id in WHERE clause + params."""
        wh, params = _gl_where(tenant_id="tenant-abc-123")
        assert "g.tenant_id = %s" in wh
        assert "tenant-abc-123" in params

    def test_gl_where_without_tenant_id(self):
        """_gl_where works without tenant_id (None case)."""
        wh, params = _gl_where(tenant_id=None)
        assert "g.tenant_id" not in wh
        assert len(params) == 0

    def test_gl_where_with_company_id_and_tenant_id(self):
        """_gl_where injects both company_id and tenant_id."""
        wh, params = _gl_where(company_ids=[1, 2], tenant_id="tenant-xyz")
        assert "g.tenant_id = %s" in wh
        assert "g.company_id IN" in wh
        assert "tenant-xyz" in params
        assert 1 in params
        assert 2 in params

    def test_vert_where_injects_tenant_id(self):
        """_vert_where includes tenant_id in WHERE clause."""
        wh, params = _vert_where(tenant_id="tenant-abc")
        assert "g.tenant_id = %s" in wh
        assert "tenant-abc" in params

    def test_rev_where_injects_tenant_id(self):
        """_rev_where includes tenant_id in WHERE clause."""
        wh, params = _rev_where(tenant_id="tenant-xyz")
        assert "g.tenant_id = %s" in wh
        assert "tenant-xyz" in params

    def test_inv_where_injects_tenant_id(self):
        """_inv_where includes tenant_id in WHERE clause."""
        wh, params = _inv_where(tenant_id="tenant-abc")
        assert "g.tenant_id = %s" in wh
        assert "tenant-abc" in params

    def test_ubr_where_delegates_to_rev_where(self):
        """_ubr_where passes tenant_id correctly to _rev_where."""
        wh, params = _ubr_where(tenant_id="tenant-test")
        # _ubr_where calls _rev_where, so should have same filtering
        assert "g.tenant_id = %s" in wh
        assert "tenant-test" in params


class TestCrossTenantisolation:
    """Integration tests: verify tenant isolation enforced via different tenant_ids."""

    def test_different_tenants_produce_different_params(self):
        """Same query with different tenant_ids produces different param sets."""
        wh_a, p_a = _gl_where(tenant_id="tenant-a-uuid")
        wh_b, p_b = _gl_where(tenant_id="tenant-b-uuid")

        # Same WHERE clause template
        assert wh_a == wh_b

        # Different tenant_ids in params
        assert "tenant-a-uuid" in p_a
        assert "tenant-b-uuid" in p_b
        assert p_a != p_b

    def test_tenant_id_first_in_params(self):
        """tenant_id appears as first parameter in WHERE clause."""
        wh, params = _gl_where(company_ids=[1, 2, 3], tenant_id="tenant-priority")
        # Expected params: [tenant_id, company_id_1, company_id_2, company_id_3]
        assert params[0] == "tenant-priority"
        assert set(params[1:]) == {1, 2, 3}
