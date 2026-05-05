# Feature: ERP-CON-JDE — JD Edwards EnterpriseOne Connector

**Created:** 2026-04-29
**Ticket:** ERP-CON-JDE
**Type:** Feature
**Phase:** Phase 2
**Priority:** Medium
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
JDE connector via Orchestrator Framework REST API (E9.2+) or JDBC direct to Oracle DB (older versions). F0911 Account Ledger table. Julian date conversion. Natural account = MCU+OBJ+SUB. Filter `GLLT='AA'` for actuals. F0010 company constants for fiscal date pattern. Multi-currency via `GLCRCD`+`GLCRA`.

### Why
JDE EnterpriseOne is prevalent in manufacturing, distribution, and oil & gas sectors. High-value enterprise clients in GCC region use JDE. Connecting JDE expands addressable market to heavy industry CFOs.

### Acceptance Criteria
- AC: `F0911` records pulled for specified company and date range
- AC: Julian date `GLDGJ` correctly converted to calendar date
- AC: Natural account (MCU+OBJ+SUB) correctly assembled and looked up in F0901
- AC: Only `GLLT='AA'` (actual ledger) entries included
- AC: Fiscal period mapping from F0010 applied (via ERP-DN-002)
- AC: Multi-currency: domestic + foreign amounts both captured

---

## P — Pseudocode

### Backend
```
# 03_Backend/connectors/jde_connector.py

class JDEConnector(ERPConnector):
  # Two modes: Orchestrator (preferred) or JDBC
  mode: Literal['orchestrator', 'jdbc']

  # --- ORCHESTRATOR MODE ---
  async def fetch_gl_entries_orchestrator(from_date, to_date):
    payload = {
      "inputs": {
        "businessUnit": self.business_unit,
        "fromDate": format_jde_date(from_date),
        "toDate": format_jde_date(to_date),
        "ledgerType": "AA"
      }
    }
    response = await post(f"{base_url}/orchestrator/GetF0911Records", payload)
    for entry in response['data']:
      yield map_to_raw_gl_line(entry)

  # --- JDBC MODE ---
  def fetch_gl_entries_jdbc(from_date, to_date):
    sql = """
      SELECT gl.GLKCO, gl.GLMCU, gl.GLOBJ, gl.GLSUB,
             gl.GLDGJ, gl.GLAA, gl.GLDC, gl.GLCRCD, gl.GLCRA,
             gl.GLDL, gl.GLANI, gl.GLDOC, gl.GLDCT,
             acct.AMDSC1
      FROM {schema}.F0911 gl
      LEFT JOIN {schema}.F0901 acct ON gl.GLMCU=acct.AMMCU AND gl.GLOBJ=acct.AMOBJ AND gl.GLSUB=acct.AMSUB
      WHERE gl.GLKCO=:company
        AND gl.GLLT='AA'
        AND gl.GLDGJ BETWEEN :from_julian AND :to_julian
    """
    for row in execute_query(sql, params):
      yield map_row_to_raw_gl_line(row)

  def map_row_to_raw_gl_line(row) -> RawGLLine:
    posting_date = jde_julian_to_date(row['GLDGJ'])
    account_code = f"{row['GLMCU'].strip()}.{row['GLOBJ'].strip()}.{row['GLSUB'].strip()}"

    # JDE: GLAA always positive; GLDC = 'D' (debit) or 'C' (credit)
    amount = Decimal(str(row['GLAA'])) / 100  # JDE stores in cents
    debit = amount if row['GLDC'] == 'D' else Decimal(0)
    credit = amount if row['GLDC'] == 'C' else Decimal(0)

    return RawGLLine(
      erp_type='JDE',
      erp_native_journal_id=str(row['GLDOC']),
      account_code=account_code,
      account_name=row.get('AMDSC1'),
      posting_date=posting_date,
      debit=debit, credit=credit,
      transaction_currency=row.get('GLCRCD'),
      transaction_amount=Decimal(str(row.get('GLCRA', 0))) / 100
    )

  @staticmethod
  def jde_julian_to_date(jde_value: int) -> date:
    # JDE: CYYDDD — C=century flag, YY=2-digit year, DDD=day of year
    century = jde_value // 100000
    year_2digit = (jde_value % 100000) // 1000
    day_of_year = jde_value % 1000
    full_year = 1900 + century * 100 + year_2digit
    return date(full_year, 1, 1) + timedelta(days=day_of_year - 1)
```

### Frontend
- Wizard: JDE → Mode selection (Orchestrator vs JDBC)
  - Orchestrator: base URL, username/password (JDE security token)
  - JDBC: Oracle JDBC URL, schema name, DB credentials
  - Company code + fiscal date pattern (F0010 auto-read or manual)

---

## A — Architecture

### New Files
- `03_Backend/connectors/jde_connector.py`
- `03_Backend/connectors/jde_mapper.py` — Julian date + amount conversion

### Modified Files
- `03_Backend/connectors/__init__.py`

### DB / API changes
`dim_erp_source.erp_type = 'JDE'`.

---

## R — Refinement

### Edge Cases
- JDE periods 13/14 (adjustment periods): map period 13 → December canonical (December adjustment)
- GLAA = 0: valid entry (e.g., statistical posting) — include, not error
- MCU/OBJ/SUB with spaces: right-pad to standard width before concatenation
- JDBC unavailable: Orchestrator-only mode; if Orchestrator also unavailable → error with DBA guidance

### Security
- JDBC Oracle credentials in vault (read-only DB user)
- JDE security token in vault
- JDBC user: SELECT on F0911, F0901, F0010 only — no other tables

### Performance
- JDE JDBC: date filter on `GLDGJ` — requires index on F0911 (GLKCO + GLDGJ); check with DBA
- JDBC batch size: 5000 rows (Oracle handles large fetches efficiently)
- Orchestrator: REST calls, smaller pages (1000)

---

## C — Completion

### Done Criteria
- [ ] JDEConnector JDBC mode: F0911 query with date filter + company filter
- [ ] JDEConnector Orchestrator mode: GetF0911Records call
- [ ] Julian date conversion verified
- [ ] Natural account assembly (MCU.OBJ.SUB) + F0901 lookup
- [ ] GLLT='AA' filter enforced
- [ ] Multi-currency: GLCRCD + GLCRA captured
- [ ] Fiscal period mapping from F0010 (via ERP-DN-002)

### Test Plan
- Julian date 126100 → 2026-04-10 ✓
- Julian date 125001 → 2025-01-01 ✓
- GLDC='D', GLAA=500000 → debit=5000.00, credit=0 ✓
- GLDC='C', GLAA=250000 → debit=0, credit=2500.00 ✓
- GLLT='BA' entry → verify excluded
- F0901 lookup for account code → verify account name returned
