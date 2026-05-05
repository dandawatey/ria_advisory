# Feature: ERP-SP-002 — Conflict Resolution

**Created:** 2026-04-29
**Ticket:** ERP-SP-002
**Type:** Feature
**Phase:** Phase 2
**Priority:** Medium
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Handle period locks (closed ERP periods), overlapping sync time ranges, restatement detection (prior-period entries changed), and duplicate entry prevention. Later sync run is authoritative for overlapping ranges.

### Why
Financial periods get locked after month-end close. Pulling a locked period repeatedly wastes resources and may return stale data. Restatements (prior-period corrections) must be detected and propagated to dashboards — a CFO cannot rely on data that has been restated without notification.

### Acceptance Criteria
- AC: Period lock detected from ERP API; locked-period data marked `is_final=true`; not re-fetched
- AC: Overlapping sync ranges: later run's data takes precedence
- AC: Restatement detected: prior-period entries modified in ERP → detect change → reprocess period → notify CFO
- AC: Idempotent upsert eliminates true duplicates

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/conflict_service.py

def handle_period_lock(erp_source_id, period):
  lock_status = connector.get_period_lock_status(period)
  if lock_status.is_locked:
    db.update(fact_gl_entries, 
      {is_final=True}, 
      WHERE {erp_source_id, period})
    db.update(dim_erp_source,
      {locked_periods: append(period)})
    # skip re-sync for this period
    return SyncDecision.SKIP

def detect_restatement(erp_source_id, period) -> bool:
  # Compare checksum of ERP period data vs stored data
  erp_checksum = connector.compute_period_checksum(period)
  stored_checksum = db.get_stored_checksum(erp_source_id, period)
  if erp_checksum != stored_checksum:
    trigger_restatement_reprocessing(erp_source_id, period)
    notify_cfo_restatement(erp_source_id, period)
    return True
  return False

def resolve_overlap(sync_run_a, sync_run_b):
  # Later run (by completed_at) wins for overlapping period
  authoritative = max(sync_run_a, sync_run_b, key=lambda r: r.completed_at)
  discard = [r for r in [sync_run_a, sync_run_b] if r != authoritative]
  for run in discard:
    db.flag_entries_from_run(run.sync_id, superseded=True)
```

### Frontend
- Restatement alert banner on dashboard: "Period Mar 2026 has been restated in SAP. Data updated."
- Period lock indicator on reconciliation page

---

## A — Architecture

### New Files
- `03_Backend/services/conflict_service.py`

### Modified Files
- `03_Backend/workers/sync_worker.py` — call conflict checks pre/post sync
- `03_Backend/database.py` — `is_final`, `is_superseded` columns on `fact_gl_entries`

### DB / API changes
`fact_gl_entries` + columns: `is_final BOOLEAN`, `is_superseded BOOLEAN`.
`dim_erp_source` + column: `locked_periods JSONB`.

---

## R — Refinement

### Edge Cases
- ERP API doesn't expose period lock status (Odoo, Tally): infer from `date_lock` field or skip detection
- Restatement in locked period: flag as anomaly — locked period should not change
- Large restatement: entire year restated → trigger full-period reprocessing job

### Security
- Restatement notifications include: what changed, how much, which account
- Restatement audit trail preserved — original + restated values kept

### Performance
- Checksum comparison: aggregate sum of debit/credit per period per account — fast SQL
- Restatement reprocessing: treated as mini-backfill for affected period

---

## C — Completion

### Done Criteria
- [ ] Period lock detection and is_final marking
- [ ] Locked periods skipped on subsequent syncs
- [ ] Restatement detection via period checksum
- [ ] CFO notification on restatement
- [ ] Overlap resolution: later run authoritative

### Test Plan
- Lock period in ERP mock → verify is_final set, period skipped next sync
- Modify prior-period entry in ERP mock → verify restatement detected + notification
- Create two overlapping syncs → verify earlier run entries marked is_superseded
