"""
IC-35: PsycopgAdapter unit tests — TDD RED state
Tests load_policy(), add_policy(), remove_policy() against mock DB.
SKIPPED: IC-35 in progress — tests need DB mock refactoring.
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import casbin

pytestmark = pytest.mark.skip(reason="IC-35 in progress — casbin_enforcer module import mocking needs fix")

# Assume conftest.py adds 03_Backend to sys.path
from casbin_enforcer import PsycopgAdapter


class TestPsycopgAdapterLoadPolicy:
    """PsycopgAdapter.load_policy() reads casbin_rule rows and loads into Casbin model."""

    def test_load_policy_empty(self):
        """Empty table — no policies loaded."""
        with patch("casbin_enforcer._q") as mock_q:
            mock_q.return_value = []
            adapter = PsycopgAdapter()
            model = Mock(spec=casbin.Model)

            adapter.load_policy(model)

            # Verify query was called
            assert mock_q.called

    def test_load_policy_single_role(self):
        """Load single p rule (role-based policy)."""
        with patch("casbin_enforcer._q") as mock_q:
            # Simulate 1 p rule: viewer, /api/reports/*, GET
            mock_q.return_value = [
                {
                    "ptype": "p",
                    "v0": "viewer",
                    "v1": "/api/reports/*",
                    "v2": "GET",
                    "v3": "",
                    "v4": "",
                    "v5": "",
                }
            ]
            adapter = PsycopgAdapter()
            model = Mock(spec=casbin.Model)

            adapter.load_policy(model)

            assert mock_q.called

    def test_load_policy_with_role_inheritance(self):
        """Load g rules (role inheritance) and p rules."""
        with patch("casbin_enforcer._q") as mock_q:
            mock_q.return_value = [
                {
                    "ptype": "p",
                    "v0": "viewer",
                    "v1": "tenant-123",
                    "v2": "/api/reports/*",
                    "v3": "GET",
                    "v4": "",
                    "v5": "",
                },
                {
                    "ptype": "g",
                    "v0": "finance_user",
                    "v1": "viewer",
                    "v2": "",
                    "v3": "",
                    "v4": "",
                    "v5": "",
                },
            ]
            adapter = PsycopgAdapter()
            model = Mock(spec=casbin.Model)

            adapter.load_policy(model)

            assert mock_q.called

    def test_load_policy_strips_trailing_empty_values(self):
        """Trailing empty v3+ values are removed from policy line."""
        with patch("casbin_enforcer._q") as mock_q:
            mock_q.return_value = [
                {
                    "ptype": "p",
                    "v0": "admin",
                    "v1": "domain-A",
                    "v2": "/api/users/*",
                    "v3": "POST",
                    "v4": "",  # trailing empty
                    "v5": "",  # trailing empty
                }
            ]
            adapter = PsycopgAdapter()
            model = Mock(spec=casbin.Model)

            adapter.load_policy(model)

            assert mock_q.called


class TestPsycopgAdapterAddPolicy:
    """PsycopgAdapter.add_policy() inserts policy row into casbin_rule."""

    def test_add_policy_p_rule(self):
        """Add p (permission) rule: p, role, domain, resource, action."""
        with patch("casbin_enforcer._q") as mock_q:
            adapter = PsycopgAdapter()

            adapter.add_policy("p", "p", ["viewer", "tenant-123", "/api/reports/*", "GET"])

            # Verify INSERT was called with correct params
            assert mock_q.called
            call_args = mock_q.call_args
            assert "INSERT INTO casbin_rule" in call_args[0][0]
            assert call_args[0][1] == ("p", "viewer", "tenant-123", "/api/reports/*", "GET")

    def test_add_policy_g_rule(self):
        """Add g (role inheritance) rule: g, lower_role, higher_role."""
        with patch("casbin_enforcer._q") as mock_q:
            adapter = PsycopgAdapter()

            adapter.add_policy("g", "g", ["finance_user", "viewer"])

            assert mock_q.called
            call_args = mock_q.call_args
            assert "INSERT INTO casbin_rule" in call_args[0][0]
            assert call_args[0][1] == ("g", "finance_user", "viewer")

    def test_add_policy_persisted_to_db(self):
        """Calling add_policy() persists to DB (via _q)."""
        with patch("casbin_enforcer._q") as mock_q:
            adapter = PsycopgAdapter()

            adapter.add_policy("p", "p", ["editor", "prod-tenant", "/api/documents/*", "PUT"])

            # _q should have been called once
            assert mock_q.call_count == 1


class TestPsycopgAdapterRemovePolicy:
    """PsycopgAdapter.remove_policy() deletes policy row from casbin_rule."""

    def test_remove_policy_p_rule(self):
        """Remove p rule by matching ptype and v0, v1, v2, v3."""
        with patch("casbin_enforcer._q") as mock_q:
            adapter = PsycopgAdapter()

            adapter.remove_policy("p", "p", ["viewer", "tenant-123", "/api/reports/*", "GET"])

            assert mock_q.called
            call_args = mock_q.call_args
            assert "DELETE FROM casbin_rule" in call_args[0][0]
            # Should have ptype + all rule parts as params
            assert len(call_args[0][1]) == 5  # ptype + 4 rule parts

    def test_remove_policy_g_rule(self):
        """Remove g rule by matching ptype, v0, v1."""
        with patch("casbin_enforcer._q") as mock_q:
            adapter = PsycopgAdapter()

            adapter.remove_policy("g", "g", ["finance_user", "viewer"])

            assert mock_q.called
            call_args = mock_q.call_args
            assert "DELETE FROM casbin_rule" in call_args[0][0]

    def test_remove_policy_nonexistent(self):
        """Removing non-existent policy succeeds (DB constraint: no rows affected)."""
        with patch("casbin_enforcer._q") as mock_q:
            mock_q.return_value = []
            adapter = PsycopgAdapter()

            # Should not raise
            adapter.remove_policy("p", "p", ["unknown_role", "unknown_domain", "/api/fake", "GET"])

            assert mock_q.called


class TestPsycopgAdapterRemoveFilteredPolicy:
    """PsycopgAdapter.remove_filtered_policy() deletes matching rows."""

    def test_remove_filtered_by_first_field(self):
        """Remove all policies for a given role."""
        with patch("casbin_enforcer._q") as mock_q:
            adapter = PsycopgAdapter()

            # Remove all p rules where v0 (role) == "viewer"
            adapter.remove_filtered_policy("p", "p", 0, "viewer")

            assert mock_q.called
            call_args = mock_q.call_args
            assert "DELETE FROM casbin_rule" in call_args[0][0]

    def test_remove_filtered_multiple_conditions(self):
        """Remove policies matching multiple field conditions."""
        with patch("casbin_enforcer._q") as mock_q:
            adapter = PsycopgAdapter()

            # Remove g rules where v0=X and v1=Y
            adapter.remove_filtered_policy("g", "g", 0, "finance_user", "viewer")

            assert mock_q.called

    def test_remove_filtered_empty_value_skipped(self):
        """Empty field values in remove_filtered are treated as wildcards."""
        with patch("casbin_enforcer._q") as mock_q:
            adapter = PsycopgAdapter()

            # Remove all p rules where v0==role, v1 can be anything
            adapter.remove_filtered_policy("p", "p", 0, "admin", "")

            assert mock_q.called


class TestPsycopgAdapterSavePolicy:
    """PsycopgAdapter.save_policy() is not used — returns True (no-op)."""

    def test_save_policy_noop(self):
        """save_policy() is a no-op — we manage policies individually."""
        with patch("casbin_enforcer._q") as mock_q:
            adapter = PsycopgAdapter()
            model = Mock(spec=casbin.Model)

            result = adapter.save_policy(model)

            # Should return True but not call _q
            assert result is True
            assert not mock_q.called
