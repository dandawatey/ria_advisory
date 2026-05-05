# Feature: ERP-CON-BC — Business Central REST API Upgrade

**Created:** 2026-04-29
**Ticket:** ERP-CON-BC
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** Critical
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Migrate BC connector from Excel export (manual) to BC REST API v2.0 (OData). OAuth2 via Azure AD client credentials. Webhook subscription for real-time GL entry change events. Multi-company enumeration. Custom dimension mapping (up to 8 global/shortcut dimensions). Backward compatible — existing Excel-loaded data becomes baseline; API adds incremental from go-live date.

### Why
Excel export is manual, error-prone, and 3–10 days stale. BC has a fully documented REST API v2.0. Migration eliminates the biggest operational pain point for existing BC clients and sets the pattern for all subsequent connectors.

### Acceptance Criteria
- AC-01: BC connector pulls all GL entries for a date range within 5 minutes for up to 100,000 records
- AC: OAuth2 token obtained via client credentials flow; auto-refreshed before expiry
- AC: Multi-company: all companies enumerable via `/companies`; selective sync supported
- AC: Custom dimensions (up to 8) fetched and mapped to canonical dimensions
- AC: Webhook subscription registered on connector setup; events trigger incremental sync
- AC: Existing Excel-loaded data preserved; API sync appends from go-live date

---

## P — Pseudocode

### Backend
```
# 03_Backend/connectors/bc_connector.py

class BusinessCentralConnector(ERPConnector):
  base_url: str   # https://api.businesscentral.dynamics.com/v2.0/{tenant_id}/{env}/api/v2.0
  company_id: str

  async def connect(credentials):
    token = await get_oauth_token(
      client_id=credentials['client_id'],
      client_secret=credentials['client_secret'],
      tenant_id=credentials['tenant_id'],
      scope='https://api.businesscentral.dynamics.com/.default'
    )
    self.session = HTTPSession(headers={'Authorization': f'Bearer {token}'})

  async def fetch_gl_entries(from_date, to_date, ledger_id=None):
    url = f"{base_url}/companies({company_id})/generalLedgerEntries"
    params = {
      '$filter': f"postingDate ge {from_date} and postingDate le {to_date}",
      '$top': 1000,
      '$select': 'id,postingDate,accountNumber,documentNumber,debitAmount,creditAmount,description,dimensionSetID'
    }
    async for page in paginate_odata(url, params):
      for entry in page:
        dims = await fetch_dimension_values(entry['dimensionSetID'])
        yield map_to_raw_gl_line(entry, dims)

  async def fetch_coa():
    url = f"{base_url}/companies({company_id})/accounts"
    return await get_all_pages(url)

  async def fetch_dimensions():
    url = f"{base_url}/companies({company_id})/dimensionValues"
    return await get_all_pages(url)

  async def fetch_entities():
    url = f"{base_url}/companies"
    return await get_all_pages(url)

  async def register_webhook():
    # Subscribe to generalLedgerEntries change events
    POST f"{base_url}/subscriptions" body={
      notificationUrl: f"{IFS_BASE_URL}/webhooks/bc/{tenant_id}",
      resource: f"companies({company_id})/generalLedgerEntries",
      clientState: generate_hmac_secret()
    }

  def map_to_raw_gl_line(entry, dims) -> RawGLLine:
    return RawGLLine(
      erp_type='BC',
      erp_native_journal_id=entry['documentNumber'],
      account_code=entry['accountNumber'],
      posting_date=entry['postingDate'],
      debit=Decimal(entry['debitAmount']),
      credit=Decimal(entry['creditAmount']),
      description=entry['description'],
      dimensions={f"BC_DIM_{k}": v for k, v in dims.items()}
    )
```

### Frontend
- Add Connector Wizard: BC option → prompts for tenant_id, client_id, client_secret, environment name
- Company selector: multi-select after test_connection succeeds

---

## A — Architecture

### New Files
- `03_Backend/connectors/bc_connector.py`
- `03_Backend/connectors/bc_mapper.py` — raw BC fields → RawGLLine

### Modified Files
- `03_Backend/connectors/__init__.py` — register BCConnector
- `03_Backend/routers/webhooks.py` — add BC webhook endpoint
- `03_Backend/data/mapping_templates/bc_coa_default.json` — BC standard CoA template

### DB / API changes
`dim_erp_source.erp_type = 'BC'`. BC-specific config in `dim_erp_source.config_json`:
```json
{"tenant_id": "...", "environment": "production", "company_ids": ["..."]}
```

---

## R — Refinement

### Edge Cases
- Dimension set ID 0 (no dimensions): return empty dict — no error
- Draft entries (postingDate IS NULL): filter out with `$filter=postingDate ne null`
- BC API rate limit: 600 requests/minute per app registration — implement throttle
- Webhook expiry: BC webhooks expire after 3 days — auto-renew daily
- Multi-company: if company has zero GL entries → skip silently

### Security
- `client_secret` stored in vault only (ERP-CF-002)
- Webhook validation: verify `clientState` HMAC on every incoming event
- Azure AD app: `Financials.ReadWrite.All` minimum scope (ReadOnly preferred if available)

### Performance
- OData `$top=1000` pagination; parallel pages up to 3 concurrent
- 100k records in 5 minutes: ~100 pages × 1000 records, ~3s per page = ~5min
- Dimension fetch: cache dimension set by ID (sets are reused across entries)

---

## C — Completion

### Done Criteria
- [ ] BCConnector implements all 7 ERPConnector methods
- [ ] OAuth2 client credentials flow working
- [ ] Multi-company enumeration and selective sync
- [ ] Custom dimension fetch and mapping
- [ ] Webhook subscription registered and events handled
- [ ] Existing Excel data preserved; API sync appends correctly
- [ ] 100k records in < 5 minutes (performance test)

### Test Plan
- AC-01: Pull 100k entries for date range → verify count + timing < 5 min
- OAuth token expiry: simulate → verify auto-refresh
- Multi-company: 3 companies → verify each syncs independently
- Webhook: post mock GL change event → verify incremental sync triggered
- Draft entry (no postingDate): verify excluded from results
- Existing Excel records: verify not overwritten by API sync
