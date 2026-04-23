# F007 — Canonical Chart of Accounts Mapping

**Area:** Data Lakehouse  
**Priority:** Must  
**PRD References:** FR-LAKE-04

---

## Situation

Each of the 17 subsidiaries has an independent BC instance with its own chart of accounts (CoA) — different account numbers, descriptions, hierarchies, and posting conventions. Comparing P&L or balance sheet across subsidiaries is currently impossible without manual mapping. The platform requires a single group-level canonical CoA to which every subsidiary account is mapped, enabling consolidated financial reporting.

---

## Problem

Without a canonical CoA, cross-subsidiary financial aggregation produces meaningless totals — "Revenue" in Sub 01 may map to three different account ranges in Sub 09. The mapping exercise is a finance-domain activity (not purely technical), requires senior finance sign-off, and must be maintainable as subsidiaries adjust their local CoAs over time. Mapping errors directly result in incorrect consolidated P&L and balance sheet figures — a material financial and compliance risk.

---

## Action

### User Stories

- As the group controller, I can define and maintain the canonical chart of accounts in the admin console.
- As a subsidiary controller, I can see which canonical account each of my local accounts maps to and flag disputes.
- As a data engineer, I can apply the canonical mapping in Gold-layer SQL without any hardcoded account number lists.

### Acceptance Criteria

1. A **group-level Canonical Chart of Accounts** is defined and maintained in the platform — a structured hierarchy with: `canonical_account_id`, `canonical_account_name`, `financial_statement_line` (P&L / Balance Sheet), `account_type` (Revenue / Expense / Asset / Liability / Equity), `is_intercompany_account` flag, and parent-child hierarchy nodes.
2. Every subsidiary local account must be mapped to **exactly one** canonical account. Unmapped accounts block Silver→Gold promotion for GL entries for that subsidiary (hard DQ rule).
3. Mapping is stored as a versioned table: `mapping.account_canonical` with columns `(subsidiary_code, local_account_no, canonical_account_id, effective_from, effective_to, mapped_by, approved_by, approval_timestamp)`.
4. All mapping changes go through the **two-person approval workflow** (F021): proposed by one finance user, approved by a second — no self-approval.
5. Mapping history is fully preserved (SCD-2 equivalent) — no overwrites; changes create new mapping rows with effective dates.
6. The admin console (F021) provides a **mapping workbench** UI: shows unmapped accounts, proposed mappings, pending approvals, and mapping history per subsidiary.
7. A **mapping exception report** is available in the close cockpit (F016) showing any accounts with missing or disputed mappings.
8. Canonical CoA changes (adding/removing nodes) require executive sponsor approval and are audit-logged.
9. Gold-layer transformation queries use the mapping table dynamically — no account numbers hardcoded in SQL.
10. Mapping coverage metric (% of active GL accounts mapped) is surfaced in the pipeline health dashboard (F023).

### Technical Notes

- Initial canonical CoA authored in Month 1–2 by group finance with CoE support (estimated 40 hours per PRD §13.3).
- CoA discovery tooling: automated extraction of all unique account numbers across 17 Silver account tables, presented to finance for mapping.
- Canonical CoA hierarchy stored as adjacency list with `parent_canonical_account_id` for rollup aggregation.
- Intercompany flag on canonical accounts drives F010 (elimination engine).

---

## Result

- Every GL entry in Gold is tagged with a canonical account, enabling consistent cross-subsidiary P&L and balance sheet aggregation.
- Mapping is fully auditable — who mapped what, when, and who approved it — satisfying SEC Rule 204-2 traceability requirements.
- Finance team can maintain mappings independently without engineering involvement.
- Unmapped accounts are surfaced immediately rather than silently producing incorrect totals.

---

## Constraints

- **Dependency:** F006 (Silver layer) must be active so subsidiary accounts are available for discovery and mapping.
- **Dependency:** F021 (admin console) provides the mapping workbench UI and approval workflow.
- **Dependency:** F010 (elimination engine) depends on the `is_intercompany_account` flag set here.
- **Dependency:** Finance leadership availability for canonical CoA sessions (~40 hours, Months 1–2).
- **Hard risk:** PRD §13.1 rates CoA harmonisation as High likelihood / High impact risk — treat as programme-critical path item.
- **Out of scope:** Statutory account mapping (e.g., GAAP taxonomy, XBRL) — platform is for management reporting only.
- **Constraint:** Canonical CoA must be stable before pilot go-live; post-GA changes require controlled change management process.
