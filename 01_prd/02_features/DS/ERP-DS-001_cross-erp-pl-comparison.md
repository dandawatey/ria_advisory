# Feature: ERP-DS-001 — Cross-ERP P&L Comparison

**Created:** 2026-04-29
**Ticket:** ERP-DS-001
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** Critical
**Owner:** Ananya_Frontend_004
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Side-by-side P&L comparison for entities running different ERPs. Normalized to canonical CoA regardless of source ERP. Period selector (month/quarter/YTD/custom). Variance column (absolute + %). Drill-down from summary line to source ERP journal entries with ERP source badge.

### Why
Group CFO with entities on BC, SAP, Odoo cannot compare financials without a common view. This is the core value proposition of the multi-ERP platform — one normalized lens across all ERP stacks.

### Acceptance Criteria
- AC-12: Cross-ERP P&L renders correctly for 3 entities on different ERPs; totals reconcile
- AC-14: Renders within 3 seconds for 12-month period
- AC: Variance column shown as absolute AED and percentage
- AC: Drill-down opens GL journal lines with ERP name badge (e.g., "SAP S/4HANA")
- AC: Period selector: month / quarter / YTD / custom range

---

## P — Pseudocode

### Backend
```
# 03_Backend/routers/dashboard.py (extend existing)

GET /api/dashboard/cross-erp-pl
  params: entity_ids[], period_from, period_to, currency, canonical_level
  → {
    periods: [YYYY-MM, ...],
    entities: [
      {entity_id, entity_name, erp_type, erp_source_id,
       pl_rows: [
         {canonical_l2, canonical_l3, periods: {YYYY-MM: {debit, credit, net}}}
       ]}
    ],
    variance: {entity_a_vs_b: {canonical_l2: {abs_diff, pct_diff}}}
  }

GET /api/dashboard/cross-erp-pl/drilldown
  params: entity_id, canonical_l2, period, page, page_size
  → {
    rows: [
      {erp_source, erp_native_journal_id, posting_date,
       description, debit, credit, source_account_code, erp_type_badge}
    ],
    total: int
  }
```

### Frontend
```
Route: /dashboard/cross-erp-comparison

Components:
  CrossERPPLPage
    ├── EntitySelector (multi-select, max 5 entities)
    ├── PeriodSelector (month/quarter/YTD/custom)
    ├── CurrencySelector (USD/EUR/local)
    ├── PLComparisonTable
    │   ├── Header row: [Account | Entity A (SAP) | Entity B (BC) | Entity C (Odoo) | Variance]
    │   ├── CategoryRows (Revenue / COGS / Gross Profit / OpEx / EBITDA / Net)
    │   └── DrilldownModal (GL journal lines with ERP badge)
    └── VarianceSummaryCard (biggest variances highlighted)
```

---

## A — Architecture

### New Files
- `02_Frontend/src/pages/60_F060_CrossERPPL.tsx`
- `02_Frontend/src/components/crosserp/PLComparisonTable.tsx`
- `02_Frontend/src/components/crosserp/ERPSourceBadge.tsx` (SAP=blue, BC=green, Odoo=purple badge)
- `02_Frontend/src/components/crosserp/DrilldownModal.tsx`

### Modified Files
- `03_Backend/routers/dashboard.py` — add cross-erp-pl endpoints
- `02_Frontend/src/components/layout/Sidebar.tsx` — add link

### DB / API changes
New SQL query joining `fact_gl_entries` + `dim_erp_source` + `dim_erp_mapping` filtering by canonical CoA.

---

## R — Refinement

### Edge Cases
- Entity has no data for selected period: show zero row, not error
- Different functional currencies: always convert to selected reporting currency
- Account exists in Entity A not in Entity B: show in Entity A column only; Entity B = 0
- Drilldown with millions of rows: paginate (50 per page); no full materialization

### Security
- Entity selection filtered to tenant's authorized entities
- `entity_ids` validated against tenant_id in session

### Performance
- Query materialized view or pre-aggregated table for P&L summary (refresh on sync completion)
- 3-second render target: SQL aggregation on indexed `fact_gl_entries` (period + erp_source_id)
- Drilldown: indexed on `(erp_source_id, canonical_l2, period)`

---

## C — Completion

### Done Criteria
- [ ] `/dashboard/cross-erp-comparison` route renders
- [ ] Entity selector (multi, max 5)
- [ ] Period selector with month/quarter/YTD/custom
- [ ] PLComparisonTable with canonical L2 rows
- [ ] Variance column: absolute + percentage
- [ ] Drill-down modal with ERP source badge
- [ ] Currency conversion applied
- [ ] Renders in < 3 seconds for 12-month, 3-entity query

### Test Plan
- Load 3 entities (SAP, BC, Odoo) for Jan–Dec 2025 → verify table renders, totals match sum of individuals
- Select YTD → verify period range correct
- Drill into Revenue row for SAP entity → verify SAP journal lines with "SAP S/4HANA" badge
- Select USD reporting currency → verify all amounts in USD
- Verify 3-second render with 100k GL lines via performance test
