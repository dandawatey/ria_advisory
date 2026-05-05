# Feature: ERP-DN-002 — Fiscal Year Alignment

**Created:** 2026-04-29
**Ticket:** ERP-DN-002
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Kiran_Data_008
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Map ERP-native period numbers to canonical YYYY-MM period. Handle non-calendar fiscal years (Apr–Mar, Oct–Sep), JDE Julian dates, SAP fiscal year variants, 4-4-5 calendars, 13-period calendars. Auto-detect FY from first sync; manual override available.

### Why
JDE "Period 01" = April for an April–March FY client. BC "Jan 2026" = January. Treating them the same without mapping produces incorrect comparative reports. CFO cannot compare entities side-by-side without common period axis.

### Acceptance Criteria
- AC-07: JDE Period 01 (April–March FY) correctly maps to YYYY-04 canonical period
- AC: SAP fiscal year variant K4 (calendar year) maps period 01 → January correctly
- AC: SAP variant V3 (Apr–Mar) maps period 01 → April correctly
- AC: Canonical period stored as YYYY-MM for all ERP sources
- AC: FY end auto-detected from first sync data; shown in connector setup for confirmation

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/fiscal_year_service.py

class FiscalCalendar:
  entity_id: UUID
  erp_type: str
  fy_start_month: int   # 1=Jan, 4=Apr, 10=Oct
  fy_start_day: int     # usually 1
  period_count: int     # 12 or 13
  period_map: dict      # {period_number: calendar_month}

def build_period_map(fy_start_month, period_count=12) -> dict:
  # period 1 = fy_start_month, period 2 = fy_start_month+1, etc.
  map = {}
  for i in range(1, period_count + 1):
    map[i] = ((fy_start_month - 1 + i - 1) % 12) + 1
  return map

def convert_erp_period_to_canonical(erp_period, fy_year, calendar: FiscalCalendar) -> str:
  calendar_month = calendar.period_map[erp_period]
  # if period crosses calendar year boundary, adjust year
  if calendar_month < calendar.fy_start_month:
    calendar_year = fy_year + 1
  else:
    calendar_year = fy_year
  return f"{calendar_year}-{calendar_month:02d}"

# JDE Julian date converter
def jde_julian_to_date(jde_value: int) -> date:
  # JDE format: CYYDDD where C=century (1=2000s), YY=year within century, DDD=day of year
  century = jde_value // 100000
  year = (jde_value % 100000) // 1000
  day_of_year = jde_value % 1000
  full_year = 1900 + (century * 100) + year
  return date(full_year, 1, 1) + timedelta(days=day_of_year - 1)

# SAP T009 fiscal year variant reader
def read_sap_fy_variant(connector, variant_key) -> FiscalCalendar:
  t009_data = connector.fetch_table('T009', filters={'PERIV': variant_key})
  fy_start_month = parse_t009_start_month(t009_data)
  return FiscalCalendar(fy_start_month=fy_start_month, ...)
```

### Frontend
- FY configuration step in Add Connector Wizard
- Preview: "Period 1 → April 2026, Period 2 → May 2026…"
- Manual override dropdown: FY start month selector

---

## A — Architecture

### New Files
- `03_Backend/services/fiscal_year_service.py` — FiscalCalendar + converters
- `03_Backend/data/fy_presets.json` — common FY configurations per ERP type

### Modified Files
- `03_Backend/workers/sync_worker.py` — call fiscal_year_service in normalization step
- `03_Backend/database.py` — add `fy_calendar JSONB` column to `dim_erp_source`

### DB / API changes
`dim_erp_source` + column: `fy_calendar JSONB` (stores FiscalCalendar config per entity).

---

## R — Refinement

### Edge Cases
- 13-period calendar: period 13 = adjustment period → map to December (period 12) canonical
- 4-4-5 calendar (retail): week-based periods → weighted allocation to canonical months
- Entity changes FY mid-history: store FY calendar with effective_from date; apply correct calendar per posting date
- Tally India: always April–March; pre-set; no configuration needed

### Security
- FY misconfiguration: period mapping preview shown to finance team before first sync
- Manual override logged with user who changed it

### Performance
- Period mapping is pure computation — no DB lookup at record level
- FiscalCalendar loaded once per sync session and cached

---

## C — Completion

### Done Criteria
- [ ] FiscalCalendar model with period_map generation
- [ ] JDE Julian date converter working
- [ ] SAP T009 variant reader (K4, V3 at minimum)
- [ ] Canonical YYYY-MM period stored in `fact_gl_entries.period`
- [ ] FY preview in connector setup wizard
- [ ] 4-4-5 calendar handled (approximation: 4w→month1, 4w→month2, 5w→month3)

### Test Plan
- April–March FY: period 1 → YYYY-04 ✓, period 12 → YYYY-03 ✓
- Calendar year FY: period 1 → YYYY-01 ✓
- JDE Julian 126100 → 2026-04-10 ✓
- SAP variant K4 period 3 → YYYY-03 ✓
- SAP variant V3 period 3 → YYYY-06 ✓
