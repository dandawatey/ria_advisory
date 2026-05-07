-- ============================================================
-- Migration 012 — iSource Seed Data
-- 3 subsidiaries, 36 months GL data, 20 accounts, 30 customers,
-- budgets + investments, posted sales
-- Idempotent: all INSERTs use ON CONFLICT DO NOTHING
-- ============================================================

-- ── 1. Seed dim_company: 3 iSource subsidiaries ───────────────
INSERT INTO dim_company (company_id, company_name, currency_id, tenant_id)
VALUES
  (18, 'iSource India Pvt Ltd', 1, '4e7b2d7a-0137-449b-8b4a-f4f85d83b7b1'),
  (19, 'iSource Technologies LLC', 1, '4e7b2d7a-0137-449b-8b4a-f4f85d83b7b1'),
  (20, 'iSource Solutions GmbH', 1, '4e7b2d7a-0137-449b-8b4a-f4f85d83b7b1')
ON CONFLICT (company_id) DO NOTHING;

-- ── 2. Seed dim_account: 20 accounts (P&L + Balance Sheet) ────
INSERT INTO dim_account (account_no, account_name, income_balance, account_category, account_subcategory, account_type)
VALUES
  -- Revenue (2 accounts)
  ('4010', 'Product Sales Revenue', 'Income', 'Revenue', 'Product Sales', 'Income'),
  ('4020', 'Service Revenue', 'Income', 'Revenue', 'Service Revenue', 'Income'),
  -- COGS (2 accounts)
  ('5010', 'Cost of Goods Sold', 'Balance', 'COGS', 'Material Costs', 'Expense'),
  ('5020', 'Direct Labor', 'Balance', 'COGS', 'Labor Costs', 'Expense'),
  -- Operating Expenses (8 accounts)
  ('6010', 'Salaries & Wages', 'Balance', 'Operating Expense', 'Personnel', 'Expense'),
  ('6020', 'Rent & Occupancy', 'Balance', 'Operating Expense', 'Facilities', 'Expense'),
  ('6030', 'Utilities', 'Balance', 'Operating Expense', 'Facilities', 'Expense'),
  ('6040', 'Marketing & Advertising', 'Balance', 'Operating Expense', 'Sales & Marketing', 'Expense'),
  ('6050', 'IT & Software', 'Balance', 'Operating Expense', 'IT', 'Expense'),
  ('6060', 'Professional Fees', 'Balance', 'Operating Expense', 'Professional Services', 'Expense'),
  ('6070', 'Travel & Meals', 'Balance', 'Operating Expense', 'Travel', 'Expense'),
  ('6080', 'Office Supplies', 'Balance', 'Operating Expense', 'General', 'Expense'),
  -- Other Income/Expense (2 accounts)
  ('7010', 'Interest Income', 'Income', 'Other Income', 'Finance Income', 'Income'),
  ('8010', 'Interest Expense', 'Balance', 'Other Expense', 'Finance Costs', 'Expense'),
  -- Balance Sheet Assets (3 accounts)
  ('1010', 'Cash and Cash Equivalents', 'Balance', 'Current Assets', 'Liquidity', 'Asset'),
  ('1020', 'Accounts Receivable', 'Balance', 'Current Assets', 'Receivables', 'Asset'),
  ('1030', 'Inventory', 'Balance', 'Current Assets', 'Inventory', 'Asset'),
  -- Balance Sheet Liabilities (2 accounts)
  ('2010', 'Accounts Payable', 'Balance', 'Current Liabilities', 'Payables', 'Liability'),
  ('2020', 'Short-term Debt', 'Balance', 'Current Liabilities', 'Debt', 'Liability')
ON CONFLICT (account_no) DO NOTHING;

