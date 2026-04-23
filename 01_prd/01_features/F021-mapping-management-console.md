# F021 — Mapping Management Console & Approval Workflow

**Area:** Administration & Governance  
**Priority:** Must  
**PRD References:** FR-ADM-01, FR-ADM-02

---

## Situation

The canonical chart of accounts (F007), dimension framework (F008), entity registry, and customer/vendor master mappings are living configurations — they must be updated as subsidiaries add accounts, re-org their dimensions, or are acquired. Group finance owns these mappings and must be able to maintain them without engineering involvement. All changes carry financial risk (incorrect mapping = incorrect consolidated P&L) and must be dual-controlled.

---

## Problem

Without a self-service admin console, every mapping change requires a data engineering ticket, a config file PR, a deployment, and a pipeline re-run — a process that takes days and is operationally unsustainable at scale. Equally, without a two-person approval workflow, a single finance user could introduce a mapping error (intentional or accidental) that corrupts consolidated reporting without a second set of eyes. This is both a financial control risk and a regulatory concern.

---

## Action

### User Stories

- As a Group Finance user, I can add or modify a canonical account mapping for a subsidiary without raising an engineering ticket.
- As a second Group Finance user, I can review and approve or reject a mapping change proposed by a colleague before it takes effect.
- As a compliance officer, I can see the full history of every mapping change — who proposed it, who approved it, when it took effect.

### Acceptance Criteria

**Mapping Workbench**

1. The admin console is a separate, restricted section of the React application accessible only to `group-admin` and `group-group-finance` roles.
2. **Account Mapping tab:** displays all subsidiary accounts per entity; columns = Local Account No, Local Account Name, Canonical Account (dropdown/search), Mapping Status (mapped/unmapped/pending approval), Mapped By, Approved By, Effective From.
3. **Dimension Mapping tab:** same structure for dimension values per entity and dimension type.
4. **Entity Registry tab:** list of all registered subsidiaries with their configuration (tenant ID, app registration, status, onboarding date).
5. **Customer/Vendor Master tab:** harmonised customer and vendor records with merge/split controls for cross-subsidiary matching.
6. Unmapped items highlighted at the top of each tab with a count badge.
7. Bulk mapping: finance user can upload a CSV of mappings (local_code → canonical_code) for a subsidiary; system validates and queues for approval.

**Two-Person Approval Workflow**

8. Any mapping change (create, update, or delete) is created as a **pending change** — it does not take effect immediately.
9. Pending changes are listed in an **Approval Queue** visible to all `group-admin` and `group-group-finance` users.
10. A change may be approved or rejected by any eligible user **other than the proposer** (no self-approval, enforced server-side).
11. Approver must provide a comment when rejecting; comment is optional on approval.
12. Approved changes take effect at the next pipeline run after approval (not retroactively — only applied to new Gold promotions).
13. Rejected changes are returned to the proposer with the rejection comment; proposer can amend and resubmit.
14. Pending changes older than 5 business days generate an alert to the admin group.

**Audit Trail**

15. Full mapping change history stored and immutable: `(change_id, change_type, entity, local_code, old_canonical, new_canonical, proposed_by, proposed_at, approved_by, approved_at, approval_comment, effective_from, effective_to)`.
16. Audit log exportable by period, entity, or user for compliance review.
17. Audit trail retained 7 years.

**Canonical Structure Management**

18. Group admin can add new nodes to the canonical CoA hierarchy or new canonical dimension values.
19. Canonical structure changes require executive sponsor approval (role: `group-exec-sponsor`) in addition to the standard two-person finance approval — flagged as higher-risk changes.
20. Deleting a canonical node with active mappings is blocked; the node must first be re-mapped to a replacement node.

---

## Result

- Group finance team can maintain all mappings independently — no engineering bottleneck for routine mapping updates.
- Two-person approval rule eliminates single-point-of-failure risk for mapping errors.
- Complete, auditable mapping history satisfies SEC Rule 204-2 and SOX-equivalent internal control requirements.
- Mapping changes take effect predictably at the next pipeline run — no surprise retroactive restatements.

---

## Constraints

- **Dependency:** F014 (React foundation) — admin console is a module within the SPA.
- **Dependency:** F019 (API layer) for all mapping CRUD operations.
- **Dependency:** F007 (canonical CoA) and F008 (canonical dimensions) are the data structures maintained here.
- **Dependency:** F016 (close cockpit) and F017 (entity detail view) link to the mapping workbench for exception resolution.
- **Dependency:** F022 (subsidiary onboarding wizard) uses the entity registry managed here.
- **Accessible to:** `group-admin`, `group-group-finance` for full access; approval requires a second eligible user in the same groups.
- **Out of scope:** BC configuration management — the console manages platform-side mappings only, not BC account structures.
- **Constraint:** Self-approval enforcement is a server-side rule, not a UI-only check — the API must reject self-approval attempts even if the UI is manipulated.
