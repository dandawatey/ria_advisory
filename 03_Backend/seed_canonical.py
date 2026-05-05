"""
seed_canonical.py — Seed ERP-agnostic canonical data model.

Steps:
  1. Run migration 007_canonical_model.sql
  2. Seed dim_canonical_account with full L1/L2/L3 hierarchy
  3. Populate account_mapping for all rows in dim_account
     - Both tenants: RIA Advisory + iSource

Run from: /Users/yogesh.dandawate/00_MyCode/ria_advisory/03_Backend
"""

import os
import sys
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

TENANT_RIA     = "0bfb1107-b0b5-49fd-821c-b6bea8050dcf"
TENANT_ISOURCE = "4e7b2d7a-0137-449b-8b4a-f4f85d83b7b1"

# ── Canonical hierarchy ────────────────────────────────────────────────────────

CANONICAL_ROWS = [
    # (l1_statement, l2_category, l3_subcategory, display_name, sort_order)
    # P&L — Revenue
    ("P&L", "Revenue", "Advisory Fee Revenue",     "Advisory Fee Revenue",          10),
    ("P&L", "Revenue", "Management Fee Revenue",   "Management Fee Revenue",        11),
    ("P&L", "Revenue", "Consulting Revenue",       "Consulting Revenue",            12),
    ("P&L", "Revenue", "Other Revenue",            "Other Revenue",                 19),
    # P&L — COGS
    ("P&L", "COGS",    "Direct Labour",            "Direct Labour",                 20),
    ("P&L", "COGS",    "Direct Materials",         "Direct Materials",              21),
    ("P&L", "COGS",    "Subcontractors",           "Subcontractors",                22),
    ("P&L", "COGS",    "Other COGS",               "Other COGS",                    29),
    # P&L — OpEx
    ("P&L", "OpEx",    "Compensation & Benefits",  "Compensation & Benefits",       30),
    ("P&L", "OpEx",    "Technology & Software",    "Technology & Software",         31),
    ("P&L", "OpEx",    "Occupancy & Facilities",   "Occupancy & Facilities",        32),
    ("P&L", "OpEx",    "Marketing & Biz Dev",      "Marketing & Business Development", 33),
    ("P&L", "OpEx",    "Travel & Entertainment",   "Travel & Entertainment",        34),
    ("P&L", "OpEx",    "Professional Fees",        "Professional Fees",             35),
    ("P&L", "OpEx",    "General & Administrative", "General & Administrative",      39),
    # P&L — Other Income
    ("P&L", "Other Income", "Interest Income",     "Interest Income",               40),
    ("P&L", "Other Income", "FX Gain",             "Foreign Exchange Gain",         41),
    ("P&L", "Other Income", "Other Income",        "Other Income",                  49),
    # P&L — Other Expense
    ("P&L", "Other Expense", "Interest Expense",   "Interest Expense",              50),
    ("P&L", "Other Expense", "FX Loss",            "Foreign Exchange Loss",         51),
    ("P&L", "Other Expense", "Other Expense",      "Other Expense",                 59),
    # P&L — Income Tax
    ("P&L", "Income Tax", "Current Tax",           "Current Tax Expense",           60),
    ("P&L", "Income Tax", "Deferred Tax",          "Deferred Tax Expense",          61),

    # Balance Sheet — Current Assets
    ("Balance Sheet", "Current Assets",  "Cash & Equivalents",     "Cash & Cash Equivalents",          100),
    ("Balance Sheet", "Current Assets",  "Accounts Receivable",    "Accounts Receivable",              101),
    ("Balance Sheet", "Current Assets",  "Prepaid Expenses",       "Prepaid Expenses & Deposits",      102),
    ("Balance Sheet", "Current Assets",  "Inventory",              "Inventory",                        103),
    ("Balance Sheet", "Current Assets",  "Other Current Assets",   "Other Current Assets",             109),
    # Balance Sheet — Fixed Assets
    ("Balance Sheet", "Fixed Assets",    "Property Plant & Equipment", "Property, Plant & Equipment",  110),
    ("Balance Sheet", "Fixed Assets",    "Intangible Assets",      "Intangible Assets",                111),
    ("Balance Sheet", "Fixed Assets",    "Capital WIP",            "Capital Work in Progress",         112),
    # Balance Sheet — Other Assets
    ("Balance Sheet", "Other Assets",    "Long-term Investments",  "Long-term Investments",            120),
    ("Balance Sheet", "Other Assets",    "Deferred Tax Asset",     "Deferred Tax Asset",               121),
    # Balance Sheet — Current Liabilities
    ("Balance Sheet", "Current Liabilities", "Accounts Payable",   "Accounts Payable",                 200),
    ("Balance Sheet", "Current Liabilities", "Accrued Liabilities","Accrued Liabilities",              201),
    ("Balance Sheet", "Current Liabilities", "Short-term Debt",    "Short-term Borrowings",            202),
    ("Balance Sheet", "Current Liabilities", "Tax Payable",        "Income Tax Payable",               203),
    # Balance Sheet — LT Liabilities
    ("Balance Sheet", "LT Liabilities",  "Long-term Debt",         "Long-term Debt",                   210),
    ("Balance Sheet", "LT Liabilities",  "Deferred Tax Liability", "Deferred Tax Liability",           211),
    # Balance Sheet — Equity
    ("Balance Sheet", "Equity",          "Share Capital",          "Share Capital & Paid-in Capital",  300),
    ("Balance Sheet", "Equity",          "Retained Earnings",      "Retained Earnings",                301),
    ("Balance Sheet", "Equity",          "Other Comprehensive Income", "Other Comprehensive Income",   302),

    # Cash Flow
    ("Cash Flow", "Operating Activities", "Operating CF",  "Net Cash from Operating Activities", 400),
    ("Cash Flow", "Investing Activities", "Investing CF",  "Net Cash from Investing Activities",  410),
    ("Cash Flow", "Financing Activities", "Financing CF",  "Net Cash from Financing Activities",  420),
]

