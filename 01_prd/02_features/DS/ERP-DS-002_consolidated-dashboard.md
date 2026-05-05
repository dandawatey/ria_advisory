# Feature: ERP-DS-002 — Consolidated Dashboard

**Created:** 2026-04-29
**Ticket:** ERP-DS-002
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** Critical
**Owner:** Ananya_Frontend_004
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Group consolidation across multiple ERPs and entities in a single P&L / Balance Sheet view. Entity tree selector (choose consolidation perimeter). Intercompany elimination toggle (Phase 2; Phase 1: pre-elimination only). Consolidation currency selector. Reconciliation waterfall: parent → subsidiary → elimination → consolidated total.

### Why
Group CFO's single most critical need: one view of the entire group's financial position regardless of what ERP each subsidiary runs. US-03 is the marquee feature of PRD_02.

### Acceptance Criteria
- AC-12: Consolidated P&L renders for group with entities on different ERPs; totals correct
- AC-14: Renders within 3 seconds for 12-month period
- AC: Entity tree selector: add/remove entities from consolidation perimeter
- AC: Consolidation currency selector (USD / EUR / GBP / local)
- AC: Phase 1: pre-elimination (sum of entities); Phase 2: post-elimination toggle

---

## P — Pseudocode

### Backend
```
GET /api/dashboard/consolidated
  params: entity_ids[], period_from, period_to, currency, include_elimination=false
  → {
    consolidated_pl: PLStatement,
    consolidated_bs: BalanceSheet,
    entity_breakdown: [{entity_id, entity_name, erp_type, pl: PLStatement}],
    waterfall: [
      {entity: "Group", amount: X},
      {entity: "Elimination (ICO)", amount: -Y},   # Phase 2
      {entity: "Consolidated Total", amount: X-Y}
    ]
  }

# SQL pattern:
SELECT
  canonical_l2, canonical_l3,
  SUM(CASE WHEN is_elimination_entry THEN 0 ELSE reporting_amount_dr - reporting_amount_cr END) AS consolidated_net,
  SUM(reporting_amount_dr - reporting_amount_cr) AS pre_elimination_net
FROM fact_gl_entries
WHERE erp_source_id = ANY(:erp_source_ids)
  AND period BETWEEN :period_from AND :period_to
GROUP BY canonical_l2, canonical_l3
```

### Frontend
```
Route: /dashboard/consolidated

Components:
  ConsolidatedDashboard
    ├── EntityTreeSelector
    │   └── Checkboxes per entity with ERP type badge
    ├── PeriodSelector + CurrencySelector
    ├── ConsolidatedPLTable (canonical L2 rows, total column)
    ├── ConsolidatedBSTable (assets / liabilities / equity)
    ├── ReconciliationWaterfall chart
    │   └── parent + each subsidiary + [elimination] + consolidated total
    ├── EntityBreakdownSection (mini P&L card per entity)
    └── FreshnessIndicator (oldest data source timestamp)
```

---

## A — Architecture

### New Files
- `02_Frontend/src/pages/61_F061_ConsolidatedDashboard.tsx`
- `02_Frontend/src/components/consolidated/EntityTreeSelector.tsx`
- `02_Frontend/src/components/consolidated/ReconciliationWaterfall.tsx`
- `02_Frontend/src/components/consolidated/ConsolidatedPLTable.tsx`

### Modified Files
- `03_Backend/routers/dashboard.py` — add consolidated endpoint
- `02_Frontend/src/components/layout/Sidebar.tsx` — link

### DB / API changes
Pre-aggregated view `mv_consolidated_pl` (materialized, refreshed on sync):
```sql
CREATE MATERIALIZED VIEW mv_consolidated_pl AS
SELECT erp_source_id, entity_id, period, canonical_l2, canonical_l3,
       SUM(reporting_amount_dr) AS total_dr, SUM(reporting_amount_cr) AS total_cr
FROM fact_gl_entries
GROUP BY 1,2,3,4,5;
```

---

## R — Refinement

### Edge Cases
- Entity in consolidation with no data for period: contribute 0 (not excluded)
- Currency: all amounts converted to reporting currency before consolidation
- Ownership < 100% (Phase 2): minority interest calculation required
- One entity's sync is stale: show consolidated with staleness warning

### Security
- Entity access scoped to tenant — cannot include entities from other tenants
- Consolidation perimeter saved as user preference (per user, not tenant-wide)

### Performance
- Materialized view refreshed on sync completion (async, < 30 seconds)
- Consolidated query hits materialized view: < 1 second for aggregation
- UI renders with loading states while data fetches

---

## C — Completion

### Done Criteria
- [ ] `/dashboard/consolidated` route renders
- [ ] EntityTreeSelector with all tenant entities listed
- [ ] Consolidated P&L table (canonical L2 + L3 rows)
- [ ] Consolidated Balance Sheet
- [ ] Reconciliation waterfall chart
- [ ] Entity breakdown mini-cards
- [ ] FreshnessIndicator showing oldest data source timestamp
- [ ] Consolidation currency selector working
- [ ] Renders in < 3 seconds

### Test Plan
- Select 3 entities (SAP, BC, Odoo) → verify consolidated Revenue = sum of 3 individual revenues
- Change currency to EUR → verify amounts converted at correct exchange rate
- Remove one entity from perimeter → verify total changes correctly
- Entity with stale data (> 48h) → verify freshness warning shown
- Waterfall chart: parent + subs + total renders correctly
