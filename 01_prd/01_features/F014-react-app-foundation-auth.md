# F014 — React Application Foundation & Authentication

**Area:** React Application  
**Priority:** Must  
**PRD References:** FR-APP-01, FR-APP-02, FR-APP-03

---

## Situation

The platform's user-facing experience is delivered through a single-page React web application. This application must be production-grade from day one: fast, accessible, secure, and persona-aware. Authentication uses the company's existing Entra ID SSO, and authorisation is enforced server-side — not client-side. The application is the primary interface for ~250 concurrent users across four distinct personas.

---

## Problem

Building a financial application on top of a data lakehouse without rigorous authentication and authorisation exposes sensitive, SEC-regulated financial data to unauthorised access. A poorly architected SPA foundation (wrong build tooling, client-side auth trust, improper token storage) creates security vulnerabilities and technical debt that are expensive to fix post-launch. The foundation must be correct before persona-specific features are built on top of it.

---

## Action

### User Stories

- As any platform user, I am redirected to the company's Entra ID login page and authenticated via SSO — no platform-specific password.
- As a subsidiary controller, I only see financial data for my entity — the application enforces my data scope without me needing to configure anything.
- As a platform engineer, I can deploy a new frontend version via CI/CD without manual steps or outages.

### Acceptance Criteria

**Application Foundation**

1. Single-page application built with **React 18+, TypeScript, and Vite** build tooling.
2. Served via **Azure Static Web Apps** behind **Azure Front Door** for global CDN, WAF, and custom domain with TLS.
3. Application code structured with clear separation: feature modules, shared components, API client, auth layer, routing.
4. TypeScript strict mode enabled; no `any` types in production code paths.
5. Build produces optimised bundles with code splitting per route; initial bundle < 200KB gzipped.
6. Full CI/CD pipeline: lint → type-check → unit tests → build → preview deploy (on PR) → production deploy (on merge to main).
7. Feature flags mechanism for staged rollout of new functionality.

**Authentication**

8. Authentication via **Entra ID SSO using MSAL** (`@azure/msal-react`).
9. MSAL configured with the platform's Entra ID app registration (separate from BC extraction app registrations).
10. Access tokens stored in memory (not localStorage); refresh tokens in secure, httpOnly, SameSite=Strict cookies — never accessible to JavaScript.
11. Silent token refresh handled by MSAL before expiry; user is not prompted to re-login during an active session.
12. Session timeout: access token lifetime ≤ 1 hour; refresh token lifetime ≤ 24 hours idle / 7 days absolute — configurable in Entra ID conditional access policy.
13. On authentication failure or token expiry without refresh, user is redirected to login with a clear message (not a blank screen).

**Authorisation**

14. Entra ID group membership maps to platform roles: `group-exec` → Executive, `group-group-finance` → Group Finance, `group-subsidiary-{code}` → Subsidiary Controller (scoped to entity), `group-fpa` → FP&A.
15. **Server-side authorisation is authoritative** — the UI reads role claims to control UI element visibility, but never trusts them as the security check. Every API request is independently authorised by the API layer (F019).
16. The React app never holds or renders data beyond what the API returns for the authenticated user's scope.
17. Unauthorised route access results in a 403 view, not a redirect to login (to distinguish auth vs. authz failures).

**Accessibility & Responsiveness**

18. WCAG 2.1 AA compliance across all pages (contrast ratios, keyboard navigation, screen reader labels, focus management).
19. Fully responsive layout at 768px (tablet) and above. Mobile (< 768px) shows a graceful degraded read-only view with a notice that full functionality requires tablet/desktop.
20. Accessible colour palette and typography defined in the design system; tokens used consistently across all feature modules.

---

## Result

- Secure, performant SPA foundation that all persona-specific features (F015–F020) are built upon.
- Users authenticate via existing company SSO — zero new credentials or password management.
- Data scoping enforced at the API level ensures no cross-entity data leakage regardless of UI state.
- WCAG 2.1 AA compliance achieved from launch.

---

## Constraints

- **Dependency:** Entra ID app registration for the React app provisioned by platform team before development begins.
- **Dependency:** Azure Static Web Apps and Front Door provisioned via Terraform (IaC).
- **Dependency:** F019 (API layer) is the sole data provider — the React app never queries Gold directly.
- **Dependency:** F024 (security controls) defines the network and token policies the frontend must comply with.
- **Out of scope:** Mobile native application (iOS/Android) — Phase 2.
- **Out of scope:** Server-side rendering (SSR) — Static Web Apps SPA model is sufficient for Phase 1 performance targets.
- **Constraint:** MSAL token storage in memory means tokens are lost on page refresh; MSAL handles re-acquisition silently. This is a known, intentional security trade-off.
