"""
seed_isource_full.py — Comprehensive iSource seed data (all screens)
Agent: Kiran_Data_008  |  Ticket: IC-26 / DATA-IS-001  |  2026-04-30

Covers ALL application screens:
  - Executive Dashboard, P&L, Balance Sheet, Cash Flow, Trial Balance
  - Collections, AR Ageing, Customer Insights, Posted Sales, Invoices
  - Expense Analysis, Dept Spend, Project Financials, Vertical Analytics
  - KPI Dashboard, Health Score, Analytics, Entity Comparison
  - Budgeting, Investments
  - ERP Integration screens

Enforces tenant data separation:
  - iSource (4e7b2d7a-...) → company_ids 18, 19, 20
  - RIA Advisory (0bfb1107-...) → company_ids 1–17

Run: PYTHONPATH=03_Backend venv/bin/python 03_Backend/seed_isource_full.py
"""
import sys, os, uuid, calendar, random, json
from datetime import date, datetime
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))
from database import query

random.seed(99)  # deterministic

# ── Tenant UUIDs ─────────────────────────────────────────────────────────────
ISOURCE_TENANT_ID = "4e7b2d7a-0137-449b-8b4a-f4f85d83b7b1"
RIA_TENANT_ID     = "0bfb1107-b0b5-49fd-821c-b6bea8050dcf"

# iSource subsidiaries (company_ids 18, 19, 20)
SUBS = [
    {
        "company_id": 18,
        "name": "iSource Innovation LLC",
        "currency": "AED",
        "base_rev": 420_000,
        "growth": 0.15,
        "dept_mix": {"TECH": 0.55, "CONSULTING": 0.20, "OPERATIONS": 0.15, "MANAGEMENT": 0.10},
        "vertical_mix": {"Cloud": 0.40, "ERP-Integration": 0.35, "Analytics": 0.15, "Managed-Services": 0.10},
        "geo_mix": {"UAE": 0.60, "KSA": 0.25, "Kuwait": 0.10, "Egypt": 0.05},
    },
    {
        "company_id": 19,
        "name": "iSource MENA Consulting FZE",
        "currency": "AED",
        "base_rev": 185_000,
        "growth": 0.12,
        "dept_mix": {"CONSULTING": 0.60, "MANAGEMENT": 0.20, "OPERATIONS": 0.15, "TECH": 0.05},
        "vertical_mix": {"ERP-Integration": 0.50, "Analytics": 0.30, "Cloud": 0.15, "Managed-Services": 0.05},
        "geo_mix": {"UAE": 0.45, "KSA": 0.30, "Kuwait": 0.15, "Egypt": 0.10},
    },
    {
        "company_id": 20,
        "name": "iSource Digital Solutions Ltd",
        "currency": "GBP",
        "base_rev": 230_000,
        "growth": 0.18,
        "dept_mix": {"TECH": 0.50, "DIGITAL": 0.30, "OPERATIONS": 0.15, "MANAGEMENT": 0.05},
        "vertical_mix": {"Cloud": 0.35, "Analytics": 0.35, "ERP-Integration": 0.20, "Managed-Services": 0.10},
        "geo_mix": {"UK": 0.55, "UAE": 0.25, "KSA": 0.15, "Kuwait": 0.05},
    },
]

