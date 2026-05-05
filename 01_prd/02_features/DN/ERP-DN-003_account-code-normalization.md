# Feature: ERP-DN-003 — Account Code Normalization → Canonical CoA

**Created:** 2026-04-29
**Ticket:** ERP-DN-003
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Kiran_Data_008
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Map ERP-native account codes to a 4-level canonical Chart of Accounts. Pre-built mapping libraries per ERP (SAP OP INT, Oracle standard, BC standard). ML-assisted classification (Phase 2). Unmapped account alerts block from consolidated reports.

### Canonical CoA Structure:
- L1: Financial Statement (P&L / Balance Sheet / Cash Flow)
- L2: Category (Revenue / COGS / Gross Profit / OpEx / EBITDA / Interest / Tax / Net Income / Current Assets / Fixed Assets / Current Liabilities / Long-term Liabilities / Equity)
- L3: Subcategory (e.g., OpEx → Salaries / Rent / Marketing / IT / Admin)
- L4: Source account code (ERP-native)

### Why
Every ERP uses different account numbering. SAP uses 6-digit codes, BC uses alphanumeric, Odoo uses `account_type` enum. Without canonical mapping, consolidated reports are impossible and period comparison across ERPs is meaningless.

### Acceptance Criteria
- AC-08: ≥ 95% of source accounts mapped after initial mapping session with pre-built templates
- AC: Unmapped account blocks GL line from appearing in consolidated reports (quarantined)
- AC: Pre-built templates cover SAP OP INT CoA, BC default CoA, Odoo standard accounts
- AC: Canonical account hierarchy queryable at all 4 levels

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/coa_normalization_service.py

class CoANormalizationService:

  def get_canonical_mapping(erp_source_id, source_account_code) -> CanonicalAccount | None:
    mapping = db.get(dim_erp_mapping, {erp_source_id, source_account_code, dimension_type='account'})
    return mapping.canonical if mapping else None

  def normalize_gl_line(raw_line, erp_source_id) -> CanonicalGLLine | None:
    canonical = get_canonical_mapping(erp_source_id, raw_line.account_code)
    if not canonical:
      quarantine_line(raw_line, reason='unmapped_account')
      alert_unmapped(erp_source_id, raw_line.account_code)
      return None

    return CanonicalGLLine(
      canonical_l1 = canonical.financial_statement,
      canonical_l2 = canonical.category,
      canonical_l3 = canonical.subcategory,
      source_account_code = raw_line.account_code,
      source_account_name = raw_line.account_name,
      ...
    )

# Seed templates per ERP type
def apply_erp_template(erp_source_id, erp_type):
  template = load_template(f"data/mapping_templates/{erp_type}_default.json")
  for mapping in template:
    db.upsert(dim_erp_mapping, {erp_source_id, **mapping, mapped_by='template'})

# Quarantine
def quarantine_line(raw_line, reason):
  db.insert(fact_gl_quarantine, {raw_line, reason, quarantined_at: now()})
```

### Frontend
- Unmapped accounts alert on Dashboard: "23 accounts unmapped — data incomplete"
- Click → opens Field Mapper (ERP-CF-004) filtered to unmapped accounts
- Quarantine report: list of GL lines excluded from reports due to unmapped accounts

---

## A — Architecture

### New Files
- `03_Backend/services/coa_normalization_service.py`
- `03_Backend/data/mapping_templates/bc_coa_default.json`
- `03_Backend/data/mapping_templates/sap_op_int_coa.json`
- `03_Backend/data/mapping_templates/odoo_account_type_map.json`
- `03_Backend/database.py` — `fact_gl_quarantine` table

### Modified Files
- `03_Backend/workers/sync_worker.py` — call normalization in pipeline

### DB / API changes
```sql
fact_gl_quarantine (
  quarantine_id    UUID PRIMARY KEY,
  erp_source_id    INT,
  raw_journal_id   VARCHAR(100),
  source_account   VARCHAR(100),
  reason           VARCHAR(50),
  quarantined_at   TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ  -- set when mapping added and record re-processed
)
```

---

## R — Refinement

### Edge Cases
- Account renamed in ERP mid-year: old code still in fact_gl_entries — mapping must cover historical codes
- Multiple ERP accounts map to same canonical: valid (many-to-one) — aggregate correctly
- New account posted to before mapping session: quarantined immediately; CFO alerted
- SAP cost element vs. GL account: SAP has both — only GL accounts (SKA1) in canonical; cost elements → dimension

### Security
- Template loading validated against schema before applying
- Quarantine log is audit trail — no deletes

### Performance
- Mapping lookup: in-memory dict cache per sync session (key: erp_source_id + account_code)
- Template application: batch upsert in single transaction

---

## C — Completion

### Done Criteria
- [ ] CanonicalAccount 4-level model defined
- [ ] Normalization service maps source code → canonical or quarantines
- [ ] SAP, BC, Odoo default templates seeded
- [ ] Quarantine table capturing unmapped lines
- [ ] Dashboard alert for unmapped accounts with count
- [ ] Re-process quarantined lines after mapping added

### Test Plan
- Apply BC template → map known BC account "40000 Sales" → verify L2=Revenue
- Submit GL line with unmapped account → verify quarantine entry created
- Add mapping for unmapped account → re-run → verify line moved from quarantine to fact_gl_entries
- Apply SAP OP INT template → verify 200+ pre-mapped accounts
