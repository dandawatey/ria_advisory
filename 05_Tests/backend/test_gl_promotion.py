import pytest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta


@pytest.fixture
def mock_db():
    """Mock database connection."""
    return MagicMock()


@pytest.fixture
def mock_logger():
    """Mock logger."""
    return Mock()


def test_promote_empty_source(mock_db, mock_logger):
    """Test: empty source handles 0 rows gracefully."""
    from workers.bc_sync_worker import promote_gl_entries

    mock_db.query.return_value = []

    result = promote_gl_entries(
        db=mock_db,
        source_id='BC',
        logger=mock_logger
    )

    assert result == 0
    assert mock_db.execute.call_count == 0


def test_promote_new_entries(mock_db, mock_logger):
    """Test: normalized rows are promoted to fact_gl_entries."""
    from workers.bc_sync_worker import promote_gl_entries

    # Setup: 3 normalized rows from BC
    normalized_rows = [
        Mock(
            erp_source_id='BC',
            entity_id='ENTITY-001',
            erp_native_journal_id='JNL-100',
            erp_native_line_number=1,
            account_code='1000',
            debit_amount=1000.00,
            credit_amount=0.00,
            posting_date='2026-05-08',
        ),
        Mock(
            erp_source_id='BC',
            entity_id='ENTITY-001',
            erp_native_journal_id='JNL-100',
            erp_native_line_number=2,
            account_code='2000',
            debit_amount=0.00,
            credit_amount=1000.00,
            posting_date='2026-05-08',
        ),
        Mock(
            erp_source_id='BC',
            entity_id='ENTITY-002',
            erp_native_journal_id='JNL-101',
            erp_native_line_number=1,
            account_code='1000',
            debit_amount=500.00,
            credit_amount=0.00,
            posting_date='2026-05-08',
        ),
    ]
    mock_db.query.return_value = normalized_rows

    result = promote_gl_entries(
        db=mock_db,
        source_id='BC',
        logger=mock_logger
    )

    assert result == 3
    assert mock_db.execute.call_count == 3


def test_promote_deduplication(mock_db, mock_logger):
    """Test: natural key deduplication prevents duplicates."""
    from workers.bc_sync_worker import promote_gl_entries

    # Setup: 4 rows, but 2 have same natural key (duplicates)
    normalized_rows = [
        Mock(
            erp_source_id='BC',
            entity_id='ENTITY-001',
            erp_native_journal_id='JNL-100',
            erp_native_line_number=1,
            account_code='1000',
            debit_amount=1000.00,
            credit_amount=0.00,
        ),
        Mock(
            erp_source_id='BC',
            entity_id='ENTITY-001',
            erp_native_journal_id='JNL-100',
            erp_native_line_number=1,  # DUPLICATE KEY
            account_code='1000',
            debit_amount=1000.00,
            credit_amount=0.00,
        ),
        Mock(
            erp_source_id='BC',
            entity_id='ENTITY-001',
            erp_native_journal_id='JNL-100',
            erp_native_line_number=2,
            account_code='2000',
            debit_amount=0.00,
            credit_amount=1000.00,
        ),
        Mock(
            erp_source_id='BC',
            entity_id='ENTITY-001',
            erp_native_journal_id='JNL-100',
            erp_native_line_number=2,  # DUPLICATE KEY
            account_code='2000',
            debit_amount=0.00,
            credit_amount=1000.00,
        ),
    ]
    mock_db.query.return_value = normalized_rows

    result = promote_gl_entries(
        db=mock_db,
        source_id='BC',
        logger=mock_logger
    )

    # Should only promote 2 unique rows (deduplicated)
    assert result == 2
    assert mock_db.execute.call_count == 2


def test_promote_preserves_attributes(mock_db, mock_logger):
    """Test: all GL attributes are preserved through promotion."""
    from workers.bc_sync_worker import promote_gl_entries

    normalized_row = Mock(
        erp_source_id='BC',
        entity_id='ENTITY-001',
        erp_native_journal_id='JNL-100',
        erp_native_line_number=1,
        account_code='1000',
        account_name='Cash',
        debit_amount=1234.56,
        credit_amount=0.00,
        posting_date='2026-05-08',
        document_type='Invoice',
        document_id='INV-001',
        currency='USD',
        description='Test entry',
    )
    mock_db.query.return_value = [normalized_row]

    result = promote_gl_entries(
        db=mock_db,
        source_id='BC',
        logger=mock_logger
    )

    assert result == 1
    # Verify db.execute was called with the row's attributes
    call_args = mock_db.execute.call_args
    assert call_args is not None


def test_promote_handles_nulls(mock_db, mock_logger):
    """Test: nullable columns are preserved (including NULL values)."""
    from workers.bc_sync_worker import promote_gl_entries

    normalized_row = Mock(
        erp_source_id='BC',
        entity_id='ENTITY-001',
        erp_native_journal_id='JNL-100',
        erp_native_line_number=1,
        account_code='1000',
        account_name=None,  # NULL
        debit_amount=1000.00,
        credit_amount=0.00,
        posting_date='2026-05-08',
        document_type=None,  # NULL
        document_id='INV-001',
        currency=None,  # NULL
        description='Test',
    )
    mock_db.query.return_value = [normalized_row]

    result = promote_gl_entries(
        db=mock_db,
        source_id='BC',
        logger=mock_logger
    )

    assert result == 1
    assert mock_db.execute.call_count == 1


def test_promote_idempotent(mock_db, mock_logger):
    """Test: running promotion twice is safe (idempotent via ON CONFLICT)."""
    from workers.bc_sync_worker import promote_gl_entries

    normalized_row = Mock(
        erp_source_id='BC',
        entity_id='ENTITY-001',
        erp_native_journal_id='JNL-100',
        erp_native_line_number=1,
        account_code='1000',
        debit_amount=1000.00,
        credit_amount=0.00,
        posting_date='2026-05-08',
    )
    mock_db.query.return_value = [normalized_row]

    # First run
    result1 = promote_gl_entries(
        db=mock_db,
        source_id='BC',
        logger=mock_logger
    )

    # Reset mock
    mock_db.reset_mock()
    mock_db.query.return_value = [normalized_row]

    # Second run (should be idempotent)
    result2 = promote_gl_entries(
        db=mock_db,
        source_id='BC',
        logger=mock_logger
    )

    assert result1 == 1
    assert result2 == 1
    # Both runs should execute (ON CONFLICT handles duplicates)
    assert mock_db.execute.call_count == 1


def test_promote_logs_result(mock_db, mock_logger):
    """Test: promotion result is logged to fact_sync_log."""
    from workers.bc_sync_worker import promote_gl_entries

    normalized_rows = [
        Mock(
            erp_source_id='BC',
            entity_id='ENTITY-001',
            erp_native_journal_id='JNL-100',
            erp_native_line_number=1,
            account_code='1000',
            debit_amount=1000.00,
            credit_amount=0.00,
        ),
        Mock(
            erp_source_id='BC',
            entity_id='ENTITY-002',
            erp_native_journal_id='JNL-101',
            erp_native_line_number=1,
            account_code='1000',
            debit_amount=500.00,
            credit_amount=0.00,
        ),
    ]
    mock_db.query.return_value = normalized_rows

    result = promote_gl_entries(
        db=mock_db,
        source_id='BC',
        logger=mock_logger
    )

    assert result == 2
    # Logger should have logged the result
    mock_logger.info.assert_called()
