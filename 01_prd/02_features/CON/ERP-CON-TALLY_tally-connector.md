# Feature: ERP-CON-TALLY — Tally Prime On-Premise Agent

**Created:** 2026-04-29
**Ticket:** ERP-CON-TALLY
**Type:** Feature
**Phase:** Phase 2
**Priority:** Medium
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Lightweight Python agent installed on-premise alongside Tally Prime. Agent pulls from Tally XML Gateway (port 9000) via TDL XML requests. Pushes data to i-finsights cloud API. Handles Tally's voucher-based debit/credit convention. Maps Tally ledger groups (Sundry Debtors, Direct Expenses etc.) to canonical account types. Tally fiscal year: April 1 – March 31 (Indian GAAP, fixed).

### Why
Tally Prime has no cloud API. XML Gateway is localhost-only. Only an on-premise agent can bridge Tally to a cloud analytics platform. India is a massive Tally market (millions of businesses). Enables Indian subsidiaries and SME clients.

### Acceptance Criteria
- AC: Tally Agent installable on Windows machine running Tally Prime
- AC: Voucher data pulled via TDL XML for date range
- AC: Debit/credit correctly determined from voucher type + ledger group
- AC: Tally ledger groups mapped to canonical account types
- AC: Agent pushes data to i-finsights `/api/connectors/{id}/ingest` endpoint (push model)
- AC: Scheduled daily push (configurable time in agent config)

---

## P — Pseudocode

### Backend (On-Premise Agent)
```
# tally_agent/main.py  (deployed on-premise, not in main backend)

class TallyAgent:
  tally_url: str = "http://localhost:9000"
  ifs_api_url: str   # i-finsights cloud URL
  api_token: str     # issued by i-finsights for this connector

  def fetch_vouchers(from_date, to_date) -> list[RawVoucher]:
    xml_request = build_tdl_request(from_date, to_date)
    response = requests.post(self.tally_url, data=xml_request,
                             headers={'Content-Type': 'text/xml'})
    return parse_tally_xml(response.text)

  def build_tdl_request(from_date, to_date) -> str:
    return f"""
    <ENVELOPE>
      <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
      <BODY>
        <EXPORTDATA>
          <REQUESTDESC>
            <REPORTNAME>Voucher Register</REPORTNAME>
            <STATICVARIABLES>
              <SVFROMDATE>{format_tally_date(from_date)}</SVFROMDATE>
              <SVTODATE>{format_tally_date(to_date)}</SVTODATE>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
          </REQUESTDESC>
        </EXPORTDATA>
      </BODY>
    </ENVELOPE>
    """

  def determine_debit_credit(voucher_type, ledger_name, ledger_group, amount) -> tuple:
    # Tally voucher type logic:
    DEBIT_GROUPS = ['Direct Expenses', 'Indirect Expenses', 'Purchase Accounts']
    CREDIT_GROUPS = ['Sales Accounts', 'Direct Incomes', 'Indirect Incomes']
    ASSET_GROUPS = ['Bank Accounts', 'Cash-in-Hand', 'Sundry Debtors', 'Fixed Assets']

    if voucher_type == 'Payment':
      # Expense DR, Cash/Bank CR
      if ledger_group in ASSET_GROUPS:
        return (Decimal(0), amount)  # cash/bank = credit
      else:
        return (amount, Decimal(0))  # expense = debit
    elif voucher_type == 'Receipt':
      if ledger_group in ASSET_GROUPS:
        return (amount, Decimal(0))  # cash/bank = debit
      else:
        return (Decimal(0), amount)  # income = credit
    elif voucher_type == 'Journal':
      # Explicit DR/CR in ledger entries
      return (amount if is_debit_entry else Decimal(0),
              amount if not is_debit_entry else Decimal(0))
    # etc.

  def push_to_ifs(records: list[RawGLLine]):
    response = requests.post(
      f"{ifs_api_url}/api/connectors/{self.connector_id}/ingest",
      json={'records': [r.dict() for r in records]},
      headers={'Authorization': f'Bearer {self.api_token}'}
    )
    response.raise_for_status()

TALLY_GROUP_TO_CANONICAL = {
  'Sales Accounts': 'Revenue',
  'Direct Incomes': 'Revenue',
  'Direct Expenses': 'COGS',
  'Purchase Accounts': 'COGS',
  'Indirect Expenses': 'OpEx',
  'Indirect Incomes': 'Other Income',
  'Sundry Debtors': 'Current Assets',
  'Sundry Creditors': 'Current Liabilities',
  'Bank Accounts': 'Current Assets',
  'Cash-in-Hand': 'Current Assets',
  'Fixed Assets': 'Fixed Assets',
  'Capital Account': 'Equity',
  'Loans (Liability)': 'Long-term Liabilities',
}
```

