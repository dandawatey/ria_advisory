# PRD — AgentiKOS: VSCode Kickstart Extension

**Version:** 1.0
**Date:** 2026-04-30
**Owner:** Aarav_PM_001
**Architect:** Meera_Architect_002
**Status:** Draft — Awaiting Sprint Planning
**Ticket Prefix:** EXT

---

## 1. Executive Summary

AgentiKOS is a VSCode extension that eliminates the manual setup overhead of starting a new agentic application. A developer opens a project folder, runs one command, fills a guided form, and receives: a scaffolded `.claude/` config tree (rules, agents, timelogs, Jira stubs, SPARC templates), a project-specific CLAUDE.md, and a fully assembled kickstart prompt ready to paste into Claude Code. What takes 20–30 minutes of copy-paste setup today takes 90 seconds with AgentiKOS.

---

## 2. Problem Statement + Opportunity

### Problem
The Agentic OS workflow (Rules 01–13, SPARC, agent team, Jira hierarchy, Ralph loop) delivers structured, auditable product development — but it requires 20–30 minutes of manual scaffolding before the first prompt is written:

- Copy 13 rule files into `.claude/rules/`
- Write 10 agent stub files with skills + guardrails
- Configure CLAUDE.md with stack, paths, agents
- Create timelog, Jira, features, sessions, graph, prompt directories
- Manually fill the kickstart prompt template with project details
- Hope nothing was missed

This friction discourages adoption on new projects and causes inconsistency across teams.

### Opportunity
VSCode has 30M+ active users. A one-click extension that scaffolds the full Agentic OS environment can:
- Standardize agentic development setup across all projects
- Eliminate human error in rule/agent file creation
- Enable non-Claude-Code-expert teammates to start correctly
- Reduce project bootstrap time from ~30 minutes to ~90 seconds

---

## 3. Goals + Non-Goals

### Goals
- G-01: Zero-friction Agentic OS project bootstrap via VSCode command palette
- G-02: Guided form UI with auto-stack detection (no manual JSON editing)
- G-03: Complete `.claude/` scaffold: 13 rules + 10 agent stubs + all supporting files
- G-04: Assembled kickstart prompt ready to use in Claude Code (clipboard + file)
- G-05: Works on any project type (not RIA-specific)
- G-06: VSCode-native theming (dark/light mode)

### Non-Goals
- NG-01: Does NOT write application code — only scaffolds the Agentic OS config layer
- NG-02: Does NOT integrate with real Jira API (local stub files only — Phase 2)
- NG-03: Does NOT manage Claude Code sessions directly
- NG-04: Does NOT support non-VSCode editors (JetBrains, Cursor — Phase 3)
- NG-05: Does NOT enforce which Claude model is used

---

## 4. User Personas

### P-01 — Yogesh (Power User / Architect)
- Starts 2–4 new agentic projects per month
- Deep Claude Code + Agentic OS knowledge
- Pain: Repetitive scaffolding wastes time; wants one-command setup
- Needs: Full control over all fields; auto-detect saves time

### P-02 — Backend Engineer (Team Member)
- Joins a project mid-stream; needs to start a sub-project or spike
- Knows the stack; unfamiliar with Agentic OS rules
- Pain: Doesn't know which rule files are required; misses agent stubs
- Needs: Guided form that explains each field; sane defaults

### P-03 — Tech Lead (Governance Owner)
- Responsible for ensuring all projects follow the Agentic OS rules
- Pain: Can't verify that new projects have correct rule files
- Needs: Consistent scaffold output that is auditable

### P-04 — New Joiner (First Agentic Project)
- Has VSCode; has Claude Code; zero knowledge of `.claude/` structure
- Pain: Intimidated by 13 rule files and 10 agent stubs
- Needs: Form that holds their hand; every field explained; one-click output

---

## 5. Feature List

### MVP (Phase 1)
- F-01: Command palette command — `Agentic OS: Kickstart New Project`
- F-02: Webview form panel (VSCode-themed, 11 input fields)
- F-03: Auto-detect stack (reads `package.json`, `requirements.txt`, `docker-compose.yml`, `go.mod`, `Cargo.toml`, `.env`)
- F-04: `.claude/` scaffolder — creates full directory tree with all files
- F-05: CLAUDE.md generator — filled with project-specific config
- F-06: Kickstart prompt builder — assembles filled prompt string
- F-07: Clipboard copy + write to `.claude/kickstart-prompt.md`
- F-08: Success notification with "Open Prompt File" action button
- F-09: Overwrite protection — warns if `.claude/` already exists

