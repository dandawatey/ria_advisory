"""GL Explorer endpoints — star schema edition."""

from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from database import query
from auth_utils import require_auth, get_allowed_company_ids

router = APIRouter(prefix="/api/gl", tags=["gl"])


@router.get("/entries")
def search_gl(
    company_id: Optional[List[int]] = Query(default=None),
    account_no: Optional[str] = None,
    department: Optional[str] = None,
    doc_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
    current: dict = Depends(require_auth),
):
    allowed = get_allowed_company_ids(current)
    if allowed is not None and len(allowed) == 0:
        return []

    # Merge user-requested company_ids with tenant-allowed list
    if allowed is not None:
        if company_id:
            effective = [c for c in company_id if c in set(allowed)]
            company_id = effective if effective else allowed
        else:
            company_id = allowed

    filters = ["g.account_no != '999999'"]
    params: list = []

    if company_id:
        ph = ", ".join(["%s"] * len(company_id))
        filters.append(f"g.company_id IN ({ph})")
        params.extend(company_id)
    if account_no:
        filters.append("g.account_no ILIKE %s")
        params.append(f"{account_no}%")
    if department:
        filters.append("dp.department_code ILIKE %s")
        params.append(f"%{department}%")
    if doc_type:
        filters.append("doc.document_type ILIKE %s")
        params.append(f"%{doc_type}%")
    if date_from:
        filters.append("d.full_date >= %s")
        params.append(date_from)
    if date_to:
        filters.append("d.full_date <= %s")
        params.append(date_to)

    where = " AND ".join(filters)
    params += [limit, offset]

    return query(f"""
        SELECT
            (co.company_id * 1000000 + g.entry_no)  AS id,
            CAST(co.company_id AS VARCHAR)            AS subsidiary_code,
            co.company_name                           AS subsidiary_name,
            d.full_date                               AS posting_date,
            doc.document_type,
            g.document_no,
            g.account_no                              AS gl_account_no,
            ac.account_name                           AS gl_account_name,
            ac.account_category,
            g.description,
            cp.source_no                              AS customer_or_vendor_name,
            dp.department_code,
            dp.vertical_code,
            g.amount,
            ba.bal_account_type,
            ba.bal_account_no,
            doc.source_code,
            g.entry_no,
            g.external_document_no,
            g.billable_flag
        FROM fact_gl_entries g
        JOIN dim_date         d   ON d.date_id          = g.date_id
        JOIN dim_account      ac  ON ac.account_no       = g.account_no
        JOIN dim_company      co  ON co.company_id       = g.company_id
        JOIN dim_document     doc ON doc.document_id     = g.document_id
        JOIN dim_department   dp  ON dp.department_id    = g.department_id
        JOIN dim_counterparty cp  ON cp.counterparty_id  = g.counterparty_id
        JOIN dim_bal_account  ba  ON ba.bal_account_id   = g.bal_account_id
        WHERE {where}
        ORDER BY d.full_date DESC, co.company_id, g.entry_no DESC
        LIMIT %s OFFSET %s
    """, params)


@router.get("/accounts")
def list_accounts(current: dict = Depends(require_auth)):
    """Distinct GL accounts with entry counts."""
    allowed = get_allowed_company_ids(current)
    if allowed is not None and len(allowed) == 0:
        return []
    co_filter = ""
    params: list = []
    if allowed:
        ph = ", ".join(["%s"] * len(allowed))
        co_filter = f"AND g.company_id IN ({ph})"
        params = list(allowed)
    return query(f"""
        SELECT
            ac.account_no                 AS gl_account_no,
            ac.account_name               AS gl_account_name,
            COUNT(DISTINCT g.company_id)  AS entity_count,
            SUM(g.amount)                 AS total_amount
        FROM dim_account ac
        JOIN fact_gl_entries g ON g.account_no = ac.account_no
        WHERE ac.account_no != '999999'
        {co_filter}
        GROUP BY ac.account_no, ac.account_name
        ORDER BY ac.account_no
    """, params)


@router.get("/departments")
def list_departments(current: dict = Depends(require_auth)):
    allowed = get_allowed_company_ids(current)
    if allowed is not None and len(allowed) == 0:
        return []
    co_filter = ""
    params: list = []
    if allowed:
        ph = ", ".join(["%s"] * len(allowed))
        co_filter = f"AND g.company_id IN ({ph})"
        params = list(allowed)
    return query(f"""
        SELECT DISTINCT dp.department_code, dp.vertical_code
        FROM dim_department dp
        JOIN fact_gl_entries g ON g.department_id = dp.department_id
        WHERE dp.department_code IS NOT NULL AND dp.department_code != ''
        {co_filter}
        ORDER BY dp.department_code
    """, params)


@router.get("/stats")
def gl_stats(current: dict = Depends(require_auth)):
    """Row counts and date range per company."""
    allowed = get_allowed_company_ids(current)
    if allowed is not None and len(allowed) == 0:
        return []
    co_filter = ""
    params: list = []
    if allowed:
        ph = ", ".join(["%s"] * len(allowed))
        co_filter = f"WHERE g.company_id IN ({ph})"
        params = list(allowed)
    return query(f"""
        SELECT
            CAST(co.company_id AS VARCHAR)  AS code,
            co.company_name                 AS name,
            COUNT(*)                        AS total_entries,
            MIN(d.full_date)                AS date_from,
            MAX(d.full_date)                AS date_to,
            SUM(g.amount)                   AS net_amount
        FROM fact_gl_entries g
        JOIN dim_company co ON co.company_id = g.company_id
        JOIN dim_date    d  ON d.date_id     = g.date_id
        {co_filter}
        GROUP BY co.company_id, co.company_name
        ORDER BY co.company_name
    """, params)
