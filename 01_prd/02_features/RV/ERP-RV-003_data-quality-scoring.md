# Feature: ERP-RV-003 — Data Quality Scoring per ERP Source

**Created:** 2026-04-29
**Ticket:** ERP-RV-003
**Type:** Feature
**Phase:** Phase 2
**Priority:** Low
**Owner:** Kiran_Data_008
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Score each ERP source across 5 dimensions (0–100): Completeness, Dimension Fill Rate, Account Mapping Rate, Currency Coverage, Timeliness. Overall score = weighted average. Trend chart over time. Remediation suggestions ("43 accounts unmapped — click to open field mapper").

### Why
CFOs and Finance Controllers need to know which ERP connectors have data quality issues so they can prioritize remediation. Without a score, issues are invisible until they cause reporting errors.

### Acceptance Criteria
- AC: 5-dimension quality score per ERP source per period
- AC: Overall weighted score displayed as 0–100 with color (red < 70, yellow 70–85, green > 85)
- AC: Trend chart: score over last 6 months per ERP
- AC: Remediation suggestions linked to actionable UI (field mapper, sync history)
- AC: Score updated after every sync

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/data_quality_service.py

WEIGHTS = {
  'completeness': 0.30,
  'dimension_fill': 0.25,
  'account_mapping': 0.25,
  'currency_coverage': 0.10,
  'timeliness': 0.10
}

def compute_quality_score(erp_source_id, period) -> QualityScore:
  total = count_gl_lines(erp_source_id, period)
  if total == 0:
    return QualityScore(overall=0, reason='no_data')

  # Completeness: % of lines with all mandatory fields non-null
  complete = count_lines_with_all_mandatory_fields(erp_source_id, period)
  completeness = complete / total * 100

  # Dimension fill: % of lines with at least 1 canonical dimension != Unallocated
  with_dim = count_lines_with_dimension(erp_source_id, period)
  dimension_fill = with_dim / total * 100

  # Account mapping rate: % of source accounts in dim_erp_mapping
  total_accounts = count_distinct_accounts(erp_source_id, period)
  mapped_accounts = count_mapped_accounts(erp_source_id, period)
  account_mapping = mapped_accounts / total_accounts * 100

  # Currency coverage: % of lines with valid ISO currency code
  with_currency = count_lines_with_valid_currency(erp_source_id, period)
  currency_coverage = with_currency / total * 100

  # Timeliness: 1 - (avg_sync_lag_hours / 48) * 100, floor at 0
  avg_lag = get_avg_sync_lag(erp_source_id, period)
  timeliness = max(0, 100 - (avg_lag / 48 * 100))

  overall = sum(score * WEIGHTS[dim] for dim, score in {
    'completeness': completeness, 'dimension_fill': dimension_fill,
    'account_mapping': account_mapping, 'currency_coverage': currency_coverage,
    'timeliness': timeliness
  }.items())

  suggestions = generate_suggestions(erp_source_id, account_mapping, dimension_fill)
  db.upsert(fact_data_quality, {erp_source_id, period, overall, **dimensions, suggestions_json})
  return QualityScore(overall=overall, ...)

def generate_suggestions(erp_source_id, account_mapping, dimension_fill) -> list[Suggestion]:
  suggestions = []
  unmapped_count = count_unmapped_accounts(erp_source_id)
  if unmapped_count > 0:
    suggestions.append({
      text: f"{unmapped_count} accounts unmapped",
      action: f"/settings/connectors/{erp_source_id}/mapping?filter=unmapped",
      impact: 'high' if unmapped_count > 10 else 'medium'
    })
  return suggestions
```

### Frontend
```
Route: /analytics/data-quality

Components:
  DataQualityPage
    ├── ERPQualityScoreGrid
    │   └── ERPQualityCard (per ERP source)
    │       ├── OverallScore (big number + color ring)
    │       ├── DimensionBreakdown (5 bars: completeness / dim-fill / mapping / currency / timeliness)
    │       └── RemediationSuggestions (clickable action links)
    └── QualityTrendChart (6-month score history per ERP)
```

---

## A — Architecture

### New Files
- `03_Backend/services/data_quality_service.py`
- `03_Backend/routers/data_quality.py`
- `02_Frontend/src/pages/65_F065_DataQuality.tsx`
- `02_Frontend/src/components/quality/ERPQualityCard.tsx`

### Modified Files
- `03_Backend/workers/sync_worker.py` — trigger quality compute post-sync

### DB / API changes
```sql
fact_data_quality (
  quality_id         SERIAL PRIMARY KEY,
  erp_source_id      INT REFERENCES dim_erp_source,
  period             CHAR(7),
  overall_score      DECIMAL(5,2),
  completeness       DECIMAL(5,2),
  dimension_fill     DECIMAL(5,2),
  account_mapping    DECIMAL(5,2),
  currency_coverage  DECIMAL(5,2),
  timeliness         DECIMAL(5,2),
  suggestions_json   JSONB,
  computed_at        TIMESTAMPTZ DEFAULT NOW()
)
```

---

## R — Refinement

### Edge Cases
- First sync (no historical trend): show single data point on trend chart
- All accounts mapped but no GL lines in period: account_mapping = 100%; overall still shows 0 completeness
- Score drops after restatement: expected; shows in trend chart as dip

### Security
- Quality scores are operational metadata — not PII
- Suggestions link only to own tenant's data

### Performance
- Quality computation: SQL aggregation, < 5 seconds per ERP per period
- Runs asynchronously post-sync (not blocking)

---

## C — Completion

### Done Criteria
- [ ] 5-dimension scoring implemented
- [ ] Weighted overall score (0–100)
- [ ] fact_data_quality table populated post-sync
- [ ] Data Quality page renders per-ERP cards
- [ ] Trend chart (6 months)
- [ ] Remediation suggestions with action links

### Test Plan
- Sync with 10% unmapped accounts → verify account_mapping = 90%
- All lines missing department → verify dimension_fill = 0%
- Overall score calculation: 90 comp, 80 dim, 90 mapping, 100 curr, 85 timeliness → verify weighted avg
- Remediation suggestion for 10 unmapped → verify link to field mapper with unmapped filter