### Phase 2
- F-10: Jira API integration — create real tickets from form data
- F-11: GitHub repo initializer — `git init` + remote setup + `.gitignore`
- F-12: Rule file version picker — choose rule set version (v1, v2)
- F-13: Team roster customizer — rename/add agents in the form
- F-14: Template library — save + reuse project configs

### Future (Phase 3)
- F-15: JetBrains / Cursor plugin parity
- F-16: Claude Code CLI integration — inject prompt directly into Claude Code session
- F-17: Multi-workspace support — scaffold multiple sub-projects from one form
- F-18: Telemetry dashboard — projects bootstrapped, rule versions in use

---

## 6. Functional Requirements

### Form — Input Fields
- FR-001: App Name — text input, required, max 60 chars, used in CLAUDE.md title + prompt + branch names
- FR-002: One-liner — text input, required, max 120 chars, used in PRD executive summary
- FR-003: Problem Statement — textarea, required, min 20 chars
- FR-004: Target Users — textarea, required, comma-separated persona names (e.g., "HR Manager, Hiring Manager")
- FR-005: Frontend Stack — text input with dropdown suggestions (React, Vue, Angular, Next.js, None), pre-filled by auto-detect
- FR-006: Backend Stack — text input with dropdown suggestions (FastAPI, Django, Express, Go/Gin, None), pre-filled by auto-detect
- FR-007: Database — text input with dropdown suggestions (PostgreSQL, MySQL, MongoDB, SQLite, None), pre-filled by auto-detect
- FR-008: Auth — single-select dropdown (Azure SSO / Clerk / Auth0 / JWT / None)
- FR-009: Repo URL — text input, optional, validated as URL if provided
- FR-010: Deploy Target — single-select dropdown (Netlify / Vercel / AWS / GCP / Self-hosted / TBD)
- FR-011: Ticket Prefix — text input, required, 2–5 uppercase chars, validated by regex `^[A-Z]{2,5}$`

### Auto-Detect
- FR-012: "Auto-Detect Stack" button triggers workspace file scan
- FR-013: Detect React/Vue/Angular/Next.js from `package.json` → `dependencies` keys
- FR-014: Detect FastAPI/Django/Flask from `requirements.txt` or `pyproject.toml` content
- FR-015: Detect Go backend from presence of `go.mod`
- FR-016: Detect Rust backend from presence of `Cargo.toml`
- FR-017: Detect PostgreSQL/MySQL/MongoDB from `docker-compose.yml` service image names
- FR-018: Detect DB from `.env` / `.env.example` — parse `DATABASE_URL` prefix
- FR-019: Auto-detect fills fields non-destructively (only pre-fills empty fields)
- FR-020: Auto-detect shows a status line: "Detected: React + FastAPI + PostgreSQL"

### Scaffolder
- FR-021: Create `.claude/` directory if not present
- FR-022: Write `.claude/CLAUDE.md` with project name, stack, key paths placeholder, agent roster, mandatory workflow
- FR-023: Write `.claude/rules/rules.md` (rule index, 13 entries)
- FR-024: Write `.claude/rules/01_workflow.md` through `.claude/rules/13_feature_complete.md` (13 files)
- FR-025: Write 10 agent stub files at `.claude/agents/<AgentID>.md` — each with role, skills, guardrails
- FR-026: Write 10 timelog stub files at `.claude/timelogs/<AgentID>.md`
- FR-027: Write `.claude/prompt.md` with P-001 stub (date + project name)
- FR-028: Write `.claude/sessions.md` with Session-001 stub
- FR-029: Write `.claude/graph.md` with empty annotated module graph
- FR-030: Write `.claude/epic.md` as epic index placeholder
- FR-031: Create directories: `.claude/jira/`, `.claude/features/`, `01_prd/`, `00_docs/`
- FR-032: All files created with correct content — no placeholder `TODO` strings left unfilled for required values
- FR-033: If `.claude/` already exists: show warning dialog with options — Overwrite / Merge (skip existing) / Cancel

### Prompt Builder
- FR-034: Assemble full kickstart prompt with all 11 form values substituted
- FR-035: Output includes: full 6-step execution sequence, output rules, constraints, GO instruction
- FR-036: Write assembled prompt to `.claude/kickstart-prompt.md`
- FR-037: Copy prompt to system clipboard
- FR-038: Show VSCode notification: "AgentiKOS ready. Prompt copied + saved to .claude/kickstart-prompt.md" with action button "Open File"

