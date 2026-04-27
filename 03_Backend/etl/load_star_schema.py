"""
ETL: Load StarSchema_GL.xlsx → PostgreSQL star schema tables.

Reads all 16 sheets from 00_InputSample/StarSchema_GL.xlsx and
upserts them into the corresponding Postgres tables in dependency order:
  dims first (leaf → root), then facts.

Usage:
    cd 03_Backend
    python etl/load_star_schema.py

Environment variables (or .env in 03_Backend/):
    PGHOST       localhost
    PGPORT       5432
    PGDATABASE   ria_advisory
    PGUSER       postgres
    PGPASSWORD   <password>
"""

import os
import sys
import logging
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv

# ── Paths ─────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent.parent
XLSX_PATH  = BASE_DIR / "00_InputSample" / "StarSchema_GL.xlsx"
SCHEMA_SQL = Path(__file__).resolve().parent.parent / "sql" / "star_schema.sql"
ENV_FILE   = Path(__file__).resolve().parent.parent / ".env"

load_dotenv(ENV_FILE)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


# ── DB helpers ────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", 5432)),
        dbname=os.getenv("PGDATABASE", "ria_advisory"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", ""),
    )


def apply_schema(conn):
    with open(SCHEMA_SQL) as f:
        sql = f.read()
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    log.info("Schema applied from %s", SCHEMA_SQL.name)


def truncate_all(conn):
    """Truncate in reverse FK order so constraints aren't violated."""
    tables = [
        "fact_posted_sales", "fact_coa_balances", "fact_gl_entries",
        "dim_customer",
        "dim_company",
        "dim_account", "dim_date", "dim_document", "dim_posting_group",
        "dim_department", "dim_counterparty", "dim_bal_account",
        "dim_project", "dim_project_code", "dim_geo",
        "dim_currency",
    ]
    with conn.cursor() as cur:
        for t in tables:
            cur.execute(f"TRUNCATE TABLE {t} CASCADE;")
    conn.commit()
    log.info("All tables truncated.")


# ── Clean helpers ─────────────────────────────────────────────

