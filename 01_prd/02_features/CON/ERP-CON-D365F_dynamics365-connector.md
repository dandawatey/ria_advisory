# Feature: ERP-CON-D365F — Microsoft Dynamics 365 Finance Connector

**Created:** 2026-04-29
**Ticket:** ERP-CON-D365F
**Type:** Feature
**Phase:** Phase 2
**Priority:** High
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
D365F connector via OData REST API (`GeneralJournalAccountEntries` entity) + Business Events for near-real-time push. OAuth2 Azure AD service principal. Legal entity enumeration. Financial dimension framework decoding (`LedgerDimension` → segment values). ICO voucher tagging. Optional Dataverse dual-write path.

### Why
D365F is the ERP of choice for large enterprise parent companies running Microsoft stack. Often parent runs D365F while subsidiaries run BC — combining both in consolidated view is a high-value scenario.

### Acceptance Criteria
- AC: `GeneralJournalAccountEntries` OData entity pulled for all legal entities
- AC: Financial dimensions decoded from `LedgerDimensionValue` combinations
- AC: Business Event `GeneralJournalEntryPosted` triggers incremental sync (near-real-time)
- AC: ICO vouchers tagged `is_intercompany=true`
- AC: Multi-currency: all 3 amounts pulled (transaction, functional, reporting)
- AC: Budget entries optionally pulled (`BudgetTransactionLine`)

---

## P — Pseudocode

### Backend
```
# 03_Backend/connectors/d365f_connector.py

class D365FConnector(ERPConnector):
  base_url: str  # https://{tenant}.operations.dynamics.com

  async def connect(credentials):
    token = await get_oauth_token(
      scope=f"https://{credentials['tenant_host']}/.default",
      client_id=credentials['client_id'],
      client_secret=credentials['client_secret'],
      authority=f"https://login.microsoftonline.com/{credentials['aad_tenant_id']}"
    )
    self.session = HTTPSession(...)

  async def fetch_gl_entries(from_date, to_date):
    url = f"{base_url}/data/GeneralJournalAccountEntries"
    params = {
      '$filter': (
        f"AccountingDate ge {from_date} and AccountingDate le {to_date} "
        f"and LegalEntity eq '{self.legal_entity}'"
      ),
      '$select': (
        'JournalNumber,AccountingDate,MainAccountId,LedgerDimension,'
        'TransactionCurrencyAmount,TransactionCurrencyCode,'
        'AccountingCurrencyAmount,ReportingCurrencyAmount,'
        'IsIntercompanyTransaction,PostingType,Text'
      )
    }
    async for page in paginate_odata(url, params):
      for entry in page:
        dims = decode_ledger_dimension(entry['LedgerDimension'])
        yield map_to_raw_gl_line(entry, dims)

  def decode_ledger_dimension(ledger_dimension_value: str) -> dict:
    # D365F LedgerDimension is a backing dimension reference
    # Must call DimensionAttributeValueCombination entity to decode
    combo = fetch_dimension_combo(ledger_dimension_value)
    return parse_dimension_segments(combo)

  def map_to_raw_gl_line(entry, dims) -> RawGLLine:
    amount = Decimal(str(entry['AccountingCurrencyAmount']))
    # D365F: positive = debit, negative = credit
    debit = amount if amount > 0 else Decimal(0)
    credit = abs(amount) if amount < 0 else Decimal(0)
    return RawGLLine(
      erp_type='D365F',
      erp_native_journal_id=entry['JournalNumber'],
      account_code=entry['MainAccountId'],
      posting_date=entry['AccountingDate'],
      debit=debit, credit=credit,
      is_intercompany=entry['IsIntercompanyTransaction'],
      dimensions=dims
    )

  async def fetch_entities():
    url = f"{base_url}/data/LegalEntities"
    return await get_all_pages(url)

# Business Event webhook
POST /webhooks/d365f/{tenant_id}
  → validate event → trigger incremental sync for affected legal entity
```

### Frontend
- Wizard: D365F → Azure AD tenant ID, client ID, client secret, D365F hostname
- Legal entity multi-select (from `LegalEntities` OData)
- Business Events setup guide link (D365F admin must configure in D365F)

---

## A — Architecture

### New Files
- `03_Backend/connectors/d365f_connector.py`
- `03_Backend/connectors/d365f_dimension_decoder.py`

### Modified Files
- `03_Backend/routers/webhooks.py` — add D365F Business Event endpoint

### DB / API changes
`dim_erp_source.erp_type = 'D365F'`.

---

## R — Refinement

### Edge Cases
- `LedgerDimension` decoding API call per entry = N+1 problem — batch decode or cache combos
- Consolidation accounts: D365F has separate consolidation accounts — filter by `PostingType != 'Consolidation'` for operational GL
- Dual-write: if client uses Dataverse dual-write, can pull from Dataverse (simpler) — config flag
- D365F near-real-time Business Events: requires D365F admin to configure; fallback to hourly polling

### Security
- Azure AD service principal: `GeneralLedger.Read` permission scope
- Same Azure AD tenant as BC if possible (unified service principal)

### Performance
- Dimension combo cache: in-memory per sync session (combos repeat extensively)
- Business Events: near-real-time, < 2 min latency when configured

---

## C — Completion

### Done Criteria
- [ ] D365FConnector implements all 7 methods
- [ ] OAuth2 Azure AD service principal working
- [ ] Financial dimension decoding working
- [ ] Business Event webhook endpoint
- [ ] ICO voucher tagging (`is_intercompany`)
- [ ] Multi-currency all 3 amounts captured

### Test Plan
- Pull GL entries for 30-day range → verify count
- Decode complex LedgerDimension with 5 segments → verify all 5 values
- ICO voucher → verify is_intercompany=true
- Business Event webhook → mock event → verify sync triggered