-- ── 3. Seed dim_customer: 30 customers (10 per subsidiary) ────
INSERT INTO dim_customer (customer_id, customer_no, customer_name, company, city, state, balance, balance_due, total_sales, total_payments)
VALUES
  -- iSource India (IDs 1–10)
  (1, 'CUST001', 'Acme Corp Delhi', 'Acme Corporation', 'New Delhi', 'Delhi', 500000, 50000, 1200000, 650000),
  (2, 'CUST002', 'TechWave Solutions', 'TechWave Solutions', 'Bangalore', 'Karnataka', 350000, 35000, 850000, 465000),
  (3, 'CUST003', 'Global Enterprises', 'Global Enterprises Inc', 'Mumbai', 'Maharashtra', 620000, 62000, 1500000, 880000),
  (4, 'CUST004', 'Finance Plus Ltd', 'Finance Plus Ltd', 'Pune', 'Maharashtra', 280000, 28000, 680000, 400000),
  (5, 'CUST005', 'CloudFirst Systems', 'CloudFirst Systems', 'Hyderabad', 'Telangana', 450000, 45000, 1100000, 650000),
  (6, 'CUST006', 'InfoTech Group', 'InfoTech Group', 'Chennai', 'Tamil Nadu', 320000, 32000, 780000, 460000),
  (7, 'CUST007', 'Digital Solutions Co', 'Digital Solutions Co', 'Kolkata', 'West Bengal', 380000, 38000, 920000, 540000),
  (8, 'CUST008', 'ERP Innovations', 'ERP Innovations Ltd', 'Gurgaon', 'Haryana', 510000, 51000, 1250000, 740000),
  (9, 'CUST009', 'Secure Networks Inc', 'Secure Networks Inc', 'Ahmedabad', 'Gujarat', 290000, 29000, 700000, 410000),
  (10, 'CUST010', 'Smart Analytics Ltd', 'Smart Analytics Ltd', 'Jaipur', 'Rajasthan', 430000, 43000, 1050000, 620000),
  -- iSource Technologies LLC (IDs 11–20)
  (11, 'CUST011', 'Fortune 500 Corp', 'Fortune 500 Corp', 'New York', 'NY', 850000, 85000, 2100000, 1250000),
  (12, 'CUST012', 'Industrial Supply Co', 'Industrial Supply Co', 'Chicago', 'IL', 620000, 62000, 1500000, 880000),
  (13, 'CUST013', 'Retail Mega Store', 'Retail Mega Store Inc', 'Los Angeles', 'CA', 920000, 92000, 2250000, 1330000),
  (14, 'CUST014', 'Manufacturing LLC', 'Manufacturing LLC', 'Detroit', 'MI', 480000, 48000, 1180000, 700000),
  (15, 'CUST015', 'Energy Solutions Corp', 'Energy Solutions Corp', 'Houston', 'TX', 750000, 75000, 1850000, 1100000),
  (16, 'CUST016', 'Financial Services Inc', 'Financial Services Inc', 'Boston', 'MA', 680000, 68000, 1680000, 1000000),
  (17, 'CUST017', 'Healthcare Providers', 'Healthcare Providers LLC', 'Philadelphia', 'PA', 580000, 58000, 1420000, 840000),
  (18, 'CUST018', 'Tech Startup Hub', 'Tech Startup Hub', 'Seattle', 'WA', 420000, 42000, 1020000, 600000),
  (19, 'CUST019', 'Construction Group', 'Construction Group Inc', 'Denver', 'CO', 510000, 51000, 1250000, 740000),
  (20, 'CUST020', 'Logistics Network', 'Logistics Network Corp', 'Atlanta', 'GA', 640000, 64000, 1560000, 920000),
  -- iSource Solutions GmbH (IDs 21–30)
  (21, 'CUST021', 'Siemens AG', 'Siemens Aktiengesellschaft', 'Munich', 'Bayern', 920000, 92000, 2250000, 1330000),
  (22, 'CUST022', 'Deutsche Bank', 'Deutsche Bank AG', 'Frankfurt', 'Hessen', 1100000, 110000, 2700000, 1600000),
  (23, 'CUST023', 'BMW Group', 'BMW AG', 'Munich', 'Bayern', 980000, 98000, 2400000, 1420000),
  (24, 'CUST024', 'Allianz SE', 'Allianz SE', 'Munich', 'Bayern', 850000, 85000, 2100000, 1250000),
  (25, 'CUST025', 'SAP SE', 'SAP Aktiengesellschaft', 'Walldorf', 'Baden-Württemberg', 750000, 75000, 1850000, 1100000),
  (26, 'CUST026', 'Daimler AG', 'Daimler Aktiengesellschaft', 'Stuttgart', 'Baden-Württemberg', 890000, 89000, 2180000, 1290000),
  (27, 'CUST027', 'Metro AG', 'Metro Aktiengesellschaft', 'Düsseldorf', 'Nordrhein-Westfalen', 620000, 62000, 1500000, 880000),
  (28, 'CUST028', 'BASF SE', 'BASF Aktiengesellschaft', 'Ludwigshafen', 'Rhineland-Palatinate', 780000, 78000, 1920000, 1140000),
  (29, 'CUST029', 'Boehringer Ingelheim', 'Boehringer Ingelheim GmbH', 'Ingelheim', 'Rhineland-Palatinate', 650000, 65000, 1600000, 950000),
  (30, 'CUST030', 'Lufthansa Group', 'Lufthansa AG', 'Cologne', 'Nordrhein-Westfalen', 910000, 91000, 2220000, 1310000)
