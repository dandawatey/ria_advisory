# RIA Advisory — Feature Development Strategy

**Status:** Active — Living Document
**Owner:** Meera_Architect_002
**Last updated:** 2026-04-30
**Rules ref:** `.claude/rules/13_feature_complete.md`

---

## Purpose

This document defines the complete, end-to-end workflow for developing any feature in the RIA Advisory / i-finsights platform. Every developer, every agent, every session follows this strategy without deviation.

The goal: **zero partial features on main branch, zero regressions, zero surprises in production.**

---

## The Golden Rule

> A feature is not started until the environment is isolated.
> A feature is not done until every gate is green and Kabir has approved.

---

## Full Feature Development Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FEATURE DEVELOPMENT LIFECYCLE                      │
│                                                                       │
│  PLANNED ──► IN SETUP ──► IN DEVELOPMENT ──► IN TESTING ──►         │
│                                                                       │
│  IN E2E ──► IN REVIEW ──► MERGING ──► DONE ✓                        │
└─────────────────────────────────────────────────────────────────────┘
```

No skipping states. Each state has a defined entry condition and exit gate.

---

## Phase 1 — Planning (before any code)

### Step 1.1 — Plan Mode
- Claude Code enters Plan Mode (`EnterPlanMode`)
- No code written until plan is approved

### Step 1.2 — Prompt Logging
- Every prompt logged → `.claude/prompt.md` as `P-NNN` entry
- Contains: prompt text, ticket reference, outcome

### Step 1.3 — Jira Ticket
- New Jira story created for the feature
- Ticket format: `ERP-XX-NNN`
- Local file: `.claude/jira/ERP-XX-NNN.md`
- Synced to real Jira within 24 hours

### Step 1.4 — SPARC Feature File
- New file written at: `.claude/features/YYYY-MM-DDTHH-MM_<TICKET>_<slug>.md`
- All 5 SPARC sections completed before execution begins:
  - **S** — Specification (What + Why + Acceptance Criteria)
  - **P** — Pseudocode (Backend + Frontend logic flow)
  - **A** — Architecture (New files + Modified files + DB/API changes)
  - **R** — Refinement (Edge cases + Security + Performance)
  - **C** — Completion (Done Criteria checkboxes + Test Plan)

### Step 1.5 — Agent Assignment
- Owner agent assigned (one of 10 named agents)
- Reviewer agent assigned (Kabir_Reviewer_010 is default)
- Every sub-task has owner + reviewer — no unowned tasks

---

## Phase 2 — Environment Setup

### Step 2.1 — Git Worktree
Every feature gets an isolated copy of the repository via `git worktree`.

```
Branch naming:   feature/<TICKET>-<slug>
Worktree path:   ../ria_advisory__<TICKET>/
```

This ensures:
- Main branch is never touched during feature development
- Two features can run in parallel in different worktrees
- Worktree is disposable if the feature needs to restart

**Setup sequence:**
```
1. git worktree add ../ria_advisory__ERP-CF-001 -b feature/ERP-CF-001-universal-connector
2. cd ../ria_advisory__ERP-CF-001
3. Copy .env from main repo (not committed)
4. Run DB migration check
5. Install any new dependencies
```

### Step 2.2 — TMUX Session
A named TMUX session with a 5-pane layout is created for the feature.

```
Session name:  ERP-CF-001

Pane layout:
┌──────────────────────────┬──────────────────────────┐
│  PANE 0: ORCHESTRATOR    │  PANE 1: BACKEND          │
│  (Ralph loop / Claude)   │  (Rohan — FastAPI/DB)     │
├──────────────────────────┼──────────────────────────┤
│  PANE 2: FRONTEND        │  PANE 3: TESTS             │
│  (Ananya — React/TS)     │  (Vikram — pytest/PW)     │
└──────────────────────────┴──────────────────────────┘
│           PANE 4: LOG / STATUS (full width)           │
└───────────────────────────────────────────────────────┘
```

All panes are `cd`'d to the feature worktree.

### Step 2.3 — Hooks Registration
Pre-commit and pre-push hooks are registered in the worktree:

```
pre-commit:  runs tests + typecheck + secret scan + migration check
pre-push:    runs full test suite + Playwright E2E + frontend build
```

Source: `.claude/hooks/pre-commit.sh` and `.claude/hooks/pre-push.sh`

```
cp .claude/hooks/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
cp .claude/hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

