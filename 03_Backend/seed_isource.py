"""
seed_isource.py — Seed iSource 3-subsidiary financial data (2022–2024)
Agent: Kiran_Data_008  |  Request: User seed data request 2026-04-30

Creates:
  - dim_date rows for 2022-01-01 → 2024-12-31 (month-end dates)
  - 3 iSource subsidiaries in dim_erp_source + dim_company
  - 36 months × 3 subsidiaries × ~15 GL lines = ~1,620 GL entries
  - Realistic P&L + Balance Sheet accounts

Subsidiaries:
  1. iSource Innovation LLC          (Dubai, AED)       — Technology Services
  2. iSource MENA Consulting FZE     (Abu Dhabi, AED)   — Management Consulting
  3. iSource Digital Solutions Ltd   (London, GBP)      — Digital & Software

Revenue grows ~15% YoY. Expenses ~60% of revenue.
Run: PYTHONPATH=03_Backend python 03_Backend/seed_isource.py
"""
import sys
import os
import uuid
import calendar
import random
from datetime import date, datetime
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))
from database import query

random.seed(42)   # deterministic

# ── Config ──────────────────────────────────────────────────────────────────

TENANT_ID = "11111111-1111-1111-1111-111111111111"  # iSource tenant

SUBSIDIARIES = [
    {
        "name": "iSource Innovation LLC",
        "erp_type": "BC",
        "currency": "AED",
        "city": "Dubai",
        "base_revenue_aed": 400_000,   # monthly base (AED) → ~4.8M/year
        "growth_rate": 0.15,
    },
    {
        "name": "iSource MENA Consulting FZE",
        "erp_type": "BC",
        "currency": "AED",
        "city": "Abu Dhabi",
        "base_revenue_aed": 180_000,   # monthly base (AED) → ~2.2M/year
        "growth_rate": 0.12,
    },
    {
        "name": "iSource Digital Solutions Ltd",
        "erp_type": "ODOO",
        "currency": "GBP",
        "city": "London",
        "base_revenue_aed": 220_000,   # monthly base in GBP equivalent
        "growth_rate": 0.18,
    },
]

# GL account definitions (account_no → category mapping)
# Using real account_nos from dim_account where available
GL_ACCOUNTS = {
    # P&L Revenue
    "401100": {"name": "Service Revenue",        "type": "revenue",     "sign": -1},
    "401200": {"name": "Project Revenue",         "type": "revenue",     "sign": -1},
    "401300": {"name": "Maintenance Revenue",     "type": "revenue",     "sign": -1},
    # P&L COGS
    "501100": {"name": "Advertising & Marketing", "type": "cogs",        "sign": 1},
    "502100": {"name": "Direct Labour Costs",     "type": "cogs",        "sign": 1},
    # P&L OpEx
    "601100": {"name": "Staff Salaries",          "type": "opex",        "sign": 1},
    "601200": {"name": "Rent & Facilities",       "type": "opex",        "sign": 1},
    "601300": {"name": "IT & Software",           "type": "opex",        "sign": 1},
    "601400": {"name": "Professional Fees",       "type": "opex",        "sign": 1},
    "601500": {"name": "Travel & Entertainment",  "type": "opex",        "sign": 1},
    # Balance Sheet
    "101001": {"name": "Fixed Assets",            "type": "bs_asset",    "sign": 1},
    "101651": {"name": "Unbilled Revenue",        "type": "bs_asset",    "sign": 1},
    "201100": {"name": "Accounts Payable",        "type": "bs_liab",     "sign": -1},
    "301100": {"name": "Retained Earnings",       "type": "bs_equity",   "sign": -1},
}

# Ensure these accounts exist in dim_account
ACCOUNT_INSERT = """
    INSERT INTO dim_account (account_no, account_name)
    VALUES (%s, %s)
    ON CONFLICT (account_no) DO NOTHING
"""

DATE_INSERT = """
    INSERT INTO dim_date (date_id, full_date, year, quarter, quarter_name,
                          month, month_name, week, day, day_name, is_month_end,
                          fiscal_year, fiscal_quarter, fiscal_period)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (date_id) DO NOTHING
"""

COMPANY_INSERT = """
    INSERT INTO dim_company (company_id, company_name, currency_id)
    VALUES (%s, %s, 1)
    ON CONFLICT DO NOTHING
"""

ERP_SOURCE_INSERT = """
    INSERT INTO dim_erp_source (
        tenant_id, erp_type, display_name, connection_status, entity_id, config_json
    ) VALUES (%s, %s, %s, 'connected', %s, %s)
    RETURNING erp_source_id
"""

GL_INSERT = """
    INSERT INTO fact_gl_entries (
        entry_no, company_id, account_no, date_id, document_id, posting_group_id,
        department_id, counterparty_id, bal_account_id, currency_id,
        amount, document_no, description,
        erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number,
        transaction_currency, transaction_amount_dr, transaction_amount_cr,
        functional_currency, functional_amount_dr, functional_amount_cr,
        is_final
    ) VALUES (
        %s, %s, %s, %s, 1, 1,
        1, 1, 1, 1,
        %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s, %s,
        'AED', %s, %s,
        TRUE
    )
"""


