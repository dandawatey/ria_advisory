# 07 — Entity Relationship Diagram
**Status:** Active — Living Document
**Owner:** Kiran_Data_008
**Last Updated:** 2026-05-07
**Source:** ria_advisory PostgreSQL database (live schema query)

---

## Overview

43 tables organised into 8 domains. Core star schema centred on `fact_gl_entries`. Multi-tenant isolation via `tenant_id UUID` on all client-data tables. 47 FK constraints.

---

## Domain Groups

### Domain: Auth & Multi-Tenancy
Tables: `tenants`, `users`, `casbin_rule`, `impersonation_audit`, `audit_logs`, `app_settings`

### Domain: Feature Flags
Tables: `feature_flags`, `tenant_feature_flags`

### Domain: ERP Integration
Tables: `dim_erp_source`, `dim_erp_credential`, `dim_erp_mapping`, `tenant_bc_config`, `fact_sync_log`, `fact_connector_health_log`, `fact_connector_alerts`

### Domain: Financial Data — Star Schema
Tables: `fact_gl_entries`, `fact_posted_sales`, `fact_coa_balances`, `dim_account`, `dim_bal_account`, `dim_company`, `dim_date`, `dim_document`, `dim_department`, `dim_currency`, `dim_counterparty`, `dim_posting_group`, `dim_project`, `dim_project_code`, `dim_geo`, `dim_customer`

### Domain: Canonical CoA Model
Tables: `dim_canonical_account`, `account_mapping`, `fact_gl_normalized`, `fact_gl_quarantine`

### Domain: Planning & Portfolio
Tables: `budgets`, `investments`

### Domain: Configuration & RBAC
Tables: `account_groups`, `account_group_members`, `dim_dimension_hierarchy`, `dim_exchange_rate`

### Domain: System
Tables: `schema_migrations`

### Domain: Uncategorised
Tables: `fact_audit_log`

---

## Mermaid ER Diagram

