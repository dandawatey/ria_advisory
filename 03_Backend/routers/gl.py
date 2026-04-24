"""GL Explorer endpoints — search/filter across all entities."""

from fastapi import APIRouter, Query
from typing import Optional
from database import query

router = APIRouter(prefix="/api/gl", tags=["gl"])


@router.get("/entries")
def search_gl(
    subsidiary: Optional[str] = None,
    account_no: Optional[str] = None,
    department: Optional[str] = None,
    doc_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
):
    filters = ["gl_account_no NOT IN ('999999')"]
    params: list = []

    if subsidiary:
        filters.append("subsidiary_code = %s")
        params.append(subsidiary.upper())
    if account_no:
        filters.append("gl_account_no ILIKE %s")
        params.append(f"{account_no}%")
    if department:
        filters.append("department_code ILIKE %s")
        params.append(f"%{department}%")
    if doc_type:
        filters.append("document_type ILIKE %s")
        params.append(f"%{doc_type}%")
    if date_from:
        filters.append("posting_date >= %s")
        params.append(date_from)
    if date_to:
        filters.append("posting_date <= %s")
        params.append(date_to)

    where = " AND ".join(filters)
    params += [limit, offset]

    return query(f"""
        SELECT
            id, subsidiary_code, subsidiary_name,
            posting_date, document_type, document_no,
            gl_account_no, gl_account_name, description,
            customer_or_vendor_name, department_code, vertical_code,
            amount, bal_account_type, bal_account_no,
            source_code, entry_no, external_document_no
        FROM gl_unified
        WHERE {where}
        ORDER BY posting_date DESC, id DESC
        LIMIT %s OFFSET %s
    """, params)


@router.get("/accounts")
def list_accounts():
    """Distinct GL accounts across all entities."""
    return query("""
        SELECT
            gl_account_no,
            MAX(gl_account_name) AS gl_account_name,
            COUNT(DISTINCT subsidiary_code) AS entity_count,
            SUM(amount) AS total_amount
        FROM gl_unified
        WHERE gl_account_no NOT IN ('999999')
        GROUP BY gl_account_no
        ORDER BY gl_account_no
    """)


@router.get("/departments")
def list_departments():
    return query("""
        SELECT DISTINCT department_code, vertical_code
        FROM gl_unified
        WHERE department_code IS NOT NULL AND department_code != ''
        ORDER BY department_code
    """)


@router.get("/stats")
def gl_stats():
    """Row counts and date range per subsidiary."""
    return query("""
        SELECT
            subsidiary_code AS code,
            subsidiary_name AS name,
            COUNT(*)        AS total_entries,
            MIN(posting_date) AS date_from,
            MAX(posting_date) AS date_to,
            SUM(amount)     AS net_amount
        FROM gl_unified
        GROUP BY subsidiary_code, subsidiary_name
        ORDER BY subsidiary_name
    """)
