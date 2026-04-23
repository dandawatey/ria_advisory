# F008 — Canonical Dimension Framework

**Area:** Data Lakehouse  
**Priority:** Must  
**PRD References:** FR-LAKE-05

---

## Situation

Beyond accounts, BC financial data is segmented using "dimensions" — key-value tags applied to GL entries for analytical slicing. Each subsidiary has its own dimension taxonomy with locally defined codes (e.g., cost centres, project codes, client segments). The platform needs a group-level canonical dimension framework so that cross-subsidiary analysis by region, client segment, service line, and entity is possible and comparable.

---

## Problem

Subsidiary dimension codes are local inventions — "REGION-NE" in Sub 03 may be equivalent to "NE" in Sub 11 and absent in Sub 07 (which uses a geography dimension instead). Without normalisation, group-level slicing by Region or Service Line is impossible. Finance teams currently maintain Excel crosswalk tables; these are unversioned, error-prone, and disconnected from the reporting pipeline.

---

## Action

### User Stories

- As the group controller, I can define the canonical dimensions and their values in the admin console.
- As a subsidiary controller, I can map my local dimension codes to canonical values and see unmapped codes flagged.
- As the Head of FP&A, I can slice consolidated P&L by Region, Client Segment, and Service Line knowing the mapping is governed and consistent.

### Acceptance Criteria

1. The platform defines four **canonical dimensions**: `Entity` (subsidiary legal entity), `Region`, `Client Segment`, and `Service Line`. Additional canonical dimensions can be added through a controlled change process.
2. Each canonical dimension has a governed value list: `canonical_dimension_id`, `dimension_name`, `canonical_value_code`, `canonical_value_label`, `parent_value_code` (for hierarchy support), `effective_from`, `effective_to`.
3. Every subsidiary dimension value must map to exactly one canonical dimension value per dimension type. Unmapped dimension values are permitted in Bronze/Silver but must be flagged in the DQ exception report; they are allowed in Gold with `canonical_value_code = 'UNMAPPED'` (soft rule, unlike account mapping which is hard).
4. Mapping stored as versioned table: `mapping.dimension_canonical` with `(subsidiary_code, dimension_type, local_dimension_code, canonical_value_code, effective_from, effective_to, mapped_by, approved_by)`.
5. All dimension mapping changes go through the two-person approval workflow (F021).
6. `dim_entity` canonical dimension is seeded from the subsidiary registry at platform setup — one canonical entity per subsidiary, plus a group-level rollup node.
7. Admin console (F021) provides a dimension mapping workbench: unmapped codes, proposed mappings, approval queue, mapping history.
8. Gold-layer `dim_dimension_value` table exposes both local and canonical dimension values; fact tables join to this for canonical slicing.
9. Mapping coverage (% of GL entry rows with fully mapped canonical dimensions) is surfaced in the pipeline health dashboard (F023).
10. Dimension hierarchy supports rollup aggregation (e.g., Sub-Region → Region → Group) for summary reporting.

### Technical Notes

- `dim_entity` is effectively auto-mapped (1:1 subsidiary → canonical entity) but still versioned for future re-org support.
- Unmapped dimension values set to `UNMAPPED` in Gold rather than blocking (unlike accounts) — prevents hard block on all GL entries just because a new department code wasn't yet mapped.
- Canonical dimension framework documented in the Data Dictionary published via Unity Catalog.

---

## Result

- Group-level slicing by Region, Client Segment, Service Line, and Entity is consistent and comparable across all 17 subsidiaries.
- Dimension mapping is versioned, auditable, and maintainable by finance without engineering involvement.
- Unmapped values are visible and actionable — not silently suppressed or misattributed.
- FP&A can perform cross-subsidiary trend and cohort analysis on governed, canonical data.

---

## Constraints

- **Dependency:** F006 (Silver) surfaces subsidiary dimension values for mapping discovery.
- **Dependency:** F007 (canonical CoA) is a sibling feature; both must be established before Gold layer is meaningful.
- **Dependency:** F021 (admin console) provides the mapping workbench and approval workflow.
- **Dependency:** F009 (Gold layer) consumes canonical dimension mappings for `dim_dimension_value`.
- **Out of scope:** Custom analytical dimensions beyond the four defined canonical dimensions — Phase 2 extension.
- **Constraint:** Canonical dimension value lists must be stable before pilot go-live; additions are a controlled change, not a structural redesign.
- **Constraint:** Subsidiary dimension configurations in BC vary widely — some subsidiaries may use global dimensions differently from others; discovery and mapping may surface classification conflicts requiring finance adjudication.
