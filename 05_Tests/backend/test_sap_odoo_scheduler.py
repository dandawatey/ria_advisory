"""
Test suite for SAP/Odoo scheduled sync workers (ICFO-65-S3)

TDD: RED → GREEN cycle
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../03_Backend'))


class TestSAPSchedulerImports:
    """Test SAP sync worker module can be imported"""

    def test_sap_sync_worker_module_exists(self):
        """Test sap_sync_worker.py module exists and imports"""
        try:
            from workers import sap_sync_worker
            assert hasattr(sap_sync_worker, 'run_sap_sync'), "Should have run_sap_sync function"
            assert hasattr(sap_sync_worker, 'start_sap_scheduler'), "Should have start_sap_scheduler function"
        except ImportError as e:
            pytest.skip(f"SAP worker not fully implemented yet: {e}")

    def test_odoo_sync_worker_module_exists(self):
        """Test odoo_sync_worker.py module exists and imports"""
        try:
            from workers import odoo_sync_worker
            assert hasattr(odoo_sync_worker, 'run_odoo_sync'), "Should have run_odoo_sync function"
            assert hasattr(odoo_sync_worker, 'start_odoo_scheduler'), "Should have start_odoo_scheduler function"
        except ImportError as e:
            pytest.skip(f"Odoo worker not fully implemented yet: {e}")


class TestSAPSchedulerLogic:
    """Test SAP sync worker logic"""

    @patch('workers.sap_sync_worker.query')
    def test_sap_sync_no_active_sources(self, mock_query):
        """Test SAP worker gracefully handles no active sources"""
        from workers.sap_sync_worker import run_sap_sync

        # Mock: no active SAP sources
        mock_query.return_value = []

        # Should not crash
        result = run_sap_sync()
        assert result is None, "Should return None when no sources"

    @patch('workers.sap_sync_worker.query')
    @patch('workers.sap_sync_worker.logger')
    def test_sap_sync_logs_no_sources(self, mock_logger, mock_query):
        """Test SAP worker logs when no sources configured"""
        from workers.sap_sync_worker import run_sap_sync

        mock_query.return_value = []
        run_sap_sync()

        # Should log info message
        assert mock_logger.info.called, "Should log info about no sources"

    @patch.dict('os.environ', {'SCHEDULE_SAP_SYNC': 'true'})
    @patch('workers.sap_sync_worker.scheduler')
    def test_sap_scheduler_registers_job(self, mock_scheduler):
        """Test SAP scheduler registers job when env var is true"""
        from workers.sap_sync_worker import start_sap_scheduler

        start_sap_scheduler()

        # Should call scheduler.add_job
        assert mock_scheduler.add_job.called, "Should register job with scheduler"

    @patch.dict('os.environ', {'SCHEDULE_SAP_SYNC': 'false'})
    @patch('workers.sap_sync_worker.logger')
    def test_sap_scheduler_disabled_when_env_false(self, mock_logger):
        """Test SAP scheduler respects disabled env var"""
        from workers.sap_sync_worker import start_sap_scheduler

        start_sap_scheduler()

        # Should log that scheduler is disabled
        assert any('disabled' in str(call).lower() for call in mock_logger.info.call_args_list), \
            "Should log disabled message"


class TestOdooSchedulerLogic:
    """Test Odoo sync worker logic"""

    @patch('workers.odoo_sync_worker.query')
    def test_odoo_sync_no_active_sources(self, mock_query):
        """Test Odoo worker gracefully handles no active sources"""
        from workers.odoo_sync_worker import run_odoo_sync

        # Mock: no active Odoo sources
        mock_query.return_value = []

        # Should not crash
        result = run_odoo_sync()
        assert result is None, "Should return None when no sources"

    @patch('workers.odoo_sync_worker.query')
    @patch('workers.odoo_sync_worker.logger')
    def test_odoo_sync_logs_no_sources(self, mock_logger, mock_query):
        """Test Odoo worker logs when no sources configured"""
        from workers.odoo_sync_worker import run_odoo_sync

        mock_query.return_value = []
        run_odoo_sync()

        # Should log info message
        assert mock_logger.info.called, "Should log info about no sources"

    @patch.dict('os.environ', {'SCHEDULE_ODOO_SYNC': 'true'})
    @patch('workers.odoo_sync_worker.scheduler')
    def test_odoo_scheduler_registers_job(self, mock_scheduler):
        """Test Odoo scheduler registers job when env var is true"""
        from workers.odoo_sync_worker import start_odoo_scheduler

        start_odoo_scheduler()

        # Should call scheduler.add_job
        assert mock_scheduler.add_job.called, "Should register job with scheduler"

    @patch.dict('os.environ', {'SCHEDULE_ODOO_SYNC': 'false'})
    @patch('workers.odoo_sync_worker.logger')
    def test_odoo_scheduler_disabled_when_env_false(self, mock_logger):
        """Test Odoo scheduler respects disabled env var"""
        from workers.odoo_sync_worker import start_odoo_scheduler

        start_odoo_scheduler()

        # Should log that scheduler is disabled
        assert any('disabled' in str(call).lower() for call in mock_logger.info.call_args_list), \
            "Should log disabled message"
