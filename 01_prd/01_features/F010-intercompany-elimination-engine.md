# F010 — Inter-Company Elimination Engine

**Area:** Data Lakehouse  
**Priority:** Must  
**PRD References:** FR-LAKE-07

---

## Situation

RIA Advisory's 17 subsidiaries transact with each other — management fees, shared services charges, intercompany loans, and other IC transactions appear in both the paying and receiving subsidiary's GL. For consolidated group reporting, these IC transactions must be eliminated to avoid double-counting revenue and expenses. Currently, eliminations are performed manually in Excel each month-end — a high-effort, error-prone process.

---

## Problem

Manual IC elimination in Excel takes significant effort each close cycle, is dependent on subsidiary controllers submitting data simultaneously, and produces no audit trail linking eliminated entries back to their source transactions. Without automated elimination, the platform's consolidated P&L and balance sheet are materially incorrect until eliminations are applied — and there is no programmatic way to verify that all IC transactions have been matched and eliminated.

---

## Action

### User Stories

- As the group controller, I can configure IC elimination rules in the admin console without code changes.
- As a finance reviewer, I can see which IC transaction pairs were matched and eliminated, and which are unmatched (and why).
- As the CFO, I can view both gross (pre-elimination) and net (post-elimination) consolidated P&L in the executive dashboard.

### Acceptance Criteria

1. The elimination engine operates on tagged IC accounts (`is_intercompany_account = true` in F007) and partner-entity dimension values.
2. **Rule-based configuration:** IC elimination rules are stored in a configuration table: `(rule_id, rule_name, canonical_account_id, elimination_type [bilateral/unilateral], partner_entity_dimension, created_by, approved_by, effective_from)`.
3. All rule changes go through two-person approval workflow (F021).
4. **Bilateral matching:** the engine attempts to match IC debit entries in one entity against IC credit entries in the partner entity for the same canonical account and period. Matched pairs are tagged `is_eliminated = true` in the Gold fact tables.
5. **Unmatched IC entries:** surfaced as exceptions in the close cockpit (F016) with: subsidiary, account, period, amount, and partner entity. Unmatched entries remain in Gold with `is_eliminated = false`.
6. Elimination operates at the **period level** (monthly) — not transaction-by-transaction (which is impractical across separate GL systems).
7. Gold layer exposes **two views** of consolidated data: 
   - Gross view: all entries including IC (for internal management reporting and subsidiary reconciliation).
   - Eliminated view: IC-tagged entries excluded/netted (for group consolidated P&L and balance sheet).
8. Elimination journal entries produced by the engine are themselves audit-logged: `(elimination_id, rule_id, entity_a, entity_b, canonical_account_id, period, eliminated_amount_usd, run_id, timestamp)`.
9. IC reconciliation report available in the close cockpit showing IC balances by entity pair and matching status.
10. Elimination run as part of the Gold promotion stage (F009), after FX translation (F011) has been applied.

### Technical Notes

- Period-level matching: sum IC debits by (canonical_account, entity_a, entity_b, period) and compare to sum IC credits by (canonical_account, entity_b, entity_a, period). Net difference > tolerance threshold (configurable; default $1,000 or 0.01%) → unmatched exception.
- Tolerance threshold accounts for FX translation rounding differences.
- Elimination does not modify Bronze or Silver data — only sets flags and creates elimination records in Gold.

---

## Result

- Group consolidated P&L and balance sheet are mathematically correct — IC double-counting eliminated automatically each pipeline run.
- Month-end close IC reconciliation effort reduced from days to hours.
- Full audit trail of every elimination decision satisfies SEC Rule 204-2 traceability requirements.
- Unmatched IC balances surfaced proactively rather than discovered at external audit time.

---

## Constraints

- **Dependency:** F007 (canonical CoA, `is_intercompany_account` flag) and F008 (canonical dimensions, entity dimension) are prerequisites.
- **Dependency:** F011 (FX translation) must run before elimination so all amounts are in USD for matching.
- **Dependency:** F009 (Gold layer) stores elimination flags and views.
- **Dependency:** F016 (close cockpit) surfaces IC unmatched exceptions.
- **Dependency:** F021 (admin console) hosts the rule configuration and approval workflow.
- **Out of scope:** Minority-interest eliminations for partially-owned subsidiaries — platform assumes wholly-owned or majority-held; partial ownership adjustments are Phase 2.
- **Out of scope:** Statutory consolidation (IFRS/US GAAP formal consolidation journal entries for statutory filing) — this is management reporting elimination only.
- **Constraint:** IC elimination rules must be defined by group finance before pilot go-live; the engine cannot auto-discover IC relationships without configured rules.
