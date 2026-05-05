# Feature: ERP-DN-004 — Intercompany Elimination

**Created:** 2026-04-29
**Ticket:** ERP-DN-004
**Type:** Feature
**Phase:** Phase 2
**Priority:** Medium
**Owner:** Kiran_Data_008
**Reviewer:** Kabir_Reviewer_010
**Status:** Planned

---

## S — Specification

### What
Define intercompany entity pairs. Auto-detect intercompany transactions (amount + counterparty + period match). Generate elimination journal entries for consolidated view. Produce unmatched intercompany report for differences above threshold.

### Why
Group consolidation without intercompany elimination inflates revenue and expenses. If Entity A bills Entity B AED 500k, that amount appears in both A's revenue and B's expenses — double-counting. Elimination is mandatory for IFRS 10 consolidated statements.

### Acceptance Criteria
- AC: Intercompany relationship pairs configurable in UI (A ↔ B)
- AC: Auto-detection matches transactions by: amount ±0.1% tolerance + counterparty entity + period
- AC: Elimination entries generated as virtual journal lines (not written to ERP)
- AC: Consolidated view shows toggle: pre-elimination / post-elimination
- AC: Unmatched ICO report: transactions that should eliminate but have no counterpart > threshold

---

## P — Pseudocode

### Backend
```
# 03_Backend/services/intercompany_service.py

def define_ico_pair(entity_a_id, entity_b_id, account_pairs):
  # account_pairs: [(entity_a_revenue_acct, entity_b_expense_acct), ...]
  db.insert(dim_ico_relationships, {entity_a_id, entity_b_id, account_pairs, ...})

def run_elimination(period, consolidation_scope) -> list[EliminationEntry]:
  pairs = db.get_ico_pairs(consolidation_scope)
  eliminations = []

  for pair in pairs:
    # find matching transactions
    a_entries = get_gl_entries(entity_a, period, pair.a_accounts)
    b_entries = get_gl_entries(entity_b, period, pair.b_accounts)
    matched = match_transactions(a_entries, b_entries, tolerance=0.001)

    for match in matched:
      eliminations.append(EliminationEntry(
        entity_a=match.a, entity_b=match.b,
        amount=match.amount, is_elimination=True
      ))

    unmatched = find_unmatched(a_entries, b_entries, matched)
    if any(u.amount > ICO_ALERT_THRESHOLD for u in unmatched):
      create_ico_variance_alert(unmatched)

  return eliminations

def match_transactions(a_entries, b_entries, tolerance) -> list[Match]:
  # Algorithm: sort both by amount; bipartite match within tolerance
  ...
```

### Frontend
- ICO Relationship manager: `/settings/intercompany`
- Toggle on Consolidated Dashboard: "Include ICO Elimination"
- Unmatched ICO report page

---

## A — Architecture

### New Files
- `03_Backend/services/intercompany_service.py`
- `03_Backend/routers/intercompany.py`
- `02_Frontend/src/pages/55_F055_IntercompanyConfig.tsx`

### Modified Files
- `02_Frontend/src/pages/DS/consolidated-dashboard.tsx` — add elimination toggle

### DB / API changes
```sql
dim_ico_relationships (
  ico_id        SERIAL PRIMARY KEY,
  tenant_id     UUID,
  entity_a_id   UUID,
  entity_b_id   UUID,
  account_pairs JSONB,
  effective_from DATE,
  is_active     BOOLEAN
)
```

---

## R — Refinement

### Edge Cases
- Partial ownership (60%): elimination only on 60% of intercompany amount; minority interest on 40%
- Currency mismatch: A bills in USD, B records in AED — convert both to reporting currency before matching
- Timing differences: A posts in period 3, B posts in period 4 — unmatched alert; manual resolution

### Security
- Elimination entries tagged `is_elimination_entry=true` — never written back to ERP
- ICO configuration changes audited

### Performance
- Run post-sync for affected periods only
- Matching algorithm O(n log n) — sort + sweep

---

## C — Completion

### Done Criteria
- [ ] ICO relationship pairs configurable
- [ ] Auto-detection with tolerance matching
- [ ] Elimination entries generated for consolidated view
- [ ] Pre/post elimination toggle on dashboard
- [ ] Unmatched ICO variance report

### Test Plan
- Define A↔B pair; post AED 100k ICO transaction both sides → verify elimination entry generated
- Toggle elimination → verify consolidated P&L reduced by AED 100k
- Introduce timing difference → verify unmatched alert fired
