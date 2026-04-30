"""
test_erp_cf_002_vault.py — TDD tests for Credential Vault Service
Agent: Vikram_QA_005  |  Ticket: IC-3 / IC-25
RED: all fail before implementation exists
GREEN: all pass after vault.py written
"""
import pytest
import os


# ── AC-01: Import works ──────────────────────────────────────────────────────

def test_vault_service_importable():
    from services.vault import VaultService
    assert VaultService is not None


# ── AC-02: Env backend stores and retrieves secret ───────────────────────────

def test_env_backend_store_and_retrieve(monkeypatch):
    from services.vault import VaultService
    vault = VaultService(backend="env")
    ref = "erp/test/api_key"
    secret = "super-secret-value-123"
    vault.store(ref, secret)
    retrieved = vault.retrieve(ref)
    assert retrieved == secret


# ── AC-03: retrieve returns None for unknown ref ─────────────────────────────

def test_retrieve_unknown_ref_returns_none():
    from services.vault import VaultService
    vault = VaultService(backend="env")
    result = vault.retrieve("erp/nonexistent/key")
    assert result is None


# ── AC-04: Vault never logs the secret value ─────────────────────────────────

def test_store_does_not_log_secret(caplog):
    import logging
    from services.vault import VaultService
    vault = VaultService(backend="env")
    with caplog.at_level(logging.DEBUG):
        vault.store("erp/test/secret", "MY_PLAINTEXT_SECRET")
    for record in caplog.records:
        assert "MY_PLAINTEXT_SECRET" not in record.message, \
            "Secret leaked into log output"


# ── AC-05: rotate replaces old secret ───────────────────────────────────────

def test_rotate_replaces_secret():
    from services.vault import VaultService
    vault = VaultService(backend="env")
    vault.store("erp/test/rotate_key", "old-secret")
    vault.rotate("erp/test/rotate_key", "new-secret")
    assert vault.retrieve("erp/test/rotate_key") == "new-secret"


# ── AC-06: make_ref builds correct path ──────────────────────────────────────

def test_make_ref_format():
    from services.vault import VaultService
    vault = VaultService(backend="env")
    ref = vault.make_ref(erp_source_id=42, credential_type="oauth2")
    assert "42" in ref
    assert "oauth2" in ref


# ── AC-07: delete removes secret ─────────────────────────────────────────────

def test_delete_removes_secret():
    from services.vault import VaultService
    vault = VaultService(backend="env")
    vault.store("erp/test/delete_me", "temp-secret")
    vault.delete("erp/test/delete_me")
    assert vault.retrieve("erp/test/delete_me") is None


# ── AC-08: unsupported backend raises ValueError ─────────────────────────────

def test_unsupported_backend_raises():
    from services.vault import VaultService
    with pytest.raises(ValueError, match="Unsupported vault backend"):
        VaultService(backend="unknown_backend")
