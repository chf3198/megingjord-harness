---
title: "Dashboard live-data patterns (SSE/polling/staleness) — 2026-Q2"
type: research
created: 2026-05-05
updated: 2026-05-05
status: complete
tags: [dashboard, telemetry, sse, polling, staleness, epic-849]
sources: ["https://web.dev/articles/eventsource-basics", "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events", "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API", "https://www.nngroup.com/articles/dashboard-design/"]
---

# Dashboard live-data patterns (SSE/polling/staleness) — 2026-Q2

**Date**: 2026-05-05  
**Ticket**: #853  
**Epic**: #849  
**Last updated**: 2026-05-05T00:00:00Z

## Summary table (per-panel design)

| Panel | Data source | Refresh cadence | Staleness indicator |
|---|---|---|---|
| Context Flow | SSE event stream + event mapping (`handleSSEvent`) | Event-driven + 30s idle sweep | Node glow decay + `last updated` timestamp |
| GitHub | `/api/github/summary` polling cache | Every refresh cycle (default 5s) | `last updated` timestamp |
| Quotas | `/api/openrouter/credits` + `/api/cloudflare/ai-usage` | Every refresh cycle | `last updated` timestamp |
| Wiki Metrics | `/api/wiki-metrics` + health drilldown | Every refresh cycle + force refresh on Wiki view switch | `last updated` timestamp |
| Cost+Token | `/api/logs/cost-telemetry` + `/api/logs/token-telemetry-summary` | Every refresh cycle + force refresh on Cost view switch | `last updated` timestamp |
| Agents | local heartbeat storage + session fetch | Every refresh cycle + force refresh on Agents view switch | `last updated` timestamp |

## Findings with source links

1. **Use SSE for eventful flows; polling for aggregates.**
   EventSource is best for low-latency stream updates; polling is simpler for computed aggregates and snapshots.
2. **Expose staleness plainly.**
   Dashboards should display visible "last updated" signals to avoid false confidence.
3. **Use partial-refresh where panel mount is delayed.**
   When views are mounted conditionally, force refresh on view switch avoids stale-first-render.
4. **Prefer resilient fallback behavior.**
   If fetch fails, keep stale cache with explicit loading/empty messaging.

Sources:
- https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- https://web.dev/articles/eventsource-basics
- https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- https://www.nngroup.com/articles/dashboard-design/

## Actionable next steps

1. Keep per-panel timestamp checks in Playwright to prevent regressions.
2. Add stale-threshold color states (green/yellow/red) if refresh age exceeds 10s/30s.
3. Add endpoint-level failure counters for each panel data source.

Refs #853, #849