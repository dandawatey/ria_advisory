# Feature: ERP-CON-ORACLE — Oracle ERP Cloud Connector

**Created:** 2026-04-29
**Ticket:** ERP-CON-ORACLE
**Type:** Feature
**Phase:** Phase 2
**Priority:** Medium
**Owner:** Rohan_Backend_003
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Oracle Fusion REST API: `/fscmRestApi/resources/.../generalLedgerJournals`. OAuth2 Oracle IDCS. Flexfield segment decoder (CCID → segment values). Both `ENTERED_DR/CR` and `ACCOUNTED_DR/CR` captured. Oracle period name (Mon-YY) parsed. Rate limit: 1000 req/hour token bucket. Optional Oracle Integration Cloud (OIC) middleware.

### Why
Oracle ERP Cloud is the dominant ERP in large enterprise (Fortune 500). Oracle Financials Cloud connections unlock the largest enterprise CFO segment.

### Acceptance Criteria
- AC: `generalLedgerJournals` REST endpoint pulled for specified ledger and date range
- AC: CCID decoded to segment values via `GlCodeCombinations`
- AC: Both functional (accounted) and transaction (entered) amounts stored
- AC: Oracle period name `Apr-26` correctly parsed to `2026-04`
- AC: Rate limiter: max 1000 requests/hour with token bucket
- AC: Intercompany lines tagged `is_intercompany=true`

---

## P — Pseudocode

### Backend
```
# 03_Backend/connectors/oracle_connector.py

class OracleERPConnector(ERPConnector):
  base_url: str  # https://{host}/fscmRestApi/resources/11.13.18.05

  async def connect(credentials):
    token = await get_oauth_token(
      token_url=credentials['idcs_token_url'],
      client_id=credentials['client_id'],
      client_secret=credentials['client_secret'],
      scope='urn:opc:resource:consumer::all'
    )
    self.session = HTTPSession(...)
    self.rate_limiter = TokenBucket(rate=1000, per=3600)  # 1000/hour

  async def fetch_gl_entries(from_date, to_date):
    url = f"{base_url}/generalLedgerJournals"
    offset = 0
    while True:
      await self.rate_limiter.acquire()
      resp = await self.session.get(url, params={
        'q': f"AccountedDate>={from_date};AccountedDate<={to_date};LedgerId={self.ledger_id}",
        'fields': (
          'JournalHeaderId,JournalLineNumber,AccountedDate,'
          'AccountCombinationId,EnteredDebit,EnteredCredit,EnteredCurrency,'
          'AccountedDebit,AccountedCredit,AccountedCurrency,'
          'IntercompanyFlag,Description,JournalSource'
        ),
        'limit': 500, 'offset': offset
      })
      data = resp.json()
      for entry in data['items']:
        segments = await decode_ccid(entry['AccountCombinationId'])
        yield map_to_raw_gl_line(entry, segments)
      if not data.get('hasMore', False):
        break
      offset += 500

  async def decode_ccid(ccid: int) -> dict:
    # Cache: most CCIDs repeat → cache in-memory
    if ccid in self.ccid_cache:
      return self.ccid_cache[ccid]
    await self.rate_limiter.acquire()
    resp = await self.session.get(
      f"{base_url}/glCodeCombinations/{ccid}",
      params={'fields': 'Segment1,Segment2,Segment3,Segment4,Segment5,Segment6,Segment7'}
    )
    segments = resp.json()
    self.ccid_cache[ccid] = segments
    return segments

  def parse_oracle_period(period_name: str) -> str:
    # 'Apr-26' → '2026-04'
    month_abbr, year_2digit = period_name.split('-')
    months = {'Jan':1,'Feb':2,'Mar':3,'Apr':4,'May':5,'Jun':6,
              'Jul':7,'Aug':8,'Sep':9,'Oct':10,'Nov':11,'Dec':12}
    month = months[month_abbr]
    year = 2000 + int(year_2digit)
    return f"{year}-{month:02d}"

  def map_to_raw_gl_line(entry, segments) -> RawGLLine:
    return RawGLLine(
      erp_type='ORACLE',
      erp_native_journal_id=str(entry['JournalHeaderId']),
      erp_native_line_number=str(entry['JournalLineNumber']),
      account_code=segments.get('Segment4', ''),  # account segment varies
      posting_date=entry['AccountedDate'],
      debit=Decimal(str(entry['AccountedDebit'] or 0)),
      credit=Decimal(str(entry['AccountedCredit'] or 0)),
      transaction_currency=entry['EnteredCurrency'],
      transaction_amount_dr=Decimal(str(entry['EnteredDebit'] or 0)),
      transaction_amount_cr=Decimal(str(entry['EnteredCredit'] or 0)),
      is_intercompany=(entry.get('IntercompanyFlag') == 'Y'),
      dimensions={f"ORA_SEG{i}": segments.get(f"Segment{i}") for i in range(1,8)}
    )
```

### Frontend
- Wizard: Oracle ERP → IDCS token URL, client_id, client_secret
- Ledger selector (from `/ledgers` endpoint)
- Flexfield segment configuration: map Segment N → canonical dimension

---

## A — Architecture

### New Files
- `03_Backend/connectors/oracle_connector.py`
- `03_Backend/connectors/oracle_ccid_cache.py` — CCID decoder + LRU cache
- `03_Backend/connectors/rate_limiter.py` — token bucket (shared across connectors)

### Modified Files
- `03_Backend/connectors/__init__.py`

### DB / API changes
`dim_erp_source.erp_type = 'ORACLE'`.

---

## R — Refinement

### Edge Cases
- Flexfield structure varies per Oracle client: must read `FND_ID_FLEX_SEGMENTS` to get correct segment-to-field mapping
- OTBI bulk export for backfill: Oracle recommends OTBI (BI Publisher) for large historical pulls — implement as separate backfill path
- 1000 req/hour limit: 500 entries/page × 2 pages = 2 requests; 1000/2 = 500 pages/hour = 250k entries/hour — sufficient for incremental
- Journal import service: Oracle sometimes generates balancing lines with description "Oracle ERP generated" — filter if `SystemGeneratedFlag='Y'` unless needed

### Security
- Oracle IDCS client credentials in vault
- No write access needed; scope: read only

### Performance
- CCID cache: saves ~50% of API calls (combos repeat heavily)
- Rate limiter: token bucket with 1000 token capacity, refill 1000/hour
- Backfill: OTBI bulk export bypasses REST rate limits

---

## C — Completion

### Done Criteria
- [ ] OracleERPConnector implements all 7 methods
- [ ] Oracle IDCS OAuth2 working
- [ ] CCID decoding with LRU cache
- [ ] Rate limiter (token bucket, 1000/hour)
- [ ] Oracle period name `Apr-26` → `2026-04`
- [ ] Both accounted and entered amounts stored
- [ ] Intercompany flag tagging

### Test Plan
- Period `Apr-26` → `2026-04` ✓; `Dec-25` → `2025-12` ✓
- CCID decode: first call hits API; second call hits cache (verify 0 API calls)
- Rate limit: fire 1001 requests in 1 hour → verify 1001st waits
- ICO flag: `IntercompanyFlag='Y'` → verify `is_intercompany=true`
- Both `EnteredDebit` and `AccountedDebit` stored separately
