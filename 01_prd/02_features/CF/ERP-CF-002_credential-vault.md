# Feature: ERP-CF-002 — Credential Vault

**Created:** 2026-04-29
**Ticket:** ERP-CF-002
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** Critical
**Owner:** Ishaan_Security_007
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Encrypted storage service for all ERP credentials (OAuth tokens, API keys, JDBC passwords, SAP JCo params). Phase 1: AWS Secrets Manager / Azure Key Vault backend. PostgreSQL stores only vault reference keys — never plaintext secrets. OAuth2 auto-refresh before expiry.

### Why
ERP credentials are high-value targets. Plaintext in DB or logs = immediate breach risk. Regulatory requirement (SOC2, ISO27001) to demonstrate credential management controls.

### Acceptance Criteria
- AC-04: PostgreSQL `dim_erp_credential.vault_secret_ref` contains only reference path — no secret value
- AC-07: No plaintext credential appears in any application log
- AC: Token refresh runs 10 minutes before OAuth2 expiry
- AC: Credential access logged with who/what/when in audit table
- AC: Per-tenant isolation — tenant A cannot retrieve tenant B credentials

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/credential_vault.py

class CredentialVaultService:
  backend: VaultBackend  # AWSSecretsManager | AzureKeyVault | EnvVault (dev)

  def store_credential(tenant_id, erp_source_id, cred_type, secret_dict) -> vault_ref:
    ref = f"ria/{tenant_id}/{erp_source_id}/{cred_type}"
    backend.put_secret(ref, encrypt(secret_dict))
    db.insert(dim_erp_credential, {vault_secret_ref: ref, ...})
    audit_log("store", ref, current_user)
    return ref

  def retrieve_credential(tenant_id, erp_source_id) -> dict:
    row = db.get(dim_erp_credential, {erp_source_id, tenant_id})
    assert row.tenant_id == tenant_id  # isolation check
    secret = backend.get_secret(row.vault_secret_ref)
    audit_log("retrieve", row.vault_secret_ref, current_user)
    return decrypt(secret)

  def rotate_credential(tenant_id, erp_source_id, new_secret_dict):
    ...refresh vault + update expires_at + audit log

  async def token_refresh_scheduler():
    # runs every 5 minutes
    expiring = db.query("SELECT * FROM dim_erp_credential WHERE expires_at < NOW() + INTERVAL '10 minutes'")
    for cred in expiring:
      refresh_oauth_token(cred)
```

### Frontend
- Credential entry form in Add Connector Wizard (ERP-CF-004)
- Fields masked — never shown after save
- "Test Connection" button calls `test_connection()` with retrieved credential

---

## A — Architecture

### New Files
- `03_Backend/services/credential_vault.py` — vault service
- `03_Backend/services/vault_backends/aws_secrets.py`
- `03_Backend/services/vault_backends/azure_keyvault.py`
- `03_Backend/services/vault_backends/env_vault.py` — dev/test only

### Modified Files
- `03_Backend/main.py` — ENV: `VAULT_BACKEND=aws|azure|env`
- `03_Backend/database.py` — add `dim_erp_credential` table migration

### DB / API changes
New table `dim_erp_credential` (see PRD §6.1). No secrets in DB.
New env vars: `VAULT_BACKEND`, `AWS_SECRET_ARN_PREFIX`, `AZURE_VAULT_URL`

---

## R — Refinement

### Edge Cases
- Vault backend unavailable: fail fast with `VaultUnavailableError` — do NOT fall back to DB
- Token refresh failure: mark `dim_erp_credential.status = 'refresh_failed'`; alert admin; halt sync
- Secret rotation: old secret remains valid in vault until new secret confirmed working

### Security
- AES-256 encryption at rest enforced by vault backend (not application layer)
- Per-tenant KMS key (AWS) or per-tenant Key Vault (Azure)
- Secret never returned in API response — only vault reference
- `env_vault.py` DISABLED in production (`ENV=production` check)

### Performance
- Credential retrieval cached in-process for connector session lifetime (max 55 min)
- Token refresh is async; does not block sync execution

---

## C — Completion

### Done Criteria
- [ ] `CredentialVaultService` implemented with store/retrieve/rotate/delete
- [ ] AWS Secrets Manager backend working
- [ ] `env_vault.py` for local dev (reads from .env)
- [ ] `dim_erp_credential` table created with migration
- [ ] Token refresh scheduler operational
- [ ] No plaintext in any log confirmed by grep test
- [ ] Audit log entries created for every store/retrieve/rotate

### Test Plan
- Store credential → verify DB has only vault_ref not secret
- Retrieve credential → verify correct secret returned
- Retrieve as different tenant → expect 403 / isolation error
- Simulate token expiry → verify auto-refresh fires
- Search all logs for secret value → expect zero matches