# ── Helper functions ─────────────────────────────────────────────────────────

def month_end(year: int, month: int) -> date:
    last = calendar.monthrange(year, month)[1]
    return date(year, month, last)


def quarter_name(month: int) -> str:
    return f"Q{(month - 1) // 3 + 1}"


def weekday_name(d: date) -> str:
    return d.strftime("%A")


def get_or_create_date_id(d: date) -> int:
    """Return date_id for a given date, inserting if missing."""
    rows = query("SELECT date_id FROM dim_date WHERE full_date = %s", (d,))
    if rows:
        return rows[0]["date_id"]
    # Get next date_id
    max_rows = query("SELECT COALESCE(MAX(date_id), 0) + 1 AS next_id FROM dim_date")
    next_id = max_rows[0]["next_id"]
    iso_week = d.isocalendar()[1]
    fy = d.year if d.month >= 4 else d.year - 1  # Apr FY
    fq_num = ((d.month - 4) % 12) // 3 + 1
    query(
        DATE_INSERT,
        (
            next_id, d, d.year, (d.month - 1) // 3 + 1,
            quarter_name(d.month),
            d.month, d.strftime("%B"),
            iso_week, d.day, weekday_name(d),
            1,  # is_month_end = True (we only insert month-ends)
            fy, fq_num, f"FY{fy}-Q{fq_num}",
        )
    )
    return next_id


def revenue_for_month(base: float, year: int, month: int, growth: float) -> float:
    """Monthly revenue with growth and seasonal variation."""
    years_since_2022 = year - 2022
    annual_factor = (1 + growth) ** years_since_2022
    # Seasonal: Q1 slower, Q4 stronger
    seasonal = {1: 0.85, 2: 0.90, 3: 0.95, 4: 1.00,
                5: 1.05, 6: 1.00, 7: 0.95, 8: 0.85,
                9: 1.00, 10: 1.05, 11: 1.10, 12: 1.15}[month]
    noise = random.uniform(0.95, 1.05)
    return round(base * annual_factor * seasonal * noise, 2)


# ── Main seed function ────────────────────────────────────────────────────────

