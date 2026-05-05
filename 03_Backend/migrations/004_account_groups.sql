-- Migration 004: User-defined GL account groups
-- Allows tenants to group GL accounts under custom labels for reporting

CREATE TABLE IF NOT EXISTS account_groups (
    group_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID        NOT NULL,
    group_name   VARCHAR(120) NOT NULL,
    description  TEXT,
    color        VARCHAR(20) DEFAULT '#6366f1',
    sort_order   INTEGER     DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, group_name)
);

CREATE TABLE IF NOT EXISTS account_group_members (
    group_id    UUID         NOT NULL REFERENCES account_groups(group_id) ON DELETE CASCADE,
    account_no  VARCHAR(20)  NOT NULL,
    label_override VARCHAR(120),   -- optional display name override for this account in the group
    added_at    TIMESTAMPTZ  DEFAULT NOW(),
    PRIMARY KEY (group_id, account_no)
);

CREATE INDEX IF NOT EXISTS idx_account_groups_tenant ON account_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_account_group_members_group ON account_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_account_group_members_acct  ON account_group_members(account_no);