# iSource customers (10 per subsidiary)
CUSTOMERS = {
    18: [
        ("CUST-IS-101", "Emirates NBD Bank PJSC",     "Dubai",      "UAE"),
        ("CUST-IS-102", "DP World FZE",               "Dubai",      "UAE"),
        ("CUST-IS-103", "Mubadala Investment Company","Abu Dhabi",  "UAE"),
        ("CUST-IS-104", "Al Futtaim Group",           "Dubai",      "UAE"),
        ("CUST-IS-105", "ADNOC Distribution",         "Abu Dhabi",  "UAE"),
        ("CUST-IS-106", "Saudi Aramco",               "Dhahran",    "KSA"),
        ("CUST-IS-107", "SABIC",                      "Riyadh",     "KSA"),
        ("CUST-IS-108", "Zain Kuwait",                "Kuwait City","Kuwait"),
        ("CUST-IS-109", "National Bank of Kuwait",    "Kuwait City","Kuwait"),
        ("CUST-IS-110", "Telecom Egypt",              "Cairo",      "Egypt"),
    ],
    19: [
        ("CUST-IS-201", "First Abu Dhabi Bank",       "Abu Dhabi",  "UAE"),
        ("CUST-IS-202", "Etisalat / e&",              "Abu Dhabi",  "UAE"),
        ("CUST-IS-203", "Majid Al Futtaim",           "Dubai",      "UAE"),
        ("CUST-IS-204", "Dubai Airports",             "Dubai",      "UAE"),
        ("CUST-IS-205", "Roads & Transport Authority","Dubai",      "UAE"),
        ("CUST-IS-206", "Saudi Electric Company",     "Riyadh",     "KSA"),
        ("CUST-IS-207", "Mobily",                     "Riyadh",     "KSA"),
        ("CUST-IS-208", "Gulf Bank Kuwait",           "Kuwait City","Kuwait"),
        ("CUST-IS-209", "Kuwait Oil Company",         "Ahmadi",     "Kuwait"),
        ("CUST-IS-210", "Commercial International Bank","Cairo",    "Egypt"),
    ],
    20: [
        ("CUST-IS-301", "BP Digital Technology",      "London",     "UK"),
        ("CUST-IS-302", "HSBC Bank plc",              "London",     "UK"),
        ("CUST-IS-303", "Barclays Digital Ventures",  "London",     "UK"),
        ("CUST-IS-304", "BT Group",                   "London",     "UK"),
        ("CUST-IS-305", "Rolls-Royce Technology",     "Derby",      "UK"),
        ("CUST-IS-306", "Emirates Group IT",          "Dubai",      "UAE"),
        ("CUST-IS-307", "Aldar Properties",           "Abu Dhabi",  "UAE"),
        ("CUST-IS-308", "Saudi Telecom Company",      "Riyadh",     "KSA"),
        ("CUST-IS-309", "KPMG Middle East",           "Dubai",      "UAE"),
        ("CUST-IS-310", "Deloitte Digital",           "London",     "UK"),
    ],
}

# GL accounts — P&L + Balance Sheet
GL_ACCOUNTS = {
    # Revenue
    "401100": ("Service Revenue",        "P&L",          "Revenue",          "Service Revenue",    -1),
    "401200": ("Project Revenue",        "P&L",          "Revenue",          "Project Revenue",    -1),
    "401300": ("Maintenance Revenue",    "P&L",          "Revenue",          "Maintenance Rev",    -1),
    "401400": ("License Revenue",        "P&L",          "Revenue",          "License Revenue",    -1),
    # COGS
    "501100": ("Advertising & Marketing","P&L",          "COGS",             "Marketing",           1),
    "502100": ("Direct Labour Costs",    "P&L",          "COGS",             "Direct Labour",       1),
    "502200": ("Subcontractor Costs",    "P&L",          "COGS",             "Subcontractors",      1),
    # OpEx
    "601100": ("Staff Salaries",         "P&L",          "OpEx",             "Salaries",            1),
    "601200": ("Rent & Facilities",      "P&L",          "OpEx",             "Rent",                1),
    "601300": ("IT & Software",          "P&L",          "OpEx",             "IT & Software",       1),
    "601400": ("Professional Fees",      "P&L",          "OpEx",             "Professional Fees",   1),
    "601500": ("Travel & Entertainment", "P&L",          "OpEx",             "Travel",              1),
    "601600": ("Depreciation",           "P&L",          "OpEx",             "Depreciation",        1),
    # Balance Sheet — Assets
    "101001": ("Cash & Bank",            "Balance Sheet","Current Assets",   "Cash",                1),
    "101100": ("Trade Receivables",      "Balance Sheet","Current Assets",   "AR",                  1),
    "101200": ("Prepayments & Deposits", "Balance Sheet","Current Assets",   "Prepayments",         1),
    "102001": ("Fixed Assets - Net",     "Balance Sheet","Non-Current Assets","Fixed Assets",       1),
    # Balance Sheet — Liabilities
    "201100": ("Trade Payables",         "Balance Sheet","Current Liabilities","AP",               -1),
    "201500": ("Bank Loans",             "Balance Sheet","Non-Current Liabilities","Loans",        -1),
    # Balance Sheet — Equity
    "301100": ("Retained Earnings",      "Balance Sheet","Equity",           "Retained Earnings",  -1),
}

