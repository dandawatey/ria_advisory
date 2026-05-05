-- 007: ERP-agnostic canonical data model
-- dim_canonical_account: L1/L2/L3 CoA hierarchy (ERP-independent)
CREATE TABLE IF NOT EXISTS dim_canonical_account (
    canonical_id   SERIAL PRIMARY KEY,
    l1_statement   TEXT NOT NULL,   -- 'P&L' | 'Balance Sheet' | 'Cash Flow'
    l2_category    TEXT NOT NULL,   -- Revenue | COGS | OpEx | etc.
    l3_subcategory TEXT,
    display_name   TEXT NOT NULL,
    sort_order     INT  DEFAULT 0,
    is_active      BOOLEAN DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_l2_l3
    ON dim_canonical_account(l2_category, COALESCE(l3_subcategory, ''));

-- account_mapping: ERP native account → canonical (per tenant, per ERP)
CREATE TABLE IF NOT EXISTS account_mapping (
    mapping_id     SERIAL PRIMARY KEY,
    tenant_id      UUID  REFERENCES tenants(id) ON DELETE CASCADE,
    source_erp     TEXT  NOT NULL DEFAULT 'BC',
    source_account TEXT  NOT NULL,
    source_name    TEXT,
    canonical_id   INT   REFERENCES dim_canonical_account(canonical_id),
    l2_override    TEXT,    -- user can override l2 without full canonical
    mapped_by      TEXT  DEFAULT 'auto',   -- 'auto' | 'user'
    confidence     DECIMAL(5,2),
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, source_erp, source_account)
);
CREATE INDEX IF NOT EXISTS idx_account_mapping_tenant ON account_mapping(tenant_id);
CREATE INDEX IF NOT EXISTS idx_account_mapping_canonical ON account_mapping(canonical_id);

-- fact_gl_normalized: future connector landing table (ERP-agnostic)
CREATE TABLE IF NOT EXISTS fact_gl_normalized (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        UUID  NOT NULL,
    source_erp       TEXT  NOT NULL,
    source_id        TEXT  NOT NULL,
    source_line      INT   DEFAULT 0,
    posting_date     DATE  NOT NULL,
    account_code     TEXT  NOT NULL,
    canonical_id     INT   REFERENCES dim_canonical_account(canonical_id),
    entity_code      TEXT,
    entity_id        INT   REFERENCES dim_company(company_id),
    debit_amount     DECIMAL(20,4) DEFAULT 0,
    credit_amount    DECIMAL(20,4) DEFAULT 0,
    currency         CHAR(3)  DEFAULT 'USD',
    fx_rate          DECIMAL(20,8) DEFAULT 1,
    reporting_amount DECIMAL(20,4),
    dimension_1      TEXT,
    dimension_2      TEXT,
    description      TEXT,
    raw_payload      JSONB,
    ingested_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, source_erp, source_id, source_line)
);
CREATE INDEX IF NOT EXISTS idx_gl_norm_tenant_date
    ON fact_gl_normalized(tenant_id, posting_date);
CREATE INDEX IF NOT EXISTS idx_gl_norm_canonical
    ON fact_gl_normalized(canonical_id);
