-- RIA Advisory — Auth & Tenant Migration
-- Run: psql ria_advisory < 03_Backend/migrations/001_auth_tenant.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tenants ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  plan        VARCHAR(50)  DEFAULT 'trial',      -- trial | starter | professional | enterprise
  status      VARCHAR(20)  DEFAULT 'active',     -- active | suspended | deleted
  settings    JSONB        DEFAULT '{}',
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),                    -- null for SSO-only accounts
  display_name  VARCHAR(200),
  azure_oid     VARCHAR(255),                    -- Azure AD Object ID (SSO)
  tenant_id     UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  role          VARCHAR(50)  DEFAULT 'viewer',   -- superadmin | tenant_admin | finance_user | viewer
  is_active     BOOLEAN      DEFAULT true,
  created_at    TIMESTAMP    DEFAULT NOW(),
  last_login    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_azure_oid ON users(azure_oid);

-- ── Audit Logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL       PRIMARY KEY,
  tenant_id   UUID         REFERENCES tenants(id),
  user_id     UUID         REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  resource    VARCHAR(200),
  details     JSONB,
  ip_address  VARCHAR(50),
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_logs(created_at);

-- ── Seed: default tenant ──────────────────────────────────────────────────────
INSERT INTO tenants (name, slug, plan, status)
VALUES ('RIA Advisory', 'ria-advisory', 'enterprise', 'active')
ON CONFLICT (slug) DO NOTHING;
