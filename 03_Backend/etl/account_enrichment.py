"""
Account Mapping Enrichment (ICFO-65-S5)

Post-sync enrichment: GL accounts → join with canonical CoA → add L2/L3 hierarchy + account_type

Pattern: After each sync (bc/sap/odoo) completes, enrich GL entries with canonical account mapping.
Idempotent: safe to run multiple times (UPDATE ... SET).
"""

import logging
from database import query

logger = logging.getLogger(__name__)


def enrich_accounts(erp_source_id=None):
    """
    Enrich GL accounts with canonical CoA mapping post-sync.

    Args:
        erp_source_id: Optional. If provided, enrich only entries for this source.
                       If None, enrich all entries with missing hierarchy.

    Returns:
        count (int): Number of accounts enriched.
    """
    try:
        # 1. Get accounts to enrich (those missing l2_category or account_type)
        if erp_source_id:
            sql = """
            SELECT DISTINCT account_code
            FROM fact_gl_entries
            WHERE erp_source_id = %s AND (l2_category IS NULL OR account_type IS NULL)
            LIMIT 10000
            """
            accounts = query(sql, [erp_source_id])
        else:
            sql = """
            SELECT DISTINCT account_code
            FROM fact_gl_entries
            WHERE l2_category IS NULL OR account_type IS NULL
            LIMIT 10000
            """
            accounts = query(sql)

        if not accounts:
            logger.info("No accounts to enrich (all enriched)")
            return 0

        # 2. Lookup each account in canonical CoA (dim_account) and enrich
        enriched_count = 0
        for account_row in accounts:
            account_code = account_row.get('account_code')

            # Lookup in canonical CoA
            coa_sql = """
            SELECT l2_category, l3_category, account_type
            FROM dim_account
            WHERE account_code = %s
            """
            coa_entries = query(coa_sql, [account_code])

            if not coa_entries:
                logger.warning(f"Account not in canonical CoA: {account_code}")
                continue

            coa_entry = coa_entries[0]

            # 3. Upsert to fact_gl_entries
            update_sql = """
            UPDATE fact_gl_entries
            SET l2_category = %s, l3_category = %s, account_type = %s, updated_at = NOW()
            WHERE account_code = %s
            """
            query(update_sql, [
                coa_entry.get('l2_category'),
                coa_entry.get('l3_category'),
                coa_entry.get('account_type'),
                account_code,
            ])

            enriched_count += 1

        # 4. Log to fact_audit_log
        if enriched_count > 0:
            audit_sql = """
            INSERT INTO fact_audit_log
            (event_type, event_description, row_count, created_at)
            VALUES (%s, %s, %s, NOW())
            """
            query(audit_sql, [
                'account_enrichment',
                f'Enriched {enriched_count} accounts from canonical CoA',
                enriched_count,
            ])

        logger.info(f"Account enrichment complete: {enriched_count} entries enriched")
        return enriched_count

    except Exception as e:
        logger.error(f"Account enrichment failed: {str(e)}")
        raise


def enrich_accounts_by_source(erp_source_id):
    """
    Enrich accounts for a specific ERP source (called after sync completes).

    Args:
        erp_source_id: ERP source to enrich.

    Returns:
        count (int): Number of accounts enriched.
    """
    return enrich_accounts(erp_source_id=erp_source_id)
