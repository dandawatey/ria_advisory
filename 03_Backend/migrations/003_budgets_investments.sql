-- ============================================================
-- Migration 003 — Budgets + Investments
-- Run: psql -d <dbname> -f 003_budgets_investments.sql
-- ============================================================

-- ── Budgets ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       SMALLINT NOT NULL REFERENCES dim_company(company_id),
  account_category VARCHAR(100) NOT NULL,
  fiscal_year      INT NOT NULL,
  fiscal_period    INT NOT NULL,          -- 1–12 (month)
  budget_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, account_category, fiscal_year, fiscal_period)
);

CREATE INDEX IF NOT EXISTS idx_budgets_company ON budgets(company_id);
CREATE INDEX IF NOT EXISTS idx_budgets_year    ON budgets(fiscal_year);

-- ── Investments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       SMALLINT NOT NULL REFERENCES dim_company(company_id),
  investment_name  VARCHAR(255) NOT NULL,
  investment_type  VARCHAR(50)  NOT NULL,  -- Equity/Fixed Income/Property/Cash/Alternative
  asset_class      VARCHAR(100),
  currency_code    VARCHAR(10)  DEFAULT 'USD',
  invested_amount  NUMERIC(18,2) NOT NULL,
  current_value    NUMERIC(18,2),
  return_amount    NUMERIC(18,2),
  investment_date  DATE NOT NULL,
  maturity_date    DATE,
  status           VARCHAR(20)  DEFAULT 'active',  -- active/matured/divested
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_company ON investments(company_id);
CREATE INDEX IF NOT EXISTS idx_investments_type    ON investments(investment_type);

-- ── Seed budgets: 110% of GL actuals (2023–2025) ────────────
INSERT INTO budgets (company_id, account_category, fiscal_year, fiscal_period, budget_amount)
SELECT
  g.company_id,
  ac.account_category,
  d.year,
  d.month,
  ROUND(ABS(SUM(g.amount)) * 1.10, 2)
FROM fact_gl_entries g
JOIN dim_account ac ON ac.account_no = g.account_no
JOIN dim_date    d  ON d.date_id     = g.date_id
WHERE ac.account_category IN ('Revenue', 'COGS', 'Operating Expense', 'Other Income')
  AND d.year BETWEEN 2023 AND 2025
  AND g.amount != 0
GROUP BY g.company_id, ac.account_category, d.year, d.month
HAVING ABS(SUM(g.amount)) > 0
ON CONFLICT (company_id, account_category, fiscal_year, fiscal_period) DO NOTHING;

-- ── Seed investments ─────────────────────────────────────────
INSERT INTO investments
  (company_id, investment_name, investment_type, asset_class,
   invested_amount, current_value, return_amount, investment_date, status)
VALUES
  (1,'US Treasury 2-Year',        'Fixed Income','Government Bonds', 500000,  512500,  12500, '2024-01-15','active'),
  (1,'S&P 500 Index Fund',        'Equity',       'Large Cap',        750000,  832500,  82500, '2023-06-01','active'),
  (1,'Commercial Property HQ',    'Property',     'Real Estate',     2000000, 2180000, 180000, '2022-03-10','active'),
  (1,'Private Credit Fund',       'Alternative',  'Private Debt',     400000,  424000,  24000, '2022-06-15','active'),
  (2,'Corporate Bonds Portfolio', 'Fixed Income','Corporate Bonds',   300000,  308400,   8400, '2024-02-20','active'),
  (2,'MSCI World ETF',            'Equity',       'Global Equity',    450000,  486000,  36000, '2023-09-15','active'),
  (2,'Office Building Fund',      'Property',     'Real Estate',      900000,  963000,  63000, '2022-08-01','active'),
  (3,'Money Market Fund',         'Cash',         'Money Market',     200000,  204000,   4000, '2024-01-01','active'),
  (3,'Tech Growth Fund',          'Equity',       'Growth',           350000,  406000,  56000, '2023-04-01','active'),
  (3,'Green Energy Bonds',        'Fixed Income','Corporate Bonds',   275000,  283250,   8250, '2023-11-01','active'),
  (4,'Infrastructure Fund',       'Alternative',  'Infrastructure',   600000,  642000,  42000, '2022-11-01','active'),
  (4,'Short-term T-Bills',        'Fixed Income','Government Bonds',  250000,  254375,   4375, '2024-03-01','active'),
  (4,'Dividend Growth ETF',       'Equity',       'Large Cap',        320000,  358400,  38400, '2023-02-15','active'),
  (5,'REITs Portfolio',           'Property',     'Real Estate',      800000,  856000,  56000, '2023-01-15','active'),
  (5,'Emerging Markets ETF',      'Equity',       'EM Equity',        200000,  214000,  14000, '2023-07-01','active'),
  (5,'High-Yield Bond Fund',      'Fixed Income','Corporate Bonds',   180000,  185400,   5400, '2024-02-01','active'),
  (6,'Cash Reserve Fund',         'Cash',         'Money Market',     150000,  153000,   3000, '2024-01-01','active'),
  (6,'Global REIT Index',         'Property',     'Real Estate',      400000,  428000,  28000, '2023-05-01','active'),
  (7,'Multi-Asset Growth Fund',   'Alternative',  'Multi-Asset',      500000,  545000,  45000, '2022-09-01','active'),
  (7,'Investment Grade Bonds',    'Fixed Income','Corporate Bonds',   350000,  360500,  10500, '2023-12-01','active');

SELECT 'Migration 003 complete: budgets + investments tables created and seeded.' AS status;
