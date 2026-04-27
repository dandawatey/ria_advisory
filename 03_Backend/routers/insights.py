"""
Insights Router — CoA, Customer, Posted Sales, Invoice endpoints
Prefix: /api/insights
"""
from fastapi import APIRouter, Query
from typing import Optional, List
from database import query

router = APIRouter(prefix="/api/insights", tags=["insights"])


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _company_filter(company_ids, params: list, alias: str = "co") -> str:
    if company_ids:
        ph = ", ".join(["%s"] * len(company_ids))
        params.extend(company_ids)
        return f"{alias}.company_id IN ({ph})"
    return "1=1"


def _year_filter(year, params: list, alias: str = "d") -> str:
    if year:
        params.append(year)
        return f"{alias}.year = %s"
    return "1=1"


# ═════════════════════════════════════════════════════════════════════════════
# CoA ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/coa/summary")
def coa_summary():
    rows = query("""
        SELECT
            COUNT(DISTINCT ac.account_no)                                  AS total_accounts,
            COUNT(DISTINCT CASE WHEN g.entry_no IS NOT NULL
                                THEN ac.account_no END)                    AS active_accounts,
            COALESCE(SUM(ABS(cb.balance)), 0)                              AS balance_total_abs,
            COUNT(DISTINCT CASE WHEN ac.income_balance = 'Income Statement'
                                     AND ac.account_category ILIKE '%%income%%'
                                THEN ac.account_no END)                    AS income_accounts,
            COUNT(DISTINCT CASE WHEN ac.income_balance = 'Income Statement'
                                     AND (ac.account_category ILIKE '%%expense%%'
                                       OR ac.account_category ILIKE '%%cost%%')
                                THEN ac.account_no END)                    AS expense_accounts
        FROM dim_account ac
        LEFT JOIN fact_coa_balances cb ON cb.account_no = ac.account_no
        LEFT JOIN fact_gl_entries g    ON g.account_no  = ac.account_no
    """, [])
    return rows[0] if rows else {}


@router.get("/coa/by-category")
def coa_by_category(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    account_prefix: Optional[str] = None,
):
    params: list = []
    company_clause = _company_filter(company_id, params, alias="g")
    year_clause    = _year_filter(year, params, alias="d")
    prefix_clause  = "1=1"
    if account_prefix:
        params.append(f"{account_prefix}%")
        prefix_clause = "ac.account_no LIKE %s"

    return query(f"""
        SELECT
            COALESCE(ac.account_category, 'Uncategorized')         AS account_category,
            COUNT(DISTINCT ac.account_no)                          AS account_count,
            COALESCE(SUM(cb.balance), 0)                           AS balance,
            COALESCE(SUM(cb.net_change), 0)                        AS net_change,
            COUNT(g.entry_no)                                      AS entry_count
        FROM dim_account ac
        LEFT JOIN fact_coa_balances cb ON cb.account_no = ac.account_no
        LEFT JOIN fact_gl_entries g    ON g.account_no  = ac.account_no
        LEFT JOIN dim_date d           ON d.date_id     = g.date_id
        WHERE 1=1
          AND {company_clause}
          AND {year_clause}
          AND {prefix_clause}
        GROUP BY COALESCE(ac.account_category, 'Uncategorized')
        ORDER BY ABS(COALESCE(SUM(cb.balance), 0)) DESC
    """, params)


