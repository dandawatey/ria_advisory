# Feature: ERP-RV-004 — Missing GL Code Detection

**Created:** 2026-04-29
**Ticket:** ERP-RV-004
**Type:** Feature
**Phase:** Phase 2
**Priority:** Low
**Owner:** Kiran_Data_008
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Compare active accounts in ERP CoA vs accounts that have actually posted entries. Alert on new accounts with no mapping. Alert on accounts active in prior periods but inactive this period (potential reclassification or error). Dormant account report (no activity > 6 months).

### Why
Accounts get added in ERP without being mapped in i-finsights — these silently drop from reports. Accounts that were active last month but not this month may indicate entries posted to wrong account. Both issues create reporting blind spots.

### Acceptance Criteria
- AC: New ERP account (in CoA but never posted to) detected and alerted for mapping
- AC: Account active prior period but zero activity current period → advisory alert
- AC: Dormant account report: accounts with no activity for > 6 months
- AC: Report accessible per entity per period

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/gl_code_detection_service.py

def detect_missing_gl_codes(erp_source_id, period):
  # All accounts in ERP CoA
  coa_accounts = set(get_coa_accounts(erp_source_id))

  # Accounts with activity this period
  active_this_period = set(get_active_accounts(erp_source_id, period))

  # Accounts with activity last period
  active_prior_period = set(get_active_accounts(erp_source_id, prior_period(period)))

  # New accounts (in CoA, never posted)
  unmapped_new = coa_accounts - get_all_ever_posted_accounts(erp_source_id)
  for acct in unmapped_new:
    create_alert(type='new_unmapped_account', account=acct, erp_source_id=erp_source_id)

  # Went inactive this period
  went_inactive = active_prior_period - active_this_period
  for acct in went_inactive:
    if not is_expected_inactive(acct, period):  # e.g., seasonal account
      create_advisory(type='account_went_inactive', account=acct)

def get_dormant_accounts(erp_source_id, months=6) -> list:
  cutoff = now() - timedelta(days=months * 30)
  return db.query("""
    SELECT DISTINCT source_account_code FROM fact_gl_entries
    WHERE erp_source_id=:eid
    GROUP BY source_account_code
    HAVING MAX(posting_date) < :cutoff
  """)

# API
GET /api/connectors/{id}/gl-code-analysis
  → {new_accounts, went_inactive, dormant, mapping_coverage_pct}
```

### Frontend
```
Route: /analytics/gl-code-analysis (sub-tab of Data Quality)

Components:
  GLCodeAnalysisTab
    ├── NewAccountsAlert (count + list with "Map Now" buttons)
    ├── WentInactiveTable (account, last posting date, prior period balance)
    └── DormantAccountsTable (account, last activity date, balance)
```

---

## A — Architecture

### New Files
- `03_Backend/services/gl_code_detection_service.py`
- `03_Backend/routers/gl_analysis.py`
- `02_Frontend/src/components/quality/GLCodeAnalysisTab.tsx`

### Modified Files
- `02_Frontend/src/pages/65_F065_DataQuality.tsx` — add GL code analysis tab
- `03_Backend/workers/sync_worker.py` — trigger detection post-CoA sync

### DB / API changes
No new tables. Queries on `fact_gl_entries` + `dim_erp_mapping` + ERP CoA data.

---

## R — Refinement

### Edge Cases
- Account deleted from ERP CoA but still has historical postings: flag as "Deleted from CoA — historical data retained"
- Expected zero-activity (e.g., accrual account not used every month): allow user to mark as "Expected Inactive" → no future alerts
- Large CoA (SAP: 1000+ accounts): pagination in report; batch alert creation

### Security
- Account codes + names shown — finance-internal data, no PII

### Performance
- Detection runs post-CoA-sync (not every GL sync)
- Dormant query: indexed on `posting_date` — fast even on large datasets

---

## C — Completion

### Done Criteria
- [ ] New unmapped account detection and alert
- [ ] Went-inactive detection (prior period active, current period zero)
- [ ] Dormant account report (6-month configurable threshold)
- [ ] GL Code Analysis tab on Data Quality page
- [ ] "Map Now" button links directly to field mapper for that account

### Test Plan
- Add new account to ERP CoA without mapping → verify alert created
- Account active in Jan, zero in Feb → verify advisory alert
- Account last posted 7 months ago → verify in dormant report
- Mark account "Expected Inactive" → verify no further alerts
