# Feature: ERP-DN-005 — Dimension Mapping

**Created:** 2026-04-29
**Ticket:** ERP-DN-005
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Kiran_Data_008
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Map ERP-native dimensions (cost centers, analytical accounts, business units) to canonical dimensions: Department, Vertical (Business Unit), Project, Geography, Product Line, Legal Entity, ERP Source. Support rollup hierarchies. Route unmapped dimensions to "Unallocated" bucket with alert.

### Why
Different ERPs call the same concept different things: SAP uses Cost Center, BC uses Dimension 1, Odoo uses Analytic Account, JDE uses Business Unit. Without mapping, department-level P&L across entities using different ERPs is impossible.

### Acceptance Criteria
- AC: All 7 canonical dimensions configurable per ERP source
- AC: Dimension rollup: Marketing + Sales → Commercial vertical
- AC: Unmapped dimension values route to "Unallocated" not silently dropped
- AC: Dimension fill rate (% of GL lines with dimension) tracked and reported
- AC: ERP-specific pre-built dimension templates (SAP CC→Dept, BC Dim1→Vertical)

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/dimension_service.py

CANONICAL_DIMENSIONS = ['Department', 'Vertical', 'Project', 'Geography', 'ProductLine']

class DimensionMappingService:

  def map_dimension(erp_source_id, dim_type, source_value) -> CanonicalDimValue:
    mapping = db.get(dim_erp_mapping, {
      erp_source_id, dimension_type=dim_type, source_dimension_code=source_value
    })
    if mapping:
      return mapping.canonical_dimension_value
    else:
      alert_unmapped_dimension(erp_source_id, dim_type, source_value)
      return 'Unallocated'

  def apply_hierarchy_rollup(dim_type, value) -> dict:
    # e.g., 'Marketing' → {l1: 'Commercial', l2: 'Marketing'}
    hierarchy = db.get_dimension_hierarchy(dim_type, value)
    return hierarchy or {l1: value, l2: value}

  def calculate_fill_rate(erp_source_id, period) -> dict:
    # % of GL lines where each dimension is NOT 'Unallocated'
    total = count_gl_lines(erp_source_id, period)
    for dim in CANONICAL_DIMENSIONS:
      filled = count_gl_lines_where_dim_not_unallocated(erp_source_id, period, dim)
      fill_rates[dim] = filled / total * 100
    return fill_rates

# Pre-built templates
SAP_DIMENSION_TEMPLATE = {
  'CostCenter': 'Department',
  'ProfitCenter': 'Vertical',
  'WBSElement': 'Project',
  'Segment': 'Geography'
}
BC_DIMENSION_TEMPLATE = {
  'Global Dimension 1': 'Department',
  'Global Dimension 2': 'Vertical'
}
```

### Frontend
- Dimension mapping section in Field Mapper (ERP-CF-004)
- Hierarchy editor: group dimension values into rollup buckets
- Fill rate indicators per dimension (shown on Data Quality page)

---

## A — Architecture

### New Files
- `03_Backend/services/dimension_service.py`
- `03_Backend/data/dimension_templates/sap_dimensions.json`
- `03_Backend/data/dimension_templates/bc_dimensions.json`
- `03_Backend/data/dimension_templates/odoo_dimensions.json`

### Modified Files
- `03_Backend/workers/sync_worker.py` — call dimension_service in normalization step
- `03_Backend/database.py` — dimension hierarchy table

### DB / API changes
```sql
dim_dimension_hierarchy (
  hierarchy_id   SERIAL PRIMARY KEY,
  tenant_id      UUID,
  canonical_dim  VARCHAR(50),  -- Department/Vertical/Project/etc
  value          VARCHAR(200),
  parent_value   VARCHAR(200),
  level          INT           -- 1=top, 2=sub, etc
)
```

---

## R — Refinement

### Edge Cases
- ERP dimension value changes name: old entries keep old mapping; new entries trigger re-mapping
- Same dimension value in two ERPs: each ERP has its own mapping (isolated by erp_source_id)
- Missing dimension (ERP line has no cost center): → Unallocated, counted in fill rate gap

### Security
- Dimension values may contain department/project names — no PII but confidential business structure

### Performance
- Dimension lookup: in-memory dict per sync session (same as account mapping cache)
- Fill rate calculation: SQL aggregation, not row-level — fast even on large datasets

---

## C — Completion

### Done Criteria
- [ ] DimensionMappingService maps all 7 canonical dimensions
- [ ] "Unallocated" fallback for unmapped values
- [ ] Pre-built templates for SAP, BC, Odoo dimensions
- [ ] Hierarchy rollup working (children → parent groups)
- [ ] `dimension_department/vertical/project/geography` columns in `fact_gl_entries`
- [ ] Fill rate calculation per dimension per period

### Test Plan
- Map SAP Cost Center "CC001" → "Finance Department" → verify canonical_dim='Department', value='Finance Department'
- Submit GL line without cost center → verify dimension_department='Unallocated'
- Create rollup: Marketing + Sales → Commercial → verify group totals correct
- Calculate fill rate: 80/100 lines have department → verify 80% fill rate
