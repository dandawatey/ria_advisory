# Feature: ERP-CF-006 — Full Historical Backfill

**Created:** 2026-04-29
**Ticket:** ERP-CF-006
**Type:** Feature
**Phase:** Phase 2
**Priority:** Medium
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
One-time bulk import of historical GL data per connector. Configurable range (default: last 5 years). Chunked parallel processing. Progress tracking with ETA. Pause/resume. Post-backfill validation report.

### Why
New connectors need historical data for YoY trend analysis and benchmarking. Without backfill, dashboards show only data from go-live date — useless for CFO decisions requiring multi-year view.

### Acceptance Criteria
- AC: Backfill configurable for 1–10 year range per connector
- AC: Processing chunked by month (12 chunks/year max) — no single request exceeds 90-second ERP timeout
- AC: Pause/resume: backfill stops cleanly; resumes from last completed chunk
- AC: Post-backfill validation report: record count, period coverage, currency breakdown, gap list
- AC: Backfill does not block incremental sync (separate worker queue)

---

## P — Pseudocode

### Backend
```
# 03_Backend/workers/backfill_worker.py

async def start_backfill(erp_source_id, from_year, to_year):
  chunks = generate_monthly_chunks(from_year, to_year)  # list of (from_date, to_date)
  job = create_backfill_job(erp_source_id, chunks)

  for chunk in chunks:
    if job.status == 'paused':
      break
    result = await process_chunk(erp_source_id, chunk)
    job.mark_chunk_done(chunk, result)
    emit_progress_event(job)

  if all chunks done:
    generate_validation_report(job)
    job.status = 'completed'

async def process_chunk(erp_source_id, chunk):
  connector = load_connector(erp_source_id)
  async for batch in connector.fetch_gl_entries(chunk.from_date, chunk.to_date):
    upsert_gl_entries(batch)
  return ChunkResult(records=count, period=chunk)

# API
POST /api/connectors/{id}/backfill  → start backfill {from_year, to_year}
GET  /api/connectors/{id}/backfill/status  → progress {done_chunks, total_chunks, eta, records}
POST /api/connectors/{id}/backfill/pause
POST /api/connectors/{id}/backfill/resume
GET  /api/connectors/{id}/backfill/report  → validation report
```

### Frontend
- Backfill section on Connector detail page
- Year range picker (from/to)
- Progress bar: chunks completed / total chunks
- ETA display
- Pause/Resume buttons
- Download validation report button

---

## A — Architecture

### New Files
- `03_Backend/workers/backfill_worker.py`
- `03_Backend/routers/backfill.py`
- `02_Frontend/src/components/connectors/BackfillPanel.tsx`

### Modified Files
- `03_Backend/main.py` — register backfill router

### DB / API changes
```sql
fact_backfill_job (
  job_id        UUID PRIMARY KEY,
  erp_source_id INT REFERENCES dim_erp_source,
  from_date     DATE,
  to_date       DATE,
  total_chunks  INT,
  done_chunks   INT,
  status        VARCHAR(20),  -- pending/running/paused/completed/failed
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  report_json   JSONB
)
```

---

## R — Refinement

### Edge Cases
- ERP rate limit during backfill: exponential backoff per chunk; pauses if too many 429s
- Partial month data (ERP goes live mid-month): handle partial period without error
- Very large entities (SAP ECC): chunk size reduce to week-level if month chunk times out

### Security
- Backfill runs as system job — no user credential in async context; uses vault service
- Only tenant admin can initiate backfill

### Performance
- Monthly chunks: 60 chunks for 5-year backfill
- Parallel chunks: max 2 concurrent (avoid ERP overload)
- Each chunk target: < 5 minutes

---

## C — Completion

### Done Criteria
- [ ] Backfill starts and processes month-by-month chunks
- [ ] Pause/resume working (resume from last done chunk)
- [ ] Progress % and ETA shown in UI
- [ ] Post-backfill validation report generated
- [ ] Backfill job runs in separate queue from incremental sync

### Test Plan
- Start 2-year backfill → pause mid-way → resume → verify no gaps
- Simulate ERP timeout on chunk 3 → verify retry + eventual success
- Verify validation report shows correct record count per period
