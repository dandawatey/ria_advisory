# Feature: ERP-RV-001 — Cross-ERP Trial Balance Reconciliation

**Created:** 2026-04-29
**Ticket:** ERP-RV-001
**Type:** Feature
**Phase:** Phase 2
**Priority:** Medium
**Owner:** Kiran_Data_008
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Generate trial balance per entity per period from canonical GL data. Compare against ERP-native trial balance (where API provides it). Highlight discrepancies. Sign-off workflow: Finance team marks reconciliation as approved per period. Historical reconciliation archive.

### Why
Finance close process requires reconciling i-finsights data back to ERP source to certify accuracy before month-end reporting. Without this, CFO cannot attest that the consolidated view matches source ERP books.

### Acceptance Criteria
- AC-15: Zero variance for correctly mapped and synced accounts
- AC: Discrepancy report shows: account, ERP balance, i-finsights balance, variance amount + %
- AC: Sign-off workflow: Finance Controller marks period as "Reconciled" per entity
- AC: Historical archive: reconciliation results stored per period, never overwritten
- AC: Reconciliation can be triggered on-demand or post-sync

---

## P — Pseudocode

### Backend
```
# 03_Backend/workers/reconciliation_worker.py

async def run_reconciliation(erp_source_id, period):
  # Step 1: Get i-finsights balances
  ifs_balances = db.query("""
    SELECT source_account_code, 
           SUM(functional_amount_dr) - SUM(functional_amount_cr) AS net_balance
    FROM fact_gl_entries
    WHERE erp_source_id=:eid AND period=:period
    GROUP BY source_account_code
  """)

  # Step 2: Get ERP native trial balance (where available)
  connector = load_connector(erp_source_id)
  erp_balances = await connector.fetch_trial_balance(period)

  # Step 3: Compare
  results = []
  all_accounts = set(ifs.keys()) | set(erp.keys())
  for account in all_accounts:
    ifs_bal = ifs_balances.get(account, 0)
    erp_bal = erp_balances.get(account, 0)
    variance = ifs_bal - erp_bal
    variance_pct = (variance / erp_bal * 100) if erp_bal != 0 else None
    results.append(ReconResult(account, erp_bal, ifs_bal, variance, variance_pct,
      status='matched' if abs(variance) < 0.01 else 'variance'))

  # Step 4: Store
  db.insert_many(fact_reconciliation, results)
  return results

# Sign-off
POST /api/reconciliation/{period}/{entity_id}/signoff
  body: {signed_off_by, notes}
  → update fact_reconciliation rows for this period

GET /api/reconciliation/{period}/{entity_id}
  → reconciliation results + sign-off status
```

### Frontend
```
Route: /analytics/reconciliation

Components:
  ReconciliationPage
    ├── PeriodEntitySelector
    ├── ReconciliationTable
    │   ├── MatchedAccounts (collapsible, green)
    │   └── VarianceAccounts (red, sorted by variance amount)
    ├── SummaryStats (total matched / total variance / % reconciled)
    ├── SignOffPanel (button: "Mark as Reconciled", shows who signed off)
    └── HistoricalArchive (list of prior reconciliations with sign-off status)
```

---

## A — Architecture

### New Files
- `03_Backend/workers/reconciliation_worker.py`
- `03_Backend/routers/reconciliation.py`
- `02_Frontend/src/pages/63_F063_Reconciliation.tsx`

### Modified Files
- `03_Backend/connectors/base.py` — add `fetch_trial_balance(period)` to ABC

### DB / API changes
`fact_reconciliation` table (see PRD §6.1).

---

## R — Refinement

### Edge Cases
- ERP doesn't expose trial balance API (Tally, JDE via Orchestrator): skip ERP comparison; compare only against expected account totals
- Rounding differences < AED 0.01: auto-classify as 'matched' (immaterial)
- Late postings after sign-off: re-run reconciliation flags previously-signed periods as "Modified — re-sign required"

### Security
- Sign-off requires `reconciliation:approve` permission (Controller level)
- Reconciliation data is financial record — no delete

### Performance
- TB comparison: SQL aggregation on indexed columns — fast
- Historical archive: paginated, 12 periods shown default

---

## C — Completion

### Done Criteria
- [ ] Reconciliation worker runs post-sync and on-demand
- [ ] Variance detection with 0.01 materiality threshold
- [ ] Sign-off workflow working
- [ ] Historical archive stores all recon runs
- [ ] Export to CSV/PDF for auditors

### Test Plan
- Sync 1000 correct entries → run recon → verify 100% matched
- Introduce 5 mismatched amounts → verify 5 variance rows
- Sign off period → verify signed_off_by + timestamp stored
- Add late posting after sign-off → verify "Modified — re-sign" flag
