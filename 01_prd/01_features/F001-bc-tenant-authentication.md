# F001 — BC Tenant Authentication & Connectivity

**Area:** Business Central Integration  
**Priority:** Must  
**PRD References:** FR-INT-01

---

## Situation

RIA Advisory operates 17 independent Business Central (BC) SaaS tenants across its subsidiaries. Each tenant is a separate Entra ID (Azure AD) boundary. The platform must authenticate to all 17 tenants programmatically, without human credential intervention, to enable automated data extraction.

---

## Problem

Manual or password-based authentication to 17 BC tenants is operationally unsustainable, a security liability, and incompatible with automated pipeline execution. There is no centralised identity mechanism today bridging the group Azure tenant to each subsidiary BC tenant. Credentials stored in scripts or config files violate SEC cybersecurity posture requirements.

---

## Action

### User Stories

- As a platform engineer, I can register an Entra ID app per subsidiary BC tenant so the pipeline can authenticate non-interactively.
- As a security administrator, I can rotate certificates without redeploying pipeline code.
- As a platform operator, I can onboard a new subsidiary BC tenant's auth config through the admin console without touching pipeline infrastructure.

### Acceptance Criteria

1. Each BC tenant has a dedicated Entra ID app registration with the minimum required API permissions (`Financials.ReadWrite.All` or scoped equivalent).
2. Authentication uses OAuth 2.0 client-credentials flow with **certificate-based secrets** (no client secrets / passwords).
3. Certificates are stored in Azure Key Vault; pipeline retrieves them via managed identity — no credentials in code or config files.
4. Token acquisition and refresh are handled transparently by the integration layer; pipelines never manage raw tokens.
5. A failed authentication attempt (expired cert, revoked permission) raises an alert within 5 minutes and does not silently produce empty extracts.
6. Auth configuration for each tenant (tenant ID, app client ID, Key Vault secret reference) is stored in a versioned configuration store, not hard-coded.
7. New tenant auth config can be registered end-to-end via the subsidiary onboarding wizard (F022) without pipeline redeployment.

### Technical Notes

- Entra ID app registrations are provisioned per subsidiary, not shared, to enforce principle of least privilege.
- Certificate rotation schedule: 90-day rotation enforced via Key Vault policy with 14-day renewal reminder alert.
- For subsidiaries that cannot grant app registration within SLA (10 business days), escalation path to executive sponsor is documented.

---

## Result

- All 17 BC tenants are accessible to the pipeline using certificate-based OAuth with zero stored passwords.
- Certificate-based auth eliminates secret-expiry incidents that would silently break pipelines.
- Onboarding a new subsidiary's auth takes < 2 hours end-to-end via the admin wizard.
- Zero credentials stored in source control or pipeline configuration files.

---

## Constraints

- **Dependency:** Each subsidiary must provision an Entra ID app registration and grant API consent — requires subsidiary IT cooperation within 10 business days.
- **Dependency:** Azure Key Vault instance provisioned and accessible via managed identity before pilot go-live (F005).
- **Out of scope:** On-premises BC deployments requiring Self-Hosted Integration Runtime — handled as a separate infrastructure task if discovered.
- **Out of scope:** User-delegated OAuth flows; this feature covers service-principal / daemon authentication only.
- **Constraint:** Microsoft BC API rate limits apply per tenant; authentication alone does not solve throttling (see F004).
