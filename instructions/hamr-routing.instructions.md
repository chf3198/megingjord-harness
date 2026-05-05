---
name: HAMR Routing
description: Use the HAMR Worker (cost levers, signed observability, MCP capability dispatch) for every governed provider call across all 3 teams.
type: instructions
---

# HAMR Routing (Wave 1-6 production)

HAMR (`https://hamr.chf3198.workers.dev`) is the cross-team cost+observability layer.
Each team — Claude Code, Copilot, Codex — is expected to route through it.
Activate with `npm run hamr:activate` once per checkout.

## Producer chain (must run periodically)

| Producer (local)            | Pushes to                     | Consumed by              |
|-----------------------------|-------------------------------|--------------------------|
| `npm run hamr:cache-push`   | KV `cache-stats:hit-rate-7d`  | `/quota` `hit_rate_7d`   |
| `npm run hamr:health-push`  | KV `substrate-health:latest`  | `/mcp doctor:probe`      |
| `npm run hamr:cache-emit`   | `~/.megingjord/cache-stats.jsonl` | `cache-hit-gate.runGate()` |

A 6h cron is installed by `npm run hamr:install-cron`. Operators MAY skip when
their machine is offline; the Worker scheduled handler advertises staleness via
`/quota.stale=true`.

## Provider call contract (all 3 teams)

Every governed provider call SHOULD flow through `scripts/global/hamr-provider-wrapper.js`:

```js
const { wrapProviderCall } = require('./hamr-provider-wrapper');
const result = await wrapProviderCall('anthropic', () => sdk.messages.create(req), { tier });
```

The wrapper auto-applies `cacheHeaders(provider)` (#926), records `appendCacheStat`
on response (#932), and returns spillover hint via `maybeSpillover` (#927) on rate-limit.

## /mcp capability dispatch

POST to `/mcp` with Ed25519 DPoP auth (use `baton-signing.js` #894) and body
`{capability, params}`. Capabilities: `bundle:fetch`, `doctor:probe`, `mailbox:read`.
Bundle SHA may be advertised via `x-hamr-bundle-sha` for SLSA gate verification.

## Cost levers (covered here, do NOT redefine in team docs)

- Cache adapters per provider — see `wiki/concepts/cache-adapters.md` (#926).
- Header-driven spillover across 6 providers — `wiki/concepts/header-spillover.md` (#927).
- Sticky-route per tier — `scripts/global/sticky-route.js` (#926).
- Anthropic Batch routing for time-elastic work (`isBatchEligible`, #927).

## Boundaries

- HAMR scripts live in `scripts/global/` only. Do NOT duplicate logic in team-specific paths.
- The global task router (`global-task-router.instructions.md`) chooses the **lane** (Free/Fleet/Haiku/Premium); HAMR provides the **cost/observability mechanics** within each lane. No conflict.
- Copilot Team owns `dashboard/js/token-reconcile.js`, `cost-report.js`, `model-routing-engine.js`. HAMR wrapper does NOT modify those — wrapper produces JSONL + KV signals those files can read.

## Activation gates (before claiming HAMR-active)

Run on each checkout:

```bash
npm run hamr:activate         # installs git hooks + cron
npm run hamr:sync-verify      # confirms scripts present in ~/.copilot/, ~/.codex/
npx playwright test tests/hamr-team-integration.spec.js   # smoke test
```

## Override

Repos that explicitly opt out (e.g., air-gapped) MUST set `MEGINGJORD_HAMR_DISABLED=1`.
Non-set defaults to opt-in for governed work.