ON CONFLICT (customer_id) DO NOTHING;

-- ── 4. Seed GL entries: 36 months (2022–2024) ────────────────
-- Generate GL entries for each company, account, date combination
-- Total: 3 companies × 20 accounts × 36 months × 2 entries = 4,320 GL entries
-- Strategy: Use random amounts based on account type + monthly variation

DO $$
DECLARE
  v_company RECORD;
  v_account RECORD;
  v_date RECORD;
  v_entry_no INT := 100000;
  v_base_amount NUMERIC(20,4);
  v_variance_pct NUMERIC;
  v_amount NUMERIC(20,4);
  v_sign INT;
BEGIN
  FOR v_company IN SELECT company_id FROM dim_company WHERE company_id IN (18, 19, 20) LOOP
    FOR v_account IN SELECT account_no, account_type FROM dim_account LOOP
      FOR v_date IN SELECT date_id, month FROM dim_date WHERE full_date >= '2022-01-01' AND full_date <= '2024-12-31' LOOP
        -- Base amount by account type (USD)
        v_base_amount := CASE v_account.account_type
          WHEN 'Income' THEN 250000 + RANDOM() * 150000     -- Revenue 250k–400k/month
          WHEN 'Expense' THEN 50000 + RANDOM() * 100000     -- Expenses 50k–150k/month
          WHEN 'Asset' THEN 1000000 + RANDOM() * 500000     -- Assets 1M–1.5M
          WHEN 'Liability' THEN 500000 + RANDOM() * 300000  -- Liabilities 500k–800k
          ELSE 100000
        END;

        -- Monthly variation: ±20% around base
        v_variance_pct := 0.8 + RANDOM() * 0.4;
        v_amount := v_base_amount * v_variance_pct;

        -- Alternate positive/negative for expenses/liabilities
        v_sign := CASE
          WHEN v_account.account_type IN ('Income', 'Liability') AND v_entry_no % 2 = 0 THEN -1
          ELSE 1
        END;

        -- Insert GL entry (2 per month per account per company)
        INSERT INTO fact_gl_entries (
          entry_no, company_id, account_no, date_id, document_id,
          posting_group_id, department_id, counterparty_id, bal_account_id,
          currency_id, amount, document_no, description
        ) VALUES (
          v_entry_no,
          v_company.company_id,
          v_account.account_no,
          v_date.date_id,
          FLOOR(RANDOM() * 5)::SMALLINT + 1,  -- doc 1–5
          FLOOR(RANDOM() * 3)::SMALLINT + 1,  -- posting group 1–3
          FLOOR(RANDOM() * 5)::SMALLINT + 1,  -- dept 1–5
          FLOOR(RANDOM() * 5)::SMALLINT + 1,  -- counterparty 1–5
          FLOOR(RANDOM() * 5)::SMALLINT + 1,  -- bal account 1–5
          1,  -- USD
          v_amount * v_sign,
          'GL-' || v_entry_no::TEXT,
          'iSource seed entry: ' || v_account.account_no || ' Month ' || v_date.month
        ) ON CONFLICT DO NOTHING;

        v_entry_no := v_entry_no + 1;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ── 5. Seed fact_coa_balances: Account balances per company ──