def _str(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    return s or None


def _int(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def _float(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _date(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        return pd.to_datetime(v).date()
    except Exception:
        return None


def _acct_no(v):
    """Convert account_no — strips trailing '.0' from float-read values (e.g. 100000.0 → '100000')."""
    s = _str(v)
    if s and s.endswith('.0') and s[:-2].isdigit():
        return s[:-2]
    return s


# ── Per-table loaders ─────────────────────────────────────────

def load_dim_currency(conn, df):
    sql = """
        INSERT INTO dim_currency (currency_id, currency_code, currency_name, currency_symbol)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (currency_id) DO UPDATE SET
            currency_code   = EXCLUDED.currency_code,
            currency_name   = EXCLUDED.currency_name,
            currency_symbol = EXCLUDED.currency_symbol
    """
    rows = [(_int(r.get("currency_id")), _str(r.get("currency_code")),
             _str(r.get("currency_name")), _str(r.get("currency_symbol")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_currency")


def load_dim_company(conn, df):
    sql = """
        INSERT INTO dim_company (company_id, company_name, currency_id)
        VALUES (%s, %s, %s)
        ON CONFLICT (company_id) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            currency_id  = EXCLUDED.currency_id
    """
    rows = [(_int(r.get("company_id")), _str(r.get("company_name")),
             _int(r.get("currency_id")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_company")


def load_dim_account(conn, df):
    sql = """
        INSERT INTO dim_account
            (account_no, account_name, income_balance, account_category,
             account_subcategory, account_type, totaling)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (account_no) DO UPDATE SET
            account_name        = EXCLUDED.account_name,
            income_balance      = EXCLUDED.income_balance,
            account_category    = EXCLUDED.account_category,
            account_subcategory = EXCLUDED.account_subcategory,
            account_type        = EXCLUDED.account_type,
            totaling            = EXCLUDED.totaling
    """
    rows = [(_acct_no(r.get("account_no")), _str(r.get("account_name")),
             _str(r.get("income_balance")), _str(r.get("account_category")),
             _str(r.get("account_subcategory")), _str(r.get("account_type")),
             _str(r.get("totaling")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_account")


def load_dim_date(conn, df):
    sql = """
        INSERT INTO dim_date
            (date_id, full_date, year, quarter, quarter_name, month, month_name,
             week, day, day_name, is_month_end, fiscal_year, fiscal_quarter, fiscal_period)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (date_id) DO NOTHING
    """
    rows = [(_int(r.get("date_id")), _date(r.get("full_date")),
             _int(r.get("year")), _int(r.get("quarter")), _str(r.get("quarter_name")),
             _int(r.get("month")), _str(r.get("month_name")),
             _int(r.get("week")), _int(r.get("day")), _str(r.get("day_name")),
             _int(r.get("is_month_end")),
             _int(r.get("fiscal_year")), _int(r.get("fiscal_quarter")), _str(r.get("fiscal_period")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_date")


def load_dim_document(conn, df):
    sql = """
        INSERT INTO dim_document (document_id, document_type, source_code)
        VALUES (%s, %s, %s)
        ON CONFLICT (document_id) DO UPDATE SET
            document_type = EXCLUDED.document_type,
            source_code   = EXCLUDED.source_code
    """
    rows = [(_int(r.get("document_id")), _str(r.get("document_type")),
             _str(r.get("source_code")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_document")


def load_dim_posting_group(conn, df):
    sql = """
        INSERT INTO dim_posting_group
            (posting_group_id, gen_posting_type, gen_bus_posting_group, gen_prod_posting_group)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (posting_group_id) DO UPDATE SET
            gen_posting_type       = EXCLUDED.gen_posting_type,
            gen_bus_posting_group  = EXCLUDED.gen_bus_posting_group,
            gen_prod_posting_group = EXCLUDED.gen_prod_posting_group
    """
    rows = [(_int(r.get("posting_group_id")), _str(r.get("gen_posting_type")),
             _str(r.get("gen_bus_posting_group")), _str(r.get("gen_prod_posting_group")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_posting_group")


def load_dim_department(conn, df):
    sql = """
        INSERT INTO dim_department (department_id, department_code, vertical_code)
        VALUES (%s, %s, %s)
        ON CONFLICT (department_id) DO UPDATE SET
            department_code = EXCLUDED.department_code,
            vertical_code   = EXCLUDED.vertical_code
    """
    rows = [(_int(r.get("department_id")), _str(r.get("department_code")),
             _str(r.get("vertical_code")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_department")


def load_dim_counterparty(conn, df):
    sql = """
        INSERT INTO dim_counterparty (counterparty_id, source_type, source_no)
        VALUES (%s, %s, %s)
        ON CONFLICT (counterparty_id) DO UPDATE SET
            source_type = EXCLUDED.source_type,
            source_no   = EXCLUDED.source_no
    """
    rows = [(_int(r.get("counterparty_id")), _str(r.get("source_type")),
             _str(r.get("source_no")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_counterparty")


def load_dim_bal_account(conn, df):
    sql = """
        INSERT INTO dim_bal_account (bal_account_id, bal_account_type, bal_account_no)
        VALUES (%s, %s, %s)
        ON CONFLICT (bal_account_id) DO UPDATE SET
            bal_account_type = EXCLUDED.bal_account_type,
            bal_account_no   = EXCLUDED.bal_account_no
    """
    rows = [(_int(r.get("bal_account_id")), _str(r.get("bal_account_type")),
             _str(r.get("bal_account_no")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_bal_account")


def load_dim_project(conn, df):
    sql = """
        INSERT INTO dim_project (project_id, project_no)
        VALUES (%s, %s)
        ON CONFLICT (project_id) DO UPDATE SET project_no = EXCLUDED.project_no
    """
    rows = [(_int(r.get("project_id")), _str(r.get("project_no")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_project")


def load_dim_project_code(conn, df):
    sql = """
        INSERT INTO dim_project_code (project_code_id, project_code)
        VALUES (%s, %s)
        ON CONFLICT (project_code_id) DO UPDATE SET project_code = EXCLUDED.project_code
    """
    rows = [(_int(r.get("project_code_id")), _str(r.get("project_code")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_project_code")


def load_dim_geo(conn, df):
    sql = """
        INSERT INTO dim_geo (geo_id, geo_code)
        VALUES (%s, %s)
        ON CONFLICT (geo_id) DO UPDATE SET geo_code = EXCLUDED.geo_code
    """
    rows = [(_int(r.get("geo_id")), _str(r.get("geo_code")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_geo")


def load_dim_customer(conn, df):
    sql = """
        INSERT INTO dim_customer
            (customer_id, counterparty_id, customer_no, customer_name, company,
             city, state, contact, balance, balance_due, total_sales,
             total_payments, coupled_to_dataverse)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (customer_id) DO UPDATE SET
            counterparty_id      = EXCLUDED.counterparty_id,
            customer_no          = EXCLUDED.customer_no,
            customer_name        = EXCLUDED.customer_name,
            company              = EXCLUDED.company,
            city                 = EXCLUDED.city,
            state                = EXCLUDED.state,
            contact              = EXCLUDED.contact,
            balance              = EXCLUDED.balance,
            balance_due          = EXCLUDED.balance_due,
            total_sales          = EXCLUDED.total_sales,
            total_payments       = EXCLUDED.total_payments,
            coupled_to_dataverse = EXCLUDED.coupled_to_dataverse
    """
    rows = [(_int(r.get("customer_id")), _int(r.get("counterparty_id")),
             _str(r.get("customer_no")), _str(r.get("customer_name")),
             _str(r.get("company")), _str(r.get("city")), _str(r.get("state")),
             _str(r.get("contact")), _float(r.get("balance")),
             _float(r.get("balance_due")), _float(r.get("total_sales")),
             _float(r.get("total_payments")), _str(r.get("coupled_to_dataverse")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "dim_customer")


def load_fact_gl_entries(conn, df):
    sql = """
        INSERT INTO fact_gl_entries
            (entry_no, company_id, account_no, date_id, document_id,
             posting_group_id, department_id, counterparty_id, bal_account_id,
             project_id, project_code_id, geo_id, currency_id,
             amount, document_no, external_document_no, description, billable_flag)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (company_id, entry_no) DO NOTHING
    """
    rows = [(_int(r.get("entry_no")),
             _int(r.get("company_id")), _acct_no(r.get("account_no")),
             _int(r.get("date_id")), _int(r.get("document_id")),
             _int(r.get("posting_group_id")), _int(r.get("department_id")),
             _int(r.get("counterparty_id")), _int(r.get("bal_account_id")),
             _int(r.get("project_id")), _int(r.get("project_code_id")),
             _int(r.get("geo_id")), _int(r.get("currency_id")),
             _float(r.get("amount")), _str(r.get("document_no")),
             _str(r.get("external_document_no")), _str(r.get("description")),
             _str(r.get("billable_flag")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "fact_gl_entries", page_size=1000)


def load_fact_coa_balances(conn, df):
    sql = """
        INSERT INTO fact_coa_balances (company_id, account_no, net_change, balance)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (company_id, account_no) DO UPDATE SET
            net_change = EXCLUDED.net_change,
            balance    = EXCLUDED.balance
    """
    rows = [(_int(r.get("company_id")), _acct_no(r.get("account_no")),
             _float(r.get("net_change")), _float(r.get("balance")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "fact_coa_balances")


def load_fact_posted_sales(conn, df):
    sql = """
        INSERT INTO fact_posted_sales
            (entry_no, company_id, account_no, date_id, document_id,
             posting_group_id, department_id, counterparty_id, currency_id,
             amount, customer_vendor_name, gl_account_name, dimension_set_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (company_id, entry_no) DO NOTHING
    """
    rows = [(_int(r.get("entry_no")),
             _int(r.get("company_id")), _acct_no(r.get("account_no")),
             _int(r.get("date_id")), _int(r.get("document_id")),
             _int(r.get("posting_group_id")), _int(r.get("department_id")),
             _int(r.get("counterparty_id")), _int(r.get("currency_id")),
             _float(r.get("amount")), _str(r.get("customer_vendor_name")),
             _str(r.get("gl_account_name")), _int(r.get("dimension_set_id")))
            for _, r in df.iterrows()]
    _bulk(conn, sql, rows, "fact_posted_sales")


def _bulk(conn, sql, rows, table, page_size=500):
    with conn.cursor() as cur:
        execute_batch(cur, sql, rows, page_size=page_size)
    conn.commit()
    log.info("  %-25s → %d rows", table, len(rows))


# ── Sheet → loader mapping ────────────────────────────────────

LOAD_ORDER = [
    ("dim_currency",      load_dim_currency),
    ("dim_company",       load_dim_company),
    ("dim_account",       load_dim_account),
    ("dim_date",          load_dim_date),
    ("dim_document",      load_dim_document),
    ("dim_posting_group", load_dim_posting_group),
    ("dim_department",    load_dim_department),
    ("dim_counterparty",  load_dim_counterparty),
    ("dim_bal_account",   load_dim_bal_account),
    ("dim_project",       load_dim_project),
    ("dim_project_code",  load_dim_project_code),
    ("dim_geo",           load_dim_geo),
    ("dim_customer",      load_dim_customer),
    ("fact_gl_entries",   load_fact_gl_entries),
    ("fact_coa_balances", load_fact_coa_balances),
    ("fact_posted_sales", load_fact_posted_sales),
]


# ── Main ──────────────────────────────────────────────────────

def main():
    if not XLSX_PATH.exists():
        log.error("Source file not found: %s", XLSX_PATH)
        sys.exit(1)

    log.info("Reading %s …", XLSX_PATH.name)
    xl = pd.ExcelFile(XLSX_PATH)
    sheets = {s: xl.parse(s) for s in xl.sheet_names if s != "data_dictionary"}
    log.info("Sheets loaded: %s", list(sheets.keys()))

    log.info("Connecting to PostgreSQL …")
    try:
        conn = get_conn()
    except Exception as exc:
        log.error("DB connection failed: %s", exc)
        sys.exit(1)

    apply_schema(conn)
    truncate_all(conn)

    log.info("Loading tables …")
    for sheet_name, loader in LOAD_ORDER:
        if sheet_name not in sheets:
            log.warning("  Sheet '%s' not found — skipping", sheet_name)
            continue
        try:
            loader(conn, sheets[sheet_name])
        except Exception as exc:
            log.error("  %-25s FAILED: %s", sheet_name, exc)
            conn.rollback()

    conn.close()
    log.info("ETL complete.")


if __name__ == "__main__":
    main()
