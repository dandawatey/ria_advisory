# Feature: ERP-DS-004 — Data Freshness Indicator

**Created:** 2026-04-29
**Ticket:** ERP-DS-004
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Ananya_Frontend_004
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Reusable component showing last sync time, next scheduled sync, and sync status per ERP source. Staleness alert if data older than configurable threshold (default 48 hours). Tooltip on every chart/table: "Data as of [timestamp] from [ERP name]". Consolidated view freshness = oldest source.

### Why
CFO making a decision on a P&L that is 5 days old is worse than knowing the data is stale and waiting. Transparency about data age is critical for financial decision-making. US-06 is a high-priority user story.

### Acceptance Criteria
- AC-13: Freshness badge updates within 60 seconds of sync completion
- AC: Staleness alert shown when data older than 48h threshold (configurable per connector)
- AC: "Data as of..." tooltip on every chart and data table
- AC: Consolidated view: freshness = oldest ERP source in consolidation perimeter
- AC: Badge shows: green (< 24h), yellow (24-48h), red (> 48h)

---

## P — Pseudocode

### Backend
```
GET /api/connectors/freshness
  params: erp_source_ids[]
  → [{
    erp_source_id, erp_type, entity_name,
    last_sync_at: TIMESTAMPTZ,
    next_sync_at: TIMESTAMPTZ,
    sync_status: 'connected'|'degraded'|'stale'|'disconnected',
    data_age_hours: float,
    staleness_threshold_hours: int,
    is_stale: bool
  }]

# Called by dashboard endpoints to include freshness metadata:
def get_freshness_for_query(erp_source_ids) -> FreshnessMeta:
  records = db.query(dim_erp_source, {erp_source_id: IN erp_source_ids})
  oldest = min(records, key=lambda r: r.last_synced_at)
  return FreshnessMeta(
    oldest_sync=oldest.last_synced_at,
    is_stale=any(r.is_stale for r in records),
    sources=[{erp_type, last_sync_at} for r in records]
  )
```

### Frontend
```
# Reusable component
FreshnessIndicator.tsx
  props: {erp_source_ids: string[], threshold_hours?: number}
  
  renders:
    <FreshnessIndicator>
      <StatusDot color={green|yellow|red} />
      <span>Data as of {formatted_time} | {erp_name}</span>
      <Tooltip>
        {sources.map(s => `${s.erp_type}: last synced ${s.last_sync_at_relative}`)}
        Next sync: {next_sync_at_relative}
      </Tooltip>
    </FreshnessIndicator>

# Used on every dashboard page:
<FreshnessIndicator erp_source_ids={selected_entity_erp_ids} />

# Staleness banner (auto-shown when is_stale=true):
<StalenessAlert>
  ⚠ Data from SAP is 73 hours old. Last sync failed. 
  <Link to="/settings/connectors/123">View connector</Link>
</StalenessAlert>
```

---

## A — Architecture

### New Files
- `02_Frontend/src/components/freshness/FreshnessIndicator.tsx`
- `02_Frontend/src/components/freshness/StalenessAlert.tsx`
- `03_Backend/routers/freshness.py` — `/api/connectors/freshness` endpoint

### Modified Files
- Every dashboard page (15_F015, 25_F025, etc.) — add `<FreshnessIndicator>` component
- Consolidated dashboard — freshness = oldest source

### DB / API changes
`dim_erp_source` + column: `staleness_threshold_hours INT DEFAULT 48`.

---

## R — Refinement

### Edge Cases
- Connector never synced (new connector, pre-first-sync): show "No data yet" not stale
- Manual sync just completed: badge must update within 60s — use polling or WebSocket push
- All connectors in consolidation are fresh except one: overall = stale (conservative)
- User dismisses staleness alert: session-local dismiss only (re-appears after page refresh)

### Security
- Freshness endpoint requires authentication — don't expose sync timestamps publicly
- No sensitive data in freshness response (only timestamps and ERP type)

### Performance
- Freshness API: lightweight — reads `dim_erp_source.last_synced_at` only
- Client polling: every 60 seconds on active dashboard pages
- Color coding: client-side, no extra API call

---

## C — Completion

### Done Criteria
- [ ] `FreshnessIndicator` component renders on all dashboard pages
- [ ] Green/yellow/red color coding by data age
- [ ] Tooltip showing per-ERP sync times
- [ ] `StalenessAlert` banner auto-shown when is_stale=true
- [ ] Consolidated view shows oldest source freshness
- [ ] Badge updates within 60 seconds of sync completion
- [ ] Staleness threshold configurable per connector

### Test Plan
- Sync completes → verify badge turns green within 60 seconds
- Set staleness threshold to 1 hour; simulate 2-hour-old data → verify red badge + alert
- Consolidated view with 3 entities: 2 fresh + 1 stale → verify overall shows stale
- New connector (no syncs yet) → verify "No data yet" not red
- Tooltip shows correct per-ERP sync times for multi-ERP consolidation
