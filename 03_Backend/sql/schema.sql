-- ============================================================
-- UFIP Unified General Ledger Schema
-- Single table combining all 17 RIA Advisory subsidiaries
-- ============================================================

CREATE TABLE IF NOT EXISTS gl_unified (
    id                      BIGSERIAL PRIMARY KEY,
    subsidiary_name         VARCHAR(150) NOT NULL,
    subsidiary_code         VARCHAR(30)  NOT NULL,

    -- Core GL fields (all files)
    posting_date            DATE,
    document_type           VARCHAR(60),
    document_no             VARCHAR(120),
    gl_account_no           VARCHAR(60),
    gl_account_name         VARCHAR(250),   -- present only in some files
    description             TEXT,
    customer_or_vendor_name VARCHAR(250),   -- present only in some files
    project_no              VARCHAR(120),
    billable_non_billable   VARCHAR(60),
    department_code         VARCHAR(120),
    vertical_code           VARCHAR(120),
    gen_posting_type        VARCHAR(60),
    gen_bus_posting_group   VARCHAR(120),
    gen_prod_posting_group  VARCHAR(120),
    amount                  NUMERIC(20, 4),
    bal_account_type        VARCHAR(60),
    bal_account_no          VARCHAR(120),
    source_code             VARCHAR(60),
    source_type             VARCHAR(60),
    source_no               VARCHAR(120),
    entry_no                INTEGER,
    dimension_set_id        INTEGER,        -- present only in some files
    external_document_no    VARCHAR(120),
    subscription_contract_no VARCHAR(120),
    geo_code                VARCHAR(60),
    project_code            VARCHAR(120),
    shortcut_dim_6_code     VARCHAR(120),
    shortcut_dim_7_code     VARCHAR(120),
    shortcut_dim_8_code     VARCHAR(120),

    loaded_at               TIMESTAMP DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_gl_subsidiary  ON gl_unified (subsidiary_code);
CREATE INDEX IF NOT EXISTS idx_gl_date        ON gl_unified (posting_date);
CREATE INDEX IF NOT EXISTS idx_gl_account     ON gl_unified (gl_account_no);
CREATE INDEX IF NOT EXISTS idx_gl_dept        ON gl_unified (department_code);

-- ============================================================
-- SSAS-like semantic layer — materialized aggregation views
-- ============================================================

-- Entity summary (used by Executive Dashboard KPI tiles)
CREATE OR REPLACE VIEW v_entity_summary AS
SELECT
    subsidiary_code,
    subsidiary_name,
    DATE_TRUNC('month', posting_date) AS period,
    SUM(CASE WHEN gl_account_no LIKE '4%' THEN amount ELSE 0 END)  AS revenue,
    SUM(CASE WHEN gl_account_no LIKE '5%' THEN amount ELSE 0 END)  AS cogs,
    SUM(CASE WHEN gl_account_no LIKE '6%' THEN amount ELSE 0 END)  AS opex,
    SUM(CASE WHEN gl_account_no LIKE '1%' THEN amount ELSE 0 END)  AS total_assets,
    SUM(CASE WHEN gl_account_no LIKE '2%' THEN amount ELSE 0 END)  AS total_liabilities,
    SUM(amount)                                                      AS net_movement,
    COUNT(*)                                                         AS entry_count
FROM gl_unified
GROUP BY subsidiary_code, subsidiary_name, DATE_TRUNC('month', posting_date);

-- Department breakdown (for P&L drill-down)
CREATE OR REPLACE VIEW v_pl_by_department AS
SELECT
    subsidiary_code,
    subsidiary_name,
    department_code,
    vertical_code,
    DATE_TRUNC('month', posting_date) AS period,
    gl_account_no,
    gl_account_name,
    SUM(amount)  AS total_amount,
    COUNT(*)     AS entry_count
FROM gl_unified
WHERE gl_account_no NOT IN ('999999')   -- exclude suspense/opening balance account
GROUP BY subsidiary_code, subsidiary_name, department_code, vertical_code,
         DATE_TRUNC('month', posting_date), gl_account_no, gl_account_name;

-- Consolidated P&L across all entities
CREATE OR REPLACE VIEW v_consolidated_pl AS
SELECT
    DATE_TRUNC('month', posting_date) AS period,
    SUM(CASE WHEN gl_account_no LIKE '4%' THEN amount ELSE 0 END)  AS total_revenue,
    SUM(CASE WHEN gl_account_no LIKE '5%' THEN amount ELSE 0 END)  AS total_cogs,
    SUM(CASE WHEN gl_account_no LIKE '6%' THEN amount ELSE 0 END)  AS total_opex,
    SUM(CASE WHEN gl_account_no LIKE '7%' THEN amount ELSE 0 END)  AS other_income,
    SUM(CASE WHEN gl_account_no LIKE '8%' THEN amount ELSE 0 END)  AS tax_expense,
    COUNT(DISTINCT subsidiary_code)                                  AS entity_count,
    SUM(amount)                                                      AS net_movement
FROM gl_unified
WHERE gl_account_no NOT IN ('999999')
GROUP BY DATE_TRUNC('month', posting_date)
ORDER BY period;

-- Trial balance by entity
CREATE OR REPLACE VIEW v_trial_balance AS
SELECT
    subsidiary_code,
    subsidiary_name,
    gl_account_no,
    gl_account_name,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)  AS debit,
    SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)  AS credit,
    SUM(amount)                                         AS net_balance
FROM gl_unified
WHERE gl_account_no NOT IN ('999999')
GROUP BY subsidiary_code, subsidiary_name, gl_account_no, gl_account_name;