---

## Phase 3 — Development (TDD Mode, Ralph Loop)

### Step 3.1 — Ralph Loop Invocation
Once environment is set up, development runs autonomously via Ralph loop:

```
/ralph-loop
```

The Ralph loop processes one sub-task per iteration. It does NOT exit until all Done Criteria are ticked.

### Step 3.2 — TDD Cycle (RED → GREEN → REFACTOR)

This is the only accepted development sequence. No exceptions.

```
┌─────────────────────────────────────────────────────────┐
│                    TDD CYCLE                            │
│                                                         │
│  1. Vikram writes test → runs → FAILS (RED confirmed)  │
│         ↓                                               │
│  2. Rohan/Ananya writes minimum code to pass           │
│         ↓                                               │
│  3. Test runs → PASSES (GREEN confirmed)               │
│         ↓                                               │
│  4. Refactor → still GREEN                             │
│         ↓                                               │
│  5. Next sub-task                                       │
└─────────────────────────────────────────────────────────┘
```

**Enforcement:** Ralph loop will not write implementation files until test files exist for that unit. RED state must be confirmed before GREEN is attempted.

### Step 3.3 — Ralph Loop Iteration Sequence

| Iteration | Sub-task | Agent | Gate |
|-----------|---------|-------|------|
| 1 | DB migration (if needed) | Kiran + Neha | Migration idempotent ✓ |
| 2 | Backend services (core logic) | Rohan | Unit tests exist ✓ |
| 3 | Backend unit tests pass | Vikram | pytest GREEN ✓ |
| 4 | Backend API endpoints | Rohan | API tests exist ✓ |
| 5 | API integration tests | Vikram | Integration GREEN ✓ |
| 6 | Frontend page + components | Ananya | Component tests exist ✓ |
| 7 | Frontend component tests | Vikram | React Testing Library GREEN ✓ |
| 8 | Playwright E2E tests | Vikram | E2E GREEN ✓ |
| 9 | Security review | Ishaan | Checklist cleared ✓ |
| 10 | SPARC done criteria update | Sonal | All checkboxes ticked ✓ |
| 11 | Kabir review gate | Kabir | PR approved ✓ |

Loop halts at any failed gate. Fix → re-run that iteration → continue.

### Step 3.4 — Parallel Agent Execution

```
GROUP A (run in parallel — independent):
  Rohan_Backend_003    → connector + API + services
  Ananya_Frontend_004  → page + components
  Kiran_Data_008       → normalization + ETL + migrations

GROUP B (run after GROUP A artifacts are ready):
  Vikram_QA_005        → unit + integration + E2E tests
  Neha_DevOps_006      → migration scripts + deploy config
  Ishaan_Security_007  → security review

SERIAL (must run last):
  Kabir_Reviewer_010   → final PR review + approval
  Aarav_PM_001         → Jira close + sprint update
```

---

## Phase 4 — Testing Gates

### Unit Tests
- Tool: `pytest` (backend), `React Testing Library` (frontend)
- Location: `05_Tests/backend/` and `05_Tests/frontend/`
- Required coverage: ≥ 80% for new code
- Must run in < 60 seconds
- **No database mocks** — integration tests hit real test DB

### API Integration Tests
- Tool: `httpx` + FastAPI `TestClient`
- Test every new endpoint: happy path + error cases + auth
- Runs against test PostgreSQL instance (Docker)

### Playwright E2E Tests
- Tool: Playwright
- Location: `05_Tests/e2e/`
- Tests new page from user perspective (login → navigate → interact → verify)
- Screenshots saved on failure to `05_Tests/screenshots/`
- Must run against Docker stack (`docker-compose up`)

