# Feature: ERP-CF-005 — Incremental Sync (Delta Load)

**Created:** 2026-04-29
**Ticket:** ERP-CF-005
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** Critical
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Pull only new/modified GL entries since last sync cursor (journal ID, modified timestamp, or sequence number). Handles late-arriving back-dated postings via configurable lookback window (default 7 days). Idempotent upsert on natural key. Triggers CoA re-sync on master data change detection.

### Why
Full sync of large ERP datasets (SAP ECC billions of rows) is infeasible daily. Delta load keeps sync fast (< 2 hours latency target) while ensuring completeness including late postings.

### Acceptance Criteria
- AC-09: Incremental sync completes within scheduled window (±5 min)
- AC: Only records newer than last cursor fetched (verified by count comparison)
- AC: Late-arriving entries within 7-day lookback window captured
- AC: Duplicate entries not created — upsert on `(erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number)`
- AC: Sync cursor updated atomically with record insert

---

## P — Pseudocode

### Backend
```
# 03_Backend/workers/sync_worker.py

async def run_incremental_sync(erp_source_id: int):
  connector = load_connector(erp_source_id)
  cursor = db.get_sync_cursor(erp_source_id)

  # lookback = max(cursor.timestamp - 7 days, last_period_lock_date)
  from_date = cursor.timestamp - timedelta(days=LOOKBACK_DAYS)
  to_date = now()

  sync_log = create_sync_log(erp_source_id, 'incremental', from_date, to_date)

  try:
    async for batch in connector.fetch_gl_entries(from_date, to_date):
      normalized = normalize_batch(batch)  # → calls ERP-DN-* layer
      upsert_gl_entries(normalized)        # ON CONFLICT (natural_key) DO UPDATE
      sync_log.records_fetched += len(batch)

    # check for master data changes
    if connector.coa_changed_since(cursor):
      trigger_coa_resync(erp_source_id)

    new_cursor = connector.get_sync_cursor()
    db.update_cursor(erp_source_id, new_cursor)
    finalize_sync_log(sync_log, status='success')

  except Exception as e:
    finalize_sync_log(sync_log, status='failed', error=str(e))
    raise

def upsert_gl_entries(records):
  sql = """
    INSERT INTO fact_gl_entries (...) VALUES (...)
    ON CONFLICT (erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number)
    DO UPDATE SET ...
  """
```

### Frontend
- Sync History page (ERP-CF-004 wizard) shows last incremental run stats
- Manual trigger button: "Sync Now" → POST /api/connectors/{id}/sync

---

## A — Architecture

### New Files
- `03_Backend/workers/sync_worker.py` — core sync logic
- `03_Backend/workers/scheduler.py` — APScheduler / Celery Beat wrapper

### Modified Files
- `03_Backend/database.py` — add cursor tracking to `dim_erp_source`; upsert logic in `fact_gl_entries`
- `03_Backend/routers/connectors.py` — POST `/api/connectors/{id}/sync` manual trigger

### DB / API changes
- `dim_erp_source` + columns: `sync_cursor JSONB`, `last_synced_at TIMESTAMPTZ`
- `fact_gl_entries` — unique constraint on `(erp_source_id, entity_id, erp_native_journal_id, erp_native_line_number)`
- `fact_sync_log` table (see PRD §6.1)

---

## R — Refinement

### Edge Cases
- ERP returns entries out of order (by posting date) — sort by erp_native_journal_id not date
- Period locked after sync started — mark those records as `is_final=true`; skip on next lookback
- Partial batch failure — wrap each batch in savepoint; rollback only failed batch
- Cursor rollback: if sync fails mid-run, keep old cursor — do NOT advance past successful point

### Security
- Sync triggered only by scheduler or authenticated users with `sync:write` permission
- Rate limit manual sync: max 1 per 5 minutes per connector

### Performance
- Batch size configurable per ERP (default 1000, SAP 500, Tally 100)
- Parallel batch normalization (thread pool, max 4 workers)
- Target: 100k records in < 10 minutes

---

## C — Completion

### Done Criteria
- [ ] Incremental sync pulls only delta since cursor
- [ ] Lookback window applied (7 days default, configurable)
- [ ] Upsert on natural key — no duplicates
- [ ] Cursor updated atomically post-sync
- [ ] Sync log written for every run (success/partial/failed)
- [ ] Manual trigger endpoint working
- [ ] CoA re-sync triggered on master data change

### Test Plan
- Seed 1000 GL entries → run sync → verify 1000 inserted
- Run same sync again → verify 0 new records (idempotent)
- Add 50 back-dated entries (within 7-day window) → re-run → verify 50 captured
- Add entry outside lookback → verify NOT captured
- Force error mid-batch → verify cursor not advanced
