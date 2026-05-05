# Feature: ERP-SP-004 — Failed Sync Alerts & Retry Logic

**Created:** 2026-04-29
**Ticket:** ERP-SP-004
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Exponential backoff retry for failed syncs. Failure categorization: auth failure (no retry), network timeout (retry), validation error (no retry, alert), rate limit (retry after cooldown). Partial success (≥90% records synced = Partial not Failed). Escalation after 3 consecutive failures. Dead letter queue for failed records.

### Why
ERP connections are inherently unreliable (network blips, auth expiry, rate limits). Silent failures mean stale data without CFO awareness. Retry logic recovers transient failures automatically. Escalation ensures humans are notified before data becomes critically stale.

### Acceptance Criteria
- AC-10: Failed sync triggers retry within 1 minute; after 3 failures, admin alert within 5 minutes
- AC: Retry schedule: 1 min → 5 min → 15 min → 1 hour → 4 hours (max 5 retries)
- AC: Auth failure: no retry; immediate alert + mark connector as auth_expired
- AC: Rate limit: retry after rate-limit cooldown period (from API response headers)
- AC: ≥90% records synced → status = 'partial' (not 'failed')
- AC: Dead letter queue stores failed records for manual review/replay

---

## P — Pseudocode

### Backend
```
# 03_Backend/workers/sync_worker.py + retry_service.py

RETRY_INTERVALS = [60, 300, 900, 3600, 14400]  # seconds

class RetryService:

  async def execute_with_retry(erp_source_id):
    for attempt, delay in enumerate(RETRY_INTERVALS):
      try:
        result = await run_incremental_sync(erp_source_id)
        reset_consecutive_failures(erp_source_id)
        return result

      except AuthError:
        # No retry — auth must be fixed first
        mark_auth_expired(erp_source_id)
        send_alert(erp_source_id, 'auth_expired', urgent=True)
        return

      except RateLimitError as e:
        cooldown = e.retry_after_seconds or 3600
        await asyncio.sleep(cooldown)
        continue  # retry immediately after cooldown

      except (NetworkError, TimeoutError):
        increment_consecutive_failures(erp_source_id)
        failures = get_consecutive_failures(erp_source_id)
        if failures >= 3:
          send_escalation_alert(erp_source_id)
        if attempt < len(RETRY_INTERVALS) - 1:
          await asyncio.sleep(delay)
          continue
        else:
          send_alert(erp_source_id, 'max_retries_exceeded')
          return

      except DataValidationError as e:
        # No retry — data issue, not transient
        store_dead_letter(erp_source_id, e.failed_records)
        send_alert(erp_source_id, 'validation_error', details=e)
        return

  def evaluate_partial_success(records_fetched, records_rejected) -> str:
    if records_rejected == 0:
      return 'success'
    success_rate = (records_fetched - records_rejected) / records_fetched
    if success_rate >= 0.90:
      return 'partial'
    return 'failed'

# Dead letter queue
def store_dead_letter(erp_source_id, failed_records):
  for record in failed_records:
    db.insert(fact_sync_dead_letter, {erp_source_id, record, failed_at: now()})

# Alerts
def send_alert(erp_source_id, alert_type, urgent=False):
  email_alert(connector.admin_email, alert_type, connector_info)
  in_app_notification(connector.tenant_id, alert_type, connector_info)
  if urgent:
    slack_webhook(alert_type, connector_info)  # if configured
```

### Frontend
- Alert bell icon in header: shows unread connector alerts
- Alert detail page: connector name, failure type, timestamp, retry count
- Dead letter queue viewer (admin): list of failed records with raw data + error

---

## A — Architecture

### New Files
- `03_Backend/services/retry_service.py`
- `03_Backend/services/alert_service.py` — email + in-app notifications
- `03_Backend/routers/alerts.py` — `/api/alerts` endpoint
- `02_Frontend/src/components/notifications/AlertBell.tsx`

### Modified Files
- `03_Backend/workers/sync_worker.py` — wrap execution in retry_service
- `03_Backend/main.py` — register alerts router

### DB / API changes
```sql
fact_sync_dead_letter (
  dlq_id        UUID PRIMARY KEY,
  erp_source_id INT REFERENCES dim_erp_source,
  raw_record    JSONB,
  error_message TEXT,
  failed_at     TIMESTAMPTZ,
  replayed_at   TIMESTAMPTZ,
  replay_status VARCHAR(20)
)

fact_connector_alerts (
  alert_id      UUID PRIMARY KEY,
  erp_source_id INT REFERENCES dim_erp_source,
  tenant_id     UUID,
  alert_type    VARCHAR(50),
  details       JSONB,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)
```

---

## R — Refinement

### Edge Cases
- Retry queue fills up: cap at 5 retries total — beyond that, enter dead state requiring manual intervention
- Alert email bounces: log delivery failure; don't retry alert infinitely
- Partial success with 50% rejected: status='failed', not partial; store all rejected in DLQ
- Connector deleted while retry pending: cancel pending retries

### Security
- Alert emails: no raw error stack traces in email body (may leak infrastructure info)
- DLQ records may contain sensitive GL data — access restricted to tenant admin

### Performance
- Retry jobs run in background worker — do not block scheduler thread
- DLQ cleanup: records > 90 days old archived/deleted automatically

---

## C — Completion

### Done Criteria
- [ ] Exponential backoff retry working (5 attempts)
- [ ] Auth failure: no retry, immediate alert
- [ ] Rate limit: respects retry-after header
- [ ] Partial success: 90% threshold correctly classified
- [ ] Dead letter queue storing failed records
- [ ] Email + in-app alert on 3rd consecutive failure
- [ ] Alert deduplication (one alert per state, not per retry)

### Test Plan
- Simulate auth error → verify no retry, connector status=auth_expired, alert sent
- Simulate 3 network timeouts → verify 3 retries at 1/5/15 min intervals, escalation alert
- Submit 1000 records, 95 fail → verify status='partial', 95 in DLQ
- Submit 1000 records, 150 fail → verify status='failed', 150 in DLQ
- Replay DLQ record after fixing issue → verify successfully inserted
