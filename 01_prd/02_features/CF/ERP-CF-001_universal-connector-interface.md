# Feature: ERP-CF-001 — Universal Connector Interface

**Created:** 2026-04-29
**Ticket:** ERP-CF-001
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** Critical
**Owner:** Meera_Architect_002
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Define a standard Python abstract base class (ABC) that every ERP adapter must implement. All 7 ERP connectors inherit from this interface. Guarantees uniform calling convention across BC, SAP, Odoo, D365F, JDE, Oracle, Tally.

### Why
Without a common interface, each connector is a bespoke integration. Adding a new ERP requires pipeline rewrites. With the interface, adding ERP = implementing ~7 methods. Decouples normalization layer from ERP specifics.

### Acceptance Criteria
- AC-01: Abstract class `ERPConnector` defined with 7 required methods — connect, test_connection, fetch_coa, fetch_gl_entries, fetch_dimensions, fetch_entities, get_sync_cursor
- AC-02: Instantiating ERPConnector directly raises `TypeError`
- AC-03: Any concrete adapter that omits a required method raises `TypeError` on instantiation
- AC-04: `fetch_gl_entries` returns paginated iterator yielding dicts in raw source schema
- AC-05: `test_connection()` returns `{status: str, latency_ms: int, error: str|None}` within 10s

---

## P — Pseudocode

### Backend
```
# 03_Backend/connectors/base.py
abstract class ERPConnector:
  abstract connect(credentials: dict) -> None
  abstract test_connection() -> ConnectionStatus
  abstract fetch_coa() -> list[RawAccount]
  abstract fetch_gl_entries(from_date, to_date, ledger_id?) -> Iterator[RawGLLine]
  abstract fetch_dimensions() -> list[RawDimension]
  abstract fetch_entities() -> list[RawEntity]
  abstract get_sync_cursor() -> SyncCursor

dataclass ConnectionStatus:
  status: Literal['connected','degraded','disconnected','auth_expired']
  latency_ms: int
  error: str | None

dataclass SyncCursor:
  cursor_type: Literal['timestamp','journal_id','sequence']
  value: str
  as_of: datetime
```

### Frontend
No frontend for this feature — pure backend contract.

---

## A — Architecture

### New Files
- `03_Backend/connectors/__init__.py`
- `03_Backend/connectors/base.py` — ERPConnector ABC + dataclass definitions
- `03_Backend/connectors/schemas.py` — RawGLLine, RawAccount, RawDimension, RawEntity Pydantic models

### Modified Files
- `03_Backend/main.py` — register connector router

### DB / API changes
None at this stage — interface only.

---

## R — Refinement

### Edge Cases
- Connector must handle ERP timeout gracefully — raise `ConnectorTimeoutError`
- `fetch_gl_entries` must be a generator (not load all into memory) — mandatory for SAP billions-of-rows scenario
- `connect()` must be idempotent — calling twice must not create duplicate sessions

### Security
- `credentials` dict must never be logged — scrub before any log call
- Connector holds no state between requests beyond session token

### Performance
- `fetch_gl_entries` chunks by configurable page size (default 1000 rows)
- `test_connection()` has 10-second hard timeout — no hanging health checks

---

## C — Completion

### Done Criteria
- [ ] `ERPConnector` ABC implemented with all 7 methods
- [ ] `RawGLLine` Pydantic schema defined with all required fields
- [ ] `ConnectionStatus` and `SyncCursor` dataclasses defined
- [ ] Unit tests: ABC enforcement, schema validation, timeout behavior
- [ ] Type hints on all methods; mypy passes

### Test Plan
- Instantiate ERPConnector directly → expect TypeError
- Create stub that omits 1 method → expect TypeError
- Create valid stub → test_connection() returns ConnectionStatus
- fetch_gl_entries() is generator → assert no full materialization