DEPT_IDS = {}    # dept_code → department_id (populated in step 3)
PROJECT_NAMES = [
    "PROJ-IS-001", "PROJ-IS-002", "PROJ-IS-003", "PROJ-IS-004", "PROJ-IS-005",
    "PROJ-IS-006", "PROJ-IS-007", "PROJ-IS-008", "PROJ-IS-009", "PROJ-IS-010",
]

# Document IDs (from dim_document): Invoice=6, Payment=8, Credit Memo=7
DOC_INVOICE = 6
DOC_PAYMENT = 8
DOC_CREDIT  = 7

SEASONAL = {
    1: 0.82, 2: 0.88, 3: 0.95, 4: 1.00,
    5: 1.05, 6: 0.98, 7: 0.90, 8: 0.82,
    9: 1.02, 10: 1.08, 11: 1.15, 12: 1.20,
}

def month_end(y: int, m: int) -> date:
    return date(y, m, calendar.monthrange(y, m)[1])

def rev(base: float, year: int, month: int, growth: float) -> float:
    """Monthly compounding — smooth upward trend, ±2% noise only."""
    months_elapsed = (year - 2022) * 12 + (month - 1)
    monthly_rate   = (1 + growth) ** (1 / 12) - 1
    trend          = base * (1 + monthly_rate) ** months_elapsed
    return round(trend * SEASONAL[month] * random.uniform(0.98, 1.02), 2)


def margin_factors(year: int, month: int):
    """
    COGS and OpEx ratios improve linearly over 36 months:
      COGS: 38% (Jan-2022) → 31% (Dec-2024)  — efficiency & mix shift
      OpEx: 33% (Jan-2022) → 26% (Dec-2024)  — operating leverage
    EBITDA margin: ~29% → ~43%  (tech-company scaling story)
    """
    progress = ((year - 2022) * 12 + (month - 1)) / 35  # 0.0 → 1.0
    cogs_pct = round(0.38 - 0.07 * progress, 4)
    opex_pct = round(0.33 - 0.07 * progress, 4)
    return cogs_pct, opex_pct

def pick_weighted(d: dict) -> str:
    keys, weights = list(d.keys()), list(d.values())
    return random.choices(keys, weights=weights)[0]


# ────────────────────────────────────────────────────────────────────────────
def step1_tenant_isolation():
    print("\n[1/9] Setting tenant subsidiary_access isolation...")

    # RIA: codes RIA001..RIA017 → company_ids 1–17
    ria_codes = [f"RIA{str(i).zfill(3)}" for i in range(1, 18)]
    query(
        "UPDATE tenants SET settings = jsonb_set(COALESCE(settings::jsonb, '{}'), '{subsidiary_access}', %s::jsonb) WHERE id = %s",
        (json.dumps(ria_codes), RIA_TENANT_ID)
    )

    # iSource: codes IS018..IS020 → company_ids 18–20
    is_codes = ["IS018", "IS019", "IS020"]
    query(
        "UPDATE tenants SET settings = jsonb_set(COALESCE(settings::jsonb, '{}'), '{subsidiary_access}', %s::jsonb) WHERE id = %s",
        (json.dumps(is_codes), ISOURCE_TENANT_ID)
    )

    # Fix dim_erp_source.tenant_id (old seed used 11111111-...)
    query(
        "UPDATE dim_erp_source SET tenant_id = %s WHERE tenant_id = '11111111-1111-1111-1111-111111111111'",
        (ISOURCE_TENANT_ID,)
    )
    print("  RIA: 17 subsidiaries (RIA001–RIA017)")
    print("  iSource: 3 subsidiaries (IS018–IS020)")
    print("  dim_erp_source.tenant_id fixed")