```mermaid
erDiagram

    %% ==================== AUTH & MULTI-TENANCY ====================

    tenants {
        UUID id PK
        varchar(200) name
        varchar(100) slug
        varchar(50) plan
        varchar(20) status
        jsonb settings
        timestamp created_at
    }

    users {
        UUID id PK
        varchar(255) email
        varchar(255) password_hash
        varchar(200) display_name
        varchar(255) azure_oid
        UUID tenant_id
        varchar(50) role
        boolean is_active
        timestamp created_at
        timestamp last_login
        jsonb subsidiary_access
    }

    casbin_rule {
        int id PK
        varchar(10) ptype
        varchar(256) v0
        varchar(256) v1
        varchar(256) v2
        varchar(256) v3
        varchar(256) v4
        varchar(256) v5
    }

    impersonation_audit {
        UUID id PK
        UUID admin_id
        UUID target_user_id
        UUID tenant_id
        timestamp started_at
        timestamp stopped_at
        text reason
        varchar(64) ip_address
    }

    audit_logs {
        int id PK
        UUID tenant_id
        UUID user_id
        varchar(100) action
        varchar(200) resource
        jsonb details
        varchar(50) ip_address
        timestamp created_at
    }

    app_settings {
        varchar(100) key PK
        text value
        timestamp updated_at
    }

    %% ==================== FEATURE FLAGS ====================

    feature_flags {
        int id PK
        varchar(100) flag_key
        varchar(200) label
        text description
        boolean is_enabled
        varchar(20) phase
        varchar(50) category
        timestamp updated_at
    }

    tenant_feature_flags {
        UUID tenant_id PK
        varchar(100) flag_key PK
        boolean is_enabled
        timestamp updated_at
    }

    %% ==================== ERP INTEGRATION ====================

    dim_erp_source {
        int erp_source_id PK
        UUID tenant_id
        varchar(50) erp_type
        varchar(50) erp_version
        UUID entity_id
        varchar(200) display_name
        varchar(20) connection_status
        timestamp last_heartbeat_at
        timestamp last_synced_at
        jsonb sync_cursor
        jsonb schedule_config
        jsonb fy_calendar
        jsonb config_json
        int staleness_threshold_hours
        jsonb locked_periods
        timestamp created_at
        timestamp updated_at
    }

    dim_erp_credential {
        UUID credential_id PK
        int erp_source_id
        varchar(50) credential_type
        varchar(500) vault_secret_ref
        timestamp expires_at
        timestamp last_rotated_at
        varchar(100) created_by
        timestamp created_at
    }

    dim_erp_mapping {
        int mapping_id PK
        int erp_source_id
        varchar(100) source_account_code
        varchar(500) source_account_name
        varchar(100) canonical_account_no
        varchar(50) canonical_category
        varchar(50) canonical_l1
        varchar(50) canonical_l2
        varchar(100) canonical_l3
        varchar(50) dimension_type
        varchar(100) source_dimension_code
        varchar(200) canonical_dimension_value
        decimal(5,2) mapping_confidence
        varchar(100) mapped_by
        timestamp mapped_at
        boolean is_active
    }

    tenant_bc_config {
        UUID id PK
        UUID tenant_id
        varchar(255) bc_tenant_id
        varchar(255) client_id
        varchar(255) client_secret
        varchar(20) environment
        varchar(20) api_version
        varchar(20) auth_status
        timestamp last_tested
        timestamp updated_at
    }

    fact_sync_log {
        UUID sync_id PK
        int erp_source_id
        varchar(20) sync_type
        varchar(100) triggered_by
        date period_from
        date period_to
        timestamp started_at
        timestamp completed_at
        varchar(20) status
        bigint records_fetched
        bigint records_inserted
        bigint records_updated
        bigint records_rejected
        text error_message
        jsonb cursor_before
        jsonb cursor_after
        int rows_fetched
        int rows_upserted
        timestamp watermark_from
        timestamp watermark_to
        text error_msg
    }

    fact_connector_health_log {
        int log_id PK
        int erp_source_id
        timestamp checked_at
        varchar(20) status
        int latency_ms
        text error_msg
    }

    fact_connector_alerts {
        UUID alert_id PK
        int erp_source_id
        UUID tenant_id
        varchar(50) alert_type
        varchar(20) severity
        jsonb details
        boolean is_read
        timestamp created_at
    }

    %% ==================== FINANCIAL DATA — STAR SCHEMA ====================

    fact_gl_entries {
        int entry_no PK
        int company_id PK
        varchar(30) account_no
        int date_id
        int document_id
        int posting_group_id
        int department_id
        int counterparty_id
        int bal_account_id
        int project_id
        int project_code_id
        int geo_id
        int currency_id
        decimal(20,4) amount
        varchar(60) document_no
        varchar(60) external_document_no
        text description
        varchar(30) billable_flag
        UUID entity_id
        int erp_source_id
        varchar(100) erp_native_journal_id
        varchar(50) erp_native_line_number
        character transaction_currency
        decimal(20,4) transaction_amount_dr
        decimal(20,4) transaction_amount_cr
        character functional_currency
        decimal(20,4) functional_amount_dr
        decimal(20,4) functional_amount_cr
        decimal(20,4) reporting_amount_dr
        decimal(20,4) reporting_amount_cr
        decimal(20,8) exchange_rate_used
        boolean is_intercompany
        boolean is_elimination_entry
        boolean is_final
        boolean is_superseded
        varchar(200) dimension_department
        varchar(200) dimension_vertical
        varchar(200) dimension_project
        varchar(200) dimension_geography
        decimal(5,2) data_quality_score
        UUID tenant_id
    }

    fact_posted_sales {
        int entry_no PK
        int company_id PK
        varchar(30) account_no
        int date_id
        int document_id
        int posting_group_id
        int department_id
        int counterparty_id
        int currency_id
        decimal(20,4) amount
        varchar(250) customer_vendor_name
        varchar(250) gl_account_name
        int dimension_set_id
    }

    fact_coa_balances {
        int company_id PK
        varchar(30) account_no PK
        decimal(20,4) net_change
        decimal(20,4) balance
    }

    dim_account {
        varchar(30) account_no PK
        varchar(250) account_name
        varchar(30) income_balance
        varchar(60) account_category
        varchar(100) account_subcategory
        varchar(30) account_type
        varchar(250) totaling
    }

    dim_bal_account {
        int bal_account_id PK
        varchar(30) bal_account_type
        varchar(60) bal_account_no
    }

    dim_company {
        int company_id PK
        varchar(150) company_name
        int currency_id
        UUID tenant_id
    }

    dim_date {
        int date_id PK
        date full_date
        int year
        int quarter
        varchar(10) quarter_name
        int month
        varchar(15) month_name
        int week
        int day
        varchar(12) day_name
        int is_month_end
        int fiscal_year
        int fiscal_quarter
        varchar(20) fiscal_period
    }

    dim_document {
        int document_id PK
        varchar(60) document_type
        varchar(30) source_code
    }

    dim_department {
        int department_id PK
        varchar(60) department_code
        varchar(60) vertical_code
    }

    dim_currency {
        int currency_id PK
        varchar(10) currency_code
        varchar(60) currency_name
        varchar(5) currency_symbol
    }

    dim_counterparty {
        int counterparty_id PK
        varchar(30) source_type
        varchar(60) source_no
    }

    dim_posting_group {
        int posting_group_id PK
        varchar(30) gen_posting_type
        varchar(60) gen_bus_posting_group
        varchar(60) gen_prod_posting_group
    }

    dim_project {
        int project_id PK
        varchar(60) project_no
    }

    dim_project_code {
        int project_code_id PK
        varchar(60) project_code
    }

    dim_geo {
        int geo_id PK
        varchar(30) geo_code
    }

    dim_customer {
        int customer_id PK
        int counterparty_id
        varchar(30) customer_no
        varchar(250) customer_name
        varchar(150) company
        varchar(100) city
        varchar(100) state
        varchar(150) contact
        decimal(20,4) balance
        decimal(20,4) balance_due
        decimal(20,4) total_sales
        decimal(20,4) total_payments
        varchar(10) coupled_to_dataverse
    }

    %% ==================== CANONICAL COA MODEL ====================

    dim_canonical_account {
        int canonical_id PK
        text l1_statement
        text l2_category
        text l3_subcategory
        text display_name
        int sort_order
        boolean is_active
    }

    account_mapping {
        int mapping_id PK
        UUID tenant_id
        text source_erp
        text source_account
        text source_name
        int canonical_id
        text l2_override
        text mapped_by
        decimal(5,2) confidence
        text notes
        timestamp created_at
        timestamp updated_at
    }

    fact_gl_normalized {
        bigint id PK
        UUID tenant_id
        text source_erp
        text source_id
        int source_line
        date posting_date
        text account_code
        int canonical_id
        text entity_code
        int entity_id
        decimal(20,4) debit_amount
        decimal(20,4) credit_amount
        character currency
        decimal(20,8) fx_rate
        decimal(20,4) reporting_amount
        text dimension_1
        text dimension_2
        text description
        jsonb raw_payload
        timestamp ingested_at
    }

    fact_gl_quarantine {
        UUID quarantine_id PK
        int erp_source_id
        varchar(100) raw_journal_id
        varchar(100) source_account
        varchar(50) reason
        jsonb raw_record_json
        timestamp quarantined_at
        timestamp resolved_at
    }

    %% ==================== PLANNING & PORTFOLIO ====================

    budgets {
        UUID id PK
        int company_id
        varchar(100) account_category
        int fiscal_year
        int fiscal_period
        decimal(18,2) budget_amount
        text notes
        timestamp created_at
        timestamp updated_at
    }

    investments {
        UUID id PK
        int company_id
        varchar(255) investment_name
        varchar(50) investment_type
        varchar(100) asset_class
        varchar(10) currency_code
        decimal(18,2) invested_amount
        decimal(18,2) current_value
        decimal(18,2) return_amount
        date investment_date
        date maturity_date
        varchar(20) status
        text notes
        timestamp created_at
    }

    %% ==================== CONFIGURATION & RBAC ====================

    account_groups {
        UUID group_id PK
        UUID tenant_id
        varchar(120) group_name
        text description
        varchar(20) color
        int sort_order
        timestamp created_at
        timestamp updated_at
    }

    account_group_members {
        UUID group_id PK
        varchar(20) account_no PK
        varchar(120) label_override
        timestamp added_at
    }

    dim_dimension_hierarchy {
        int hierarchy_id PK
        UUID tenant_id
        varchar(50) canonical_dim
        varchar(200) value
        varchar(200) parent_value
        int level_num
    }

    dim_exchange_rate {
        int rate_id PK
        date rate_date
        character from_currency
        character to_currency
        decimal(20,8) rate
        varchar(20) rate_type
        varchar(50) source
    }

    %% ==================== SYSTEM ====================

    schema_migrations {
        varchar(20) version PK
        varchar(200) filename
        timestamp applied_at
    }

    %% ==================== UNCATEGORISED ====================

    fact_audit_log {
        UUID log_id PK
        varchar(50) entity_type
        varchar(100) entity_id
        varchar(100) field
        text old_value
        text new_value
        varchar(100) changed_by
        timestamp changed_at
    }

    %% ==================== RELATIONSHIPS ====================
    account_groups ||--o{ account_group_members : "group"
    dim_canonical_account ||--o{ account_mapping : "canonical"
    tenants ||--o{ account_mapping : "tenant"
    tenants ||--o{ audit_logs : "tenant"
    users ||--o{ audit_logs : "user"
    dim_company ||--o{ budgets : "company"
    dim_currency ||--o{ dim_company : "currency"
    dim_counterparty ||--o{ dim_customer : "counterparty"
    dim_erp_source ||--o{ dim_erp_credential : "erp source"
    dim_erp_source ||--o{ dim_erp_mapping : "erp source"
    dim_account ||--o{ fact_coa_balances : "account no"
    dim_company ||--o{ fact_coa_balances : "company"
    dim_erp_source ||--o{ fact_connector_alerts : "erp source"
    dim_erp_source ||--o{ fact_connector_health_log : "erp source"
    dim_account ||--o{ fact_gl_entries : "account no"
    dim_bal_account ||--o{ fact_gl_entries : "bal account"
    dim_company ||--o{ fact_gl_entries : "company"
    dim_counterparty ||--o{ fact_gl_entries : "counterparty"
    dim_currency ||--o{ fact_gl_entries : "currency"
    dim_date ||--o{ fact_gl_entries : "date"
    dim_department ||--o{ fact_gl_entries : "department"
    dim_document ||--o{ fact_gl_entries : "document"
    dim_erp_source ||--o{ fact_gl_entries : "erp source"
    dim_geo ||--o{ fact_gl_entries : "geo"
    dim_posting_group ||--o{ fact_gl_entries : "posting group"
    dim_project_code ||--o{ fact_gl_entries : "project code"
    dim_project ||--o{ fact_gl_entries : "project"
    dim_canonical_account ||--o{ fact_gl_normalized : "canonical"
    dim_company ||--o{ fact_gl_normalized : "entity"
    dim_erp_source ||--o{ fact_gl_quarantine : "erp source"
    dim_account ||--o{ fact_posted_sales : "account no"
    dim_company ||--o{ fact_posted_sales : "company"
    fact_gl_entries ||--o{ fact_posted_sales : "company"
    dim_counterparty ||--o{ fact_posted_sales : "counterparty"
    dim_currency ||--o{ fact_posted_sales : "currency"
    dim_date ||--o{ fact_posted_sales : "date"
    dim_department ||--o{ fact_posted_sales : "department"
    dim_document ||--o{ fact_posted_sales : "document"
    dim_posting_group ||--o{ fact_posted_sales : "posting group"
    dim_erp_source ||--o{ fact_sync_log : "erp source"
    users ||--o{ impersonation_audit : "admin"
    tenants ||--o{ impersonation_audit : "tenant"
    dim_company ||--o{ investments : "company"
    tenants ||--o{ tenant_bc_config : "tenant"
    feature_flags ||--o{ tenant_feature_flags : "flag key"
    tenants ||--o{ tenant_feature_flags : "tenant"
    tenants ||--o{ users : "tenant"
```

---

## Update Log

### Updated 2026-05-07
Auto-generated by `03_Backend/scripts/generate_er_diagram.py`.
Tables: 43 | FK relationships: 47 | Migrations applied: 001–011
