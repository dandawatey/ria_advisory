# i-finsights Documentation

**Product:** i-CFO360 — Unified Financial Intelligence Platform
**Client:** RIA Advisory Group
**Built by:** i-Source Infosystems
**Live:** Self-hosted Docker (http://localhost:5002 — dev)

---

## Documents

| # | Document | Audience | Description |
|---|----------|----------|-------------|
| 01 | [Vision & Idea](01_Vision_and_Idea.md) | All | Problem statement, vision, strategic pillars, target personas |
| 02 | [Feature Catalog](02_Feature_Catalog.md) | Product / Engineering | All 51 features, routes, access levels, data model, API summary |
| 03 | [Technical Architecture](03_Technical_Architecture.md) | Engineering | Stack, system diagram, DB schema, pipeline, security, deployment |
| 04 | [Leadership Presentation](04_Leadership_Presentation.md) | Board / Executive | 14-slide deck — problem, solution, features, ROI, roadmap, ask |

---

## Quick Reference

| Item | Value |
|------|-------|
| Frontend | React 18 + TypeScript + Vite → `02_Frontend/` |
| Backend | FastAPI + PostgreSQL → `03_Backend/` |
| Tests | Playwright E2E → `05_Tests/` |
| PRD | Feature specs → `01_prd/` |
| Data Model | Star schema docs → `04_DataModel/` |
| Features | 51 total (F000–F051) |
| GL Records | 188,380 across 17 subsidiaries |
| Roles | superadmin · ria_admin · isource_admin · finance_user · viewer |
