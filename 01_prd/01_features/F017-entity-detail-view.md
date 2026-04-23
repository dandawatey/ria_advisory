# F017 — Entity Detail View

**Area:** React Application  
**Priority:** Must  
**PRD References:** FR-APP-06

---

## Situation

Subsidiary Controllers (Priya) need a scoped view into their own entity's financial data — detailed enough to support reconciliation against their local BC instance, review DQ exceptions specific to their entity, and resolve intercompany discrepancies. They do not need (and should not see) other subsidiaries' data.

---

## Problem

Without a subsidiary-scoped view, subsidiary controllers either have no access to the platform (eliminating their ability to self-serve reconciliation) or receive a confusing group-wide view they must filter manually. Subsidiary controllers are also the primary owners of DQ exception remediation — they need their exceptions surfaced clearly, not buried in a group-level exception queue.

---

## Action

### User Stories

- As a Subsidiary Controller, I see my entity's trial balance, AR/AP detail, and DQ exceptions in a single scoped view.
- As a Subsidiary Controller, I can reconcile my platform-reported trial balance against my BC local report and flag any discrepancies.
- As a Subsidiary Controller, I can see the status of my IC accounts and whether my partner entities have matched my IC transactions.

### Acceptance Criteria

**Entity Context**

1. Entity view is automatically scoped to the user's entity based on Entra ID group membership (`group-subsidiary-{code}`).
2. Group finance / exec users accessing the entity view via drill-through from F015/F016 see the same view but with a clear "Viewing as: [Entity Name]" indicator and a back-navigation breadcrumb.
3. Period selector consistent with other views; defaults to current close period.

**Trial Balance Panel**

4. Trial balance table: canonical account hierarchy rows; columns = Opening Balance, Debit MTD, Credit MTD, Closing Balance (all in USD and LCY side by side).
5. Toggle between canonical account view and local (native BC) account view.
6. Export trial balance to CSV or Excel for external reconciliation.
7. "Reconcile" mode: user can upload a local BC trial balance export; platform performs line-by-line comparison and highlights variances > configurable tolerance. Reconciliation result saved with timestamp.

**AR / AP Detail Panel**

8. Outstanding AR invoice lines: customer, invoice number, due date, original amount (LCY + USD), outstanding amount, aging bucket. Filterable by aging bucket, customer.
9. Outstanding AP invoice lines: same structure for payables.
10. Export to CSV.

**DQ Exception Panel**

11. DQ exceptions for this entity only: rule name, severity, entity affected, rows failed, amount affected, first seen, status (open/resolved).
12. Critical exceptions highlighted with guidance on remediation (e.g., "Account 44020 has no canonical mapping — contact group finance to add mapping in the admin console").
13. Subsidiary controller cannot resolve DQ exceptions directly (resolution happens in BC or in mapping workbench) but can add a comment or flag for group finance review.

**IC Reconciliation Panel**

14. IC balances for this entity: partner entity, canonical IC account, this entity's balance (LCY + USD), partner entity's balance (USD), variance, matched status.
15. Unmatched IC entries highlighted; subsidiary controller can add a comment or dispute flag.

**Data Freshness**

16. Entity-level last refresh timestamp displayed; notification if entity data is older than the group's freshness target.

---

## Result

- Subsidiary controllers are self-sufficient for reconciliation — no need to request data extracts from group finance.
- DQ exceptions are actionable at the source — subsidiary controller knows exactly what needs to be fixed in BC.
- IC reconciliation visibility reduces the back-and-forth between subsidiary controllers and the group controller during close.
- Entity scoping enforced at the API level — no risk of cross-entity data leakage.

---

## Constraints

- **Dependency:** F014 (React foundation), F019 (API layer with entity-level RLS).
- **Dependency:** F009 (Gold layer) for trial balance, AR/AP data.
- **Dependency:** F012 (DQ framework) provides entity-level exception data.
- **Dependency:** F010 (IC elimination engine) provides entity IC reconciliation data.
- **Accessible to:** `group-subsidiary-{code}` role scoped to their entity; `group-group-finance` and `group-exec` can access any entity (via drill-through from F015/F016).
- **Out of scope:** Editing or correcting data in the platform — all corrections happen in BC.
- **Out of scope:** Subsidiary operational reporting (local BC reports remain authoritative for operational use per PRD §5.2).
- **Constraint:** Reconciliation upload feature (comparison with local BC export) must define and document the expected BC export format before implementation; format variance across BC versions is a risk.
