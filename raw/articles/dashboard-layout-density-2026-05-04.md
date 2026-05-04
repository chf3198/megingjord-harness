---
title: "Dashboard layout density — 2026-Q2 research"
type: research
created: 2026-05-04
updated: 2026-05-04
status: pending
tags: [dashboard, layout, viewport, sizing, governance]
sources: ["[[baton-protocol]]", "[[governance-enforcement]]"]
---

# Dashboard layout density — 2026-Q2 research

**Date**: 2026-05-04
**Ticket**: #854 (research only; child of EPIC #850)
**Lane**: docs-research
**Last updated**: 2026-05-04T06:13:00Z

## Summary matrix

| Panel | Decision | Desktop 1920×1080 | Laptop 1440×900 | Mobile-touch |
|---|---|---|---|---|
| Context Flow | Keep, event-first | `minmax(320px, 1.4fr)` | `minmax(260px, 1.3fr)` | collapsed cards + drilldown |
| GitHub | Keep, compact table | `minmax(260px, 1fr)` | `minmax(220px, 1fr)` | list with status chips |
| Quotas | Keep, high-signal KPIs | `minmax(220px, 0.9fr)` | `minmax(200px, 0.9fr)` | KPI strip + expandable detail |
| Wiki Metrics | Consolidate into Insights | `minmax(220px, 0.8fr)` | `minmax(190px, 0.8fr)` | metrics folded under Insights |
| Cost+Token | Keep, trend-first | `minmax(260px, 1fr)` | `minmax(220px, 1fr)` | sparkline + last sync |
| Agents | Keep, ownership-critical | `minmax(300px, 1.2fr)` | `minmax(250px, 1.1fr)` | compact roster + detail sheet |

## Findings with source links

1. **Viewport fill heuristic**: prefer CSS Grid `minmax()` + `fr` for dashboard rows; reserve `vh` anchoring for global shell wrappers to avoid nested-scroll traps.
2. **Scroll vs collapse vs fullscreen**: users accept collapse/accordion on dense panels before fullscreen. Fullscreen is best as optional drilldown.
3. **Panel removal rule**: remove only when information is redundant and derivable from another panel within one click.
4. **Cross-viewport**: desktop favors simultaneous awareness; laptop reduces vertical waste; mobile uses progressive disclosure.
5. **Regression baseline**: preserve before/after screenshots for desktop/laptop/mobile and verify panel order, height class, and overflow.

## Visual mockups (wireframe baseline)

### Desktop (1920×1080)
- Row 1: Context Flow (wide) | Agents
- Row 2: GitHub | Cost+Token
- Row 3: Quotas | Insights (Wiki merged)

### Laptop (1440×900)
- Row 1: Context Flow
- Row 2: Agents | GitHub
- Row 3: Cost+Token | Quotas
- Row 4: Insights (collapsed by default)

### Mobile-touch
- Stack order: Context Flow → Agents → Quotas KPI strip → GitHub → Cost+Token → Insights
- Default collapsed: Insights details, long table rows, secondary tooltips

## Fleet/cloud utilization evidence (zero paid tokens)

- `npm run capability:probe` → 6 providers + 3 fleet hosts.
- `routing-refresh --update-matrix` → Groq 16, Cerebras 4, OpenRouter 371, Google 50; 36gbwinresource 5.
- `fleet-benchmark-runner.js` → 36gbwinresource cold ~72.73 tok/s.
- OpenClaw preflight attempted; endpoint unavailable at run time, then workload shifted to remaining free providers/fleet.

## Actionable next steps (deferred)

1. Panel height tokens (`tall`, `standard`, `compact`).
2. Wiki Metrics consolidation into Insights.
3. Playwright baselines for 3 viewports.
4. Overflow guardrails against nested scrolling.
5. Spawn implementation children only after client review.

## Sources

- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout
- https://www.w3.org/TR/css-sizing-3/
- https://www.nngroup.com/articles/dashboard-design/
- https://www.smashingmagazine.com/2023/02/guide-building-better-dashboards/

Refs #854, #850
