# F022 — Subsidiary Onboarding Wizard

**Area:** Administration & Governance  
**Priority:** Should  
**PRD References:** FR-ADM-04

---

## Situation

RIA Advisory's stated growth strategy involves continued acquisition of new RIA firms. Each acquisition brings a new BC tenant that must be integrated into the platform. The PRD targets a ≤ 30 calendar day onboarding time from acquisition to live on platform. With 17 existing subsidiaries and more expected, the onboarding process must be repeatable, self-service, and not require engineering involvement for each new entity.

---

## Problem

Without a structured onboarding flow, each new subsidiary requires ad-hoc engineering work: manually provisioning auth, configuring extraction, running initial loads, and mapping accounts/dimensions — an undocumented, inconsistent process that scales poorly. A new acquisition might take 60–90 days to integrate, undermining the group's reporting completeness during the integration period.

---

## Action

### User Stories

- As a platform administrator, I can register a new subsidiary and complete its end-to-end onboarding in the admin console without raising engineering tickets for each step.
- As a subsidiary controller for a newly acquired entity, I can see my entity data in the platform within 30 calendar days of acquisition close.
- As the Group Controller, I can monitor the onboarding progress of a new entity in real time.

### Acceptance Criteria

**Wizard Flow (end-to-end in the admin console)**

The wizard guides the admin through these sequential steps, each with a validation gate before proceeding:

**Step 1 — Entity Registration**

1. Enter: Legal entity name, subsidiary code (unique, alphanumeric, ≤ 10 chars), jurisdiction, functional currency, BC API tenant ID, fiscal year start month.
2. System checks subsidiary code uniqueness; warns if BC tenant ID is already registered.
3. Entity saved to entity registry (F021) in `pending_onboarding` status.

**Step 2 — Authentication Configuration**

4. Input: Entra ID app client ID for this subsidiary's BC tenant, Key Vault secret name for the certificate.
5. Wizard triggers a **test authentication** against the BC tenant API; result displayed (success / failure with error detail).
6. Admin cannot proceed until authentication test passes.

**Step 3 — Entity Catalog Configuration**

7. Wizard lists the standard BC entity set (GL entries, CoA, dimensions, customers, vendors, etc.).
8. Admin confirms which entities are in scope for this subsidiary (default: all standard entities selected).
9. Option to add custom BC API pages (FR-INT-07) with endpoint path and field list.
10. Entity catalog configuration saved to the pipeline config store.

**Step 4 — Initial Validation Load**

11. Wizard triggers a limited validation extraction: extracts CoA, dimensions, and 1 month of GL entries for the new tenant.
12. Progress displayed in real time (extraction status, rows loaded, DQ results).
13. Admin reviews: row counts, DQ exception summary, unmapped account count, unmapped dimension count.
14. Admin can proceed even with mapping gaps (they are resolved in Step 5) but critical extraction errors block progression.

**Step 5 — Account & Dimension Mapping**

15. Wizard presents the new entity's accounts and dimension values for mapping.
16. System auto-suggests canonical mappings based on similarity scoring against existing mappings (similar account names/numbers from other subsidiaries).
17. Admin reviews suggestions, confirms or overrides; submits for two-person approval (F021 workflow).
18. Wizard displays mapping completion % and lists remaining unmapped items.
19. Admin can save progress and return; wizard state is persisted.

**Step 6 — Full Historical Load**

20. Once mapping is approved (by a second admin), wizard triggers the full historical backfill for all in-scope entities.
21. Progress displayed: estimated completion, rows loaded per entity, errors.
22. Full load is asynchronous; admin receives an in-app notification and email when complete.

**Step 7 — Go Live**

23. Once full load is complete with DQ pass rate ≥ 99.5% for critical rules, admin marks the entity as `active`.
24. Entity becomes visible in the executive dashboard (F015), close cockpit (F016), and entity detail view (F017).
25. Subsidiary controller user is provisioned (Entra ID group membership added: `group-subsidiary-{code}`).
26. Go-live notification sent to: group controller, subsidiary controller, platform admin.

**Operational Constraints**

27. Total onboarding time (Step 1 → Go Live) target: ≤ 30 calendar days.
28. Onboarding status visible to group controller in the close cockpit as a special "onboarding" entity status.
29. Failed steps can be retried from the failed step without restarting the wizard.

---

## Result

- New subsidiary onboarding achievable in ≤ 30 days without engineering involvement.
- Consistent, repeatable process for every acquisition — no tribal knowledge required.
- Mapping completion and DQ gating ensure new entities meet platform quality standards before going live.
- Platform scales to 40+ subsidiaries (PRD NFR) without linear increase in onboarding effort.

---

## Constraints

- **Dependency:** F001 (auth), F002 (extraction), F003 (orchestration), F004 (resilience) — wizard automates configuration of these for the new entity.
- **Dependency:** F021 (mapping console and approval workflow) — Step 5 uses the standard mapping approval workflow.
- **Dependency:** F005 (Bronze), F006 (Silver), F009 (Gold) — the new entity's data flows through the standard lakehouse pipeline.
- **Dependency:** Azure Key Vault — the subsidiary's certificate must be pre-loaded into Key Vault before Step 2 can complete.
- **Dependency:** Each subsidiary must provision an Entra ID app registration before Step 2 (10-business-day SLA per PRD §13.2).
- **Out of scope:** Entra ID app registration provisioning in the subsidiary's BC tenant — that remains a manual step by subsidiary IT.
- **Constraint:** Auto-suggestion for account mapping (Step 5) is advisory only — human review and approval required before activation.
- **Constraint:** Wizard does not delete or decommission subsidiaries — that is a separate, manually controlled process given the data retention requirements.
