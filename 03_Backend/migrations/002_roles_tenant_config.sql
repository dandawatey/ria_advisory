-- RIA Advisory — Roles & Tenant Config Migration
-- Run: psql ria_advisory < 03_Backend/migrations/002_roles_tenant_config.sql

-- ── BC Config per tenant (stores OAuth secrets) ───────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_bc_config (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  bc_tenant_id    VARCHAR(255),
  client_id       VARCHAR(255),
  client_secret   VARCHAR(255),
  environment     VARCHAR(20)  DEFAULT 'production',   -- sandbox | production
  api_version     VARCHAR(20)  DEFAULT 'v2.0',
  auth_status     VARCHAR(20)  DEFAULT 'pending',       -- pending | connected | error
  last_tested     TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_bc_config_tid ON tenant_bc_config(tenant_id);

-- ── Seed iSource tenant ───────────────────────────────────────────────────────
INSERT INTO tenants (name, slug, plan, status)
VALUES ('iSource', 'isource', 'enterprise', 'active')
ON CONFLICT (slug) DO NOTHING;

-- ── Document role values ──────────────────────────────────────────────────────
COMMENT ON COLUMN users.role IS
  'superadmin | ria_admin | isource_admin | finance_user | viewer';