@router.get("/coa/accounts")
def coa_accounts(
    company_id: Optional[List[int]] = Query(default=None),
    category: Optional[str] = None,
    account_prefix: Optional[str] = None,
):
    params: list = []
    company_clause = _company_filter(company_id, params, alias="g")

    cat_clause = "1=1"
    if category:
        params.append(category)
        cat_clause = "ac.account_category = %s"

    prefix_clause = "1=1"
    if account_prefix:
        params.append(f"{account_prefix}%")
        prefix_clause = "ac.account_no LIKE %s"

    return query(f"""
        SELECT
            ac.account_no,
            ac.account_name,
            COALESCE(ac.account_category, 'Uncategorized')         AS account_category,
            COALESCE(ac.account_subcategory, '')                    AS account_subcategory,
            COUNT(DISTINCT g.company_id)                            AS company_count,
            COALESCE(SUM(cb.balance), 0)                            AS balance_total,
            COALESCE(SUM(cb.net_change), 0)                         AS net_change_total,
            COUNT(g.entry_no)                                       AS entry_count
        FROM dim_account ac
        LEFT JOIN fact_coa_balances cb ON cb.account_no = ac.account_no
        LEFT JOIN fact_gl_entries g    ON g.account_no  = ac.account_no
        WHERE 1=1
          AND {company_clause}
          AND {cat_clause}
          AND {prefix_clause}
        GROUP BY ac.account_no, ac.account_name, ac.account_category, ac.account_subcategory
        ORDER BY ABS(COALESCE(SUM(cb.balance), 0)) DESC
        LIMIT 50
    """, params)


@router.get("/coa/coverage")
def coa_coverage():
    return query("""
        SELECT
            COALESCE(ac.account_category, 'Uncategorized')  AS account_category,
            co.company_name,
            COUNT(DISTINCT ac.account_no)                   AS account_count,
            COALESCE(SUM(cb.balance), 0)                    AS balance
        FROM dim_account ac
        CROSS JOIN dim_company co
        LEFT JOIN fact_coa_balances cb
               ON cb.account_no  = ac.account_no
              AND cb.company_id  = co.company_id
        GROUP BY COALESCE(ac.account_category, 'Uncategorized'), co.company_name
        ORDER BY account_category, co.company_name
    """)


# ═════════════════════════════════════════════════════════════════════════════
# CUSTOMER ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/customers/summary")
def customers_summary():
    rows = query("""
        SELECT
            COUNT(*)                              AS total_customers,
            COALESCE(SUM(balance), 0)             AS total_balance,
            COALESCE(SUM(balance_due), 0)         AS total_balance_due,
            COALESCE(SUM(total_sales), 0)         AS total_sales,
            COALESCE(AVG(balance), 0)             AS avg_balance
        FROM dim_customer
    """)
    return rows[0] if rows else {}


@router.get("/customers/top")
def customers_top(
    limit: int = Query(default=20, le=100),
    sort_by: str = Query(default="sales"),
):
    order_col = "total_sales" if sort_by == "sales" else "balance"
    params = [limit]
    return query(f"""
        SELECT
            customer_name,
            company,
            city,
            state,
            COALESCE(balance, 0)          AS balance,
            COALESCE(balance_due, 0)      AS balance_due,
            COALESCE(total_sales, 0)      AS total_sales,
            COALESCE(total_payments, 0)   AS total_payments
        FROM dim_customer
        ORDER BY ABS(COALESCE({order_col}, 0)) DESC
        LIMIT %s
    """, params)


@router.get("/customers/by-entity")
def customers_by_entity():
    return query("""
        SELECT
            COALESCE(NULLIF(TRIM(company), ''), 'Unknown') AS company_name,
            COUNT(*)                                        AS customer_count,
            COALESCE(SUM(balance), 0)                      AS total_balance,
            COALESCE(SUM(total_sales), 0)                  AS total_sales
        FROM dim_customer
        GROUP BY COALESCE(NULLIF(TRIM(company), ''), 'Unknown')
        ORDER BY ABS(COALESCE(SUM(total_sales), 0)) DESC
    """)


@router.get("/customers/geographic")
def customers_geographic():
    return query("""
        SELECT
            NULLIF(TRIM(city), '')  AS city,
            NULLIF(TRIM(state), '') AS state,
            COUNT(*)                AS customer_count,
            COALESCE(SUM(balance), 0)      AS total_balance,
            COALESCE(SUM(total_sales), 0)  AS total_sales
        FROM dim_customer
        WHERE city IS NOT NULL AND TRIM(city) != ''
        GROUP BY NULLIF(TRIM(city), ''), NULLIF(TRIM(state), '')
        ORDER BY ABS(COALESCE(SUM(total_sales), 0)) DESC
        LIMIT 20
    """)


# ═════════════════════════════════════════════════════════════════════════════
# POSTED SALES ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

