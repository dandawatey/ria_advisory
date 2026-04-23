# F024 — Security, Privacy & Compliance Controls

**Area:** Cross-Cutting / Security  
**Priority:** Must  
**PRD References:** §11 (Security, Privacy & Compliance)

---

## Situation

RIA Advisory subsidiaries are SEC-registered investment advisers. The platform holds financial data subject to Investment Advisers Act Rule 204-2 (books and records), Regulation S-P (safeguarding client NPI), SEC Cybersecurity Risk Management rules, and potentially GDPR and state privacy laws. CISO sign-off is required before pilot go-live. The platform must be secure by design — not retrofitted after launch.

---

## Problem

A data platform handling SEC-regulated financial records and client PII that lacks systematic security controls is not merely a technical risk — it is a regulatory violation. Perimeter-only security, unencrypted data at rest, or UI-layer-only authorisation create attack surfaces that can result in SEC enforcement action, client notification obligations under Reg S-P, and reputational damage. These controls must be foundational, not bolted on.

---

## Action

### User Stories

- As the CISO, I can attest that all platform data is encrypted at rest and in transit, with no public internet exposure to storage or compute.
- As a compliance officer, I can produce an audit log of every data access event for any user, date, and entity within 24 hours of request.
- As a subsidiary controller, I can only see financial data for my entity — I have no ability to access other subsidiaries' data even via direct API manipulation.

### Acceptance Criteria

**Encryption**

1. All data at rest encrypted using **Customer-Managed Keys (CMK)** stored in Azure Key Vault — applies to ADLS Gen2, SQL Warehouse scratch storage, and any application database.
2. All data in transit uses **TLS 1.2+** — enforced at Azure Front Door, API layer, and all internal service-to-service communication; TLS 1.0/1.1 disabled.
3. Key rotation policy: CMK rotated annually; automated rotation configured via Key Vault rotation policy; rotation does not require downtime.

**Network Isolation**

4. No public internet access to ADLS Gen2, Databricks SQL Warehouse, or the API backend — accessed exclusively via **Azure Private Link / Private Endpoints**.
5. Azure Front Door (with WAF policy) is the only public-facing component — accepts HTTPS traffic for the React SPA and the API; WAF rules include OWASP Core Rule Set.
6. All Azure-to-Azure communication uses managed identities and private endpoints — no service account keys or storage access keys in code or config.
7. Databricks workspace deployed in a customer-managed VNet with no public cluster access.

**Row-Level Security & Column-Level Masking**

8. **Row-level security (RLS)** enforced at the **Databricks SQL Warehouse layer** using Unity Catalog dynamic views or row filters — users can only query rows matching their authorised entity scope.
9. RLS is enforced for all access paths: React app (via API), direct SQL Warehouse connection (BI tools, SQL clients), and programmatic API access.
10. **Column-level masking** applied to PII fields (customer NPI, bank account numbers, SSN-equivalent identifiers) for all roles except narrowly authorised data steward roles — enforced in Unity Catalog.
11. RLS and masking policies are defined in Terraform and version-controlled; no manual Unity Catalog permission changes in production.
12. Quarterly access review: all Entra ID group memberships reviewed by the CISO and group finance; stale memberships removed.

**Audit Logging**

13. Every data access event logged: UI query (via Application Insights), API request (F019 access log), SQL Warehouse query (Databricks audit log), and direct lake access (ADLS diagnostic log).
14. Audit logs centralised in Log Analytics Workspace; retained **7 years** in immutable (WORM) storage — satisfying SEC Rule 204-2.
15. Audit log entries include: `user_id`, `entra_group`, `entity_scope`, `action`, `resource`, `timestamp`, `source_ip`, `query_or_payload_hash` (no PII in log metadata).
16. Audit log is queryable on demand; can produce a full access history for any user or resource within 24 hours of request.
17. Privileged actions (mapping approval, sign-off, admin config change) logged at higher verbosity — full payload hashed and stored.

**Immutability & Retention**

18. Bronze ADLS container enforces WORM immutable blob policy with 7-year retention lock (F005).
19. Audit logs and run metadata stored with equivalent WORM protection.
20. No delete or overwrite operations permitted on Bronze or audit storage — pipeline failures result in quarantine, not deletion.

**Vulnerability Management**

21. SAST (static application security testing) and dependency scanning integrated into CI/CD pipeline — builds fail on critical CVEs.
22. Annual third-party penetration test; quarterly vulnerability scanning of all deployed resources.
23. Dependency pinning and `dependabot` / equivalent automated update PRs for all package managers.
24. Secrets scanning in CI (e.g., `gitleaks`) — any committed secret triggers an immediate build failure and incident.

**Incident Response**

25. Incident response runbook documented and accessible to CISO and platform ops team before pilot go-live.
26. SEC cybersecurity incident reporting posture aligned to adopted SEC amendments — material incidents reported within required timelines.
27. Data breach detection: Azure Defender for Storage enabled on all ADLS accounts; anomaly detection alerts to CISO within 1 hour of trigger.

**Compliance Posture**

28. Security architecture review and data-residency sign-off by CISO completed before pilot go-live (PRD §13.3).
29. Data residency: all Azure resources in US regions (East US + West US for DR) — no cross-border data transfer unless explicitly approved for EU-resident subsidiaries.
30. SOC 2 Type II readiness assessment completed in Year 1; formal SOC 2 Type II audit targeted for Year 2.

---

## Result

- Platform meets SEC Rule 204-2, Reg S-P, and SEC Cybersecurity Rule requirements at launch.
- CISO can attest to encryption, network isolation, access control, and audit logging completeness.
- Entity data scoping is technically enforced — no cross-entity leakage possible via any access path.
- Audit evidence for any regulatory inquiry available on demand within 24 hours.

---

## Constraints

- **Dependency:** All other features depend on this — security controls are a prerequisite gate for pilot go-live, not a post-launch hardening exercise.
- **Dependency:** CISO sign-off (security architecture review) required before pilot (PRD §13.3).
- **Dependency:** Azure enterprise agreement headroom for Databricks, ADLS, Front Door, Key Vault, Defender (PRD §13.3).
- **Dependency:** Terraform IaC coverage is 100% — no manual console changes in production (PRD NFR).
- **Out of scope:** Statutory filing generation, formal SOC 2 audit (Year 1), GDPR DPA agreements (Phase 2 for EU subsidiaries).
- **Constraint:** CMK and Private Endpoint configuration adds complexity to local development; developers must use a dev environment that mirrors the prod network topology, not a simplified open-network setup.
- **Constraint:** WORM lock on Bronze storage is irreversible — must be thoroughly validated in dev/UAT before enabling in production (coordinate with CISO and legal before locking).
