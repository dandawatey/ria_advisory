# Feature: ERP-SP-003 — Audit Trail

**Created:** 2026-04-29
**Ticket:** ERP-SP-003
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Immutable log of every sync event (connector, entity, trigger source, timing, record counts, status). Also logs: credential changes, mapping changes, schedule changes. Accessible via Sync History page. Exportable as CSV/PDF for compliance. No deletes allowed on audit log.

### Why
External auditors require data lineage proof: where did this number come from, when was it synced, has it been changed. SOC2 Type 2 requires demonstrable audit controls on data ingestion pipelines.

### Acceptance Criteria
- AC-11: Every sync execution recorded in `fact_sync_log` (success, partial, failed)
- AC: Log is immutable — no delete, no update on `fact_sync_log`
- AC: Records: connector, entity, triggered_by, start/end time, status, record counts, error
- AC: Who-what-when for credential changes, mapping changes, schedule changes
- AC: Export as CSV from Sync History page

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/audit_service.py

class AuditService:

  def log_sync(erp_source_id, sync_type, triggered_by,
               period_from, period_to) -> UUID:
    sync_id = gen_uuid()
    db.insert(fact_sync_log, {
      sync_id, erp_source_id, sync_type, triggered_by,
      period_from, period_to, started_at: now(), status: 'running',
      records_fetched: 0, records_inserted: 0,
      records_updated: 0, records_rejected: 0
    })
    return sync_id

  def finalize_sync(sync_id, status, records, error=None):
    # UPDATE is allowed only to finalize a running sync
    db.execute("""
      UPDATE fact_sync_log
      SET status=:status, completed_at=NOW(),
          records_fetched=:fetched, records_inserted=:inserted,
          records_updated=:updated, records_rejected=:rejected,
          error_message=:error
      WHERE sync_id=:sync_id AND status='running'
    """)

  def log_config_change(entity_type, entity_id, field, old_val, new_val, user_id):
    db.insert(fact_audit_log, {
      entity_type, entity_id, field,
      old_value: old_val, new_value: new_val,
      changed_by: user_id, changed_at: now()
    })

# API
GET /api/connectors/{id}/sync-history
  → paginated list of fact_sync_log rows

GET /api/connectors/{id}/sync-history/export
  → CSV download (streaming)

GET /api/audit-log?entity_type=credential&from=...&to=...
  → config change history
```

### Frontend
- Sync History page: `/settings/connectors/:id/sync-history`
- Table: Run ID | Type | Triggered By | Start | End | Status | Records | Error
- Export button → CSV download
- Audit log page for config changes (credential/mapping/schedule)

---

## A — Architecture

### New Files
- `03_Backend/services/audit_service.py`
- `03_Backend/routers/audit.py` — `/api/connectors/{id}/sync-history`, export
- `02_Frontend/src/pages/56_F056_SyncHistory.tsx`

### Modified Files
- `03_Backend/workers/sync_worker.py` — call audit_service at start/end of every sync

### DB / API changes
`fact_sync_log` table (see PRD §6.1).
```sql
fact_audit_log (
  log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(50),   -- 'credential', 'mapping', 'schedule', 'connector'
  entity_id     VARCHAR(100),
  field         VARCHAR(100),
  old_value     TEXT,
  new_value     TEXT,
  changed_by    VARCHAR(100),
  changed_at    TIMESTAMPTZ DEFAULT NOW()
)
-- No DELETE privilege granted on fact_sync_log or fact_audit_log at DB level
```

---

## R — Refinement

### Edge Cases
- App crash mid-sync: `started_at` set but no `completed_at` → stale 'running' status → mark as 'failed' on restart
- Very high volume: 1000+ syncs/day at scale → partition `fact_sync_log` by month
- Export for large date ranges → streaming CSV (no full materialization in memory)

### Security
- `fact_sync_log` and `fact_audit_log`: DB user has INSERT + SELECT only — no UPDATE (except finalize), no DELETE
- Export requires `audit:read` permission
- PII in error messages: scrub any credential values before storing in `error_message`

### Performance
- Sync log write: async — does not block sync pipeline
- History API: paginated, default 50 rows, max 500

---

## C — Completion

### Done Criteria
- [ ] `fact_sync_log` created with all required columns
- [ ] `fact_audit_log` created for config changes
- [ ] Every sync writes start + finalize records
- [ ] Stale 'running' jobs cleaned up on startup
- [ ] Sync History page renders with all columns
- [ ] CSV export working (streaming)
- [ ] DB permissions: no DELETE on audit tables

### Test Plan
- Run sync → verify `fact_sync_log` row with correct counts
- Simulate crash (kill mid-sync) → restart → verify status corrected to 'failed'
- Change mapping → verify `fact_audit_log` row with old/new values
- Export 1000 rows as CSV → verify all rows present, correct format
- Attempt DELETE on fact_sync_log via DB → expect permission denied
