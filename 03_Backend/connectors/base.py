"""
connectors/base.py — ERPConnector Abstract Base Class
Agent: Meera_Architect_002  |  Ticket: IC-2
Every ERP connector MUST extend this class and implement all 7 methods.
Attempting to instantiate ERPConnector directly → TypeError.
Attempting to subclass without all methods → TypeError.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from datetime import date
from typing import Iterator
from connectors.schemas import (
    RawGLLine, RawAccount, RawDimension, RawEntity,
    ConnectionStatus, SyncCursor
)


class ConnectorTimeoutError(Exception):
    """Raised when ERP API call exceeds configured timeout."""


class ConnectorAuthError(Exception):
    """Raised when ERP credentials are invalid or expired."""


class ConnectorRateLimitError(Exception):
    """Raised when ERP API rate limit is hit. Includes retry_after_seconds."""
    def __init__(self, message: str, retry_after_seconds: int = 60):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class DataValidationError(Exception):
    """Raised when ERP data fails Pydantic schema validation."""


class ERPConnector(ABC):
    """
    Abstract base for all ERP connectors.

    Subclasses MUST implement all 7 abstract methods.
    fetch_gl_entries MUST be a generator (yield, not return list).
    test_connection MUST complete within 10 seconds.

    Error handling contract:
      ConnectorTimeoutError  → retry (ERP-SP-004)
      ConnectorAuthError     → no retry; mark auth_expired; alert
      ConnectorRateLimitError → wait retry_after_seconds; retry
      DataValidationError    → no retry; dead-letter queue
    """

    @abstractmethod
    def connect(self, credentials: dict) -> None:
        """
        Establish connection using credentials dict from vault.
        Credentials dict is ephemeral — do not store on self beyond session.
        """

    @abstractmethod
    def test_connection(self) -> ConnectionStatus:
        """
        Verify connectivity and auth. Must complete within 10 seconds.
        Returns ConnectionStatus with latency measurement.
        Raises ConnectorAuthError if credentials invalid.
        Raises ConnectorTimeoutError if no response within 10s.
        """

    @abstractmethod
    def fetch_coa(self) -> list[RawAccount]:
        """
        Fetch full chart of accounts. Returns list (not generator — CoA is small).
        """

    @abstractmethod
    def fetch_gl_entries(self, from_date: date, to_date: date) -> Iterator[RawGLLine]:
        """
        Fetch GL entries for date range. MUST be a generator (yield).
        Never load full dataset into memory.
        Apply ERP-specific posted-only filter (BC: postingDate ne null, Odoo: parent_state=posted).
        Normalise to debit-positive before yielding.
        """

    @abstractmethod
    def fetch_dimensions(self) -> list[RawDimension]:
        """Fetch all active dimension values (departments, projects, cost centres)."""

    @abstractmethod
    def fetch_entities(self) -> list[RawEntity]:
        """Fetch all legal entities / companies defined in this ERP source."""

    @abstractmethod
    def get_sync_cursor(self) -> SyncCursor:
        """
        Return the current sync cursor position.
        Used by incremental sync to know where last sync ended.
        Returns SyncCursor(cursor_value=None) for fresh/full sync.
        """
