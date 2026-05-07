-- Migration 010: Feature flags table
-- Phase 1 (promised in proposal) → enabled=true
-- Phase 2+ (not yet promised) → enabled=false
-- Superadmin can toggle any flag via /api/feature-flags

CREATE TABLE IF NOT EXISTS feature_flags (
    id          SERIAL PRIMARY KEY,
    flag_key    VARCHAR(100) UNIQUE NOT NULL,
    label       VARCHAR(200) NOT NULL,
    description TEXT,
    is_enabled  BOOLEAN NOT NULL DEFAULT false,
    phase       VARCHAR(20) NOT NULL DEFAULT 'phase2',
    category    VARCHAR(50) NOT NULL DEFAULT 'reports',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Phase 1 — promised in 3-week proposal (enabled by default) ─────────────────
INSERT INTO feature_flags (flag_key, label, description, is_enabled, phase, category) VALUES
('page_collections',   'Collections Dashboard',  'Real-time AR aging, collection rate trend, overdue alerts by subsidiary', true,  'phase1', 'ar'),
('page_ar_aging',      'AR Ageing Report',       '4-bucket aging per entity: 0–30, 31–60, 61–90, 90+ days; group-consolidated view', true,  'phase1', 'ar'),
('page_revenue',       'Revenue Report',         'GL-sourced revenue by subsidiary, month, account category; YoY comparison', true,  'phase1', 'revenue'),
('page_ubr',           'Unbilled Revenue (UBR)', 'Work-in-progress vs invoiced gap; revenue recognised vs invoiced by project', true,  'phase1', 'revenue'),
('page_invoicing',     'Invoicing Report',       'Invoice count and value by entity, client, month; drill-through to BC lines', true,  'phase1', 'revenue'),
('page_settings',      'Settings',               'BC connection config, app settings, credential management', true,  'phase1', 'admin'),
('page_bc_tenants',    'BC Tenant Auth',         'OAuth credential setup for all 17 BC tenants', true,  'phase1', 'admin'),
('page_api_status',    'API Status',             'Backend health and BC sync status monitor', true,  'phase1', 'admin'),

-- ── Phase 2 — Command Center ───────────────────────────────────────────────────
('page_executive_dashboard', 'Executive Dashboard',  'C-suite consolidated financial overview across all subsidiaries', false, 'phase2', 'command'),
('page_health_score',        'Health Score',          'Financial health scoring and alerts', false, 'phase2', 'command'),
('page_360_view',            'CFO 360° View',         'Unified 360-degree executive financial view', false, 'phase2', 'command'),

-- ── Phase 2 — Financial Statements ────────────────────────────────────────────
('page_pl',                  'P&L Statement',         'Full P&L analytics with drill-through and YoY comparison', false, 'phase2', 'financial'),
('page_balance_sheet',       'Balance Sheet',         'Consolidated and per-entity balance sheet', false, 'phase2', 'financial'),
('page_cash_flow',           'Cash Flow',             'Cash flow statement analysis', false, 'phase2', 'financial'),
('page_trial_balance',       'Trial Balance',         'Trial balance by entity and period', false, 'phase2', 'financial'),

-- ── Phase 2 — Performance ─────────────────────────────────────────────────────
('page_kpi_dashboard',       'KPI Dashboard',         'Key performance indicator tracking', false, 'phase2', 'performance'),
('page_cfo_ratios',          'CFO Ratios',            'Financial ratio analysis', false, 'phase2', 'performance'),
('page_analytics',           'Analytics',             'Advanced GL analytics module', false, 'phase2', 'performance'),
('page_entity_comparison',   'Entity Comparison',     'Side-by-side financial comparison across entities', false, 'phase2', 'performance'),

-- ── Phase 2 — Revenue & Income (beyond Phase 1) ───────────────────────────────
('page_monthly_income',      'Monthly Income',        'Month-by-month income breakdown', false, 'phase2', 'revenue'),
('page_posted_sales',        'Posted Sales Insights', 'BC posted sales deep-dive analysis', false, 'phase2', 'revenue'),
('page_invoice_insights',    'Invoice Insights',      'Detailed invoice analytics from BC', false, 'phase2', 'revenue'),

-- ── Phase 2 — AR (beyond Phase 1) ─────────────────────────────────────────────
('page_customers',           'Customer Insights',     'Customer-level AR and revenue analysis', false, 'phase2', 'ar'),

-- ── Phase 2 — Cost Management ─────────────────────────────────────────────────
('page_expense_analysis',    'Expense Analysis',      'Expense breakdown and trend analysis', false, 'phase2', 'cost'),
('page_dept_spend',          'Dept Spend',            'Department-level expenditure tracking', false, 'phase2', 'cost'),
('page_projects',            'Project Financials',    'Project-level financial tracking and profitability', false, 'phase2', 'cost'),
('page_verticals',           'Vertical Analytics',    'Business vertical performance analysis', false, 'phase2', 'cost'),

-- ── Phase 2 — Planning ────────────────────────────────────────────────────────
('page_budgeting',           'Budget Planning',       'Budget vs actuals planning module', false, 'phase2', 'planning'),
('page_investments',         'Investments',           'Investment portfolio tracking', false, 'phase2', 'planning'),

-- ── Phase 2 — ERP Integration ─────────────────────────────────────────────────
('page_consolidated',        'Consolidated View',     'Multi-ERP consolidated financial dashboard', false, 'phase2', 'erp'),
('page_cross_erp_pl',        'Cross-ERP P&L',        'P&L comparison across ERP systems', false, 'phase2', 'erp'),
('page_erp_sources',         'ERP Sources',           'Multi-ERP connection management', false, 'phase2', 'erp'),
('page_field_mapping',       'Field Mapping',         'ERP field-to-canonical mapping configuration', false, 'phase2', 'erp'),

-- ── Phase 2 — Close & Control ─────────────────────────────────────────────────
('page_close_cockpit',       'Close Cockpit',         'Month-end close management and checklist', false, 'phase2', 'close'),
('page_ai_query',            'AI Query',              'Natural language financial queries (NLQ)', false, 'phase2', 'close'),

-- ── Phase 2 — Data Pipeline ───────────────────────────────────────────────────
('page_data_extraction',     'Data Extraction',       'Pipeline data extraction monitoring', false, 'phase2', 'pipeline'),
('page_orchestration',       'Pipeline Orchestration','Data pipeline orchestration control', false, 'phase2', 'pipeline'),
('page_resilience',          'Ingestion Resilience',  'Pipeline error handling and retry management', false, 'phase2', 'pipeline'),
('page_bronze_zone',         'Bronze Zone',           'Raw data landing zone browser', false, 'phase2', 'pipeline'),
('page_silver_layer',        'Silver Layer',          'Cleansed and conformed data layer', false, 'phase2', 'pipeline'),
('page_gold_layer',          'Gold Layer',            'Analytics-ready gold layer browser', false, 'phase2', 'pipeline'),
('page_data_lineage',        'Data Lineage',          'End-to-end data lineage tracking', false, 'phase2', 'pipeline'),

-- ── Phase 2 — Administration ──────────────────────────────────────────────────
('page_rbac',                'RBAC Console',          'Role-based access control management', false, 'phase2', 'admin'),
('page_gl_mapping',          'GL Mapping',            'GL account mapping console', false, 'phase2', 'admin'),
('page_coa',                 'Chart of Accounts',     'Canonical chart of accounts browser', false, 'phase2', 'admin'),
('page_data_quality',        'Data Quality',          'Data quality monitoring and alerts', false, 'phase2', 'admin'),
('page_ic_elimination',      'IC Elimination',        'Intercompany elimination rules configuration', false, 'phase2', 'admin'),
('page_dimensions',          'Dimensions',            'Dimension framework configuration', false, 'phase2', 'admin'),
('page_fx_translation',      'FX Translation',        'Foreign exchange translation rules', false, 'phase2', 'admin'),
('page_onboarding_wizard',   'Onboarding Wizard',     'New entity onboarding workflow', false, 'phase2', 'admin'),
('page_security',            'Security & Compliance', 'Security posture and compliance monitoring', false, 'phase2', 'admin'),
('page_tenant_management',   'Tenant Management',     'Multi-tenant management (superadmin)', false, 'phase2', 'admin'),
('page_pipeline_health',     'Pipeline Health',       'Data pipeline health and alerting', false, 'phase2', 'admin'),
('page_gl_insights',         'GL Insights',           'General ledger insights browser', false, 'phase2', 'insights'),
('page_coa_insights',        'CoA Insights',          'Chart of accounts insights', false, 'phase2', 'insights')
ON CONFLICT (flag_key) DO NOTHING;
