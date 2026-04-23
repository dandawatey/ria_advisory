# F004 — Ingestion Resilience, Error Handling & Fallback

**Area:** Business Central Integration  
**Priority:** Must / Should  
**PRD References:** FR-INT-06, FR-INT-07, FR-INT-08

---

## Situation

The platform extracts data from 17 external BC SaaS tenants — systems not under RIA Advisory's direct operational control. BC APIs impose rate limits (HTTP 429), have occasional outages, and subsidiaries may temporarily lose API connectivity. Additionally, some subsidiaries may publish custom BC API pages for non-standard entities, and in rare cases a subsidiary may need to provide data via secure file drop instead of API.

---

## Problem

Without robust error handling, a single transient BC API failure cascades into a missed extraction window, stale data in Gold, and unreliable reporting — potentially during critical close periods. Over-aggressive retry can trigger rate-limit bans. Custom entity support and SFTP fallback are needed for subsidiaries that cannot always meet the standard API-based extraction model.

---

## Action

### User Stories

- As a pipeline engineer, I can rely on the extraction framework to retry transient failures automatically without manual intervention.
- As a platform operator, I am alerted when a circuit breaker trips on a tenant so I can investigate and reset manually.
- As a subsidiary controller, I can drop a signed trial balance file to a secure SFTP endpoint when my BC API is temporarily unavailable.

### Acceptance Criteria

**Resilience & Error Handling**

1. All BC API calls use **exponential backoff with jitter**: initial delay 1s, max delay 60s, max attempts configurable (default: 5).
2. On HTTP 429 (rate limit), the extractor reads the `Retry-After` header and waits the specified duration before retrying — never retries immediately.
3. **Circuit breaker:** after N consecutive failures (configurable; default: 3) on a given tenant/entity combination, the extractor stops retrying and marks the extraction as `circuit_open`. Subsequent scheduled runs skip that tenant/entity until the circuit is manually or automatically reset.
4. Circuit-open events generate an alert within 5 minutes via Azure Monitor / PagerDuty integration.
5. Partial failures (some entities succeed, some fail) do not block successful entities from proceeding to Bronze/Silver/Gold.
6. All errors are logged with full context: tenant, entity, HTTP status, response body (truncated), retry attempt number, timestamp.

**Custom BC API Pages (FR-INT-07)**

7. An **entity catalog** (configuration-as-code) defines all extraction targets: standard and custom BC API pages.
8. A subsidiary can register a custom BC API page in the entity catalog by providing: endpoint path, authentication scope, field list, and incremental strategy.
9. The extraction engine treats custom pages identically to standard pages once registered — same retry, delta, pagination logic applies.
10. Custom page registration does not require pipeline code changes — only entity catalog config update and CI/CD deploy.

**SFTP Fallback Ingestion (FR-INT-08)**

11. A secure SFTP endpoint (Azure Blob Storage with SFTP protocol enabled) is provisioned per subsidiary.
12. Accepted file format: signed trial balance + sub-ledger extract in a documented CSV/Excel schema.
13. Files deposited to SFTP trigger an ingestion pipeline that validates, parses, and lands data in Bronze — flagged as `source_type = 'sftp_fallback'` for downstream transparency.
14. SFTP ingestion applies the same DQ checks as API ingestion; malformed files are quarantined with alert.
15. SFTP path is documented in the subsidiary onboarding runbook as the fallback procedure, not the primary path.

---

## Result

- Transient BC API failures are handled transparently; only sustained failures surface as operational alerts.
- Rate-limit compliance prevents Microsoft from throttling or suspending tenant API access.
- Circuit breaker prevents runaway retry storms that could aggravate API instability.
- Custom BC entity support enables subsidiaries with non-standard data needs to participate without platform changes.
- SFTP fallback ensures data continuity even during BC API outages.

---

## Constraints

- **Dependency:** F001 (authentication) and F002 (extraction engine) are prerequisites.
- **Dependency:** F003 (orchestration) invokes the resilience-wrapped extraction functions.
- **Dependency:** F005 (Bronze zone) as write target; F023 (health dashboard) for circuit-breaker visibility.
- **Out of scope:** Real-time streaming fallback; SFTP is a batch fallback only.
- **Out of scope:** Modification or write-back to BC — platform is read-only with respect to source systems.
- **Constraint:** SFTP file schema must be defined and agreed with each subsidiary before the fallback path is activated.
- **Constraint:** Microsoft BC API rate-limit policy is external and subject to change; implementation must be reactive to `Retry-After` headers, not hard-coded delay values.
