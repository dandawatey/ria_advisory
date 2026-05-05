# Feature: ERP-CON-SAP — SAP S/4HANA Cloud Connector

**Created:** 2026-04-29
**Ticket:** ERP-CON-SAP
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** Critical
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
SAP S/4HANA Cloud connector via OData v4 (`API_GLACCOUNTLINEITEM_SRV`). OAuth2 SAP IDCS. Always use leading ledger (0L). Handle document splitting line items. Read SAP fiscal year variant from T009 (via ERP-DN-002). Debit/credit sign normalization (SAP sign reversal for expense accounts). Company code → entity mapping.

### Why
SAP is the most-demanded ERP among enterprise clients. Connecting to SAP eliminates the need for SAP consultants to run manual GL exports. Largest market opportunity in PRD_02.

### Acceptance Criteria
- AC-02: SAP connector pulls `GLAccountLineItem` for 30-day range; matches SAP Trial Balance by ≤ 0.01 variance
- AC: Leading ledger (0L) used unless client requests parallel ledger
- AC: Document split lines included
- AC: Fiscal year variant read from T009; period → canonical month mapping correct
- AC: Debit/credit normalized (SAP expense sign reversal)
- AC: Company code → i-finsights entity mapping configured in wizard

---

## P — Pseudocode

### Backend
```
# 03_Backend/connectors/sap_s4_connector.py

class SAPS4Connector(ERPConnector):
  base_url: str   # https://{host}/sap/opu/odata/sap/API_GLACCOUNTLINEITEM_SRV

  async def connect(credentials):
    token = await get_oauth_token(
      client_id=credentials['client_id'],
      client_secret=credentials['client_secret'],
      token_url=credentials['token_url'],  # SAP IDCS OAuth endpoint
      scope='API_GLACCOUNTLINEITEM_SRV'
    )
    self.session = HTTPSession(headers={'Authorization': f'Bearer {token}'})

  async def fetch_gl_entries(from_date, to_date, ledger_id='0L'):
    url = f"{base_url}/A_GLAccountLineItem"
    params = {
      '$filter': (
        f"CompanyCode eq '{self.company_code}' "
        f"and PostingDate ge datetime'{from_date}T00:00:00' "
        f"and PostingDate le datetime'{to_date}T23:59:59' "
        f"and Ledger eq '{ledger_id}'"
      ),
      '$select': (
        'CompanyCode,GLAccount,PostingDate,AccountingDocumentItem,'
        'AccountingDocument,AmountInTransactionCurrency,TransactionCurrency,'
        'AmountInCompanyCodeCurrency,CompanyCodeCurrency,'
        'DebitCreditCode,DocumentItemText,CostCenter,ProfitCenter,WBSElement'
      ),
      '$top': 500  # SAP: smaller pages for safety
    }
    async for page in paginate_odata(url, params):
      for entry in page:
        yield map_to_raw_gl_line(entry)

  def map_to_raw_gl_line(entry) -> RawGLLine:
    # SAP sign convention: expense accounts may be stored as negative
    # Normalize: always debit-positive
    dc_flag = entry['DebitCreditCode']  # 'S' = Soll/Debit, 'H' = Haben/Credit
    amount = Decimal(entry['AmountInCompanyCodeCurrency'])
    debit = amount if dc_flag == 'S' else Decimal(0)
    credit = amount if dc_flag == 'H' else Decimal(0)

    return RawGLLine(
      erp_type='SAP_S4',
      erp_native_journal_id=entry['AccountingDocument'],
      erp_native_line_number=entry['AccountingDocumentItem'],
      account_code=entry['GLAccount'],
      posting_date=entry['PostingDate'],
      debit=debit, credit=credit,
      transaction_currency=entry['TransactionCurrency'],
      transaction_amount=Decimal(entry['AmountInTransactionCurrency']),
      description=entry['DocumentItemText'],
      dimensions={
        'CostCenter': entry.get('CostCenter'),
        'ProfitCenter': entry.get('ProfitCenter'),
        'WBSElement': entry.get('WBSElement')
      }
    )

  async def fetch_coa():
    url = f"{base_url_fiori}/A_GLAccountInChartOfAccounts"
    # Filter by client's chart of accounts key (KTOPL)
    ...
```

### Frontend
- Add Connector Wizard: SAP S/4HANA option
  - Step 1: Host URL, client_id, client_secret, token_url
  - Step 2: Company code + entity mapping
  - Step 3: Ledger selection (0L default; show available ledgers)
  - Step 4: Fiscal year variant (auto-detect from T009 or manual select)
  - Step 5: Test connection + sample GL pull

---

## A — Architecture

### New Files
- `03_Backend/connectors/sap_s4_connector.py`
- `03_Backend/connectors/sap_mapper.py` — SAP fields + sign normalization
- `03_Backend/data/mapping_templates/sap_op_int_coa.json` — SAP OP INT standard CoA mappings

### Modified Files
- `03_Backend/connectors/__init__.py` — register SAPS4Connector

### DB / API changes
`dim_erp_source.erp_type = 'SAP_S4'`. SAP config:
```json
{
  "host": "...", "company_code": "1000",
  "ledger": "0L", "chart_of_accounts": "INT",
  "fy_variant": "K4"
}
```

---

## R — Refinement

### Edge Cases
- SAP API returns 0 for empty amount fields (not null): treat 0 as valid
- Document splitting: split lines have same AccountingDocument but different AccountingDocumentItem — both included; natural key handles uniqueness
- S/4HANA BTP middleware required for some cloud editions: connector config flag `use_btp=true`
- Parallel ledger entries (N1, etc.): always filter by `Ledger eq '0L'` unless explicitly configured otherwise
- SAP period 0 (opening balance): map to December of prior year

### Security
- SAP basis team creates RFC user with read-only authorizations: `S_RFC`, `S_TABU_DIS`
- No write operations — connector is read-only
- SAP IDCS client secret in vault

### Performance
- `$top=500` (conservative for SAP — large split documents)
- Date-range chunks: monthly for historical backfill
- BSEG volume warning: SAP ECC (not S4 Cloud) can have billions of rows — mandatory date filter enforced

---

## C — Completion

### Done Criteria
- [ ] SAPS4Connector implements all 7 ERPConnector methods
- [ ] OAuth2 SAP IDCS flow working
- [ ] Debit/credit sign normalization (D/C flag → debit-positive)
- [ ] Document split lines included
- [ ] Fiscal year variant read + period mapping (via ERP-DN-002)
- [ ] Company code → entity mapping in wizard
- [ ] Trial balance validation: ≤ 0.01 variance vs SAP TB (AC-02)

### Test Plan
- AC-02: Pull 30-day range → compare sum per account vs SAP Trial Balance → variance ≤ 0.01
- Debit entry (dc_flag='S') → verify stored as debit, credit=0
- Credit entry (dc_flag='H') → verify stored as credit, debit=0
- Document with 5 split lines → verify all 5 RawGLLine records with unique line_numbers
- FY variant K4: period 1 → January ✓
- FY variant V3: period 1 → April ✓
