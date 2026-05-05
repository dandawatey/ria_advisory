# Feature: ERP-RV-002 — Variance Alerts

**Created:** 2026-04-29
**Ticket:** ERP-RV-002
**Type:** Feature
**Phase:** Phase 2
**Priority:** Medium
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Configure variance rules: alert if account balance changes > X% period-over-period. Alert if same entity same period differs between two ERP syncs. Unusual posting detection: outside business hours, round-number transactions above threshold, entries by inactive users. Configurable thresholds per account category.

### Why
Variance alerts catch data integrity issues (sync errors, wrong account mappings) and potential fraud indicators (unusual postings) before they reach CFO dashboards or external auditors.

### Acceptance Criteria
- AC: PoP variance rule: alert when account moves > configured % vs prior period
- AC: Cross-sync integrity: alert if same period data differs between sync runs (restatement or error)
- AC: Unusual posting detection: round numbers > AED 100k, entries at 02:00–05:00 system time
- AC: Alert thresholds configurable per canonical account category (L2)
- AC: Alerts delivered via email + in-app; configurable per rule

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/variance_alert_service.py

def run_pop_variance_check(erp_source_id, period):
  current = get_period_balances(erp_source_id, period)
  prior = get_period_balances(erp_source_id, prior_period(period))

  for account, curr_bal in current.items():
    prior_bal = prior.get(account, 0)
    if prior_bal == 0:
      continue
    variance_pct = abs(curr_bal - prior_bal) / abs(prior_bal) * 100
    threshold = get_threshold(account.canonical_l2)

    if variance_pct > threshold:
      create_alert(
        type='pop_variance',
        erp_source_id=erp_source_id,
        account=account,
        period=period,
        variance_pct=variance_pct,
        threshold=threshold
      )

def detect_unusual_postings(erp_source_id, period):
  entries = get_gl_entries(erp_source_id, period)
  for entry in entries:
    # Round number + large amount
    if entry.amount % 1000 == 0 and entry.amount > ROUND_NUMBER_THRESHOLD:
      create_alert(type='unusual_round_number', entry=entry)
    # Outside business hours (2am-5am)
    if 2 <= entry.posted_hour <= 5:
      create_alert(type='unusual_posting_time', entry=entry)

# Configurable thresholds stored in DB
dim_variance_rules (
  rule_id, tenant_id, canonical_l2,
  pop_threshold_pct, round_number_threshold,
  alert_email, is_active
)
```

### Frontend
- Variance Rules config page: `/settings/variance-rules`
- Alerts list: `/analytics/alerts` (filterable by type)
- Alert detail: entry details + suggested action

---

## A — Architecture

### New Files
- `03_Backend/services/variance_alert_service.py`
- `03_Backend/routers/variance_rules.py`
- `02_Frontend/src/pages/64_F064_VarianceAlerts.tsx`

### Modified Files
- `03_Backend/workers/sync_worker.py` — trigger variance checks post-sync

### DB / API changes
Table `dim_variance_rules` (above). Alerts stored in `fact_connector_alerts` (shared with ERP-SP-004).

---

## R — Refinement

### Edge Cases
- New account (no prior period): skip PoP check; create informational "new account" alert
- Seasonal variance (e.g., Q4 always spikes): allow exception periods per rule
- Alert flood: if 50+ accounts trigger same rule same day, batch into single digest

### Security
- Unusual posting time: post time from ERP metadata, not i-finsights ingestion time
- Alert content: no full GL data in alert; link to drill-down only

### Performance
- Variance checks: SQL aggregation, run post-sync (async)
- Alert deduplication: one alert per account per period per rule

---

## C — Completion

### Done Criteria
- [ ] PoP variance rule engine working
- [ ] Round number + unusual time detectors
- [ ] Configurable thresholds per canonical L2
- [ ] Alerts created in fact_connector_alerts
- [ ] Email + in-app delivery
- [ ] Alert digest for flood prevention

### Test Plan
- Set Revenue PoP threshold to 20%; simulate 25% increase → alert fires
- Simulate 19% increase → no alert
- Post round-number entry (500,000 at 3am) → both alerts fire
- Create 50 alerts same day → verify digest sent not 50 emails
