"""
ETL: Load all 17 subsidiary GL Excel files → PostgreSQL gl_unified table.

Usage:
    python etl/load_gl.py

Environment variables (or .env file in 03_Backend/):
    PGHOST     localhost
    PGPORT     5432
    PGDATABASE ufip
    PGUSER     postgres
    PGPASSWORD <your password>
"""

import os
import sys
import logging
from pathlib import Path
from typing import Optional

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SAMPLE_DIR = BASE_DIR / "00_InputSample"
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

load_dotenv(ENV_FILE)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# Maps filename → (subsidiary_name, subsidiary_code)
SUBSIDIARY_MAP = {
    "GL_RIA ADVISORY PHILS.xlsx":              ("RIA Advisory Philippines",     "PHILS"),
    "GL_RIA ADVISORY S. DE RL. DE CV..xlsx":   ("RIA Advisory Mexico",          "MXN"),
    "GL_RIA Advisory Aggregator LLC.xlsx":     ("RIA Advisory Aggregator LLC",  "AGG"),
    "GL_RIA Advisory Borrower LLC.xlsx":       ("RIA Advisory Borrower LLC",    "BOR"),
    "GL_RIA Advisory Canada LTD.xlsx":         ("RIA Advisory Canada Ltd",      "CAN"),
    "GL_RIA Advisory Guarantor LLC.xlsx":      ("RIA Advisory Guarantor LLC",   "GUA"),
    "GL_RIA Advisory LLC Pty Ltd.xlsx":        ("RIA Advisory Pty Ltd (AUS)",   "PTY"),
    "GL_RIA Advisory LLC(USA).xlsx":           ("RIA Advisory LLC (USA)",       "USA"),
    "GL_RIA Advisory LLP INDIA.xlsx":          ("RIA Advisory LLP India",       "IND"),
    "GL_RIA_Advisory_Ltd.xlsx":                ("RIA Advisory Ltd (UK)",        "GBP"),
    "GL_Ria Advisory SA (Pty) Ltd.xlsx":       ("RIA Advisory SA (ZAF)",        "ZAF"),
    "GL_SYNERSYS GLOBAL INC.xlsx":             ("Synersys Global Inc",          "SYN"),
    "GL_TMG Bidco Inc.xlsx":                   ("TMG Bidco Inc",                "TBID"),
    "GL_TMG Bidco Sub INC.xlsx":               ("TMG Bidco Sub Inc",            "TSUB"),
    "GL_TMG CONSULTING CANADA,INC.xlsx":       ("TMG Consulting Canada Inc",    "TCAN"),
    "GL_TMG Offshore Synersys Global.xlsx":    ("TMG Offshore Synersys Global", "TOFF"),
    "GL_TMG UTILITY ADVISORY SERVICES.xlsx":   ("TMG Utility Advisory Services","TUAS"),
}

# Normalised column → DB column
# Handles both schema variants (26-col and 29-col files)
COL_MAP = {
    "Posting Date":               "posting_date",
    "Document Type":              "document_type",
    "Document No.":               "document_no",
    "G/L Account No.":            "gl_account_no",
    "G/L Account Name":           "gl_account_name",
    "Description":                "description",
    "Customer Or Vendor Name":    "customer_or_vendor_name",
    "Project No.":                "project_no",
    "Billable/Non Billable":      "billable_non_billable",
    "Department Code":            "department_code",
    "Vertical Code":              "vertical_code",
    "Gen. Posting Type":          "gen_posting_type",
    "Gen. Bus. Posting Group":    "gen_bus_posting_group",
    "Gen. Prod. Posting Group":   "gen_prod_posting_group",
    "Amount ($)":                 "amount",
    "Bal. Account Type":          "bal_account_type",
    "Bal. Account No.":           "bal_account_no",
    "Source Code":                "source_code",
    "Source Type":                "source_type",
    "Source No.":                 "source_no",
    "Entry No.":                  "entry_no",
    "Dimension Set ID":           "dimension_set_id",
    "External Document No.":      "external_document_no",
    "Subscription Contract No.":  "subscription_contract_no",
    "Geo Code":                   "geo_code",
    "Project code Code":          "project_code",
    "Shortcut Dimension 6 Code":  "shortcut_dim_6_code",
    "Shortcut Dimension 7 Code":  "shortcut_dim_7_code",
    "Shortcut Dimension 8 Code":  "shortcut_dim_8_code",
}