def seed():
    print("=" * 60)
    print("iSource Seed — 3 subsidiaries × 3 years (2022–2024)")
    print("=" * 60)

    # 1. Ensure GL accounts exist
    print("\n[1/5] Ensuring GL accounts in dim_account...")
    for acct_no, meta in GL_ACCOUNTS.items():
        query(ACCOUNT_INSERT, (acct_no, meta["name"]))
    print(f"  {len(GL_ACCOUNTS)} accounts ensured")

    # 2. Generate dim_date for 2022-2024 month ends
    print("\n[2/5] Populating dim_date (2022-01-01 → 2024-12-31 month ends)...")
    date_ids = {}
    for year in range(2022, 2025):
        for month in range(1, 13):
            d = month_end(year, month)
            date_ids[(year, month)] = get_or_create_date_id(d)
    print(f"  {len(date_ids)} month-end date entries ensured")

    # 3. Create iSource ERP sources and companies
    print("\n[3/5] Creating iSource ERP sources and companies...")
    # Find max existing company_id to avoid collision
    max_cid_rows = query("SELECT COALESCE(MAX(company_id), 100) + 1 AS next_id FROM dim_company")
    next_company_id = max_cid_rows[0]["next_id"]

    erp_sources = []
    for sub in SUBSIDIARIES:
        # Create/get company
        company_rows = query(
            "SELECT company_id FROM dim_company WHERE company_name = %s", (sub["name"],)
        )
        if company_rows:
            company_id = company_rows[0]["company_id"]
        else:
            company_id = next_company_id
            query(COMPANY_INSERT, (company_id, sub["name"]))
            next_company_id += 1

        entity_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, sub["name"]))
        erp_res = query(
            ERP_SOURCE_INSERT,
            (
                TENANT_ID, sub["erp_type"], sub["name"], entity_id,
                f'{{"city": "{sub["city"]}", "currency": "{sub["currency"]}"}}'
            )
        )
        if erp_res:
            erp_source_id = erp_res[0]["erp_source_id"]
        else:
            row = query(
                "SELECT erp_source_id FROM dim_erp_source WHERE display_name = %s AND tenant_id = %s",
                (sub["name"], TENANT_ID)
            )
            erp_source_id = row[0]["erp_source_id"]

        erp_sources.append({**sub, "erp_source_id": erp_source_id, "company_id": company_id, "entity_id": entity_id})
        print(f"  ERP source {erp_source_id}: {sub['name']} (company_id={company_id})")

    # 4. Generate GL entries
    print("\n[4/5] Generating GL journal entries (2022–2024)...")
    # Get starting entry_no (after existing max)
    max_eno = query("SELECT COALESCE(MAX(entry_no), 0) + 1 AS next_id FROM fact_gl_entries")
    entry_no_counter = [max_eno[0]["next_id"]]

    def next_entry_no():
        n = entry_no_counter[0]
        entry_no_counter[0] += 1
        return n

    total_entries = 0

    for sub_data in erp_sources:
        eid = sub_data["erp_source_id"]
        cid = sub_data["company_id"]
        entity_id = sub_data["entity_id"]
        base = sub_data["base_revenue_aed"]
        growth = sub_data["growth_rate"]
        currency = sub_data["currency"]
        sub_name = sub_data["name"]

        journal_seq = 1

        for year in range(2022, 2025):
            for month in range(1, 13):
                date_id = date_ids[(year, month)]
                month_rev = revenue_for_month(base, year, month, growth)
                journal_no = f"IS-{eid}-{year}{month:02d}"

                # ── Revenue lines ────────────────────────────────────────────
                rev_split = [0.60, 0.30, 0.10]
                rev_accounts = ["401100", "401200", "401300"]
                line = 1
                for rev_acct, rev_pct in zip(rev_accounts, rev_split):
                    rev_amt = round(month_rev * rev_pct, 2)
                    query(GL_INSERT, (
                        next_entry_no(), cid, rev_acct, date_id,
                        -rev_amt,  # credit = negative in amount column
                        journal_no,
                        f"{sub_name} revenue {date(year, month, 1).strftime('%b %Y')}",
                        eid, entity_id, journal_no, str(line),
                        currency, 0.0, rev_amt,
                        0.0, rev_amt,
                    ))
                    line += 1
                    total_entries += 1

                # ── COGS (~35% of revenue) ───────────────────────────────────
                cogs_total = round(month_rev * 0.35, 2)
                cogs_accounts = [("501100", 0.4), ("502100", 0.6)]
                for cogs_acct, cogs_pct in cogs_accounts:
                    cogs_amt = round(cogs_total * cogs_pct, 2)
                    query(GL_INSERT, (
                        next_entry_no(), cid, cogs_acct, date_id,
                        cogs_amt,
                        journal_no,
                        f"{sub_name} COGS {date(year, month, 1).strftime('%b %Y')}",
                        eid, entity_id, journal_no, str(line),
                        currency, cogs_amt, 0.0,
                        cogs_amt, 0.0,
                    ))
                    line += 1
                    total_entries += 1

                # ── OpEx (~30% of revenue) ───────────────────────────────────
                opex_total = round(month_rev * 0.30, 2)
                opex_accounts = [
                    ("601100", 0.50),  # Salaries — biggest
                    ("601200", 0.15),  # Rent
                    ("601300", 0.15),  # IT & Software
                    ("601400", 0.10),  # Professional Fees
                    ("601500", 0.10),  # Travel
                ]
                for opex_acct, opex_pct in opex_accounts:
                    opex_amt = round(opex_total * opex_pct, 2)
                    query(GL_INSERT, (
                        next_entry_no(), cid, opex_acct, date_id,
                        opex_amt,
                        journal_no,
                        f"{sub_name} OpEx {date(year, month, 1).strftime('%b %Y')}",
                        eid, entity_id, journal_no, str(line),
                        currency, opex_amt, 0.0,
                        opex_amt, 0.0,
                    ))
                    line += 1
                    total_entries += 1

                # ── Balance Sheet: AR (unbilled, ~15% of revenue) ────────────
                ar_amt = round(month_rev * 0.15, 2)
                query(GL_INSERT, (
                    next_entry_no(), cid, "101651", date_id,
                    ar_amt,
                    journal_no,
                    f"{sub_name} Unbilled AR {date(year, month, 1).strftime('%b %Y')}",
                    eid, entity_id, journal_no, str(line),
                    currency, ar_amt, 0.0,
                    ar_amt, 0.0,
                ))
                line += 1
                total_entries += 1

                journal_seq += 1

        sub_total_per_sub = total_entries
        print(f"  {sub_name}: entries generated up to now = {total_entries}")

    print(f"\n  Total GL entries inserted: {total_entries}")

    # 5. Register sync log entry
    print("\n[5/5] Logging seed sync in fact_sync_log...")
    per_sub = total_entries // len(erp_sources)
    for sub_data in erp_sources:
        query("""
            INSERT INTO fact_sync_log (
                erp_source_id, triggered_by, status,
                sync_type, started_at, completed_at, records_fetched,
                records_inserted, records_updated
            ) VALUES (%s, 'seed_script', 'completed',
                      'full', NOW() - INTERVAL '10 minutes', NOW(),
                      %s, %s, 0)
        """, (sub_data["erp_source_id"], per_sub, per_sub))
    print("  Sync log entries created")

    print("\n" + "=" * 60)
    print(f"SEED COMPLETE")
    print(f"  Subsidiaries : {len(erp_sources)}")
    print(f"  Period       : 2022-01-01 → 2024-12-31 (36 months)")
    print(f"  GL entries   : {total_entries}")
    print("=" * 60)


if __name__ == "__main__":
    seed()
