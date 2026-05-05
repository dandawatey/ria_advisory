# Feature: ERP-DS-003 — ERP-Specific Benchmarking KPIs

**Created:** 2026-04-29
**Ticket:** ERP-DS-003
**Type:** Feature
**Phase:** Phase 2
**Priority:** Low
**Owner:** Ananya_Frontend_004
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Compare same-entity financials across ERP migration periods (pre-SAP vs post-SAP). Peer benchmarking across entities using same ERP. KPI cards: Revenue per FTE, OpEx ratio, DSO, DPO — filterable by ERP source. ERP data quality score: completeness % + dimension fill rate + mapping coverage.

### Why
CFO wants to know: did switching from BC to SAP improve data quality? Are Odoo entities running leaner than SAP entities? Which ERP system correlates with better financial performance metrics?

### Acceptance Criteria
- AC: KPI cards filterable by ERP type
- AC: Pre/post ERP migration comparison (date range split)
- AC: Peer group: "All entities on Odoo" vs "All entities on SAP"
- AC: Data quality score per ERP: completeness + dimension fill + mapping coverage

---

## P — Pseudocode

### Backend
```
GET /api/analytics/erp-benchmarking
  params: kpi_type, erp_filter[], period_from, period_to
  → {
    kpi_by_erp: {
      'SAP': {revenue_per_fte: X, opex_ratio: Y, dso: Z, data_quality: 87},
      'BC':  {revenue_per_fte: X, opex_ratio: Y, dso: Z, data_quality: 92},
      'Odoo':{...}
    },
    migration_comparison: {
      entity_id, pre_erp: {erp_type, period, kpis},
      post_erp: {erp_type, period, kpis}
    }
  }
```

### Frontend
```
Route: /analytics/erp-benchmarking

Components:
  ERPBenchmarkingPage
    ├── ERPTypeFilter (checkbox: SAP / BC / Odoo / D365F / ...)
    ├── KPIGrid
    │   ├── RevenuePerFTECard (by ERP)
    │   ├── OpExRatioCard (by ERP)
    │   ├── DSOCard (Days Sales Outstanding)
    │   └── DPOCard (Days Payable Outstanding)
    ├── DataQualityByERPChart (bar chart: quality score per ERP)
    └── MigrationComparisonSection (pre/post ERP transition timeline)
```

---

## A — Architecture

### New Files
- `02_Frontend/src/pages/62_F062_ERPBenchmarking.tsx`
- `03_Backend/routers/benchmarking.py`
- `03_Backend/services/kpi_service.py` — KPI calculations

### Modified Files
- `02_Frontend/src/components/layout/Sidebar.tsx`

### DB / API changes
No new tables. Queries on `fact_gl_entries` + `dim_erp_source` + `dim_erp_mapping`.
Requires headcount data in `dim_company` (new field: `fte_count INT`).

---

## R — Refinement

### Edge Cases
- FTE count not available: Revenue per FTE = N/A (not zero)
- Entity migrated ERP mid-year: split period at migration date; compare same months
- Single entity on one ERP: peer benchmarking not meaningful — show message "Not enough peers"

### Security
- Benchmarking data aggregated at entity level — no individual transaction exposure
- Cross-tenant benchmarking: disabled (entities from other tenants not visible)

### Performance
- KPI calculations use pre-aggregated period totals
- Benchmarking page acceptable at 5-second render (lower priority)

---

## C — Completion

### Done Criteria
- [ ] KPI cards (Revenue/FTE, OpEx ratio, DSO, DPO) computed per ERP type
- [ ] ERP type filter working
- [ ] Data quality score per ERP type
- [ ] Migration comparison for entities that switched ERPs
- [ ] Peer grouping by ERP type

### Test Plan
- Load entities with SAP + Odoo → verify separate KPI cards per ERP
- Filter to SAP only → verify Odoo entities excluded
- Entity with no FTE data → verify Revenue/FTE shows "N/A"
