# i-finsights — Technical Architecture

**Version:** 1.0
**Stack:** React 18 + TypeScript → FastAPI → PostgreSQL
**Deployed:** https://i-finsights.netlify.app

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  17 Business Central SaaS Tenants                                   │
│  BC001 · BC002 · BC003 ... BC017                                    │
│  Microsoft Dynamics 365 Business Central OData API v2.0             │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Certificate-based OAuth
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FastAPI Backend  (03_Backend/)           http://localhost:8000      │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │ Auth Router  │  │Tenant Router│  │ ETL Scripts  │               │
│  │ /auth/*      │  │/api/tenants │  │ etl/         │               │
│  └─────────────┘  └─────────────┘  └──────┬───────┘               │
│  ┌─────────────┐  ┌─────────────┐         │                        │
│  │  Dashboard  │  │  Analytics  │  Bronze → Silver → Gold          │
│  │  /api/dash  │  │  /api/analy │         │                        │
│  └─────────────┘  └─────────────┘         │                        │
│  ┌─────────────┐  ┌─────────────┐         │                        │
│  │  GL Router  │  │ Reports     │         │                        │
│  │  /api/gl    │  │ /api/reports│         │                        │
│  └─────────────┘  └─────────────┘         │                        │
└────────────────────────────────────────────┼────────────────────────┘
                                             │
                    ┌────────────────────────▼────────────────────────┐
                    │  PostgreSQL Database                             │
                    │                                                 │
                    │  ┌─────────────┐   ┌──────────────────────┐   │
                    │  │  Raw Layer  │   │   Star Schema (Gold)  │   │
                    │  │ gl_unified  │   │  fact_gl_entries       │   │
                    │  │ 188K rows   │   │  fact_coa_balances     │   │
                    │  │ 17 entities │   │  fact_posted_sales     │   │
                    │  └─────────────┘   │  dim_* (12 dims)      │   │
                    │                    └──────────────────────┘   │
                    │  ┌─────────────────────────────────────────┐   │
                    │  │  Auth & Multi-Tenancy                   │   │
                    │  │  tenants · users · tenant_bc_config     │   │
                    │  └─────────────────────────────────────────┘   │
                    └─────────────────────────────────────────────────┘
                                             ▲
                                      REST API (JSON)
                                      Bearer JWT auth
                                             │
┌────────────────────────────────────────────┼────────────────────────┐
│  React Frontend  (02_Frontend/)            │   http://localhost:5173 │
│  Deployed to Netlify                       │                        │
│                                            │                        │
│  ┌─────────────────────────────────────────┴──────────────────┐    │
│  │  AuthContext  ·  TenantContext  ·  MSAL (Entra ID)         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │  AppShell    │  │  Sidebar     │  │  ProtectedRoute        │   │
│  │  (Layout)    │  │  (Nav)       │  │  (Role Guards)         │   │
│  └──────────────┘  └──────────────┘  └───────────────────────┘   │
│                                                                     │
│  51 Pages: Landing · Login · Dashboard · GL Explorer · Reports...   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Technology
| Package | Version | Purpose |
|---------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.5.3 | Type safety |
| Vite | 5.3.4 | Build tool + dev server |
| React Router | 6.26.0 | SPA routing |
| Recharts | 2.12.7 | Charts (bar, line, waterfall, heatmap) |
| @azure/msal-browser | 3.14.0 | Azure Entra ID SSO |
| @azure/msal-react | 2.0.22 | MSAL React integration |
| powerbi-client | 2.23.1 | Power BI report embed |
| Playwright | 1.59.1 | E2E testing |

### Directory Structure
```
02_Frontend/
├── src/
│   ├── App.tsx                    # Router + context providers
│   ├── main.tsx                   # React root mount
│   ├── index.css                  # Global design tokens + CSS
│   ├── api/
│   │   └── client.ts              # Axios/fetch API client
│   ├── assets/
│   │   ├── ria-advisory-logo.svg
│   │   ├── isource-logo.png
│   │   └── pattern-lattice.svg    # Design system hex pattern
│   ├── components/
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx # Role-based route guard
│   │   ├── layout/
│   │   │   ├── AppShell.tsx       # Main layout (sidebar + topbar)
│   │   │   ├── AppShellBlank.tsx  # Blank layout (logo only)
│   │   │   └── Sidebar.tsx        # Navigation sidebar
│   │   └── shared/
│   │       ├── KPITile.tsx
│   │       ├── PowerBIEmbed.tsx
│   │       └── StatusBadge.tsx
│   ├── config/
│   │   └── msalConfig.ts          # Azure AD app registration config
│   ├── contexts/
│   │   ├── AuthContext.tsx         # User auth state, role, login/logout
│   │   └── TenantContext.tsx       # Active tenant, switchTenant()
│   ├── pages/                     # 52 page components (F000–F051)
│   └── types/
│       └── index.ts               # 80+ TypeScript types + UserRole
├── playwright.config.ts            # Playwright config (tests in 05_Tests/)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Context Architecture
```typescript
// App.tsx wraps everything in order:
<MsalProvider instance={msalInstance}>
  <AuthProvider>          // login(), loginSSO(), user, isAuthenticated
    <TenantProvider>      // activeTenantId, switchTenant()
      <RouterProvider />  // 51 routes
    </TenantProvider>
  </AuthProvider>
</MsalProvider>
```

### Route Protection
```typescript
// ProtectedRoute enforces role hierarchy:
roleOrder: ['viewer', 'finance_user', 'isource_admin', 'ria_admin', 'superadmin']

// Usage:
<ProtectedRoute requiredRole="finance_user">  // finance_user and above
<ProtectedRoute requiredRole="ria_admin">      // ria_admin and above
<ProtectedRoute requiredRole="superadmin">     // superadmin only
```

---

## Backend Architecture

### Technology
| Package | Version | Purpose |
|---------|---------|---------|
| FastAPI | 0.111.0 | REST API framework |
| Uvicorn | 0.30.1 | ASGI web server |
| psycopg2-binary | 2.9.9 | PostgreSQL driver |
| python-jose | 3.3.0 | JWT token encoding/decoding |
| passlib[bcrypt] | 1.7.4 | Password hashing |
| httpx | 0.27.0 | BC OAuth token requests |
| pandas | 2.2.2 | ETL data manipulation |
| openpyxl | 3.1.5 | Excel-based ETL |
| python-dotenv | 1.0.1 | Environment variable loading |

### Directory Structure
```
03_Backend/
├── main.py                # FastAPI app + CORS + router registration
├── database.py            # PostgreSQL connection + query() helper
├── auth_utils.py          # JWT creation/verification + role dependencies
├── requirements.txt       # Python dependencies
├── routers/
│   ├── auth.py            # /auth/* endpoints
│   ├── tenants.py         # /api/tenants/* endpoints
│   ├── dashboard.py       # /api/dashboard/* endpoints
│   ├── entities.py        # /api/entities/* endpoints
│   ├── analytics.py       # /api/analytics/* endpoints
│   ├── gl.py              # /api/gl/* endpoints
│   ├── insights.py        # /api/insights/* endpoints
│   ├── reports.py         # /api/reports/* endpoints
│   └── settings.py        # /api/settings/* endpoints
├── migrations/
│   ├── 001_star_schema.sql           # Initial star schema
│   └── 002_roles_tenant_config.sql   # Multi-tenancy + BC config
└── etl/                   # ETL scripts for data loading
```

### Authentication Flow
```
1. User submits email + password → POST /auth/login
2. Server verifies bcrypt hash → returns {access_token, refresh_token, user}
3. Client stores tokens in localStorage
4. All API calls include: Authorization: Bearer <access_token>
5. FastAPI dependency require_auth() decodes JWT → injects {sub, tenant_id, role}
6. Role dependencies (require_ria_admin etc.) enforce RBAC per endpoint

SSO Flow:
1. MSAL completes Entra ID login → returns id_token
2. Client sends id_token → POST /auth/sso
3. Server decodes JWT claims (oid, email, name) — no sig verify in dev
4. Finds or creates user linked to default tenant
5. Returns same {access_token, refresh_token, user}
```

### Database Helper
```python
# database.py exposes single function:
def query(sql: str, params=None) -> list[dict]:
    # Opens connection, executes, returns list of dicts, closes connection
    # Used everywhere: query("SELECT ...", (param1, param2))
```

---

## Database Architecture

### Star Schema (Gold Layer)
```sql
-- Central fact table
fact_gl_entries (188,380 rows)
  ├── company_id    → dim_company (17 subsidiaries)
  ├── account_id    → dim_account (474 canonical accounts)
  ├── date_id       → dim_date   (282 calendar days)
  ├── currency_id   → dim_currency (8 currencies)
  ├── document_id   → dim_document (36 doc types)
  ├── posting_grp_id → dim_posting_group (19 groups)
  ├── dept_id       → dim_department (32 departments)
  ├── counterparty_id → dim_counterparty (967 customers/vendors)
  ├── bal_account_id → dim_bal_account (1,007)
  ├── project_id    → dim_project (44 projects)
  ├── project_code_id → dim_project_code (259 codes)
  └── geo_id        → dim_geo (3 regions)

fact_coa_balances (7,892 rows)
  ├── company_id → dim_company
  ├── account_id → dim_account
  └── date_id    → dim_date

fact_posted_sales (3,094 rows)
  ├── company_id     → dim_company
  ├── counterparty_id → dim_counterparty
  └── date_id        → dim_date
```

### Multi-Tenancy Tables
```sql
tenants (
  id UUID PK,
  name VARCHAR,
  slug VARCHAR UNIQUE,    -- 'ria-advisory', 'isource'
  plan VARCHAR,           -- trial/starter/professional/enterprise
  status VARCHAR,         -- active/suspended/deleted
  settings JSONB          -- {branding, subsidiary_access, billing}
)

users (
  id UUID PK,
  email VARCHAR UNIQUE,
  password_hash VARCHAR,
  display_name VARCHAR,
  role VARCHAR,           -- superadmin/ria_admin/isource_admin/finance_user/viewer
  tenant_id UUID → tenants,
  azure_oid VARCHAR,      -- Entra ID object ID for SSO
  is_active BOOLEAN,
  last_login TIMESTAMP
)

tenant_bc_config (
  id UUID PK,
  tenant_id UUID UNIQUE → tenants,
  bc_tenant_id VARCHAR,   -- Azure AD tenant for BC
  client_id VARCHAR,
  client_secret VARCHAR,  -- stored plaintext; encrypt in prod
  environment VARCHAR,    -- production/sandbox
  api_version VARCHAR,    -- v2.0
  auth_status VARCHAR,    -- pending/authenticated/error
  last_tested TIMESTAMP
)
```

---

## Data Pipeline Architecture

### Flow
```
17 BC Tenants (OData API)
       │
       ▼ (F001) Certificate OAuth → token per tenant
       │
       ▼ (F002) Data Extraction: GL Entries, CoA, Customers, Posted Sales
       │
       ▼ BRONZE (gl_unified): Raw append-only store
       │
       ▼ (F006) SILVER: Type cast, deduplicate, map accounts, standardise dates
       │
       ▼ (F007) CoA Mapping: subsidiary account → canonical account
       │
       ▼ (F010) IC Elimination: remove intercompany pairs
       │
       ▼ (F011) FX Translation: all amounts → USD
       │
       ▼ (F012) DQ Gates: completeness, referential integrity, range checks
       │
       ▼ GOLD (fact_gl_entries + star schema): Analytics-ready
       │
       ▼ FastAPI → React Dashboard
```

### ETL Scripts
- `03_Backend/etl/` contains Python scripts for each pipeline stage
- Triggered manually or via scheduler
- Each run logged to pipeline health endpoint

---

## Security Architecture

### Authentication
- **SSO:** Azure Entra ID (MSAL) — no passwords stored for SSO users
- **Local:** bcrypt password hashing (cost factor 12)
- **Tokens:** JWT (HS256, 60-min access + 7-day refresh)
- **Secret:** `JWT_SECRET` env var (must be rotated in prod)

### Authorisation (RBAC)
```python
# FastAPI dependency injection:
require_superadmin    = require_role("superadmin")
require_ria_admin     = require_role("superadmin", "ria_admin")
require_isource_admin = require_role("superadmin", "isource_admin")
require_any_admin     = require_role("superadmin", "ria_admin", "isource_admin")
require_finance_user  = require_role("superadmin", "ria_admin", "isource_admin", "finance_user")
```

### Tenant Isolation
- Every user has `tenant_id` in JWT claims
- All queries filter by `tenant_id`
- `_assert_tenant_access()` enforces cross-tenant access control
- Superadmin can switch tenant context via Tenant Hub

### CORS
- Configured in `main.py` — restrict to production origin in deployment

### BC Credentials
- `client_secret` stored in `tenant_bc_config` table
- **Production requirement:** Encrypt at rest using Azure Key Vault or similar

---

## Deployment

### Frontend — Netlify
```toml
# netlify.toml
[build]
  base    = "02_Frontend"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

**URL:** https://i-finsights.netlify.app

### Backend — Local / Cloud
```bash
cd 03_Backend
uvicorn main:app --reload --port 8000
```

**Target cloud:** Azure Container Apps or Azure App Service

### Environment Variables
```bash
# Backend (.env)
PGHOST=...
PGPORT=5432
PGDATABASE=ria_advisory
PGUSER=...
PGPASSWORD=...
JWT_SECRET=change-me-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
JWT_REFRESH_DAYS=7

# Frontend (.env.local)
VITE_API_URL=http://127.0.0.1:8000
```

---

## Testing

### E2E Tests — Playwright (05_Tests/)
```
05_Tests/
├── playwright.config.ts     # Test runner config (baseURL: 5173)
├── package.json
├── smoke.spec.ts            # Landing page, login tabs, redirect
├── login_flow.spec.ts       # Superadmin → hub, tenant entry, ria_admin login, logout
├── roles.spec.ts            # Role badges, tenant config 4 tabs, logo assertions
├── ria.spec.ts              # Backend API health, GL Explorer, Analytics
└── screenshots/             # Auto-captured test screenshots
```

**Run:**
```bash
cd 05_Tests
npm install
npx playwright install
npx playwright test --headed
```

**Test coverage:** 20 tests across 4 spec files covering auth flows, role system, reports, and API health.

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Dashboard P95 load | < 2.5 seconds |
| GL Explorer search (188K rows) | < 2 seconds |
| API availability (business hours) | 99.9% |
| Playwright test suite runtime | < 5 minutes |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | React + TypeScript | Team familiarity, ecosystem maturity, Netlify deploy |
| API framework | FastAPI | Python, async, auto-docs, type validation |
| Database | PostgreSQL | ACID, JSON support, OLAP-capable at this data size |
| Data model | Star schema | Fast aggregations, dim reusability, analytics-ready |
| Auth | JWT + MSAL | Stateless API, enterprise SSO out of box |
| Multi-tenancy | Row-level (tenant_id FK) | Simple, auditable, no DB-per-tenant overhead |
| BC integration | OData v2.0 + OAuth | Microsoft's supported API; certificate-based = no passwords |
| Charts | Recharts | React-native, customisable, no licensing cost |
| Deployment | Netlify + BYOB backend | Zero frontend ops; backend scales independently |