### Cloud Backend (i-finsights ingest endpoint)
```
# 03_Backend/routers/ingest.py
POST /api/connectors/{connector_id}/ingest
  Auth: Bearer token (issued to Tally agent)
  body: {records: [RawGLLine...]}
  → validate + normalize + upsert to fact_gl_entries
```

### Frontend
- Tally Connector setup: download agent installer + show config snippet
- Agent status: shows "Last push: 2 hours ago" + record count
- Setup guide: step-by-step Tally.ini configuration + agent install

---

## A — Architecture

### New Files
- `tally_agent/` — separate Python package (pip-installable)
  - `tally_agent/main.py`
  - `tally_agent/tdl_builder.py`
  - `tally_agent/xml_parser.py`
  - `tally_agent/mapper.py`
  - `tally_agent/config.py`
  - `tally_agent/scheduler.py` (APScheduler daily push)
- `03_Backend/routers/ingest.py` — push ingest endpoint
- `02_Frontend/src/components/connectors/TallyAgentSetup.tsx` — download + config guide

### Modified Files
- `03_Backend/connectors/__init__.py` — Tally is push-model (no pull connector)

### DB / API changes
`dim_erp_source.erp_type = 'TALLY'`. Ingest token in `dim_erp_credential`.

---

## R — Refinement

### Edge Cases
- Tally XML Gateway not running: agent retries 3x then logs error; alerts i-finsights API of failure
- Multiple Tally companies: agent config lists multiple company names; each synced separately
- Tally `.900` data files: agent reads active data path from Tally.ini — must match currently-open company
- Unicode in ledger names (Hindi, Arabic): Tally XML is UTF-8; parse accordingly
- Tally Prime Connected (cloud): if client has cloud version, REST API preferred — detect and use REST instead of XML gateway

### Security
- Agent config file (`tally_agent.conf`): stores API token — restrict file permissions (0600)
- Agent → cloud: HTTPS only; TLS certificate validation enforced
- Ingest token: scoped to single connector_id; rotate quarterly

### Performance
- Daily push: pull 1 month of vouchers in ~2 minutes (Tally XML is fast for date-filtered queries)
- Agent runs as Windows scheduled task or service

---

## C — Completion

### Done Criteria
- [ ] Tally agent pip package installable on Windows
- [ ] TDL XML request correctly fetches vouchers for date range
- [ ] Debit/credit logic for all voucher types (Payment/Receipt/Journal/Sales/Purchase/Contra)
- [ ] Tally group → canonical account type mapping
- [ ] Push to `/api/connectors/{id}/ingest` working
- [ ] Daily scheduler in agent
- [ ] Cloud ingest endpoint validates + upserts
- [ ] Setup guide in UI with agent download

### Test Plan
- Build TDL XML for Apr 1 – Apr 30 → verify valid Tally response
- Payment voucher: Expense AED 5000, Cash account → verify Expense DR=5000, Cash CR=5000
- Receipt voucher: Sales AED 10000, Bank account → verify Sales CR=10000, Bank DR=10000
- Journal voucher → verify explicit debit/credit from ledger entries
- Push 1000 records to ingest endpoint → verify all inserted in fact_gl_entries
- Invalid token on push → verify 401 returned, records not ingested