def _ps_filters(company_ids, year) -> tuple:
    """Return (where_clause, params) for fact_posted_sales queries."""
    clauses = ["1=1"]
    params: list = []
    if company_ids:
        ph = ", ".join(["%s"] * len(company_ids))
        clauses.append(f"ps.company_id IN ({ph})")
        params.extend(company_ids)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    return "WHERE " + " AND ".join(clauses), params


@router.get("/posted-sales/summary")
def posted_sales_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    wh, params = _ps_filters(company_id, year)
    rows = query(f"""
        SELECT
            COUNT(*)                                                        AS total_entries,
            COALESCE(SUM(ps.amount), 0)                                     AS total_amount,
            COUNT(DISTINCT NULLIF(TRIM(ps.customer_vendor_name), ''))       AS unique_customers,
            COUNT(DISTINCT ps.company_id)                                   AS entity_count,
            COUNT(*) FILTER (WHERE TRIM(doc.document_type) = 'Invoice')     AS invoice_count,
            COUNT(*) FILTER (WHERE TRIM(doc.document_type) = 'Payment')     AS payment_count
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id     = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
    """, params)
    return rows[0] if rows else {}


@router.get("/posted-sales/by-period")
def posted_sales_by_period(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    wh, params = _ps_filters(company_id, year)
    return query(f"""
        SELECT
            TO_CHAR(MIN(d.full_date), 'YYYY-MM')                                               AS month,
            d.month_name,
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Invoice'
                               THEN ps.amount ELSE 0 END), 0)                                  AS invoice_amount,
            COALESCE( SUM(CASE WHEN TRIM(doc.document_type) = 'Payment'
                               THEN ps.amount ELSE 0 END), 0)                                  AS payment_amount,
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Refund'
                               THEN ps.amount ELSE 0 END), 0)                                  AS refund_amount,
            COALESCE(SUM(ps.amount), 0)                                                        AS net_amount,
            COUNT(*)                                                                            AS entry_count
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
        GROUP BY d.year, d.month, d.month_name
        ORDER BY d.year, d.month
    """, params)


@router.get("/posted-sales/by-customer")
def posted_sales_by_customer(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    doc_type: Optional[str] = None,
    limit: int = Query(default=20, le=100),
):
    clauses = ["1=1", "NULLIF(TRIM(ps.customer_vendor_name), '') IS NOT NULL"]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"ps.company_id IN ({ph})")
        params.extend(company_id)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if doc_type:
        clauses.append("TRIM(doc.document_type) = %s")
        params.append(doc_type)

    wh = "WHERE " + " AND ".join(clauses)
    params.append(limit)

    return query(f"""
        SELECT
            ps.customer_vendor_name,
            COUNT(DISTINCT ps.company_id)                                                      AS entity_count,
            COUNT(*) FILTER (WHERE TRIM(doc.document_type) = 'Invoice')                       AS invoice_count,
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Invoice'
                               THEN ps.amount ELSE 0 END), 0)                                  AS total_invoiced,
            COALESCE( SUM(CASE WHEN TRIM(doc.document_type) = 'Payment'
                               THEN ps.amount ELSE 0 END), 0)                                  AS total_paid,
            COALESCE(SUM(ps.amount), 0)                                                        AS net_amount
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
        GROUP BY ps.customer_vendor_name
        ORDER BY ABS(COALESCE(SUM(ps.amount), 0)) DESC
        LIMIT %s
    """, params)