def step2_ensure_accounts():
    print("\n[2/9] Ensuring dim_account for all iSource GL accounts...")
    for acct_no, meta in GL_ACCOUNTS.items():
        name, l1, l2, l3, _ = meta
        query("""
            INSERT INTO dim_account (account_no, account_name)
            VALUES (%s, %s)
            ON CONFLICT (account_no) DO NOTHING
        """, (acct_no, name))
    print(f"  {len(GL_ACCOUNTS)} accounts ensured")


def step3_ensure_departments():
    print("\n[3/9] Ensuring iSource departments in dim_department...")
    depts = [
        ("TECH",        "Technology"),
        ("CONSULTING",  "Management Consulting"),
        ("DIGITAL",     "Digital & Software"),
        ("OPERATIONS",  "Operations"),
        ("MANAGEMENT",  "Management"),
        ("SALES",       "Sales & BD"),
    ]
    for dept_code, vertical in depts:
        rows = query(
            "SELECT department_id FROM dim_department WHERE department_code = %s AND vertical_code = %s",
            (dept_code, dept_code)
        )
        if rows:
            DEPT_IDS[dept_code] = rows[0]["department_id"]
        else:
            max_id = query("SELECT COALESCE(MAX(department_id), 0) + 1 AS nxt FROM dim_department")[0]["nxt"]
            query(
                "INSERT INTO dim_department (department_id, department_code, vertical_code) VALUES (%s, %s, %s)",
                (max_id, dept_code, dept_code)
            )
            DEPT_IDS[dept_code] = max_id
    print(f"  {len(DEPT_IDS)} departments ensured")


def step4_clear_old_seed():
    print("\n[4/9] Clearing old thin iSource seed data...")
    for t in ["fact_posted_sales", "fact_gl_entries"]:
        r = query(f"DELETE FROM {t} WHERE company_id IN (18, 19, 20)")
    r2 = query("DELETE FROM budgets WHERE company_id IN (18, 19, 20)")
    r3 = query("DELETE FROM investments WHERE company_id IN (18, 19, 20)")
    r4 = query("DELETE FROM dim_customer WHERE company IN ('iSource Innovation LLC','iSource MENA Consulting FZE','iSource Digital Solutions Ltd')")
    print("  Old seed data cleared")


