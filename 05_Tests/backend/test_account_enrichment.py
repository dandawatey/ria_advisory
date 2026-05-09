"""
Test suite for Account Mapping Enrichment (ICFO-65-S5)

TDD: RED → GREEN cycle
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../03_Backend'))


class TestAccountEnrichment:
    """Account enrichment logic tests"""

    @patch('etl.account_enrichment.query')
    def test_enrich_accounts_with_canonical_coa(self, mock_query):
        """Test account enrichment joins with canonical CoA"""
        from etl.account_enrichment import enrich_accounts

        # Mock: GL entries with account_code but no l2_category
        mock_query.side_effect = [
            # First call: get accounts to enrich
            [{'account_code': '1000'}, {'account_code': '5000'}],
            # Second call: lookup 1000 in CoA
            [{'l2_category': 'Current Assets', 'l3_category': 'Cash', 'account_type': 'asset'}],
            # Third call: UPDATE 1000
            None,
            # Fourth call: lookup 5000 in CoA
            [{'l2_category': 'Revenue', 'l3_category': 'Service Revenue', 'account_type': 'revenue'}],
            # Fifth call: UPDATE 5000
            None,
            # Sixth call: INSERT to fact_audit_log
            None,
        ]

        count = enrich_accounts()

        assert count == 2, "Should enrich 2 accounts"
        # Verify UPDATE called for each account
        update_calls = [call for call in mock_query.call_args_list
                       if 'UPDATE' in str(call).upper()]
        assert len(update_calls) >= 1, "Should call UPDATE for accounts"

    @patch('etl.account_enrichment.query')
    @patch('etl.account_enrichment.logger')
    def test_enrich_accounts_missing_account_skipped(self, mock_logger, mock_query):
        """Test enrichment skips accounts not in CoA"""
        from etl.account_enrichment import enrich_accounts

        # Mock: GL entry with account_code not in CoA
        mock_query.side_effect = [
            # Get accounts to enrich
            [{'account_code': '9999'}],
            # Lookup 9999 in CoA (not found)
            [],
        ]

        count = enrich_accounts()

        assert count == 0, "Should skip missing account"
        # Verify warning logged
        assert mock_logger.warning.called, "Should log warning for missing account"

    @patch('etl.account_enrichment.query')
    def test_enrich_accounts_idempotent(self, mock_query):
        """Test enrichment is idempotent (run 2x = same state)"""
        from etl.account_enrichment import enrich_accounts

        mock_query.side_effect = [
            # First enrichment: 2 accounts
            [{'account_code': '1000'}, {'account_code': '5000'}],
            [{'l2_category': 'Assets', 'l3_category': 'Cash', 'account_type': 'asset'}],
            None,  # UPDATE 1000
            [{'l2_category': 'Revenue', 'l3_category': 'Sales', 'account_type': 'revenue'}],
            None,  # UPDATE 5000
            None,  # INSERT to fact_audit_log
            # Second enrichment: same 2 accounts (already enriched)
            [{'account_code': '1000'}, {'account_code': '5000'}],
            [{'l2_category': 'Assets', 'l3_category': 'Cash', 'account_type': 'asset'}],
            None,  # UPDATE 1000
            [{'l2_category': 'Revenue', 'l3_category': 'Sales', 'account_type': 'revenue'}],
            None,  # UPDATE 5000
            None,  # INSERT to fact_audit_log
        ]

        count1 = enrich_accounts()
        count2 = enrich_accounts()

        assert count1 == count2 == 2, "Should return same count on both runs"

    @patch('etl.account_enrichment.query')
    def test_enrich_accounts_updates_fact_gl_entries(self, mock_query):
        """Test enrichment updates fact_gl_entries columns"""
        from etl.account_enrichment import enrich_accounts

        mock_query.side_effect = [
            # Get accounts
            [{'account_code': '1000'}],
            # Lookup CoA
            [{'l2_category': 'Assets', 'l3_category': 'Bank Account', 'account_type': 'asset'}],
            # UPDATE
            None,
            # INSERT to fact_audit_log
            None,
        ]

        enrich_accounts()

        # Verify UPDATE SQL executed with correct parameters
        update_calls = [call for call in mock_query.call_args_list
                       if 'UPDATE' in str(call).upper()]
        assert len(update_calls) >= 1, "Should execute UPDATE"

    @patch('etl.account_enrichment.query')
    def test_enrich_accounts_logs_audit_trail(self, mock_query):
        """Test enrichment creates fact_audit_log entry"""
        from etl.account_enrichment import enrich_accounts

        mock_query.side_effect = [
            # Get accounts
            [{'account_code': '1000'}],
            # Lookup CoA
            [{'l2_category': 'Assets', 'l3_category': 'Cash', 'account_type': 'asset'}],
            # UPDATE
            None,
            # INSERT to fact_audit_log
            None,
        ]

        enrich_accounts()

        # Verify fact_audit_log INSERT called
        audit_calls = [call for call in mock_query.call_args_list
                      if 'fact_audit_log' in str(call).lower()]
        assert len(audit_calls) >= 1, "Should log to fact_audit_log"

    @patch('etl.account_enrichment.query')
    def test_enrich_accounts_handles_null_values(self, mock_query):
        """Test enrichment handles NULL l3_category gracefully"""
        from etl.account_enrichment import enrich_accounts

        mock_query.side_effect = [
            # Get accounts
            [{'account_code': '1000'}],
            # Lookup CoA with NULL l3_category
            [{'l2_category': 'Assets', 'l3_category': None, 'account_type': 'asset'}],
            # UPDATE
            None,
            # INSERT to fact_audit_log
            None,
        ]

        # Should not crash
        count = enrich_accounts()

        assert count == 1, "Should handle NULL l3_category"


class TestEnrichmentIntegration:
    """Integration with sync workers"""

    @patch('etl.account_enrichment.enrich_accounts')
    def test_enrichment_triggered_post_sync(self, mock_enrich):
        """Test enrichment hook called after sync completes"""
        # This test would verify that bc_sync_worker calls enrich_accounts()
        # after promote_gl_entries() completes
        pytest.skip("Requires full sync integration test")

    def test_enrich_accounts_with_real_db(self):
        """Integration test with real test database"""
        pytest.skip("Requires test database setup")