INSERT INTO fact_coa_balances (company_id, account_no, net_change, balance)
SELECT DISTINCT
  g.company_id,
  g.account_no,
  SUM(g.amount) AS net_change,
  SUM(g.amount) AS balance
FROM fact_gl_entries g
WHERE g.company_id IN (18, 19, 20)
GROUP BY g.company_id, g.account_no
ON CONFLICT (company_id, account_no) DO UPDATE
SET net_change = EXCLUDED.net_change,
    balance = EXCLUDED.balance;

-- ── 6. Seed budgets: 110% of GL actuals for each company ──────
INSERT INTO budgets (company_id, account_category, fiscal_year, fiscal_period, budget_amount)
SELECT
  g.company_id,
  COALESCE(a.account_category, 'General'),
  d.fiscal_year,
  d.fiscal_period,
  ROUND(ABS(SUM(g.amount)) * 1.10, 2) AS budget_amount
FROM fact_gl_entries g
LEFT JOIN dim_account a ON a.account_no = g.account_no
JOIN dim_date d ON d.date_id = g.date_id
WHERE g.company_id IN (18, 19, 20)
  AND ABS(g.amount) > 0
GROUP BY g.company_id, a.account_category, d.fiscal_year, d.fiscal_period
ON CONFLICT (company_id, account_category, fiscal_year, fiscal_period) DO NOTHING;

-- ── 7. Seed investments: 20 investments (6–7 per company) ─────
INSERT INTO investments (
  company_id, investment_name, investment_type, asset_class,
  invested_amount, current_value, return_amount, investment_date, status
)
VALUES
  -- iSource India (18)
  (18, 'SBI Fixed Deposit 2Y', 'Fixed Income', 'Bank Deposits', 200000, 210000, 10000, '2023-06-01', 'active'),
  (18, 'NSE Nifty 50 Index Fund', 'Equity', 'Large Cap', 300000, 345000, 45000, '2022-09-01', 'active'),
  (18, 'Commercial Real Estate Delhi', 'Property', 'Real Estate', 500000, 560000, 60000, '2021-12-15', 'active'),
  (18, 'ICICI Liquid Fund', 'Cash', 'Money Market', 100000, 102500, 2500, '2023-12-01', 'active'),
  (18, 'Infrastructure Bond Fund', 'Alternative', 'Infrastructure', 250000, 275000, 25000, '2022-03-01', 'active'),
  (18, 'HDFC Short Duration Fund', 'Fixed Income', 'Debt Mutual Fund', 150000, 158500, 8500, '2023-03-15', 'active'),
  (18, 'Startup Investment Syndicate', 'Equity', 'Growth', 180000, 198000, 18000, '2022-07-01', 'active'),
  -- iSource Technologies LLC (19)
  (19, 'US Treasury 3Y Bond', 'Fixed Income', 'Government Bonds', 500000, 518750, 18750, '2024-01-15', 'active'),
  (19, 'S&P 500 Index ETF', 'Equity', 'Large Cap', 600000, 678000, 78000, '2023-06-01', 'active'),
  (19, 'Commercial Real Estate Fund', 'Property', 'Real Estate', 1000000, 1100000, 100000, '2022-03-10', 'active'),
  (19, 'Corporate Bond Portfolio', 'Fixed Income', 'Corporate Bonds', 400000, 418000, 18000, '2023-09-01', 'active'),
  (19, 'Private Equity Fund', 'Alternative', 'Private Equity', 300000, 345000, 45000, '2021-06-15', 'active'),
  (19, 'Money Market Fund', 'Cash', 'Money Market', 250000, 256250, 6250, '2024-01-01', 'active'),
  (19, 'Healthcare ETF Growth', 'Equity', 'Sector', 350000, 399500, 49500, '2023-02-15', 'active'),
  -- iSource Solutions GmbH (20)
  (20, 'German Government Bonds 5Y', 'Fixed Income', 'Government Bonds', 400000, 414000, 14000, '2023-08-01', 'active'),
  (20, 'MSCI Germany Index Fund', 'Equity', 'Large Cap', 350000, 385000, 35000, '2023-04-01', 'active'),
  (20, 'Commercial Real Estate Munich', 'Property', 'Real Estate', 750000, 825000, 75000, '2022-05-10', 'active'),
  (20, 'Euro Corporate Bonds', 'Fixed Income', 'Corporate Bonds', 300000, 315000, 15000, '2024-02-01', 'active'),
  (20, 'European Infrastructure Fund', 'Alternative', 'Infrastructure', 200000, 226000, 26000, '2022-11-01', 'active'),
  (20, 'Tech Growth Fund EUR', 'Equity', 'Growth', 280000, 322000, 42000, '2023-01-15', 'active')
