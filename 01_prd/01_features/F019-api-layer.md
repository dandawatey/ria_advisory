# F019 — API Layer (REST + GraphQL)

**Area:** React Application  
**Priority:** Must  
**PRD References:** FR-APP-08

---

## Situation

The React application and any future BI or programmatic consumers must access Gold-layer financial data through a governed, versioned API layer. The API layer sits between consumers and the Databricks SQL Warehouse, enforcing authorisation, abstracting the data model, and providing a stable contract. The UI never queries the data lake directly.

---

## Problem

Direct lake queries from the frontend would expose internal table schemas, bypass server-side authorisation, and create tight coupling between UI components and the data model. Without an API layer, any Gold-layer schema change breaks all consumers simultaneously. The API layer also prevents a single misconfigured UI component from issuing a full-table scan against a petabyte-scale lake.

---

## Action

### User Stories

- As a frontend engineer, I consume financial data through stable, documented REST and GraphQL endpoints — I don't need to know the Gold table structure.
- As an FP&A analyst, I can query saved Explorer views programmatically via a stable API endpoint using my Entra ID token.
- As a platform operator, I can version the API and deprecate old versions without breaking existing consumers on a defined timeline.

### Acceptance Criteria

**Architecture**

1. API implemented as a **FastAPI** (Python) or **Node.js** service deployed to Azure Container Apps or Azure App Service — behind Azure Front Door alongside the SPA.
2. **REST** endpoints for structured, predictable data access (dashboards, close cockpit, entity views, pipeline metadata).
3. **GraphQL** endpoint for flexible, FP&A-style queries (Explorer, saved views, ad-hoc field selection) — prevents over-fetching.
4. All endpoints versioned: `/api/v1/...`; breaking changes require a new version with a 90-day deprecation notice for the prior version.
5. API connects to **Databricks SQL Warehouse** using a service principal (not user credentials); SQL queries parameterised, never string-interpolated (SQL injection prevention).

**Authorisation**

6. Every API request authenticated via **Bearer token (Entra ID JWT)**; unauthenticated requests return HTTP 401.
7. Row-level security enforced in the SQL Warehouse via Databricks Unity Catalog dynamic views or row filters — not in API code (to prevent bypass via direct SQL Warehouse access).
8. Entity scoping: API passes the authenticated user's entity claims to the SQL Warehouse as session parameters for RLS evaluation.
9. API returns HTTP 403 (not 404) for authorised-but-scoped-out resources — so users know the resource exists but they don't have access.

**Performance & Reliability**

10. API response cache for frequently requested, slow-changing data (e.g., canonical CoA structure, dimension values) — cache TTL configurable per endpoint; invalidated on pipeline completion event.
11. Query timeout: 30 seconds for standard REST endpoints; 60 seconds for GraphQL/Explorer queries. Returns HTTP 503 with a `retry_after` hint on timeout.
12. Rate limiting: 100 requests/minute per authenticated user; 1000 requests/minute per Entra group.
13. API availability target: 99.9% during business hours (07:00–20:00 ET, business days).

**Observability**

14. Every request logged: `request_id`, user, endpoint, entity_scope, duration_ms, status_code, row_count_returned. Retained 7 years.
15. Application Insights integrated for latency tracking, error rates, and dependency tracing (SQL Warehouse query latency visible in traces).
16. OpenAPI specification auto-generated and published at `/api/v1/docs`.

**Key Endpoints (non-exhaustive)**

17. `GET /api/v1/dashboard/summary` — consolidated KPI tiles for executive dashboard.
18. `GET /api/v1/entities/{entity_id}/trial-balance` — trial balance for entity detail view.
19. `GET /api/v1/close/{period}/status` — close cockpit period status for all entities.
20. `POST /api/v1/explorer/query` — ad-hoc Gold query with filter/dimension parameters (GraphQL preferred for this).
21. `GET /api/v1/pipeline/runs` — pipeline run history for health dashboard.
22. `POST /api/v1/pipeline/trigger` — on-demand pipeline trigger (admin only).

---

## Result

- React application and programmatic consumers have a stable, documented, versioned API — changes to Gold schema don't break consumers.
- Server-side authorisation enforced on every request — no data leakage possible via UI manipulation.
- API performance targets (< 2.5s dashboard, < 6s Explorer P95) achievable with SQL Warehouse caching and query optimisation.
- Full audit log of every data access event satisfies SEC Rule 204-2 access logging requirements.

---

## Constraints

- **Dependency:** F009 (Gold layer) + Databricks SQL Warehouse as data source.
- **Dependency:** F014 (React foundation) consumes this API.
- **Dependency:** F024 (security controls) — RLS configuration in SQL Warehouse is a security dependency.
- **Dependency:** Azure Container Apps / App Service provisioned via Terraform.
- **Out of scope:** Direct Bronze or Silver data serving — API only exposes Gold.
- **Out of scope:** Write operations to the data lake or BC systems — API is read-only for data.
- **Constraint:** GraphQL introspection disabled in production (prevents schema enumeration by unauthorised clients).
- **Constraint:** SQL Warehouse cold-start latency (first query after idle period can take 20–60s for cluster resume); API must handle this gracefully with a 503 + retry-after rather than a timeout error.
