# F015 — Executive Dashboard

**Area:** React Application  
**Priority:** Must  
**PRD References:** FR-APP-04

---

## Situation

The Group CFO (Elena) and board-level stakeholders need a real-time, single-screen view of group financial performance across all 17 subsidiaries. Today this view does not exist between month-end cycles. The executive dashboard is the primary value-delivery screen of the platform — it replaces the monthly Excel consolidation with a live, drill-capable view.

---

## Problem

Leadership currently has no intra-month visibility into group P&L, cash position, or subsidiary-level performance. When they do get data (monthly), it is stale, manually assembled, and provides no drill-through to understand what is driving a variance. Decision-making is delayed and reactive rather than proactive.

---

## Action

### User Stories

- As the Group CFO, I see consolidated P&L, cash position, AR aging, and AP aging on a single dashboard, refreshed every pipeline cycle.
- As the Group CFO, I can click on any subsidiary in the consolidated view and drill through to that entity's individual financials.
- As a board member, I can see KPI tiles with period-over-period variance and trend sparklines without needing to understand the underlying data model.

### Acceptance Criteria

**Layout & Content**

1. Dashboard loads in P95 < 2.5 seconds for authorised users.
2. **KPI Tiles** (top of page): Consolidated Revenue (MTD/YTD), Consolidated EBITDA, Net Cash Position, Total AR Outstanding, Total AP Outstanding — each tile shows current period value, prior period value, absolute variance, and % variance; colour-coded (green/amber/red) against plan.
3. **Consolidated P&L summary table**: rows = canonical account hierarchy (Revenue → EBITDA → Net Income); columns = current period, prior period, YTD, prior YTD, variance $, variance %; data from `fact_gl_entry` Gold table, filtered to eliminated view by default.
4. **Cash position panel**: aggregate bank balances by subsidiary and currency, translated to USD; trend sparkline for last 13 weeks.
5. **AR Aging panel**: aging buckets (Current, 30, 60, 90, 90+ days) aggregated across all subsidiaries; total outstanding and overdue %.
6. **AP Aging panel**: same structure as AR aging but for payables.
7. **Subsidiary performance table**: one row per subsidiary; columns = Revenue MTD, EBITDA MTD, Revenue YTD, EBITDA YTD, % variance to plan; sortable by any column.
8. **Entity drill-through:** clicking any subsidiary row navigates to the Entity Detail View (F017) scoped to that subsidiary — Elena can drill through despite not being a subsidiary controller (her Entra role grants group-level read access to all entities).

**Filtering & Interactivity**

9. Period selector: current month (default), prior month, custom month-year range, YTD, custom date range.
10. Entity filter: all entities (default), or multi-select to a subset.
11. Gross / Eliminated toggle: switch between pre-elimination and post-elimination consolidated view.
12. All filter state persists in URL query params for bookmarkability and sharing.
13. Drill-through opens in the same tab (navigates to F017 with filter context preserved) or new tab (shift-click).

**Annotations**

14. Any KPI tile or table row can be annotated (F020 in-app annotations): comment icon visible on hover; annotations displayed inline as a count badge; full annotation thread accessible in a slide-out panel.

**Data Freshness**

15. Dashboard header displays last data refresh timestamp (from pipeline run metadata) and a visual indicator if data is > 8 hours old (amber) or > 24 hours old (red).

---

## Result

- CFO has intra-day visibility into group financial performance — no waiting for month-end.
- Consolidated P&L and KPIs derived from a single governed source — no reconciliation disputes.
- Entity drill-through replaces ad-hoc data requests to subsidiary controllers.
- Dashboard load performance < 2.5s P95 met through Gold-layer optimisation and SQL Warehouse caching.

---

## Constraints

- **Dependency:** F014 (React foundation & auth) — dashboard is a feature module within the SPA.
- **Dependency:** F009 (Gold layer) for P&L, fact tables; F010 (elimination engine) for eliminated view; F011 (FX) for USD translation.
- **Dependency:** F019 (API layer) — all data fetched via versioned API, not direct lake query.
- **Dependency:** F020 (annotations) for the annotation feature on tiles and rows.
- **Accessible to:** `group-exec`, `group-group-finance`, `group-fpa` roles. Subsidiary controllers see their entity only via F017.
- **Out of scope:** Budget/plan data (unless a plan ingestion feature is added); dashboard shows actuals vs. plan only if plan data is loaded into Gold.
- **Constraint:** P&L hierarchy display depends on canonical CoA hierarchy (F007) being fully defined and approved before dashboard go-live.
- **Constraint:** Drill-through to F017 respects the target user's entity-level permissions — if an exec drills into Sub 07, they see Sub 07 data because their role grants group-wide access, not because F017 bypasses entity scoping.
