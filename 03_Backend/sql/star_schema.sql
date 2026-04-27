-- ============================================================
-- RIA Advisory — Star Schema DDL
-- 3 Fact Tables · 13 Dimension Tables
-- ============================================================

-- ── Dimension Tables ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_currency (
    currency_id     SMALLINT     PRIMARY KEY,
    currency_code   VARCHAR(10)  NOT NULL UNIQUE,
    currency_name   VARCHAR(60)  NOT NULL,
    currency_symbol VARCHAR(5)   NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_company (
    company_id    SMALLINT     PRIMARY KEY,
    company_name  VARCHAR(150) NOT NULL,
    currency_id   SMALLINT     NOT NULL REFERENCES dim_currency(currency_id)
);

CREATE TABLE IF NOT EXISTS dim_account (
    account_no          VARCHAR(30)  PRIMARY KEY,
    account_name        VARCHAR(250) NOT NULL,
    income_balance      VARCHAR(30),
    account_category    VARCHAR(60),
    account_subcategory VARCHAR(100),
    account_type        VARCHAR(30),
    totaling            VARCHAR(250)
);

CREATE TABLE IF NOT EXISTS dim_date (
    date_id        INTEGER     PRIMARY KEY,
    full_date      DATE        NOT NULL UNIQUE,
    year           SMALLINT    NOT NULL,
    quarter        SMALLINT    NOT NULL,
    quarter_name   VARCHAR(10) NOT NULL,
    month          SMALLINT    NOT NULL,
    month_name     VARCHAR(15) NOT NULL,
    week           SMALLINT    NOT NULL,
    day            SMALLINT    NOT NULL,
    day_name       VARCHAR(12) NOT NULL,
    is_month_end   SMALLINT    NOT NULL DEFAULT 0,
    fiscal_year    SMALLINT    NOT NULL,
    fiscal_quarter SMALLINT    NOT NULL,
    fiscal_period  VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_document (
    document_id   SMALLINT     PRIMARY KEY,
    document_type VARCHAR(60),
    source_code   VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS dim_posting_group (
    posting_group_id      SMALLINT     PRIMARY KEY,
    gen_posting_type      VARCHAR(30),
    gen_bus_posting_group VARCHAR(60),
    gen_prod_posting_group VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS dim_department (
    department_id   SMALLINT    PRIMARY KEY,
    department_code VARCHAR(60),
    vertical_code   VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS dim_counterparty (
    counterparty_id INTEGER     PRIMARY KEY,
    source_type     VARCHAR(30),
    source_no       VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS dim_bal_account (
    bal_account_id   INTEGER     PRIMARY KEY,
    bal_account_type VARCHAR(30),
    bal_account_no   VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS dim_project (
    project_id  INTEGER     PRIMARY KEY,
    project_no  VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS dim_project_code (
    project_code_id INTEGER     PRIMARY KEY,
    project_code    VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS dim_geo (
    geo_id   SMALLINT    PRIMARY KEY,
    geo_code VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS dim_customer (
    customer_id            INTEGER      PRIMARY KEY,
    counterparty_id        INTEGER      REFERENCES dim_counterparty(counterparty_id),
    customer_no            VARCHAR(30)  NOT NULL,
    customer_name          VARCHAR(250),
    company                VARCHAR(150),
    city                   VARCHAR(100),
    state                  VARCHAR(100),
    contact                VARCHAR(150),
    balance                NUMERIC(20,4),
    balance_due            NUMERIC(20,4),
    total_sales            NUMERIC(20,4),
    total_payments         NUMERIC(20,4),
    coupled_to_dataverse   VARCHAR(10)
);

-- ── Fact Tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fact_gl_entries (
    entry_no            INTEGER      NOT NULL,
    company_id          SMALLINT     NOT NULL REFERENCES dim_company(company_id),
    account_no          VARCHAR(30)  NOT NULL REFERENCES dim_account(account_no),
    date_id             INTEGER      NOT NULL REFERENCES dim_date(date_id),
    document_id         SMALLINT     NOT NULL REFERENCES dim_document(document_id),
    posting_group_id    SMALLINT     NOT NULL REFERENCES dim_posting_group(posting_group_id),
    department_id       SMALLINT     NOT NULL REFERENCES dim_department(department_id),
    counterparty_id     INTEGER      NOT NULL REFERENCES dim_counterparty(counterparty_id),
    bal_account_id      INTEGER      NOT NULL REFERENCES dim_bal_account(bal_account_id),
    project_id          INTEGER      REFERENCES dim_project(project_id),
    project_code_id     INTEGER      REFERENCES dim_project_code(project_code_id),
    geo_id              SMALLINT     REFERENCES dim_geo(geo_id),
    currency_id         SMALLINT     NOT NULL REFERENCES dim_currency(currency_id),
    amount              NUMERIC(20,4),
    document_no         VARCHAR(60),
    external_document_no VARCHAR(60),
    description         TEXT,
    billable_flag       VARCHAR(30),
    PRIMARY KEY (company_id, entry_no)
);

CREATE TABLE IF NOT EXISTS fact_coa_balances (
    company_id  SMALLINT    NOT NULL REFERENCES dim_company(company_id),
    account_no  VARCHAR(30) NOT NULL REFERENCES dim_account(account_no),
    net_change  NUMERIC(20,4),
    balance     NUMERIC(20,4),
    PRIMARY KEY (company_id, account_no)
);

CREATE TABLE IF NOT EXISTS fact_posted_sales (
    entry_no            INTEGER      NOT NULL,
    company_id          SMALLINT     NOT NULL REFERENCES dim_company(company_id),
    account_no          VARCHAR(30)  NOT NULL REFERENCES dim_account(account_no),
    date_id             INTEGER      NOT NULL REFERENCES dim_date(date_id),
    document_id         SMALLINT     NOT NULL REFERENCES dim_document(document_id),
    posting_group_id    SMALLINT     NOT NULL REFERENCES dim_posting_group(posting_group_id),
    department_id       SMALLINT     NOT NULL REFERENCES dim_department(department_id),
    counterparty_id     INTEGER      NOT NULL REFERENCES dim_counterparty(counterparty_id),
    currency_id         SMALLINT     NOT NULL REFERENCES dim_currency(currency_id),
    amount              NUMERIC(20,4),
    customer_vendor_name VARCHAR(250),
    gl_account_name     VARCHAR(250),
    dimension_set_id    INTEGER,
    PRIMARY KEY (company_id, entry_no),
    FOREIGN KEY (company_id, entry_no) REFERENCES fact_gl_entries(company_id, entry_no)
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gl_company      ON fact_gl_entries (company_id);
CREATE INDEX IF NOT EXISTS idx_gl_date         ON fact_gl_entries (date_id);
CREATE INDEX IF NOT EXISTS idx_gl_account      ON fact_gl_entries (account_no);
CREATE INDEX IF NOT EXISTS idx_gl_department   ON fact_gl_entries (department_id);
CREATE INDEX IF NOT EXISTS idx_gl_counterparty ON fact_gl_entries (counterparty_id);
CREATE INDEX IF NOT EXISTS idx_gl_currency     ON fact_gl_entries (currency_id);

CREATE INDEX IF NOT EXISTS idx_sales_company   ON fact_posted_sales (company_id);
CREATE INDEX IF NOT EXISTS idx_sales_date      ON fact_posted_sales (date_id);
CREATE INDEX IF NOT EXISTS idx_sales_account   ON fact_posted_sales (account_no);

CREATE INDEX IF NOT EXISTS idx_coa_company     ON fact_coa_balances (company_id);
CREATE INDEX IF NOT EXISTS idx_coa_account     ON fact_coa_balances (account_no);

-- ── Analytical Views ──────────────────────────────────────────

-- P&L by entity and month
CREATE OR REPLACE VIEW v_pl_by_entity AS
SELECT
    co.company_name,
    cu.currency_code,
    d.year,
    d.month,
    d.month_name,
    d.fiscal_year,
    d.fiscal_period,
    ac.account_category,
    ac.account_subcategory,
    ac.account_no,
    ac.account_name,
    SUM(g.amount)  AS total_amount,
    COUNT(*)       AS entry_count
FROM fact_gl_entries g
JOIN dim_company      co ON co.company_id   = g.company_id
JOIN dim_currency     cu ON cu.currency_id  = g.currency_id
JOIN dim_date         d  ON d.date_id       = g.date_id
JOIN dim_account      ac ON ac.account_no   = g.account_no
GROUP BY co.company_name, cu.currency_code,
         d.year, d.month, d.month_name, d.fiscal_year, d.fiscal_period,
         ac.account_category, ac.account_subcategory, ac.account_no, ac.account_name;

-- Trial balance per company
CREATE OR REPLACE VIEW v_trial_balance AS
SELECT
    co.company_name,
    ac.account_no,
    ac.account_name,
    ac.account_category,
    ac.income_balance,
    SUM(CASE WHEN g.amount > 0 THEN g.amount ELSE 0 END) AS total_debit,
    SUM(CASE WHEN g.amount < 0 THEN g.amount ELSE 0 END) AS total_credit,
    SUM(g.amount)                                         AS net_balance
FROM fact_gl_entries g
JOIN dim_company co ON co.company_id = g.company_id
JOIN dim_account ac ON ac.account_no = g.account_no
GROUP BY co.company_name, ac.account_no, ac.account_name,
         ac.account_category, ac.income_balance;

-- Department spend summary
CREATE OR REPLACE VIEW v_dept_spend AS
SELECT
    co.company_name,
    dp.department_code,
    dp.vertical_code,
    d.fiscal_year,
    d.fiscal_period,
    ac.account_category,
    SUM(g.amount)  AS total_amount,
    COUNT(*)       AS entry_count
FROM fact_gl_entries g
JOIN dim_company    co ON co.company_id    = g.company_id
JOIN dim_department dp ON dp.department_id = g.department_id
JOIN dim_date       d  ON d.date_id        = g.date_id
JOIN dim_account    ac ON ac.account_no    = g.account_no
GROUP BY co.company_name, dp.department_code, dp.vertical_code,
         d.fiscal_year, d.fiscal_period, ac.account_category;

-- CoA balances with account detail
CREATE OR REPLACE VIEW v_coa_balances AS
SELECT
    co.company_name,
    ac.account_no,
    ac.account_name,
    ac.income_balance,
    ac.account_category,
    ac.account_subcategory,
    cb.net_change,
    cb.balance
FROM fact_coa_balances cb
JOIN dim_company co ON co.company_id = cb.company_id
JOIN dim_account ac ON ac.account_no = cb.account_no;

-- Sales summary by customer and period
CREATE OR REPLACE VIEW v_sales_summary AS
SELECT
    co.company_name,
    cu.currency_code,
    cp.source_type,
    ps.customer_vendor_name,
    d.year,
    d.month,
    d.month_name,
    d.fiscal_year,
    d.fiscal_period,
    SUM(ps.amount)  AS total_amount,
    COUNT(*)        AS invoice_count
FROM fact_posted_sales ps
JOIN dim_company     co ON co.company_id    = ps.company_id
JOIN dim_currency    cu ON cu.currency_id   = ps.currency_id
JOIN dim_counterparty cp ON cp.counterparty_id = ps.counterparty_id
JOIN dim_date        d  ON d.date_id        = ps.date_id
GROUP BY co.company_name, cu.currency_code, cp.source_type,
         ps.customer_vendor_name, d.year, d.month, d.month_name,
         d.fiscal_year, d.fiscal_period;
