# Dashboard live-data methodology (Epic #849)

## Summary
Recommended pattern for this dashboard:
- SSE for event-stream visuals (Context Flow)
- Polling for aggregate/API-backed panels
- Explicit per-panel `last updated` timestamps
- Forced refresh on delayed-mount views (Wiki, Cost, Agents)

## Per-panel contract

1. Context Flow: SSE + mapped node animation.
2. GitHub: `/api/github/summary` poll.
3. Quotas: `/api/openrouter/credits` + `/api/cloudflare/ai-usage` poll.
4. Wiki Metrics: `/api/wiki-metrics` poll + view-switch refresh.
5. Cost+Token: telemetry summary endpoints + view-switch refresh.
6. Agents: heartbeat/session fetch + view-switch refresh.

## Staleness strategy
- Always render visible "last updated" text.
- Keep stale data on transient fetch failure.
- Surface empty/loading states explicitly.
