# RIA Advisory — Full Star Schema ER Diagram

## 3 Fact Tables · 12 Dimension Tables

```mermaid
erDiagram

    fact_gl_entries {
        int     entry_no              PK
        int     company_id            FK
        int     account_no            FK
        int     date_id               FK
        int     document_id           FK
        int     posting_group_id      FK
        int     department_id         FK
        int     counterparty_id       FK
        int     bal_account_id        FK
        int     project_id            FK
        int     project_code_id       FK
        int     geo_id                FK
        int     currency_id           FK
        float   amount
        string  document_no
        string  external_document_no
        string  description
        string  billable_flag
    }

    fact_coa_balances {
        int     company_id   FK
        int     account_no   FK
        float   net_change
        float   balance
    }

    fact_posted_sales {
        int     entry_no              PK_FK
        int     company_id            FK
        int     account_no            FK
        int     date_id               FK
        int     document_id           FK
        int     posting_group_id      FK
        int     department_id         FK
        int     counterparty_id       FK
        int     currency_id           FK
        float   amount
        string  customer_vendor_name
        string  gl_account_name
        int     dimension_set_id
    }

    dim_company {
        int     company_id    PK
        string  company_name
        int     currency_id   FK
    }

    dim_account {
        int     account_no          PK
        string  account_name
        string  income_balance
        string  account_category
        string  account_subcategory
        string  account_type
        string  totaling
    }

    dim_date {
        int     date_id         PK
        date    full_date
        int     year
        int     quarter
        string  quarter_name
        int     month
        string  month_name
        int     week
        int     day
        string  day_name
        int     is_month_end
        int     fiscal_year
        int     fiscal_quarter
        string  fiscal_period
    }

    dim_currency {
        int     currency_id     PK
        string  currency_code
        string  currency_name
        string  currency_symbol
    }

    dim_document {
        int     document_id   PK
        string  document_type
        string  source_code
    }

    dim_posting_group {
        int     posting_group_id       PK
        string  gen_posting_type
        string  gen_bus_posting_group
        string  gen_prod_posting_group
    }

    dim_department {
        int     department_id   PK
        string  department_code
        string  vertical_code
    }

    dim_counterparty {
        int     counterparty_id  PK
        string  source_type
        string  source_no
    }

    dim_bal_account {
        int     bal_account_id   PK
        string  bal_account_type
        string  bal_account_no
    }

    dim_project {
        int     project_id  PK
        string  project_no
    }

    dim_project_code {
        int     project_code_id  PK
        string  project_code
    }

    dim_geo {
        int     geo_id    PK
        string  geo_code
    }

    %% fact_gl_entries relationships
    fact_gl_entries }o--|| dim_company       : "company_id"
    fact_gl_entries }o--|| dim_account       : "account_no"
    fact_gl_entries }o--|| dim_date          : "date_id"
    fact_gl_entries }o--|| dim_document      : "document_id"
    fact_gl_entries }o--|| dim_posting_group : "posting_group_id"
    fact_gl_entries }o--|| dim_department    : "department_id"
    fact_gl_entries }o--|| dim_counterparty  : "counterparty_id"
    fact_gl_entries }o--|| dim_bal_account   : "bal_account_id"
    fact_gl_entries }o--o| dim_project       : "project_id (nullable)"
    fact_gl_entries }o--o| dim_project_code  : "project_code_id (nullable)"
    fact_gl_entries }o--o| dim_geo           : "geo_id (nullable)"
    fact_gl_entries }o--|| dim_currency      : "currency_id"

    %% fact_coa_balances relationships
    fact_coa_balances }o--|| dim_company : "company_id"
    fact_coa_balances }o--|| dim_account : "account_no"

    %% fact_posted_sales relationships
    fact_posted_sales ||--o{ fact_gl_entries   : "entry_no (subset)"
    fact_posted_sales }o--|| dim_company       : "company_id"
    fact_posted_sales }o--|| dim_account       : "account_no"
    fact_posted_sales }o--|| dim_date          : "date_id"
    fact_posted_sales }o--|| dim_document      : "document_id"
    fact_posted_sales }o--|| dim_posting_group : "posting_group_id"
    fact_posted_sales }o--|| dim_department    : "department_id"
    fact_posted_sales }o--|| dim_counterparty  : "counterparty_id"
    fact_posted_sales }o--|| dim_currency      : "currency_id"

    %% shared dim
    dim_company }o--|| dim_currency : "functional currency"
```

---

## Schema Summary

| Table | Rows | Type | Source |
|---|---|---|---|
| `fact_gl_entries` | 188,380 | Fact | GL Export (all 17 companies) |
| `fact_coa_balances` | 7,892 | Fact | Chart of Accounts Combined |
| `fact_posted_sales` | 3,094 | Fact | Posted Sales Invoices + Credit Memos |
| `dim_company` | 17 | Dim | GL / CoA |
| `dim_account` | 474 | Dim | Chart of Accounts (canonical) |
| `dim_date` | 282 | Dim | Derived from GL posting dates |
| `dim_currency` | 8 | Dim | Manual — USD PHP MXN CAD INR GBP ZAR AUD |
| `dim_document` | 36 | Dim | Document type × source code |
| `dim_posting_group` | 19 | Dim | Gen/Bus/Prod posting groups |
| `dim_department` | 32 | Dim | Department × vertical |
| `dim_counterparty` | 967 | Dim | Customers / vendors / banks |
| `dim_bal_account` | 1,007 | Dim | Balancing account |
| `dim_project` | 44 | Dim | Project number (sparse) |
| `dim_project_code` | 259 | Dim | Project code |
| `dim_geo` | 3 | Dim | Geographic code (sparse) |