### Pre-commit Hook Gates
```
✓ pytest 05_Tests/ — all pass
✓ tsc --noEmit    — TypeScript clean
✓ Secret scan     — no credentials in code
✓ Migration check — DB schema consistent
```

### Pre-push Hook Gates
```
✓ Full pytest suite
✓ Playwright E2E
✓ npm run build (vite build clean)
```

---

## Phase 5 — Review & Merge

### PR Description Requirements
Every PR must include:
```markdown
## Feature
[TICKET] — Feature Name

## Summary
- What was built
- Key design decisions

## SPARC Reference
Link to .claude/features/YYYY-MM-DDTHH-MM_<TICKET>_<slug>.md

## Tests
- Unit: X tests added, all green
- E2E: Y scenarios, all green
- Coverage: Z%

## Checklist
- [ ] TDD: test RED confirmed before implementation
- [ ] All unit tests GREEN
- [ ] Playwright E2E GREEN
- [ ] Security checklist (Ishaan) passed
- [ ] SPARC Done Criteria all ticked
- [ ] Living docs updated (00_docs/)
- [ ] Jira ticket updated to Done
```

### Kabir Review Gate
Kabir_Reviewer_010 checks:
1. PR description complete
2. All tests green (CI confirmation)
3. Code follows security rules (Rule 05)
4. No anti-patterns (partial feature, mock DB, `--no-verify`)
5. SPARC Done Criteria all ticked
6. Living docs updated

**Approval = merge authorized. No approval = no merge. No exceptions.**

### Merge Protocol
```
1. Squash-merge to main (clean history)
2. Commit message: "feat(ERP-CF-001): Universal Connector Interface\n\nCo-authored-by: [agents]"
3. Delete feature branch
4. Remove git worktree: git worktree remove ../ria_advisory__ERP-CF-001
5. Close TMUX session: tmux kill-session -t ERP-CF-001
6. Update Jira ticket → Done
7. Update .claude/sessions.md with session close entry
```

---

## Phase 6 — Post-Merge

### Living Document Updates (Sonal_Docs_009)
After every feature merge, update applicable docs in `00_docs/`:

| Feature type | Documents to update |
|---|---|
| New DB tables | `data_model.md` |
| New API endpoints | `api_reference.md` |
| New ERP connector | `connector_guide.md` |
| New env vars | `onboarding.md` |
| Architecture change | `architecture.md` + `decisions.md` |

### Context Graph Update
```
/graphify → updates 00_docs/knowledge_graph.html + knowledge_graph.json
```

### Session Log Entry
```
.claude/sessions.md → Session-NNN entry with:
  - Features completed
  - Decisions made
  - State at close
```

---

## Anti-Patterns Reference

| Anti-pattern | Consequence | Rule |
|---|---|---|
| Commit directly to main | Bypasses all gates | R13 |
| Write code before test | Violates TDD | R04, R13 |
| Partial feature merge | Broken main branch | R13 |
| Skip E2E, rely on unit tests only | Production UI broken | R13 |
| Delete worktree before merge | Lost work | R13 |
| Run two features in one worktree | Git conflicts | R13 |
| `git commit --no-verify` | All hooks bypassed | R13 |
| Approve own PR | No independent review | R03 |
| Mock the database in tests | Mismatch vs prod | R04 |
| Plaintext secret in code | Security breach | R05 |

---

## Quick Reference Card

```
Feature start:
  git worktree add ../ria_advisory__TICKET -b feature/TICKET-slug
  tmux new-session -s TICKET
  /ralph-loop

TDD cycle:
  Vikram: write test → RED ✓
  Rohan/Ananya: implement → GREEN ✓
  Refactor → still GREEN ✓

Exit gate (ALL required):
  pytest GREEN ✓
  tsc clean ✓
  Playwright E2E GREEN ✓
  Ishaan security ✓
  SPARC checkboxes ✓
  Kabir approved ✓

Post-merge:
  git worktree remove + tmux kill + Jira Done + docs updated
```

---

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-30 | Initial document created from Rule 13 + CLAUDE.md | Meera_Architect_002 |