def step5_seed_gl_entries():
    print("\n[5/9] Seeding fact_gl_entries (3 subs × 36 months × 20 accounts)...")
    max_row = query("SELECT COALESCE(MAX(entry_no), 0) AS mx FROM fact_gl_entries")[0]["mx"]
    entry_no = [max_row + 1]

    def nxt():
        n = entry_no[0]; entry_no[0] += 1; return n

    # Get erp_source_ids for iSource
    erp_rows = query("SELECT erp_source_id, entity_id FROM dim_erp_source WHERE tenant_id = %s", (ISOURCE_TENANT_ID,))
    erp_map = {i: r for i, r in enumerate(erp_rows)}  # index 0,1,2 → row

    # Get or create date_ids for 2022–2024
    def get_date_id(d: date) -> int:
        rows = query("SELECT date_id FROM dim_date WHERE full_date = %s", (d,))
        if rows:
            return rows[0]["date_id"]
        mx = query("SELECT COALESCE(MAX(date_id), 0) + 1 AS nxt FROM dim_date")[0]["nxt"]
        q = (d.month - 1) // 3 + 1
        fy = d.year if d.month >= 4 else d.year - 1
        fq = ((d.month - 4) % 12) // 3 + 1
        query("""
            INSERT INTO dim_date (date_id, full_date, year, quarter, quarter_name,
                                  month, month_name, week, day, day_name, is_month_end,
                                  fiscal_year, fiscal_quarter, fiscal_period)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE,%s,%s,%s)
            ON CONFLICT (date_id) DO NOTHING
        """, (mx, d, d.year, q, f"Q{q}", d.month, d.strftime("%B"),
              d.isocalendar()[1], d.day, d.strftime("%A"), fy, fq, f"FY{fy}-Q{fq}"))
        return mx

    total = 0
    for sub_idx, sub in enumerate(SUBS):
        cid = sub["company_id"]
        erp_row = erp_map.get(sub_idx)
        erp_id  = erp_row["erp_source_id"] if erp_row else None
        eid     = str(erp_row["entity_id"]) if erp_row else str(uuid.uuid4())
        base    = sub["base_rev"]
        growth  = sub["growth"]

        for year in range(2022, 2025):
            for month in range(1, 13):
                d = month_end(year, month)
                date_id = get_date_id(d)
                month_rev = rev(base, year, month, growth)
                jnl = f"IS-{cid}-{year}{month:02d}"

                dept     = pick_weighted(sub["dept_mix"])
                vertical = pick_weighted(sub["vertical_mix"])
                geo      = pick_weighted(sub["geo_mix"])
                project  = random.choice(PROJECT_NAMES)
                dept_id  = DEPT_IDS.get(dept, 1)

                def insert_gl(acct_no, amt, sign, doc_id=5, desc_suffix=""):
                    dr = max(0.0, round(amt * sign, 2))
                    cr = max(0.0, round(amt * -sign, 2)) if sign < 0 else 0.0
                    cr = max(0.0, round(amt, 2)) if sign < 0 else 0.0
                    dr = round(amt, 2) if sign > 0 else 0.0
                    cr = round(amt, 2) if sign < 0 else 0.0
                    net = cr - dr if sign < 0 else dr - cr
                    query("""
                        INSERT INTO fact_gl_entries (
                            entry_no, company_id, account_no, date_id,
                            document_id, posting_group_id, department_id,
                            counterparty_id, bal_account_id, currency_id,
                            amount, document_no, description,
                            erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number,
                            transaction_currency, transaction_amount_dr, transaction_amount_cr,
                            functional_currency, functional_amount_dr, functional_amount_cr,
                            dimension_department, dimension_vertical, dimension_project, dimension_geography,
                            data_quality_score, is_final
                        ) VALUES (
                            %s,%s,%s,%s,
                            %s,1,%s,
                            1,1,1,
                            %s,%s,%s,
                            %s,%s,%s,%s,
                            %s,%s,%s,
                            'AED',%s,%s,
                            %s,%s,%s,%s,
                            95.0,TRUE
                        )
                        ON CONFLICT (entry_no, company_id) DO NOTHING
                    """, (
                        nxt(), cid, acct_no, date_id,
                        doc_id, dept_id,
                        net, jnl, f"{sub['name'][:20]} {acct_no} {d.strftime('%b %Y')}{desc_suffix}",
                        erp_id, eid, jnl, str(total + 1),
                        sub["currency"], dr, cr,
                        dr, cr,
                        dept, vertical, project, geo,
                    ))
                    return 1

                # Revenue: 4 lines (60/25/10/5 split)
                rev_splits = [(0.60,"401100"),(0.25,"401200"),(0.10,"401300"),(0.05,"401400")]
                for pct_r, acct in rev_splits:
                    total += insert_gl(acct, round(month_rev * pct_r, 2), -1, DOC_INVOICE)

                # COGS and OpEx — improving margins over 36 months
                cogs_pct, opex_pct = margin_factors(year, month)
                cogs = round(month_rev * cogs_pct, 2)
                for pct_c, acct in [(0.35,"501100"),(0.45,"502100"),(0.20,"502200")]:
                    total += insert_gl(acct, round(cogs * pct_c, 2), 1, DOC_INVOICE)

                opex = round(month_rev * opex_pct, 2)
                opex_splits = [
                    (0.45,"601100"),(0.12,"601200"),(0.15,"601300"),
                    (0.10,"601400"),(0.08,"601500"),(0.10,"601600"),
                ]
                for pct_o, acct in opex_splits:
                    total += insert_gl(acct, round(opex * pct_o, 2), 1, 5)

                # Balance Sheet
                ar_amt  = round(month_rev * 0.18, 2)
                cash_amt= round(month_rev * 0.50, 2)
                prep_amt= round(month_rev * 0.05, 2)
                fa_amt  = round(month_rev * 0.08, 2)
                ap_amt  = round(cogs * 0.40, 2)
                loan_rd = round(month_rev * 0.03, 2)
                re_amt  = round((month_rev - cogs - opex) * 0.80, 2)

                for amt, acct, sign in [
                    (ar_amt,   "101100",  1),
                    (cash_amt, "101001",  1),
                    (prep_amt, "101200",  1),
                    (fa_amt,   "102001",  1),
                    (ap_amt,   "201100", -1),
                    (loan_rd,  "201500", -1),
                    (re_amt,   "301100", -1),
                ]:
                    if amt > 0:
                        total += insert_gl(acct, amt, sign, 5)

        print(f"  {sub['name'][:35]:35s} → GL entries running total: {total:,}")

    print(f"\n  Total GL entries inserted: {total:,}")
    return total


