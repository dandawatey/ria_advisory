# Feature: ERP-DN-001 — Currency Conversion

**Created:** 2026-04-29
**Ticket:** ERP-DN-001
**Type:** Feature
**Phase:** Phase 1 — MVP
**Priority:** High
**Owner:** Kiran_Data_008
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Daily exchange rate pull from ECB XML feed or Open Exchange Rates API. Store in `dim_exchange_rate`. Convert all GL amounts to functional currency (entity primary) and reporting currency (group = USD). Apply IFRS 21 rate types: period-end for Balance Sheet accounts, period-average for P&L accounts. Multi-currency triangle conversion for missing direct pairs.

### Why
Multi-ERP group has entities in AED, SAR, GBP, EUR, INR. Consolidated P&L meaningless without common currency. IFRS/GAAP mandate specific rate types per account category — incorrect rate type = misstated financials.

### Acceptance Criteria
- AC-06: All GL amounts converted to reporting currency using correct rate type per IFRS 21
- AC: Period-end rate applied to balance sheet accounts; period-average to P&L
- AC: Triangular conversion works (e.g., SAR → USD via EUR if direct rate missing)
- AC: Exchange rate data available for all 180 ISO currencies
- AC: Rate fetch runs daily at 08:00 UTC after ECB publishes

---

## P — Pseudocode

### Backend
```
# 03_Backend/workers/exchange_rate_fetcher.py

async def fetch_and_store_rates():
  # ECB publishes at ~16:00 CET; our fetch at 08:00 UTC next day
  ecb_rates = await fetch_ecb_xml_feed()  # EUR base rates
  oxr_rates = await fetch_oxr_api()        # fallback for non-ECB currencies

  merged = merge_rates(ecb_rates, oxr_rates)

  for (from_curr, to_curr, rate, date) in merged:
    db.upsert(dim_exchange_rate, {
      rate_date: date, from_currency: from_curr, to_currency: to_curr,
      rate: rate, rate_type: 'spot', source: 'ECB'
    })

  # generate period averages (avg of spot rates in month)
  compute_period_averages()

# 03_Backend/services/currency_service.py

def convert(amount, from_curr, to_curr, date, rate_type='spot') -> Decimal:
  rate = get_rate(from_curr, to_curr, date, rate_type)
  if not rate:
    # triangle via USD
    rate = get_rate(from_curr, 'USD', date) * get_rate('USD', to_curr, date)
  return round(amount * rate, 4)

def get_rate_type_for_account(canonical_category) -> str:
  if canonical_category in ['Current Assets', 'Fixed Assets', 'Liabilities', 'Equity']:
    return 'period_end'  # IFRS 21: balance sheet → closing rate
  return 'period_average'  # IFRS 21: P&L → average rate

# Called during normalization:
def normalize_gl_line(raw_line, erp_mapping) -> CanonicalGLLine:
  ...
  rate_type = get_rate_type_for_account(canonical_category)
  reporting_dr = convert(functional_dr, entity.functional_currency, 'USD',
                         raw_line.posting_date, rate_type)
```

### Frontend
- Currency selector on consolidated views (USD / EUR / local)
- Rate type legend tooltip on Balance Sheet vs P&L charts

---

## A — Architecture

### New Files
- `03_Backend/workers/exchange_rate_fetcher.py` — daily cron job
- `03_Backend/services/currency_service.py` — conversion logic

### Modified Files
- `03_Backend/workers/sync_worker.py` — call currency_service during normalization

### DB / API changes
`dim_exchange_rate` table (see PRD §6.1). Env var: `OPEN_EXCHANGE_RATES_APP_ID`.

---

## R — Refinement

### Edge Cases
- ECB feed unavailable: fall back to OXR; if both unavailable, use last known rate + alert
- Weekend/holiday: use prior business day rate (standard practice)
- Hyperinflationary currency (IAS 29): flag — do not auto-convert; require manual rate entry
- Rate gap > 7 days: alert finance team

### Security
- OXR API key in vault (ERP-CF-002)
- Rate data is public — no PII concern

### Performance
- Daily fetch: ~170 currency pairs from ECB → < 30 seconds
- Period-average computation: batch SQL aggregation at month-end
- Conversion in sync worker: in-memory rate cache (refreshed daily)

---

## C — Completion

### Done Criteria
- [ ] Daily ECB rate fetch running at 08:00 UTC
- [ ] `dim_exchange_rate` populated with spot + period_average rates
- [ ] Conversion function applies correct rate type per account category
- [ ] Triangle conversion working for non-direct pairs
- [ ] `fact_gl_entries` populated with `reporting_amount_dr/cr` and `exchange_rate_used`
- [ ] Alert on ECB feed failure

### Test Plan
- Fetch ECB feed → verify dim_exchange_rate rows for today
- Convert 1000 AED → USD on known date → verify against published ECB rate
- Apply P&L rate type to Revenue account → verify period-average used
- Apply BS rate type to Assets → verify period-end used
- Triangle: SAR → GBP via USD → verify result within 0.001% of direct rate
