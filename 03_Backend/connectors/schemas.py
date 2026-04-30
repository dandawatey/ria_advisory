"""
connectors/schemas.py — Pydantic schemas for ERP connector data transfer
Agent: Meera_Architect_002  |  Ticket: IC-2
All connectors normalise to these schemas before DB insert.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, field_validator
from enum import Enum


class ERPConnectionStatus(str, Enum):
    connected = "connected"
    degraded = "degraded"
    disconnected = "disconnected"
    auth_expired = "auth_expired"
    disabled = "disabled"


class ConnectionStatus(BaseModel):
    status: ERPConnectionStatus
    latency_ms: Optional[int] = None
    message: Optional[str] = None
    checked_at: datetime = None

    def model_post_init(self, __context: Any) -> None:
        if self.checked_at is None:
            object.__setattr__(self, "checked_at", datetime.utcnow())


class SyncCursor(BaseModel):
    """Opaque cursor tracking last sync position. None = full sync needed."""
    cursor_value: Optional[Any] = None
    cursor_type: str = "timestamp"   # timestamp | page | offset | etag


class RawGLLine(BaseModel):
    """Single GL entry as fetched from ERP — debit-positive normalised."""
    journal_id: str
    line_number: str
    account_code: str
    account_name: Optional[str] = None
    debit_amount: float = 0.0
    credit_amount: float = 0.0
    currency: str                        # ISO 4217
    posting_date: date
    description: Optional[str] = None
    department_code: Optional[str] = None
    project_code: Optional[str] = None
    dimension_1: Optional[str] = None   # ERP-native dimension 1
    dimension_2: Optional[str] = None   # ERP-native dimension 2
    is_intercompany: bool = False
    raw_erp_fields: Optional[dict] = None  # passthrough for unmapped fields

    @field_validator("currency")
    @classmethod
    def currency_must_be_3_chars(cls, v: str) -> str:
        if len(v) != 3:
            raise ValueError(f"currency must be ISO 4217 (3 chars), got: {v!r}")
        return v.upper()


class RawAccount(BaseModel):
    """ERP chart-of-accounts entry."""
    account_code: str
    account_name: str
    account_type: Optional[str] = None   # Asset | Liability | Equity | Revenue | Expense
    parent_code: Optional[str] = None
    is_blocked: bool = False


class RawDimension(BaseModel):
    """ERP dimension value (department, project, cost centre, etc.)."""
    dimension_type: str    # department | project | cost_centre | geography
    code: str
    name: str
    parent_code: Optional[str] = None


class RawEntity(BaseModel):
    """Legal entity / company as defined in the ERP."""
    entity_id: str
    entity_name: str
    currency: str
    country: Optional[str] = None
    is_active: bool = True