# ── Category → l2 mapping for account_mapping auto-seed ───────────────────────

CATEGORY_TO_L2 = {
    "Revenue":             "Revenue",
    "Income":              "Revenue",
    "COGS":                "COGS",
    "OpEx":                "OpEx",
    "Expense":             "OpEx",
    "Interest":            "Other Expense",
    "Tax":                 "Income Tax",
    "Current Assets":      "Current Assets",
    "Fixed Assets":        "Fixed Assets",
    "Assets":              "Other Assets",
    "Intangibles":         "Fixed Assets",
    "Investments":         "Other Assets",
    "Current Liabilities": "Current Liabilities",
    "LT Liabilities":      "LT Liabilities",
    "Liabilities":         "LT Liabilities",
    "Equity":              "Equity",
    "Cash Flow":           "Operating Activities",
    "FX":                  "Other Income",
}

PREFIX_TO_L2 = {
    "4": "Revenue",
    "5": "COGS",
    "6": "OpEx",
    "7": "Other Income",
    "8": "Income Tax",
    "1": "Current Assets",
    "2": "Current Liabilities",
    "3": "Equity",
}


def get_conn():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", 5432)),
        dbname=os.getenv("PGDATABASE", "ufip"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", ""),
    )


def run_migration(cur):
    print("[1/4] Running migration 007_canonical_model.sql …")
    migration_path = os.path.join(os.path.dirname(__file__), "migrations", "007_canonical_model.sql")
    with open(migration_path) as f:
        sql = f.read()
    cur.execute(sql)
    print("      Migration applied.")


def seed_canonical(cur):
    print("[2/4] Seeding dim_canonical_account …")
    inserted = 0
    for (l1, l2, l3, display, sort) in CANONICAL_ROWS:
        cur.execute(
            """
            INSERT INTO dim_canonical_account
                (l1_statement, l2_category, l3_subcategory, display_name, sort_order)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (l2_category, COALESCE(l3_subcategory, ''))
            DO UPDATE SET
                l1_statement = EXCLUDED.l1_statement,
                display_name = EXCLUDED.display_name,
                sort_order   = EXCLUDED.sort_order
            """,
            (l1, l2, l3, display, sort),
        )
        inserted += 1
    print(f"      {inserted} canonical rows upserted.")


def build_canonical_map(cur) -> dict:
    """Return {l2_category: canonical_id} for the first (lowest sort_order) row per l2."""
    cur.execute(
        """
        SELECT DISTINCT ON (l2_category) l2_category, canonical_id
        FROM dim_canonical_account
        ORDER BY l2_category, sort_order
        """
    )
    return {row["l2_category"]: row["canonical_id"] for row in cur.fetchall()}


def resolve_canonical_id(account_no: str, category: str | None, canonical_map: dict) -> int | None:
    """Map an account row to a canonical_id using category first, then prefix fallback."""
    if account_no == "999999":
        return None

    l2 = None
    if category and category in CATEGORY_TO_L2:
        l2 = CATEGORY_TO_L2[category]
    else:
        prefix = str(account_no)[:1]
        l2 = PREFIX_TO_L2.get(prefix)

    if l2 and l2 in canonical_map:
        return canonical_map[l2]
    return None


def seed_mappings(cur, canonical_map: dict):
    print("[3/4] Loading dim_account rows …")
    cur.execute("SELECT account_no, account_name, account_category FROM dim_account")
    accounts = cur.fetchall()
    print(f"      {len(accounts)} accounts found.")

    print("[4/4] Seeding account_mapping for both tenants …")
    mapped = 0
    unmapped = 0

    for tenant_id in (TENANT_RIA, TENANT_ISOURCE):
        for row in accounts:
            account_no = row["account_no"]
            account_name = row["account_name"]
            category = row["account_category"]

            canonical_id = resolve_canonical_id(account_no, category, canonical_map)
            confidence = 90.0 if (category and category in CATEGORY_TO_L2) else 60.0 if canonical_id else None

            cur.execute(
                """
                INSERT INTO account_mapping
                    (tenant_id, source_erp, source_account, source_name,
                     canonical_id, mapped_by, confidence)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id, source_erp, source_account)
                DO UPDATE SET
                    source_name  = EXCLUDED.source_name,
                    canonical_id = EXCLUDED.canonical_id,
                    confidence   = EXCLUDED.confidence,
                    updated_at   = NOW()
                WHERE account_mapping.mapped_by = 'auto'
                """,
                (
                    tenant_id, "BC", account_no, account_name,
                    canonical_id, "auto", confidence,
                ),
            )
            if canonical_id:
                mapped += 1
            else:
                unmapped += 1

    total = len(accounts) * 2
    print(f"      {total} mapping rows upserted ({mapped} mapped, {unmapped} unmapped).")


def main():
    print("=== seed_canonical.py — ERP-agnostic canonical model ===\n")
    conn = get_conn()
    try:
        conn.autocommit = False
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            run_migration(cur)
            seed_canonical(cur)
            canonical_map = build_canonical_map(cur)
            seed_mappings(cur, canonical_map)
        conn.commit()
        print("\n=== DONE — all changes committed. ===")
    except Exception as exc:
        conn.rollback()
        print(f"\nERROR: {exc}", file=sys.stderr)
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
