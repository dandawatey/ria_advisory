# F011 — FX Translation Engine

**Area:** Data Lakehouse  
**Priority:** Must  
**PRD References:** FR-LAKE-08

---

## Situation

RIA Advisory subsidiaries may operate in currencies other than USD (e.g., CAD, GBP, EUR for any international or cross-border entities). Consolidated group reporting requires all financial amounts expressed in a single presentation currency (USD). Accounting standards prescribe different exchange rates for different financial statement line types: period-end rates for balance sheet items, average rates for income statement items, and historical rates for equity transactions.

---

## Problem

Without systematic FX translation, multi-currency subsidiaries produce amounts that cannot be meaningfully aggregated with USD-denominated subsidiaries. Using a single exchange rate for all line types is technically incorrect under US GAAP/IFRS. Manual FX translation in Excel introduces calculation errors and is not reproducible from source data alone. The rate source and translation method must be documented and auditable.

---

## Action

### User Stories

- As the group controller, I can configure the FX translation policy (rate type per account category) in the admin console.
- As the CFO, I see all consolidated amounts in USD in the executive dashboard, correctly translated by account type.
- As a compliance reviewer, I can trace any USD amount back to the source local-currency amount and the rate used.

### Acceptance Criteria

1. All non-USD amounts in Gold fact tables are translated to USD at load time and stored in `amount_usd` alongside the source `amount_lcy` (local currency).
2. Three rate types supported: `PERIOD_END` (last day of period), `AVERAGE` (simple average of daily rates within period), `HISTORICAL` (transaction-date rate).
3. **Translation policy configuration table:** `(canonical_account_id, account_type, rate_type)` — e.g., all Asset/Liability canonical accounts use `PERIOD_END`; Revenue/Expense use `AVERAGE`; Equity use `HISTORICAL`. Configurable by group finance, two-person approval required.
4. FX rates ingested from a configured external rate source (BC currency table as primary source; external API or manual upload as fallback); rates stored in `fact_fx_rate` (F009) with `(currency_pair, rate_date, rate_type, rate_value, source)`.
5. If a rate for a required currency/date/type is missing, the translation produces a DQ exception (F012) and the affected row is flagged `fx_translated = false` — it is not silently zeroed or excluded.
6. `fact_gl_entry` and all other currency-denominated fact tables carry: `currency_code`, `amount_lcy`, `exchange_rate_used`, `rate_type`, `rate_date`, `amount_usd`, `fx_translated` (boolean).
7. Translation is computed in the Gold promotion stage (F009), before IC elimination (F010) — IC matching operates on USD amounts.
8. Historical rate for equity: the rate on the original transaction posting date (`posting_date`) is used; `fact_fx_rate` must carry rates for all historical dates present in the data.
9. Translation logic is version-controlled; changes to policy configuration are audit-logged.
10. FX translation summary available in the pipeline health dashboard: rows translated, rows with missing rates, total translation variance for the period.

### Technical Notes

- Rate source priority: (1) BC Currency Exchange Rate table extracted via F002, (2) configured external API (e.g., ECB, Bloomberg), (3) manual rate upload via admin console.
- Simple daily average computed at pipeline time from daily closing rates ingested for the period — not BC's computed average.
- USD-denominated subsidiaries: `amount_usd = amount_lcy`, `exchange_rate_used = 1.0`, `fx_translated = true`, `rate_type = 'PARITY'`.

---

## Result

- All Gold financial amounts available in USD for cross-subsidiary aggregation.
- Translation methodology is correct per US GAAP multi-currency consolidation requirements.
- Every translated amount is traceable to source currency, rate used, rate type, and rate date — satisfying audit requirements.
- Missing rate exceptions surface immediately rather than propagating silent errors into consolidated totals.

---

## Constraints

- **Dependency:** F009 (Gold layer) hosts `fact_fx_rate` and the translated fact tables.
- **Dependency:** F007 (canonical CoA) provides account type classification used to select rate type.
- **Dependency:** F010 (IC elimination) runs after FX translation — amounts must be in USD before IC matching.
- **Dependency:** F012 (DQ framework) handles missing-rate exceptions.
- **Out of scope:** Hedging accounting entries or derivative instrument translation — management reporting only.
- **Constraint:** The group's stated FX policy (rate type per account category) must be documented and signed off by the CFO before pipeline implementation (PRD Open Question §14).
- **Constraint:** Rate source (BC vs. external provider) must be agreed before pilot — different rate sources produce different translated amounts and both cannot be correct simultaneously.