### Validation
- FR-039: Form submit blocked if any required field is empty — inline error shown per field
- FR-040: Ticket Prefix validated against `^[A-Z]{2,5}$` — error shown inline
- FR-041: Repo URL validated as valid URL if non-empty
- FR-042: App Name validated — no special characters except hyphens/underscores

---

## 7. Non-Functional Requirements

- NFR-01: **Performance** — Scaffold + prompt build completes in < 2 seconds for any project size
- NFR-02: **Compatibility** — VSCode engine `^1.85.0`; tested on Mac, Windows, Linux
- NFR-03: **Theming** — Full VSCode CSS variable support; correct appearance in all default themes (Dark+, Light+, High Contrast)
- NFR-04: **Bundle size** — VSIX package < 500 KB; zero heavy npm dependencies
- NFR-05: **Offline** — Works fully offline; no network calls in MVP
- NFR-06: **Idempotent scaffold** — Running twice with Merge mode never corrupts existing files
- NFR-07: **Accessibility** — All form inputs have labels; keyboard-navigable; screen reader compatible
- NFR-08: **Error handling** — All file system errors caught and shown as VSCode notifications (never silent failures)

---

## 8. Data Model (Entities + Relationships)

### ProjectConfig (in-memory, form state)
Holds all 11 user-provided values. Passed from form → scaffolder → prompt builder. Not persisted to disk directly — only its rendered outputs (CLAUDE.md, kickstart-prompt.md) are saved.

### ScaffoldManifest (in-memory)
List of all files + directories to create, derived from ProjectConfig. Each entry has: `path`, `content`, `overwritePolicy` (always / skip / prompt). Produced by scaffolder, consumed by file writer.

### StackDetectionResult (in-memory)
Output of the auto-detect scan. Fields: `frontend`, `backend`, `database` (all optional strings). Merged into ProjectConfig only for empty fields.

### Template Registry (compile-time)
13 rule templates + 10 agent templates embedded as TypeScript string constants. Versioned with the extension. No runtime file reads required.

---

## 9. API Surface

No HTTP API. Extension communicates via VSCode's internal message passing:

### Webview → Extension Host
- `submit` — carries full ProjectConfig; triggers scaffold + prompt build
- `detectStack` — triggers workspace scan; returns StackDetectionResult
- `checkExisting` — checks if `.claude/` exists; returns boolean + file count

### Extension Host → Webview
- `stackDetected` — carries StackDetectionResult for field pre-fill
- `existingFound` — carries existing file count; webview shows warning dialog
- `scaffoldComplete` — carries output file count + prompt path; webview shows success state
- `scaffoldError` — carries error message; webview shows error state

---

## 10. Tech Stack Decision

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript | VSCode extension API is TypeScript-native; type safety for message contracts |
| Extension API | `vscode` 1.85+ | Webview, clipboard, notifications, file system — all built-in |
| UI | VSCode Webview API (HTML/CSS/JS) | No React needed; plain HTML + CSS variables = zero bundle overhead |
| File I/O | Node.js `fs/promises` via `vscode.workspace.fs` | Cross-platform; uses VSCode's virtual filesystem |
| Bundler | `esbuild` (via `@vscode/vscode-dts`) | Fast; minimal config; produces small VSIX |
| Templates | TypeScript string constants | No runtime file reads; templates ship inside compiled JS; simpler than loading from disk |
| Testing | Mocha + `@vscode/test-electron` | VSCode extension test standard |
| Publishing | `vsce` (VSCode Extension CLI) | Standard VSIX packaging + Marketplace publish |

---

## 11. Integrations

### MVP
- **System clipboard** — `vscode.env.clipboard.writeText()` for prompt copy
- **VSCode workspace filesystem** — read files for auto-detect, write files for scaffold

### Phase 2
- **Jira Cloud REST API** — create Epic + Stories from form data (requires API token input)
- **GitHub API** — init repo, create first commit, push scaffold

### Future
- **Claude Code CLI** — inject prompt directly via `claude` CLI stdin

---

## 12. Security Requirements

- SR-01: No telemetry, no external network calls in MVP — all data stays local
- SR-02: No credentials stored — extension never handles API keys (Phase 2 Jira token stored in VSCode SecretStorage, not settings.json)
- SR-03: Scaffolded rule files do not contain any project-specific secrets
- SR-04: Clipboard content (kickstart prompt) contains no credentials — only project metadata
- SR-05: Extension permissions limited to: `workspaceContains`, `clipboard` — no broad filesystem access beyond workspace
- SR-06: Webview Content Security Policy set to `default-src 'none'`; only inline scripts allowed