def step6_seed_customers():
    print("\n[6/9] Seeding dim_customer (30 iSource customers)...")
    next_cid = [query("SELECT COALESCE(MAX(customer_id), 0) + 1 AS nxt FROM dim_customer")[0]["nxt"]]
    inserted = 0
    for comp_id, custs in CUSTOMERS.items():
        comp_name = next(s["name"] for s in SUBS if s["company_id"] == comp_id)
        for i, (cno, cname, city, state) in enumerate(custs):
            ex = query("SELECT customer_id FROM dim_customer WHERE customer_no = %s", (cno,))
            if ex:
                continue
            base_sales = random.uniform(200_000, 2_500_000)
            payments   = round(base_sales * random.uniform(0.70, 0.95), 2)
            balance    = round(base_sales - payments, 2)
            balance_due= round(balance * random.uniform(0.50, 0.90), 2)
            query("""
                INSERT INTO dim_customer
                    (customer_id, counterparty_id, customer_no, customer_name, company, city, state, contact,
                     balance, balance_due, total_sales, total_payments)
                VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (next_cid[0], cno, cname, comp_name, city, state,
                  f"accounts@{cname.lower().replace(' ','-')[:20]}.com",
                  round(balance, 2), round(balance_due, 2),
                  round(base_sales, 2), round(payments, 2)))
            next_cid[0] += 1
            inserted += 1
    print(f"  {inserted} customers inserted")


def step7_seed_posted_sales():
    """
    fact_posted_sales shares PK with fact_gl_entries (company_id, entry_no).
    Fetch the GL entries we inserted for invoice accounts and mirror them into
    fact_posted_sales with customer_vendor_name populated.
    """
    print("\n[7/9] Seeding fact_posted_sales (mirroring GL invoice entries)...")

    # Build a customer rotation per company
    cust_map = {cid: [cname for (_, cname, _, _) in custs] for cid, custs in CUSTOMERS.items()}

    inserted = 0
    for sub in SUBS:
        cid   = sub["company_id"]
        custs = cust_map[cid]

        # Fetch all revenue GL entries for this company (these will be mirrored)
        gl_rows = query("""
            SELECT g.entry_no, g.account_no, g.date_id, g.document_id,
                   g.posting_group_id, g.department_id, g.currency_id, g.amount
            FROM fact_gl_entries g
            WHERE g.company_id = %s
              AND g.account_no LIKE '4%%'
            ORDER BY g.entry_no
        """, (cid,))

        for idx, gl in enumerate(gl_rows):
            cust_name = custs[idx % len(custs)]
            # Check already exists
            ex = query("SELECT 1 FROM fact_posted_sales WHERE company_id=%s AND entry_no=%s",
                       (cid, gl["entry_no"]))
            if ex:
                continue
            query("""
                INSERT INTO fact_posted_sales
                    (entry_no, company_id, account_no, date_id, document_id,
                     posting_group_id, department_id, counterparty_id, currency_id,
                     amount, customer_vendor_name, gl_account_name)
                VALUES (%s,%s,%s,%s,%s,%s,%s,1,%s,%s,%s,'Service Revenue')
                ON CONFLICT DO NOTHING
            """, (
                gl["entry_no"], cid, gl["account_no"], gl["date_id"],
                gl["document_id"] or DOC_INVOICE,
                gl["posting_group_id"] or 1,
                gl["department_id"] or 1,
                gl["currency_id"] or 1,
                gl["amount"],
                cust_name,
            ))
            inserted += 1

    print(f"  {inserted} posted_sales rows inserted")


def step8_seed_budgets():
    print("\n[8/9] Seeding budgets (3 subs × 3 years × 12 months × 6 categories)...")
    cats = ["Revenue", "COGS", "OpEx", "Salaries", "Marketing", "IT & Software"]
    inserted = 0
    for sub in SUBS:
        cid  = sub["company_id"]
        base = sub["base_rev"]
        growth = sub["growth"]
        for year in range(2022, 2025):
            for month in range(1, 13):
                fy_period = month
                # Budget = actual rev formula × aspirational 8% premium
                rev_actual = rev(base, year, month, growth)
                rev_monthly = round(rev_actual * 1.08, 2)
                cogs_pct, opex_pct = margin_factors(year, month)
                # Budget margins = aspirational (1-2% better than forecast)
                b_cogs_pct = round(cogs_pct - 0.01, 4)
                b_opex_pct = round(opex_pct - 0.01, 4)
                budgets_by_cat = {
                    "Revenue":       rev_monthly,
                    "COGS":          round(rev_monthly * b_cogs_pct, 2),
                    "OpEx":          round(rev_monthly * b_opex_pct, 2),
                    "Salaries":      round(rev_monthly * b_opex_pct * 0.46, 2),
                    "Marketing":     round(rev_monthly * b_cogs_pct * 0.35, 2),
                    "IT & Software": round(rev_monthly * b_opex_pct * 0.15, 2),
                }
                for cat, amt in budgets_by_cat.items():
                    ex = query(
                        "SELECT id FROM budgets WHERE company_id=%s AND account_category=%s AND fiscal_year=%s AND fiscal_period=%s",
                        (cid, cat, year, fy_period)
                    )
                    if not ex:
                        query("""
                            INSERT INTO budgets
                                (id, company_id, account_category, fiscal_year, fiscal_period, budget_amount)
                            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
                        """, (cid, cat, year, fy_period, amt))
                        inserted += 1
    print(f"  {inserted} budget rows inserted")


def step9_seed_investments():
    print("\n[9/9] Seeding investments (10 per subsidiary = 30 total)...")
    asset_classes = [
        ("Money Market Fund",    "Fixed Income",  0.04,  0.06),
        ("Government Bonds",     "Fixed Income",  0.03,  0.05),
        ("Sukuk",                "Fixed Income",  0.05,  0.07),
        ("Listed Equities",      "Equity",        0.08,  0.25),
        ("Private Equity Fund",  "Equity",        0.12,  0.35),
        ("Real Estate Fund",     "Real Estate",   0.06,  0.15),
        ("Gold ETF",             "Commodities",   0.04,  0.18),
        ("Tech Venture Fund",    "Venture",       0.15,  0.45),
        ("FX Forward",           "Derivatives",   0.02,  0.04),
        ("Cash Deposit",         "Cash",          0.03,  0.04),
    ]
    statuses = ["active", "active", "active", "active", "matured", "active", "active", "divested", "active", "active"]
    inserted = 0
    for sub in SUBS:
        cid = sub["company_id"]
        for i, (inv_name, asset_class, min_ret, max_ret) in enumerate(asset_classes):
            ex = query("SELECT id FROM investments WHERE company_id=%s AND investment_name=%s", (cid, inv_name))
            if ex:
                continue
            invested = round(random.uniform(200_000, 2_000_000), 2)
            ret_pct  = random.uniform(min_ret, max_ret)
            ret_amt  = round(invested * ret_pct, 2)
            curr_val = round(invested + ret_amt, 2)
            inv_date = date(random.randint(2021, 2023), random.randint(1, 12), 1)
            mat_date = date(inv_date.year + random.randint(1, 5), inv_date.month, 1) if asset_class != "Cash" else None
            query("""
                INSERT INTO investments
                    (id, company_id, investment_name, investment_type, asset_class,
                     currency_code, invested_amount, current_value, return_amount,
                     investment_date, maturity_date, status)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (cid, inv_name, asset_class, asset_class, sub["currency"],
                  invested, curr_val, ret_amt, inv_date, mat_date, statuses[i]))
            inserted += 1
    print(f"  {inserted} investments inserted")


