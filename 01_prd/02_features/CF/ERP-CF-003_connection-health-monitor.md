# Feature: ERP-CF-003 — Connection Health Monitor

**Created:** 2026-04-29
**Ticket:** ERP-CF-003
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Background service that heartbeat-checks every active ERP connector every 15 minutes. Tracks health states (Connected / Degraded / Disconnected / Auth_Expired), records p50/p95 latency, triggers alerts on state change to Disconnected.

### Why
CFO dashboards are only trustworthy if data is fresh. Silent connector failure = stale data with no warning. Health monitor provides operational visibility without manual checking.

### Acceptance Criteria
- AC-05: Disconnection detected within 20 minutes; alert sent within 5 minutes of detection
- AC: Health state visible per ERP per entity on Connector Management page
- AC: Latency p50/p95 tracked and displayed
- AC: Alert sent via email + in-app notification on Disconnected state
- AC: State history retained for 30 days

---

## P — Pseudocode

### Backend
```
# 03_Backend/workers/health_monitor.py

async def run_heartbeat_loop():
  every 15 minutes:
    connectors = db.query("SELECT * FROM dim_erp_source WHERE connection_status != 'disabled'")
    for connector in connectors (parallel):
      result = await check_health(connector)
      update_health_state(connector, result)

async def check_health(connector) -> HealthResult:
  start = now()
  try:
    status = await connector_instance.test_connection()  # 10s timeout
    latency = now() - start
    return HealthResult(status='connected', latency_ms=latency)
  except AuthError:
    return HealthResult(status='auth_expired')
  except TimeoutError:
    return HealthResult(status='degraded', latency_ms=10000)
  except Exception:
    return HealthResult(status='disconnected')

def update_health_state(connector, result):
  prev_status = connector.connection_status
  db.update(dim_erp_source, {connection_status: result.status, last_heartbeat_at: now()})
  record_latency(connector.erp_source_id, result.latency_ms)
  if prev_status != 'disconnected' and result.status == 'disconnected':
    trigger_alert(connector, result)

# API endpoint
GET /api/connectors/{erp_source_id}/health
→ {status, last_heartbeat_at, latency_p50_ms, latency_p95_ms, history[]}
```

### Frontend
- Connector Management page: status badge per connector (green/yellow/red/gray)
- Tooltip on badge: last heartbeat time, latency p50/p95
- In-app notification bell: alert on Disconnected
- Health history chart (30 days) on connector detail page

---

## A — Architecture

### New Files
- `03_Backend/workers/health_monitor.py` — heartbeat loop
- `03_Backend/routers/health.py` — `/api/connectors/{id}/health` endpoint
- `02_Frontend/src/components/connectors/HealthBadge.tsx` — reusable status badge

### Modified Files
- `03_Backend/main.py` — start health monitor on startup (asyncio background task)
- `03_Backend/database.py` — add `fact_connector_health_log` table

### DB / API changes
```sql
fact_connector_health_log (
  log_id        SERIAL PRIMARY KEY,
  erp_source_id INT REFERENCES dim_erp_source,
  checked_at    TIMESTAMPTZ DEFAULT NOW(),
  status        VARCHAR(20),
  latency_ms    INT,
  error_msg     TEXT
)
```

---

## R — Refinement

### Edge Cases
- ERP in maintenance window: treat repeated Degraded as expected; do not escalate if maintenance_window configured
- Multiple connectors same ERP type: check each independently (one failing ≠ all failing)
- Alert deduplication: do not re-alert on every heartbeat if already in Disconnected state — alert once per state transition

### Security
- Heartbeat uses same credential as sync — verifies credential validity too
- Health endpoint requires auth — no public exposure of connector status

### Performance
- All heartbeats run in parallel (asyncio.gather) — 15-minute window must complete in < 5 minutes for up to 50 connectors
- Latency history stored as rolling 30-day window; older rows purged daily

---

## C — Completion

### Done Criteria
- [ ] Heartbeat loop runs every 15 minutes
- [ ] All 4 health states correctly assigned
- [ ] Alert fires on Connected → Disconnected transition
- [ ] p50/p95 latency calculated from last 100 checks
- [ ] Health badge component renders in Connector Management page
- [ ] State history retained 30 days

### Test Plan
- Mock connector returning AuthError → state = auth_expired
- Simulate 3 consecutive timeouts → state = disconnected, alert fired
- Verify alert deduplicated (fires once not 3 times)
- Latency p95 calculation with 100 synthetic latency values
