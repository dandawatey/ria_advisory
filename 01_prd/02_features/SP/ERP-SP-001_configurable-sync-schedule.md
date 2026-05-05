# Feature: ERP-SP-001 — Configurable Sync Schedule

**Created:** 2026-04-29
**Ticket:** ERP-SP-001
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Per-connector schedule configuration: real-time webhook (BC, D365F, S4 Cloud), hourly polling (Oracle, Odoo), daily at configurable time (JDE, ECC, Tally), on-demand manual. Business hours restriction option. Serialized sync queue per connector. Timezone-aware scheduling.

### Why
Different ERPs support different sync frequencies. Real-time where possible, polling where webhooks are unavailable. Scheduling respects ERP maintenance windows and off-peak hours to avoid impacting ERP production performance.

### Acceptance Criteria
- AC-09: Sync runs within ±5 minutes of configured schedule
- AC: On-demand manual trigger works from UI and API
- AC: Queue serialized — no concurrent sync for same connector
- AC: Business hours filter: sync only between configured hours
- AC: Schedule timezone-aware: can run at 02:00 ERP server time

---

## P — Pseudocode

### Backend
```
# 03_Backend/workers/scheduler.py

class SyncScheduler:
  scheduler: APScheduler  # AsyncIOScheduler

  def configure_connector(erp_source_id, schedule_config: ScheduleConfig):
    # Remove old job if exists
    scheduler.remove_job(f"sync_{erp_source_id}", missing_ok=True)

    if schedule_config.type == 'webhook':
      # No scheduled job; webhook handler triggers sync
      pass
    elif schedule_config.type == 'hourly':
      scheduler.add_job(
        run_sync, 'interval', hours=1,
        id=f"sync_{erp_source_id}", args=[erp_source_id]
      )
    elif schedule_config.type == 'daily':
      scheduler.add_job(
        run_sync, 'cron',
        hour=schedule_config.hour, minute=schedule_config.minute,
        timezone=schedule_config.timezone,
        id=f"sync_{erp_source_id}", args=[erp_source_id]
      )

  async def run_sync(erp_source_id):
    # Check business hours
    if not is_within_business_hours(erp_source_id):
      log("Skipping sync outside business hours")
      return

    # Serialized queue: skip if sync already running
    if sync_lock.is_locked(erp_source_id):
      log("Sync already running, skipping")
      return

    async with sync_lock.acquire(erp_source_id):
      await sync_worker.run_incremental_sync(erp_source_id)

# Webhook receiver
POST /webhooks/bc/{tenant_id} → trigger sync for BC connector
POST /webhooks/sap/{tenant_id} → trigger sync for SAP connector

# Manual trigger
POST /api/connectors/{id}/sync
  → rate limit: 1 per 5 minutes
  → queue sync job immediately
```

### Frontend
- Schedule configuration step in Add Connector Wizard (ERP-CF-004 wizard)
- Options: Real-time / Hourly / Daily (time picker + timezone) / Manual only
- Business hours toggle: Mon–Fri, 18:00–06:00 server time
- "Sync Now" button on connector detail page

---

## A — Architecture

### New Files
- `03_Backend/workers/scheduler.py` — APScheduler wrapper + sync_lock
- `03_Backend/routers/webhooks.py` — webhook endpoints for BC, SAP

### Modified Files
- `03_Backend/main.py` — start scheduler on startup; register webhook routes
- `03_Backend/database.py` — `schedule_config JSONB` column on `dim_erp_source`

### DB / API changes
`dim_erp_source` + column: `schedule_config JSONB` (stores schedule type, time, timezone, business_hours).

---

## R — Refinement

### Edge Cases
- Scheduler restart: reload all active schedule configs from DB on startup
- ERP maintenance window: if sync fails during maintenance → retry after window, not immediate
- Two manual triggers within 5 minutes → rate limit second; return 429
- Timezone DST transition: APScheduler handles DST with pytz; use `UTC` internally, display in local tz

### Security
- Webhook endpoints validate HMAC signature (BC webhooks support HMAC)
- Rate limit on manual trigger prevents abuse

### Performance
- APScheduler in-process — lightweight for < 100 connectors
- If > 100 connectors: migrate to Celery Beat + Redis

---

## C — Completion

### Done Criteria
- [ ] APScheduler starts on app startup
- [ ] Connector schedule persisted in DB; survives app restart
- [ ] Daily, hourly, webhook, manual modes working
- [ ] Sync queue serialized — no concurrent runs per connector
- [ ] Business hours filter working
- [ ] Manual trigger with rate limiting

### Test Plan
- Configure daily sync at 02:00 UTC → verify job created in scheduler
- Restart app → verify job still active (loaded from DB)
- Trigger two manual syncs within 5 min → second returns 429
- Set business hours 09:00–18:00 → trigger at 22:00 → verify skipped
- Simulate concurrent sync → verify second run skipped by lock
