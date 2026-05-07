-- Migration 011: Per-tenant feature flag overrides
-- Stores tenant-specific enable/disable state.
-- When no row exists for a (tenant_id, flag_key) pair, the global
-- feature_flags.is_enabled default applies.

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    flag_key    VARCHAR(100) NOT NULL REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
    is_enabled  BOOLEAN     NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_tenant ON tenant_feature_flags(tenant_id);