---

## 13. Success Metrics

### Phase 1 (MVP) KPIs
| Metric | Target | Measurement |
|--------|--------|-------------|
| Bootstrap time | < 90 seconds from command to prompt-ready | Manual timing |
| Scaffold accuracy | 100% of required files created with correct content | Test suite |
| Form completion rate | > 90% of form opens result in submit | VSCode telemetry (Phase 2) |
| Zero scaffold errors | 0 file write failures on clean workspace | Test suite |

### Phase 2 KPIs
| Metric | Target |
|--------|--------|
| Marketplace installs | 100 within 30 days of publish |
| Rating | ≥ 4.5 / 5 stars |
| Jira ticket creation success | > 95% |

---

## 14. Risks + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| VSCode API breaking change | Low | High | Pin engine version; add regression tests per VSCode release |
| Scaffold overwrites user files | Medium | High | Overwrite protection (FR-033); default to Merge mode |
| Rule templates go stale as Agentic OS evolves | High | Medium | Template versioning in package.json; "Check for updates" command (Phase 2) |
| Auto-detect false positives (wrong stack) | Medium | Low | Fields are editable after auto-detect; user always has final say |
| VSIX bundle too large due to template strings | Low | Low | Templates are plain text strings; total size < 50 KB |
| Webview XSS from user input rendered in HTML | Low | High | Sanitize all user input before rendering in webview; never use innerHTML with user data |

---

## 15. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should the extension be published to VSCode Marketplace or distributed as VSIX only? | Aarav_PM_001 | Sprint 1 planning |
| OQ-02 | Should rule templates be embedded at compile time (current plan) or fetched from a remote URL to stay current? | Meera_Architect_002 | Sprint 1 planning |
| OQ-03 | Does the Ticket Prefix need to be validated against an existing Jira project, or is local-only validation sufficient for MVP? | Aarav_PM_001 | MVP scope decision |
| OQ-04 | Should `00_docs/` and `01_prd/` directories be created inside the workspace root or configurable? | Meera_Architect_002 | Sprint 1 |
| OQ-05 | Is the overwrite-protection dialog (FR-033) blocking (modal) or non-blocking (notification)? | Ananya_Frontend_004 | UX decision |

---

## Appendix A — Scaffold Output (Full File Tree)

```
.claude/
├── CLAUDE.md                          ← generated from form values
├── rules/
│   ├── rules.md                       ← rule index (13 entries)
│   ├── 01_workflow.md
│   ├── 02_no_dumps.md
│   ├── 03_jira.md
│   ├── 04_tdd.md
│   ├── 05_security.md
│   ├── 06_data_model.md
│   ├── 07_connector.md
│   ├── 08_frontend.md
│   ├── 09_agents.md
│   ├── 10_deploy.md
│   ├── 11_logging.md
│   ├── 12_docs.md
│   └── 13_feature_complete.md
├── agents/
│   ├── Aarav_PM_001.md
│   ├── Meera_Architect_002.md
│   ├── Rohan_Backend_003.md
│   ├── Ananya_Frontend_004.md
│   ├── Vikram_QA_005.md
│   ├── Neha_DevOps_006.md
│   ├── Ishaan_Security_007.md
│   ├── Kiran_Data_008.md
│   ├── Sonal_Docs_009.md
│   └── Kabir_Reviewer_010.md
├── timelogs/
│   ├── Aarav_PM_001.md
│   └── ... (10 files)
├── jira/                              ← empty directory
├── features/                          ← empty directory
├── prompt.md                          ← P-001 stub
├── sessions.md                        ← Session-001 stub
├── graph.md                           ← empty annotated graph
├── epic.md                            ← epic index placeholder
└── kickstart-prompt.md                ← assembled kickstart prompt

01_prd/                                ← empty directory
00_docs/                               ← empty directory
```

---

## Appendix B — Extension Manifest Summary

```
Name:           agentikos
Display Name:   Agentic OS Kickstart
Publisher:      [TBD]
Version:        0.1.0
Engine:         vscode ^1.85.0
Activation:     onCommand:agentikos.kickstart
Command:        "Agentic OS: Kickstart New Project"
Category:       Agentic OS
```
