---
name: HAMR Routing
description: Use the HAMR Worker (cost levers, signed observability, MCP capability dispatch) for every governed provider call across all 3 teams.
type: instructions
---

# HAMR Routing (Wave 1-6 production)

HAMR (`https://hamr.chf3198.workers.dev`) is the cross-team cost+observability layer.
Each team — Claude Code, Copilot, Codex — is a first-class consumer and is
expected to route governed provider calls through it.
Activate with `npm run hamr:activate` once per checkout. The activation script
supports normal clones and linked Git worktrees; it installs hooks through
Git's resolved hooks path rather than assuming `.git/` is a directory.
SessionStart runs `hamr_activation_check.py` as an advisory gate. Missing,
disabled, malformed, or >24h stale activation emits context before governed
provider calls; offline work remains unblocked.

## Producer chain (must run periodically)

| Producer (local)           | Pushes to                         | Consumed by                 |
|----------------------------|-----------------------------------|-----------------------------|
| `npm run hamr:cache-push`  | KV `cache-stats:hit-rate-7d`      | `/quota` `hit_rate_7d`      |
| `npm run hamr:health-push` | KV `substrate-health:latest`      | `/mcp doctor:probe`         |
| `npm run hamr:cache-emit`  | `~/.megingjord/cache-stats.jsonl` | `cache-hit-gate.runGate()`  |

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
Treat runtime and provider as separate fields: Codex is a runtime, while
OpenAI-compatible, Anthropic, Ollama, LiteLLM, or OpenRouter are provider paths.

## Diagnostic carve-out (per #1155)

For diagnostic calls, integration test probes, or health checks that must be excluded from production utilization and cost metrics:
- Pass `opts.tier = 'diagnostic'` to `wrapProviderCall`. This ensures the call bypasses provider stickiness/routing, executes directly, and is tagged as `tier: 'diagnostic'` in `cache-stats.jsonl` to exclude it from production metrics.
- For genuinely uncoverable raw connection bypasses (very rare), prefix the bypass with:
  ```js
  // hamr-bypass-ok: diagnostic <reason>
  ```
  This prevents linter alerts and reserves bypass status exclusively for necessary testing.

## Token telemetry policy

- Prefer exact provider usage from HAMR-wrapped responses or aggregate usage APIs.
- Record generic OpenAI-compatible traffic as `provider=openai-compatible` unless a
  narrower adapter is known.
- Do not invent Codex per-request token totals. If a Codex session does not expose
  per-request usage, record route metadata and reconcile against aggregate OpenAI
  usage or Codex OpenTelemetry exports when configured.

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

Provider key checks are runtime-aware. `HAMR_TEAM=claude-code` defaults to the
Anthropic provider path and checks `ANTHROPIC_API_KEY`; `HAMR_TEAM=codex`
defaults to OpenAI-compatible activation and checks `OPENAI_API_KEY`.
Provider-neutral, fleet, and Ollama activation modes do not require a cloud
provider key at activation time. Set `HAMR_PROVIDER` to override the default.

## Per-role lane preferences (Refs #2320)

`model-routing-policy.json` now carries a `per_role_lane_preferences` block that
encodes a preferred lane (free|fleet|haiku|premium) per role × complexity tier
(low `[0,0.3)` / mid `[0.3,0.7)` / high `[0.7,1.0]`).

When `resolveRouting(prompt, route, { role })` is called with an active baton role,
the per-role preference overrides the base cascade lane — subject to rollback and
budget governors. The preference is skipped when a rollback is in effect.

Supported roles: `manager`, `collaborator`, `admin`, `consultant`, `it`, `red-team`.

Usage from any runtime:

```js
const { resolveRouting } = require('./model-routing-engine');
const resolved = resolveRouting(prompt, route, { role: 'collaborator' });
// resolved.rolePrefApplied === true when preference was applied
// resolved.activeRole === 'collaborator'
```

Design intent per D3 (fleet-first for role-execution):
- `collaborator`, `admin`, `it`: fleet at low+mid complexity; haiku only at high.
- `manager`, `consultant`: haiku at mid; premium at high (scoping/critique require reasoning).
- `red-team`: fleet at low+mid; haiku ceiling even at high (cross-family, not cloud-first).


## Override

Repos that explicitly opt out (e.g., air-gapped) MUST set `MEGINGJORD_HAMR_DISABLED=1`.
Non-set defaults to opt-in for governed work.
