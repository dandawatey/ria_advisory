# F016 — Close Cockpit

**Area:** React Application  
**Priority:** Must  
**PRD References:** FR-APP-05

---

## Situation

The Group Controller (Marcus) manages the monthly close process across 17 subsidiaries — coordinating data submission, resolving mapping exceptions, reviewing IC eliminations, and signing off on the consolidated package. Today this is managed through email, spreadsheets, and phone calls. The close cockpit centralises this orchestration into a single, audited workflow.

---

## Problem

Without a centralised close management tool, the group controller has no real-time visibility into which subsidiaries have submitted complete data, which mapping exceptions are blocking Gold promotion, or which IC entries are unmatched. The close process is opaque — the controller discovers issues reactively (subsidiary calls to report a problem) rather than proactively. There is no audit trail of close decisions, approvals, or exceptions resolution.

---

## Action

### User Stories

- As the Group Controller, I see the close status of all 17 subsidiaries on a single board and can identify blockers without contacting each controller individually.
- As the Group Controller, I can review and approve IC elimination results for a period and record my sign-off with an audit timestamp.
- As the Group Controller, I can see all mapping exceptions (unmapped accounts, unmatched IC) that are blocking or warning, and drill into each one.

### Acceptance Criteria

**Close Status Board**

1. Period selector (current close period by default; navigable to prior periods).
2. One row per subsidiary showing: Entity Name, Pipeline Run Status (last run timestamp, success/failed), DQ Status (pass/warning/fail with exception count), Mapping Status (% accounts mapped), IC Reconciliation Status (matched/unmatched/no IC), Close Sign-Off Status (pending/reviewed/signed off), Sign-Off By (user), Sign-Off Timestamp.
3. Status badges are colour-coded: green = complete/pass, amber = warnings/partial, red = failure/blocked.
4. Overall period close status summary at the top: % entities ready for consolidation, total DQ exceptions outstanding, unmatched IC entries outstanding.

**Mapping Exceptions Queue**

5. Tabular list of all active mapping exceptions: entity, exception type (unmapped account / unmapped dimension), local code, number of GL entries affected, amount affected (USD), first seen date, severity (critical/warning).
6. Critical exceptions (blocking Gold promotion) highlighted; links to the mapping workbench (F021) for resolution.
7. Exceptions dismissible with a comment once resolved; resolution logged with user and timestamp.

**IC Elimination Review**

8. IC reconciliation panel: matrix view of IC balances by entity pair and canonical IC account; columns = Debit entity, Credit entity, Canonical Account, Period, Gross Amount (USD), Matched (Y/N), Variance.
9. Unmatched IC entries listed with: entity pair, account, period, debit amount, credit amount, variance, likely cause (> tolerance / missing partner entry).
10. Controller can mark an unmatched IC as "reviewed and accepted" with a mandatory comment — this is audit-logged and does not change the underlying data.
11. Export IC reconciliation to Excel for external review.

**Sign-Off Workflow**

12. Per-entity "Mark as Reviewed" action: available to Group Controller and Group Finance roles; records `reviewed_by`, `reviewed_at`, `comments`.
13. Per-period "Sign Off Consolidation" action: available only after all entities are marked as reviewed and no critical DQ or critical IC exceptions are open; records `signed_off_by`, `signed_off_at`.
14. Sign-off is immutable once recorded (cannot be unsigned); if corrections are required, the period must be "reopened" by a second authorised user with a mandatory reason.
15. Full sign-off audit log viewable and exportable (SEC Rule 204-2 audit evidence).

**On-Demand Pipeline Trigger**

16. "Refresh All Data" button triggers an on-demand pipeline run (via F003 API) for the current close period across all entities; status updates in real time on the close board.

---

## Result

- Group Controller has complete, real-time visibility into close status — no manual status chasing.
- Close cycle reduced from 8–10 business days to ≤ 3 business days (PRD KPI).
- IC elimination review and sign-off is structured, auditable, and defensible to external auditors.
- Mapping exceptions are surfaced and resolved within the same tool, eliminating email back-and-forth.

---

## Constraints

- **Dependency:** F014 (React foundation), F019 (API layer).
- **Dependency:** F012 (DQ framework) provides DQ exception data displayed here.
- **Dependency:** F010 (IC elimination engine) provides IC reconciliation data displayed here.
- **Dependency:** F007 (canonical CoA mapping) and F008 (dimension mapping) provide mapping exception data.
- **Dependency:** F003 (orchestration) exposes the on-demand trigger API.
- **Dependency:** F021 (admin console / mapping workbench) is the target for resolving mapping exceptions.
- **Accessible to:** `group-group-finance` (Group Controller, Group Finance team) for full access; `group-exec` for read-only view of close status.
- **Out of scope:** Statutory consolidation sign-off (10-K, Form ADV) — this is management reporting close only.
- **Constraint:** Sign-off workflow must be configured with the correct authorised roles before pilot go-live; incorrect role configuration could allow self-approval of the consolidation.