ON CONFLICT DO NOTHING;

-- ── 8. Seed fact_posted_sales: Monthly sales by customer ─────
DO $$
DECLARE
  v_customer RECORD;
  v_date RECORD;
  v_entry_no INT := 200000;
  v_amount NUMERIC(20,4);
  v_company_id SMALLINT;
BEGIN
  FOR v_customer IN SELECT customer_id FROM dim_customer WHERE customer_id BETWEEN 1 AND 30 LOOP
    -- Map customer to company: 1–10 → 18, 11–20 → 19, 21–30 → 20
    v_company_id := CASE
      WHEN v_customer.customer_id <= 10 THEN 18
      WHEN v_customer.customer_id <= 20 THEN 19
      ELSE 20
    END;

    FOR v_date IN SELECT date_id FROM dim_date WHERE full_date >= '2022-01-01' AND full_date <= '2024-12-31' LOOP
      -- Base sales amount per customer (USD)
      v_amount := (50000 + RANDOM() * 100000);

      INSERT INTO fact_posted_sales (
        entry_no, company_id, account_no, date_id, document_id,
        posting_group_id, department_id, counterparty_id, currency_id,
        amount, customer_vendor_name
      ) VALUES (
        v_entry_no,
        v_company_id,
        '4010',  -- Product Sales Revenue
        v_date.date_id,
        FLOOR(RANDOM() * 5)::SMALLINT + 1,
        FLOOR(RANDOM() * 3)::SMALLINT + 1,
        FLOOR(RANDOM() * 5)::SMALLINT + 1,
        v_customer.customer_id,
        1,  -- USD
        v_amount,
        'CUST' || LPAD(v_customer.customer_id::TEXT, 3, '0')
      ) ON CONFLICT DO NOTHING;

      v_entry_no := v_entry_no + 1;
    END LOOP;
  END LOOP;
END $$;

-- ── 9. Verify seed data ────────────────────────────────────────
SELECT
  'Migration 012 Complete' AS status,
  (SELECT COUNT(*) FROM dim_company WHERE company_id IN (18, 19, 20)) AS companies_seeded,
  (SELECT COUNT(*) FROM dim_account) AS total_accounts,
  (SELECT COUNT(*) FROM dim_customer WHERE customer_id BETWEEN 1 AND 30) AS customers_seeded,
  (SELECT COUNT(*) FROM fact_gl_entries WHERE company_id IN (18, 19, 20)) AS gl_entries_seeded,
  (SELECT COUNT(*) FROM budgets WHERE company_id IN (18, 19, 20)) AS budgets_seeded,
  (SELECT COUNT(*) FROM investments WHERE company_id IN (18, 19, 20)) AS investments_seeded,
  (SELECT COUNT(*) FROM fact_posted_sales WHERE company_id IN (18, 19, 20)) AS sales_seeded;
