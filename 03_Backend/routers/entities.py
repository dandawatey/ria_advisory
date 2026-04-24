"""Per-entity (subsidiary) endpoints."""

from fastapi import APIRouter, HTTPException
from database import query

router = APIRouter(prefix="/api/entities", tags=["entities"])


@router.get("/")
def list_entities():
    return query("""
        SELECT DISTINCT subsidiary_code AS code, subsidiary_name AS name
        FROM gl_unified
        ORDER BY subsidiary_name
    """)


@router.get("/{code}/summary")
def entity_summary(code: str):
    rows = query("""
        SELECT
            subsidiary_code AS code, subsidiary_name AS name,
            -SUM(CASE WHEN gl_account_no LIKE '4%%' THEN amount ELSE 0 END)  AS revenue,
             SUM(CASE WHEN gl_account_no LIKE '5%%' THEN amount ELSE 0 END)  AS cogs,
             SUM(CASE WHEN gl_account_no LIKE '6%%' THEN amount ELSE 0 END)  AS opex,
             SUM(CASE WHEN gl_account_no LIKE '1%%' THEN amount ELSE 0 END)  AS total_assets,
            -SUM(CASE WHEN gl_account_no LIKE '2%%' THEN amount ELSE 0 END)  AS total_liabilities,
            COUNT(*)                                                           AS entry_count,
            MIN(posting_date)                                                  AS earliest_date,
            MAX(posting_date)                                                  AS latest_date
        FROM gl_unified
        WHERE subsidiary_code = %s
          AND gl_account_no NOT IN ('999999')
        GROUP BY subsidiary_code, subsidiary_name
    """, (code.upper(),))
    if not rows:
        raise HTTPException(status_code=404, detail="Entity not found")
    return rows[0]


@router.get("/{code}/trial-balance")
def entity_trial_balance(code: str):
    return query("""
        SELECT
            gl_account_no,
            MAX(gl_account_name) AS gl_account_name,
            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)  AS debit,
            SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)  AS credit,
            SUM(amount)                                         AS net_balance
        FROM gl_unified
        WHERE subsidiary_code = %s
          AND gl_account_no NOT IN ('999999')
        GROUP BY gl_account_no
        ORDER BY gl_account_no
    """, (code.upper(),))


@router.get("/{code}/gl-entries")
def entity_gl_entries(code: str, limit: int = 500, offset: int = 0):
    return query("""
        SELECT
            id, posting_date, document_type, document_no,
            gl_account_no, gl_account_name, description,
            customer_or_vendor_name, department_code, vertical_code,
            gen_posting_type, amount, bal_account_type, bal_account_no,
            source_code, source_type, entry_no, external_document_no
        FROM gl_unified
        WHERE subsidiary_code = %s
        ORDER BY posting_date DESC, entry_no DESC
        LIMIT %s OFFSET %s
    """, (code.upper(), limit, offset))


@router.get("/{code}/pl-by-account")
def entity_pl_by_account(code: str):
    return query("""
        SELECT
            CASE
                WHEN gl_account_no LIKE '4%%' THEN 'Revenue'
                WHEN gl_account_no LIKE '5%%' THEN 'COGS'
                WHEN gl_account_no LIKE '6%%' THEN 'Operating Expenses'
                WHEN gl_account_no LIKE '7%%' THEN 'Other Income'
                WHEN gl_account_no LIKE '8%%' THEN 'Tax'
                ELSE 'Other'
            END                       AS account_category,
            gl_account_no,
            MAX(gl_account_name)      AS gl_account_name,
            department_code,
            SUM(amount)               AS total_amount,
            COUNT(*)                  AS entry_count
        FROM gl_unified
        WHERE subsidiary_code = %s
          AND gl_account_no NOT IN ('999999')
          AND gl_account_no ~ '^[4-8]'
        GROUP BY account_category, gl_account_no, department_code
        ORDER BY account_category, gl_account_no
    """, (code.upper(),))