DB_COLS = [
    "subsidiary_name", "subsidiary_code",
    "posting_date", "document_type", "document_no",
    "gl_account_no", "gl_account_name", "description", "customer_or_vendor_name",
    "project_no", "billable_non_billable", "department_code", "vertical_code",
    "gen_posting_type", "gen_bus_posting_group", "gen_prod_posting_group",
    "amount", "bal_account_type", "bal_account_no",
    "source_code", "source_type", "source_no",
    "entry_no", "dimension_set_id",
    "external_document_no", "subscription_contract_no",
    "geo_code", "project_code",
    "shortcut_dim_6_code", "shortcut_dim_7_code", "shortcut_dim_8_code",
]

INSERT_SQL = f"""
    INSERT INTO gl_unified ({', '.join(DB_COLS)})
    VALUES ({', '.join(['%s'] * len(DB_COLS))})
"""


def get_connection():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", 5432)),
        dbname=os.getenv("PGDATABASE", "ufip"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", ""),
    )


def clean_str(val) -> Optional[str]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    return s if s else None


def clean_num(val) -> Optional[float]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def clean_int(val) -> Optional[int]:
    v = clean_num(val)
    return int(v) if v is not None else None


def load_file(conn, xlsx_path: Path, subsidiary_name: str, subsidiary_code: str) -> int:
    df = pd.read_excel(xlsx_path, sheet_name="General Ledger Entries", dtype=str)

    # Rename columns using the map (ignore columns not in map)
    df = df.rename(columns={c: COL_MAP[c] for c in df.columns if c in COL_MAP})

    rows = []
    for _, row in df.iterrows():
        def g(col):
            return row.get(col)

        record = (
            subsidiary_name,
            subsidiary_code,
            pd.to_datetime(g("posting_date"), errors="coerce").date() if g("posting_date") else None,
            clean_str(g("document_type")),
            clean_str(g("document_no")),
            clean_str(g("gl_account_no")),
            clean_str(g("gl_account_name")),
            clean_str(g("description")),
            clean_str(g("customer_or_vendor_name")),
            clean_str(g("project_no")),
            clean_str(g("billable_non_billable")),
            clean_str(g("department_code")),
            clean_str(g("vertical_code")),
            clean_str(g("gen_posting_type")),
            clean_str(g("gen_bus_posting_group")),
            clean_str(g("gen_prod_posting_group")),
            clean_num(g("amount")),
            clean_str(g("bal_account_type")),
            clean_str(g("bal_account_no")),
            clean_str(g("source_code")),
            clean_str(g("source_type")),
            clean_str(g("source_no")),
            clean_int(g("entry_no")),
            clean_int(g("dimension_set_id")),
            clean_str(g("external_document_no")),
            clean_str(g("subscription_contract_no")),
            clean_str(g("geo_code")),
            clean_str(g("project_code")),
            clean_str(g("shortcut_dim_6_code")),
            clean_str(g("shortcut_dim_7_code")),
            clean_str(g("shortcut_dim_8_code")),
        )
        rows.append(record)

    with conn.cursor() as cur:
        execute_batch(cur, INSERT_SQL, rows, page_size=500)
    conn.commit()
    return len(rows)


def main():
    log.info("Connecting to PostgreSQL …")
    try:
        conn = get_connection()
    except Exception as exc:
        log.error("DB connection failed: %s", exc)
        sys.exit(1)

    # Apply schema
    schema_path = Path(__file__).resolve().parent.parent / "sql" / "schema.sql"
    with conn.cursor() as cur, open(schema_path) as f:
        cur.execute(f.read())
    conn.commit()
    log.info("Schema applied.")

    # Truncate before reload (idempotent)
    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE gl_unified RESTART IDENTITY;")
    conn.commit()
    log.info("Table truncated, starting load …")

    total = 0
    for fname, (sub_name, sub_code) in SUBSIDIARY_MAP.items():
        path = SAMPLE_DIR / fname
        if not path.exists():
            log.warning("File not found: %s", path)
            continue
        try:
            n = load_file(conn, path, sub_name, sub_code)
            log.info("  %-45s → %d rows", fname, n)
            total += n
        except Exception as exc:
            log.error("  %-45s FAILED: %s", fname, exc)
            conn.rollback()

    conn.close()
    log.info("ETL complete. Total rows loaded: %d", total)


if __name__ == "__main__":
    main()
