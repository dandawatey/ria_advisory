# Feature: ERP-CF-004 — Field Mapping UI

**Created:** 2026-04-29
**Ticket:** ERP-CF-004
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Ananya_Frontend_004
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Visual drag-and-drop (or dropdown-select) mapper: source ERP field → canonical i-finsights field. Pre-built mapping templates per ERP. Tenant-specific overrides. Mapping validation. Account code mapping to canonical CoA categories. Export/import as JSON.

### Why
Finance team must map ERP accounts to canonical CoA without developer help. Manual mapping = hours of work; visual UI = 30-minute self-service setup. Reduces onboarding friction significantly.

### Acceptance Criteria
- AC-08: Account mapping covers ≥ 95% of source accounts after initial session
- AC: Pre-built templates auto-apply on connector creation (SAP, BC, Odoo default maps)
- AC: Unmapped mandatory fields highlighted in red — save blocked until resolved
- AC: Mapping exported as JSON for audit purposes
- AC: Dimension mapping: source dim → canonical (Department/Project/Vertical/Geography)

---

## P — Pseudocode

### Backend
```
# 03_Backend/routers/mapping.py

GET  /api/connectors/{erp_source_id}/mapping
  → list of dim_erp_mapping rows for this connector

POST /api/connectors/{erp_source_id}/mapping
  body: [{source_account_code, canonical_account_id, canonical_category, ...}]
  → upsert dim_erp_mapping; validate canonical_account_id exists

GET  /api/connectors/{erp_source_id}/mapping/template
  → pre-built template for erp_type (seeded from JSON files per ERP)

GET  /api/connectors/{erp_source_id}/mapping/unmapped
  → accounts in dim_coa fetched from ERP but not in dim_erp_mapping

POST /api/connectors/{erp_source_id}/mapping/export
  → returns JSON of full mapping set

POST /api/connectors/{erp_source_id}/mapping/import
  body: JSON mapping file
  → validate + bulk upsert
```

### Frontend
```
Route: /settings/connectors/:id/mapping

Components:
  MappingPage
    ├── MappingHeader (ERP name, entity, progress bar: X/Y accounts mapped)
    ├── AccountMappingTable
    │     ├── SourceAccountRow (code, name, type)
    │     └── CanonicalSelect (dropdown: Revenue/COGS/OpEx/... + subcategory)
    ├── DimensionMappingTable
    │     ├── SourceDimensionRow
    │     └── CanonicalDimensionSelect (Department/Project/Vertical/Geography)
    ├── ValidationPanel (unmapped required fields, type mismatches)
    ├── ExportButton → download JSON
    └── ImportButton → upload JSON → validate → apply
```

---

## A — Architecture

### New Files
- `03_Backend/routers/mapping.py` — CRUD + template + export/import
- `03_Backend/data/mapping_templates/bc_default.json`
- `03_Backend/data/mapping_templates/sap_s4_default.json`
- `03_Backend/data/mapping_templates/odoo_default.json`
- `02_Frontend/src/pages/54_F054_FieldMapper.tsx`
- `02_Frontend/src/components/mapping/AccountMappingTable.tsx`
- `02_Frontend/src/components/mapping/DimensionMappingTable.tsx`
- `02_Frontend/src/components/mapping/ValidationPanel.tsx`

### Modified Files
- `02_Frontend/src/App.tsx` — add route `/settings/connectors/:id/mapping`
- `02_Frontend/src/components/layout/Sidebar.tsx` — link in Settings section

### DB / API changes
`dim_erp_mapping` table (see PRD §6.1). New endpoints in `/api/connectors/{id}/mapping`.

---

## R — Refinement

### Edge Cases
- Source account code contains special chars (SAP `#` separator) — URL-encode in API
- ERP CoA changes mid-cycle (new account added) — re-fetch CoA on demand; highlight new unmapped accounts
- Conflicting mappings (two source codes → same canonical) — warn but allow (many-to-one is valid)
- Import file from different ERP type — validate erp_type match before applying

### Security
- Mapping changes logged with user_id and timestamp
- Only tenant admins can modify mappings; read-only for finance viewers

### Performance
- Mapping table can have 500+ accounts — virtualized list (react-window)
- Bulk save: batch upsert in single DB transaction
- Template apply: client-side pre-fill before save

---

## C — Completion

### Done Criteria
- [ ] `/settings/connectors/:id/mapping` route renders
- [ ] Account mapping table with source → canonical dropdown
- [ ] Dimension mapping table
- [ ] Pre-built templates for BC, SAP S/4HANA, Odoo loaded on connector create
- [ ] Unmapped accounts highlighted; save blocked if mandatory fields empty
- [ ] Export JSON working
- [ ] Import JSON with validation working
- [ ] Progress bar: X/Y accounts mapped shown in header

### Test Plan
- Apply BC template → verify 90%+ accounts pre-filled
- Save with unmapped required fields → expect block + error
- Export JSON → re-import on fresh connector → verify identical mappings
- Map same source to two different canonicals → verify both saved (many-to-one)