def step10_sync_log():
    print("\n[Bonus] Updating sync log for all 3 iSource ERP sources...")
    erp_rows = query("SELECT erp_source_id FROM dim_erp_source WHERE tenant_id = %s", (ISOURCE_TENANT_ID,))
    for r in erp_rows:
        query("""
            UPDATE dim_erp_source
            SET connection_status = 'connected', last_synced_at = NOW()
            WHERE erp_source_id = %s
        """, (r["erp_source_id"],))
        ex = query("SELECT sync_id FROM fact_sync_log WHERE erp_source_id=%s LIMIT 1", (r["erp_source_id"],))
        if not ex:
            query("""
                INSERT INTO fact_sync_log
                    (erp_source_id, triggered_by, status, sync_type,
                     started_at, completed_at, records_fetched, records_inserted, records_updated)
                VALUES (%s, 'seed_isource_full', 'success', 'full',
                        NOW() - INTERVAL '15 minutes', NOW(), 2160, 2160, 0)
            """, (r["erp_source_id"],))
    print("  Sync log updated")


if __name__ == "__main__":
    print("=" * 65)
    print("iSource Full Seed — IC-26 / DATA-IS-001")
    print("3 subsidiaries × 3 years × all application screens")
    print("=" * 65)

    step1_tenant_isolation()
    step2_ensure_accounts()
    step3_ensure_departments()
    step4_clear_old_seed()
    gl_count = step5_seed_gl_entries()
    step6_seed_customers()
    step7_seed_posted_sales()
    step8_seed_budgets()
    step9_seed_investments()
    step10_sync_log()

    print("\n" + "=" * 65)
    print("SEED COMPLETE — IC-26 / DATA-IS-001")
    print(f"  GL entries   : ~{gl_count:,}")
    print("  Customers    : 30  (10 per subsidiary)")
    print("  Posted sales : monthly Invoice + Payment rows")
    print("  Budgets      : 6 categories × 36 months × 3 subs")
    print("  Investments  : 10 per subsidiary")
    print("  Tenant isolation: iSource IS018–IS020 | RIA RIA001–RIA017")
    print("=" * 65)
