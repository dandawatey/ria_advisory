-- IC-34 — Casbin RBAC + Impersonation Audit
-- Run: psql ria_advisory < 03_Backend/migrations/005_casbin_rbac.sql

-- ── Casbin policy store ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS casbin_rule (
    id    SERIAL       PRIMARY KEY,
    ptype VARCHAR(10)  NOT NULL,          -- 'p' (policy) or 'g' (role)
    v0    VARCHAR(256) DEFAULT '',
    v1    VARCHAR(256) DEFAULT '',
    v2    VARCHAR(256) DEFAULT '',
    v3    VARCHAR(256) DEFAULT '',
    v4    VARCHAR(256) DEFAULT '',
    v5    VARCHAR(256) DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_casbin_rule_ptype ON casbin_rule(ptype);

-- ── Per-user subsidiary access ────────────────────────────────────────────────
-- NULL = inherit from tenant settings. [] = no access. ["RIA001","RIA003"] = explicit list.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subsidiary_access JSONB DEFAULT NULL;

-- ── Impersonation audit log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS impersonation_audit (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID        NOT NULL REFERENCES users(id),
    target_user_id  UUID        NOT NULL REFERENCES users(id),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),
    started_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    stopped_at      TIMESTAMP,
    reason          TEXT,
    ip_address      VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_impersonation_admin    ON impersonation_audit(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_target   ON impersonation_audit(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_tenant   ON impersonation_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_started  ON impersonation_audit(started_at);
