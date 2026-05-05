# Feature: ERP-CON-ODOO — Odoo JSON-RPC Connector

**Created:** 2026-04-29
**Ticket:** ERP-CON-ODOO
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** Critical
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Odoo connector via JSON-RPC API (v14+: API key auth; v13–: session auth). Model: `account.move.line`. Mandatory filter: posted entries only (`parent_state = 'posted'`). Multi-company via `company_id`. Delta sync via `write_date` (Odoo has no native change tracking). Analytic accounts for project/department dimension.

### Why
Odoo is widely adopted across mid-market clients (open-source ERP). Many regional subsidiaries in UAE/KSA/South Asia run Odoo. Second-largest demand segment after SAP.

### Acceptance Criteria
- AC-03: Odoo connector pulls all posted `account.move.line` records for a company and matches Odoo Trial Balance report
- AC: API key auth (v14+) preferred; session auth fallback for v13
- AC: Multi-company: enumerate via `res.company` model; one sync per company
- AC: Analytic account lines linked and mapped to Project canonical dimension
- AC: Delta sync: `write_date >= last_cursor` filter
- AC: Filter: `parent_state = 'posted'` enforced — no draft entries

---

## P — Pseudocode

### Backend
```
# 03_Backend/connectors/odoo_connector.py

class OdooConnector(ERPConnector):
  url: str          # https://client.odoo.com or self-hosted URL
  db_name: str      # Odoo database name
  api_key: str      # v14+ API key (from vault)

  async def connect(credentials):
    self.url = credentials['url']
    self.db_name = credentials['db']
    self.api_key = credentials['api_key']
    # Verify via authenticate call
    result = await jsonrpc(
      f"{url}/web/dataset/call_kw",
      model='res.users', method='search_read',
      args=[[['id', '=', credentials['user_id']]]],
      kwargs={'fields': ['name'], 'limit': 1}
    )
    assert len(result) == 1

  async def fetch_gl_entries(from_date, to_date):
    offset = 0
    while True:
      records = await jsonrpc(
        f"{url}/web/dataset/call_kw",
        model='account.move.line',
        method='search_read',
        args=[[
          ['parent_state', '=', 'posted'],
          ['company_id', '=', self.company_id],
          ['date', '>=', str(from_date)],
          ['date', '<=', str(to_date)],
          ['move_type', 'in', ['entry','out_invoice','in_invoice','out_refund','in_refund']]
        ]],
        kwargs={
          'fields': ['account_id','date','debit','credit','name','ref',
                     'company_id','currency_id','amount_currency',
                     'analytic_account_id','write_date','move_id'],
          'limit': 1000, 'offset': offset
        }
      )
      if not records:
        break
      for rec in records:
        yield map_to_raw_gl_line(rec)
      offset += 1000

  def map_to_raw_gl_line(rec) -> RawGLLine:
    return RawGLLine(
      erp_type='ODOO',
      erp_native_journal_id=str(rec['move_id'][0]),
      erp_native_line_number=str(rec['id']),
      account_code=str(rec['account_id'][0]),
      account_name=rec['account_id'][1],
      posting_date=rec['date'],
      debit=Decimal(str(rec['debit'])),
      credit=Decimal(str(rec['credit'])),
      transaction_currency=rec['currency_id'][1] if rec['currency_id'] else None,
      transaction_amount=Decimal(str(rec['amount_currency'])),
      description=rec['name'] or rec['ref'],
      dimensions={
        'AnalyticAccount': rec['analytic_account_id'][1] if rec['analytic_account_id'] else None
      }
    )

  async def fetch_entities():
    return await jsonrpc(
      model='res.company', method='search_read',
      args=[[]], kwargs={'fields': ['name','currency_id','country_id']}
    )

  async def get_sync_cursor() -> SyncCursor:
    latest_write = db.query("SELECT MAX(write_date) FROM fact_gl_entries WHERE erp_type='ODOO'")
    return SyncCursor(cursor_type='timestamp', value=str(latest_write), as_of=now())

  async def jsonrpc(url, model, method, args, kwargs):
    payload = {
      "jsonrpc": "2.0", "method": "call", "id": gen_id(),
      "params": {
        "model": model, "method": method, "args": args, "kwargs": kwargs
      }
    }
    headers = {'X-Openerp-Session-Id': self.api_key} if self.api_key else {}
    response = await self.session.post(url, json=payload, headers=headers)
    return response.json()['result']
```

### Frontend
- Add Connector Wizard: Odoo option
  - Step 1: URL, database name, API key (or username/password for v13)
  - Step 2: Company selector (from res.company)
  - Step 3: Odoo version selection (v13/v14/v15/v16/v17)
  - Step 4: Test connection → show company list

---

## A — Architecture

### New Files
- `03_Backend/connectors/odoo_connector.py`
- `03_Backend/connectors/odoo_mapper.py`
- `03_Backend/data/mapping_templates/odoo_account_type_map.json`

### Modified Files
- `03_Backend/connectors/__init__.py` — register OdooConnector

### DB / API changes
`dim_erp_source.erp_type = 'ODOO'`. Odoo config:
```json
{"url": "...", "db": "production", "version": "16", "company_ids": [1, 3]}
```

---

## R — Refinement

### Edge Cases
- `write_date` delta sync: Odoo updates `write_date` on any field change, not just financial — may pull non-financial changes. Deduplicate by `move_id` + `id` (natural key)
- Odoo SaaS (v15 and below): no REST API — JSON-RPC only. v16+ REST available but JSON-RPC still works
- Multi-currency: `amount_currency` is 0 for same-currency transactions — use `debit/credit` as functional amount
- Reconciled lines (`reconciled=True`): include them — reconciliation is an accounting action, not a GL exclusion
- `account_type` mapping: Odoo `income` → Revenue; `expense` → OpEx; `asset_receivable` → Current Assets etc.

### Security
- API key in vault
- DB name and URL in `dim_erp_source.config_json` (not secret)
- For self-hosted: ensure Odoo XML-RPC/JSON-RPC not exposed to internet without TLS

### Performance
- JSON-RPC `limit=1000` per call; offset pagination
- Parallel: not advisable for Odoo SaaS (rate limits)
- Delta via `write_date`: efficient for incremental but first full sync of large databases takes time (batch nightly)

---

## C — Completion

### Done Criteria
- [ ] OdooConnector implements all 7 ERPConnector methods
- [ ] API key auth (v14+) working; session auth fallback
- [ ] `parent_state='posted'` filter enforced
- [ ] Multi-company enumeration and per-company sync
- [ ] Analytic account dimension mapped to Project canonical
- [ ] Delta sync via `write_date`
- [ ] Trial balance match: ≤ 0.01 variance vs Odoo TB (AC-03)

### Test Plan
- AC-03: Pull all posted entries → compare sum per account vs Odoo Trial Balance → ≤ 0.01 variance
- Draft entry (parent_state='draft'): verify excluded
- Multi-company (3 companies): verify each syncs separately
- Delta sync: post new entry → re-run → verify only new entry fetched
- Analytic account present → verify dimension_project mapped
- v13 (session auth): verify fallback works