@router.get("/posted-sales/by-type")
def posted_sales_by_type(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    wh, params = _ps_filters(company_id, year)
    return query(f"""
        SELECT
            COALESCE(NULLIF(TRIM(doc.document_type), ''), 'Unspecified') AS document_type,
            COUNT(*)                                                       AS entry_count,
            COALESCE(SUM(ps.amount), 0)                                   AS total_amount,
            ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS pct
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
        GROUP BY COALESCE(NULLIF(TRIM(doc.document_type), ''), 'Unspecified')
        ORDER BY entry_count DESC
    """, params)


# ═════════════════════════════════════════════════════════════════════════════
# INVOICE ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

def _inv_filters(company_ids, year) -> tuple:
    """WHERE filters scoped to Invoice document_type."""
    clauses = ["1=1", "TRIM(doc.document_type) = 'Invoice'"]
    params: list = []
    if company_ids:
        ph = ", ".join(["%s"] * len(company_ids))
        clauses.append(f"ps.company_id IN ({ph})")
        params.extend(company_ids)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    return "WHERE " + " AND ".join(clauses), params


@router.get("/invoices/summary")
def invoices_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    wh, params = _inv_filters(company_id, year)
    rows = query(f"""
        SELECT
            COUNT(*)                                                         AS invoice_count,
            COALESCE(-SUM(ps.amount), 0)                                     AS total_value,
            COALESCE(-AVG(ps.amount), 0)                                     AS avg_invoice,
            COUNT(DISTINCT ps.company_id)                                    AS entity_count,
            COUNT(DISTINCT NULLIF(TRIM(ps.customer_vendor_name), ''))        AS customer_count
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
    """, params)
    return rows[0] if rows else {}


@router.get("/invoices/by-period")
def invoices_by_period(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
):
    wh, params = _inv_filters(company_id, year)
    return query(f"""
        SELECT
            TO_CHAR(MIN(d.full_date), 'YYYY-MM')  AS month,
            d.month_name,
            COUNT(*)                              AS invoice_count,
            COALESCE(-SUM(ps.amount), 0)          AS invoice_value,
            COALESCE(-AVG(ps.amount), 0)          AS avg_invoice
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
        GROUP BY d.year, d.month, d.month_name
        ORDER BY d.year, d.month
    """, params)


@router.get("/invoices/by-customer")
def invoices_by_customer(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    limit: int = Query(default=15, le=100),
):
    clauses = [
        "1=1",
        "TRIM(doc.document_type) = 'Invoice'",
        "NULLIF(TRIM(ps.customer_vendor_name), '') IS NOT NULL",
    ]
    params: list = []
    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        clauses.append(f"ps.company_id IN ({ph})")
        params.extend(company_id)
    if year:
        clauses.append("d.year = %s")
        params.append(year)

    wh = "WHERE " + " AND ".join(clauses)
    params.append(limit)

    return query(f"""
        SELECT
            ps.customer_vendor_name,
            COUNT(*)                              AS invoice_count,
            COALESCE(-SUM(ps.amount), 0)          AS total_value,
            COALESCE(-AVG(ps.amount), 0)          AS avg_invoice,
            co.company_name
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        LEFT JOIN dim_company  co  ON co.company_id   = ps.company_id
        {wh}
        GROUP BY ps.customer_vendor_name, co.company_name
        ORDER BY ABS(COALESCE(SUM(ps.amount), 0)) DESC
        LIMIT %s
    """, params)


@router.get("/invoices/by-entity")
def invoices_by_entity(
    year: Optional[int] = None,
):
    clauses = ["1=1", "TRIM(doc.document_type) = 'Invoice'"]
    params: list = []
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    wh = "WHERE " + " AND ".join(clauses)

    return query(f"""
        SELECT
            co.company_name,
            COUNT(*)                              AS invoice_count,
            COALESCE(-SUM(ps.amount), 0)          AS total_value,
            COALESCE(-AVG(ps.amount), 0)          AS avg_invoice
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        LEFT JOIN dim_company  co  ON co.company_id   = ps.company_id
        {wh}
        GROUP BY co.company_name
        ORDER BY ABS(COALESCE(SUM(ps.amount), 0)) DESC
    """, params)


# ═════════════════════════════════════════════════════════════════════════════
# COLLECTIONS ENDPOINTS  (Invoice vs Payment matching from fact_posted_sales)
# ═════════════════════════════════════════════════════════════════════════════

def _col_filters(company_ids, year, month_from=None, month_to=None, doc_type=None) -> tuple:
    clauses = ["1=1"]
    params: list = []
    if company_ids:
        ph = ", ".join(["%s"] * len(company_ids))
        clauses.append(f"ps.company_id IN ({ph})")
        params.extend(company_ids)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if month_from:
        y, m = month_from.split("-")
        clauses.append("(d.year * 100 + d.month) >= %s")
        params.append(int(y) * 100 + int(m))
    if month_to:
        y, m = month_to.split("-")
        clauses.append("(d.year * 100 + d.month) <= %s")
        params.append(int(y) * 100 + int(m))
    if doc_type:
        clauses.append("TRIM(COALESCE(doc.document_type, '')) = %s")
        params.append(doc_type)
    return "WHERE " + " AND ".join(clauses), params


@router.get("/collections/summary")
def collections_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _col_filters(company_id, year, month_from, month_to, doc_type=doc_type)
    rows = query(f"""
        SELECT
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Invoice'
                               THEN ps.amount ELSE 0 END), 0)          AS total_invoiced,
            COALESCE( SUM(CASE WHEN TRIM(doc.document_type) = 'Payment'
                               THEN ps.amount ELSE 0 END), 0)          AS total_collected,
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Refund'
                               THEN ps.amount ELSE 0 END), 0)          AS total_refunded,
            COUNT(*) FILTER (WHERE TRIM(doc.document_type) = 'Invoice') AS invoice_count,
            COUNT(*) FILTER (WHERE TRIM(doc.document_type) = 'Payment') AS payment_count,
            COUNT(DISTINCT NULLIF(TRIM(ps.customer_vendor_name), ''))   AS customer_count,
            COUNT(DISTINCT ps.company_id)                               AS entity_count
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
    """, params)
    row = rows[0] if rows else {}
    inv  = float(row.get("total_invoiced",  0) or 0)
    coll = float(row.get("total_collected", 0) or 0)
    row["outstanding"]      = round(inv - coll, 4)
    row["collection_rate"]  = round((coll / inv * 100) if inv > 0 else 0, 2)
    return row


@router.get("/collections/monthly")
def collections_monthly(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _col_filters(company_id, year, month_from, month_to, doc_type=doc_type)
    rows = query(f"""
        SELECT
            TO_CHAR(MIN(d.full_date), 'YYYY-MM')                               AS month,
            d.month_name,
            d.year,
            d.quarter,
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Invoice'
                               THEN ps.amount ELSE 0 END), 0)                  AS invoiced,
            COALESCE( SUM(CASE WHEN TRIM(doc.document_type) = 'Payment'
                               THEN ps.amount ELSE 0 END), 0)                  AS collected,
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Refund'
                               THEN ps.amount ELSE 0 END), 0)                  AS refunded,
            COUNT(*) FILTER (WHERE TRIM(doc.document_type) = 'Invoice')        AS invoice_count,
            COUNT(*) FILTER (WHERE TRIM(doc.document_type) = 'Payment')        AS payment_count,
            COUNT(DISTINCT NULLIF(TRIM(ps.customer_vendor_name), ''))          AS active_customers
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
        GROUP BY d.year, d.quarter, d.month, d.month_name
        ORDER BY d.year, d.month
    """, params)
    for r in rows:
        inv  = float(r.get("invoiced",   0) or 0)
        coll = float(r.get("collected",  0) or 0)
        r["outstanding"]     = round(inv - coll, 4)
        r["collection_rate"] = round((coll / inv * 100) if inv > 0 else 0, 2)
    return rows


@router.get("/collections/by-customer")
def collections_by_customer(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    limit: int = Query(default=25, le=100),
    doc_type: Optional[str] = None,
):
    wh, params = _col_filters(company_id, year, month_from, month_to, doc_type=doc_type)
    params.append(limit)
    rows = query(f"""
        SELECT
            COALESCE(NULLIF(TRIM(ps.customer_vendor_name), ''), '(unknown)') AS customer_name,
            COUNT(DISTINCT ps.company_id)                                      AS entity_count,
            COUNT(*) FILTER (WHERE TRIM(doc.document_type) = 'Invoice')       AS invoice_count,
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Invoice'
                               THEN ps.amount ELSE 0 END), 0)                  AS invoiced,
            COALESCE( SUM(CASE WHEN TRIM(doc.document_type) = 'Payment'
                               THEN ps.amount ELSE 0 END), 0)                  AS collected,
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Refund'
                               THEN ps.amount ELSE 0 END), 0)                  AS refunded
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
        GROUP BY COALESCE(NULLIF(TRIM(ps.customer_vendor_name), ''), '(unknown)')
        ORDER BY ABS(COALESCE(SUM(CASE WHEN TRIM(doc.document_type) = 'Invoice'
                                       THEN ps.amount ELSE 0 END), 0)) DESC
        LIMIT %s
    """, params)
    for r in rows:
        inv  = float(r.get("invoiced",  0) or 0)
        coll = float(r.get("collected", 0) or 0)
        r["outstanding"]     = round(inv - coll, 4)
        r["collection_rate"] = round((coll / inv * 100) if inv > 0 else 0, 2)
    return rows


@router.get("/collections/by-entity")
def collections_by_entity(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _col_filters(company_id, year, month_from, month_to, doc_type=doc_type)
    rows = query(f"""
        SELECT
            co.company_name,
            COUNT(*) FILTER (WHERE TRIM(doc.document_type) = 'Invoice')  AS invoice_count,
            COALESCE(-SUM(CASE WHEN TRIM(doc.document_type) = 'Invoice'
                               THEN ps.amount ELSE 0 END), 0)             AS invoiced,
            COALESCE( SUM(CASE WHEN TRIM(doc.document_type) = 'Payment'
                               THEN ps.amount ELSE 0 END), 0)             AS collected,
            COUNT(DISTINCT NULLIF(TRIM(ps.customer_vendor_name), ''))     AS customer_count
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        LEFT JOIN dim_company  co  ON co.company_id   = ps.company_id
        {wh}
        GROUP BY co.company_name
        ORDER BY ABS(COALESCE(SUM(CASE WHEN TRIM(doc.document_type) = 'Invoice'
                                       THEN ps.amount ELSE 0 END), 0)) DESC
    """, params)
    for r in rows:
        inv  = float(r.get("invoiced",  0) or 0)
        coll = float(r.get("collected", 0) or 0)
        r["outstanding"]     = round(inv - coll, 4)
        r["collection_rate"] = round((coll / inv * 100) if inv > 0 else 0, 2)
    return rows


# ═════════════════════════════════════════════════════════════════════════════
# MONTHLY INCOME ENDPOINTS  (GL income accounts: 4xx revenue, 7xx other income)
# ═════════════════════════════════════════════════════════════════════════════

def _inc_filters(company_ids, year, month_from=None, month_to=None, account_prefix=None) -> tuple:
    clauses = [
        "ac.account_no != '999999'",
        "(ac.account_no LIKE '4%%' OR ac.account_no LIKE '7%%')",
    ]
    params: list = []
    if company_ids:
        ph = ", ".join(["%s"] * len(company_ids))
        clauses.append(f"g.company_id IN ({ph})")
        params.extend(company_ids)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if month_from:
        y, m = month_from.split("-")
        clauses.append("(d.year * 100 + d.month) >= %s")
        params.append(int(y) * 100 + int(m))
    if month_to:
        y, m = month_to.split("-")
        clauses.append("(d.year * 100 + d.month) <= %s")
        params.append(int(y) * 100 + int(m))
    if account_prefix:
        clauses.append("ac.account_no LIKE %s")
        params.append(f"{account_prefix}%")
    return "WHERE " + " AND ".join(clauses), params


@router.get("/income/summary")
def income_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
):
    wh, params = _inc_filters(company_id, year, month_from, month_to, account_prefix=account_prefix)
    rows = query(f"""
        SELECT
            -SUM(g.amount)                                            AS total_income,
            -SUM(CASE WHEN ac.account_no LIKE '4%%'
                      THEN g.amount ELSE 0 END)                       AS revenue,
            -SUM(CASE WHEN ac.account_no LIKE '7%%'
                      THEN g.amount ELSE 0 END)                       AS other_income,
            COUNT(DISTINCT d.year * 100 + d.month)                   AS months_count,
            COUNT(DISTINCT g.company_id)                              AS entity_count,
            COUNT(*)                                                   AS entry_count
        FROM fact_gl_entries g
        JOIN dim_date    d  ON d.date_id     = g.date_id
        JOIN dim_account ac ON ac.account_no = g.account_no
        {wh}
    """, params)
    row = rows[0] if rows else {}
    months = int(row.get("months_count") or 1)
    total  = float(row.get("total_income") or 0)
    row["avg_monthly_income"] = round(total / months, 4) if months > 0 else 0
    return row


@router.get("/income/monthly")
def income_monthly(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
):
    wh, params = _inc_filters(company_id, year, month_from, month_to, account_prefix=account_prefix)
    return query(f"""
        SELECT
            TO_CHAR(MIN(d.full_date), 'YYYY-MM')                      AS month,
            d.month_name,
            d.year,
            d.quarter,
            -SUM(g.amount)                                             AS total_income,
            -SUM(CASE WHEN ac.account_no LIKE '4%%'
                      THEN g.amount ELSE 0 END)                        AS revenue,
            -SUM(CASE WHEN ac.account_no LIKE '7%%'
                      THEN g.amount ELSE 0 END)                        AS other_income,
            COUNT(DISTINCT g.company_id)                               AS entity_count,
            COUNT(*)                                                    AS entry_count
        FROM fact_gl_entries g
        JOIN dim_date    d  ON d.date_id     = g.date_id
        JOIN dim_account ac ON ac.account_no = g.account_no
        {wh}
        GROUP BY d.year, d.quarter, d.month, d.month_name
        ORDER BY d.year, d.month
    """, params)


@router.get("/income/by-account")
def income_by_account(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
):
    wh, params = _inc_filters(company_id, year, month_from, month_to, account_prefix=account_prefix)
    return query(f"""
        SELECT
            ac.account_no,
            ac.account_name,
            COALESCE(ac.account_category,    'Uncategorized') AS account_category,
            COALESCE(ac.account_subcategory, 'Uncategorized') AS account_subcategory,
            -SUM(g.amount)                                     AS total_income,
            COUNT(DISTINCT g.company_id)                       AS entity_count,
            COUNT(*)                                            AS entry_count
        FROM fact_gl_entries g
        JOIN dim_date    d  ON d.date_id     = g.date_id
        JOIN dim_account ac ON ac.account_no = g.account_no
        {wh}
        GROUP BY ac.account_no, ac.account_name, ac.account_category, ac.account_subcategory
        ORDER BY ABS(SUM(g.amount)) DESC
        LIMIT 50
    """, params)


@router.get("/income/by-entity")
def income_by_entity(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    account_prefix: Optional[str] = None,
):
    wh, params = _inc_filters(company_id, year, month_from, month_to, account_prefix=account_prefix)
    return query(f"""
        SELECT
            co.company_name,
            -SUM(g.amount)                                             AS total_income,
            -SUM(CASE WHEN ac.account_no LIKE '4%%'
                      THEN g.amount ELSE 0 END)                        AS revenue,
            -SUM(CASE WHEN ac.account_no LIKE '7%%'
                      THEN g.amount ELSE 0 END)                        AS other_income,
            COUNT(DISTINCT d.year * 100 + d.month)                    AS months_active,
            COUNT(*)                                                    AS entry_count
        FROM fact_gl_entries g
        JOIN dim_date    d  ON d.date_id     = g.date_id
        JOIN dim_account ac ON ac.account_no = g.account_no
        JOIN dim_company co ON co.company_id = g.company_id
        {wh}
        GROUP BY co.company_name
        ORDER BY ABS(SUM(g.amount)) DESC
    """, params)


# ═════════════════════════════════════════════════════════════════════════════
# AGEING ENDPOINTS  (Invoice ageing buckets from fact_posted_sales)
# ═════════════════════════════════════════════════════════════════════════════

def _age_filters(company_ids, year, month_from=None, month_to=None, doc_type=None) -> tuple:
    base_doc = doc_type if doc_type else 'Invoice'
    clauses = [f"TRIM(COALESCE(doc.document_type, '')) = '{base_doc}'"]
    params: list = []
    if company_ids:
        ph = ", ".join(["%s"] * len(company_ids))
        clauses.append(f"ps.company_id IN ({ph})")
        params.extend(company_ids)
    if year:
        clauses.append("d.year = %s")
        params.append(year)
    if month_from:
        y, m = month_from.split("-")
        clauses.append("(d.year * 100 + d.month) >= %s")
        params.append(int(y) * 100 + int(m))
    if month_to:
        y, m = month_to.split("-")
        clauses.append("(d.year * 100 + d.month) <= %s")
        params.append(int(y) * 100 + int(m))
    return "WHERE " + " AND ".join(clauses), params


@router.get("/ageing/summary")
def ageing_summary(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _age_filters(company_id, year, month_from, month_to, doc_type=doc_type)
    rows = query(f"""
        SELECT
            COUNT(*)                                                       AS invoice_count,
            COUNT(DISTINCT ps.company_id)                                  AS entity_count,
            COUNT(DISTINCT NULLIF(TRIM(ps.customer_vendor_name), ''))      AS customer_count,
            COALESCE(-SUM(ps.amount), 0)                                   AS total_outstanding,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) <= 30
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_0_30,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) BETWEEN 31 AND 60
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_31_60,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) BETWEEN 61 AND 90
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_61_90,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) BETWEEN 91 AND 120
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_91_120,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) > 120
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_120_plus
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
    """, params)
    return rows[0] if rows else {}


@router.get("/ageing/by-customer")
def ageing_by_customer(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    limit: int = Query(default=25, le=100),
    doc_type: Optional[str] = None,
):
    wh, params = _age_filters(company_id, year, month_from, month_to, doc_type=doc_type)
    params.append(limit)
    return query(f"""
        SELECT
            COALESCE(NULLIF(TRIM(ps.customer_vendor_name), ''), '(unknown)') AS customer_name,
            COUNT(*)                                                           AS invoice_count,
            COUNT(DISTINCT ps.company_id)                                      AS entity_count,
            COALESCE(-SUM(ps.amount), 0)                                       AS total_outstanding,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) <= 30
                               THEN ps.amount ELSE 0 END), 0)                  AS bucket_0_30,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) BETWEEN 31 AND 60
                               THEN ps.amount ELSE 0 END), 0)                  AS bucket_31_60,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) BETWEEN 61 AND 90
                               THEN ps.amount ELSE 0 END), 0)                  AS bucket_61_90,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) BETWEEN 91 AND 120
                               THEN ps.amount ELSE 0 END), 0)                  AS bucket_91_120,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) > 120
                               THEN ps.amount ELSE 0 END), 0)                  AS bucket_120_plus
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        {wh}
        GROUP BY COALESCE(NULLIF(TRIM(ps.customer_vendor_name), ''), '(unknown)')
        ORDER BY ABS(COALESCE(SUM(ps.amount), 0)) DESC
        LIMIT %s
    """, params)


@router.get("/ageing/by-entity")
def ageing_by_entity(
    company_id: Optional[List[int]] = Query(default=None),
    year: Optional[int] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    doc_type: Optional[str] = None,
):
    wh, params = _age_filters(company_id, year, month_from, month_to, doc_type=doc_type)
    return query(f"""
        SELECT
            co.company_name,
            COUNT(*)                                                       AS invoice_count,
            COUNT(DISTINCT NULLIF(TRIM(ps.customer_vendor_name), ''))      AS customer_count,
            COALESCE(-SUM(ps.amount), 0)                                   AS total_outstanding,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) <= 30
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_0_30,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) BETWEEN 31 AND 60
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_31_60,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) BETWEEN 61 AND 90
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_61_90,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) BETWEEN 91 AND 120
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_91_120,
            COALESCE(-SUM(CASE WHEN (CURRENT_DATE - d.full_date) > 120
                               THEN ps.amount ELSE 0 END), 0)              AS bucket_120_plus
        FROM fact_posted_sales ps
        LEFT JOIN dim_date     d   ON d.date_id      = ps.date_id
        LEFT JOIN dim_document doc ON doc.document_id = ps.document_id
        LEFT JOIN dim_company  co  ON co.company_id   = ps.company_id
        {wh}
        GROUP BY co.company_name
        ORDER BY ABS(COALESCE(SUM(ps.amount), 0)) DESC
    """, params)
