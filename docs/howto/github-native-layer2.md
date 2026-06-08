# GitHub-Native Layer-2 Coordination

<!-- docs: github-native-layer2 -->

## Overview

The harness implements all Tier-1 HAMR Layer-2 coordination routes as **zero-dependency
GitHub-native primitives**. Cloudflare and a separate HAMR account are **not required** for
single-workspace (Tier-1) use cases.

## Route Table

| Route | GitHub-native implementation | Script |
|---|---|---|
| `/mailbox/write`, `/mailbox/read` | Issues comment append-log + ETag polling | `github-mailbox.js` |
| `/bundle/*` | GitHub Releases asset upload/download | `github-bundle-client.js` |
| `/mcp dispatch` (async) | `repository_dispatch` workflow trigger | `github-mcp-dispatch.js` |
| `/quota`, `/cache-stats` | Scheduled Action → workflow artifact | `.github/workflows/telemetry-collect.yml` |
| `/substrate-health` | Scheduled Action → health.json artifact | `.github/workflows/substrate-health.yml` |
| `mcp review:run` | Scheduled nightly Action | `.github/workflows/review-run.yml` |
| `mcp rotation:check` | Weekly Action → opens Issue when due | `.github/workflows/rotation-check.yml` |

## Dual-Mode Contract

The unified client (`github-native-client.js`) auto-selects the implementation:

```js
const client = require('./scripts/global/github-native-client');

// Default: GitHub-native (no Cloudflare needed)
await client.writeMailbox('owner', 'repo', 'hello');
await client.readMailbox('owner', 'repo');

// Opt-in HAMR for accelerated paths
// MEGINGJORD_HAMR_ENABLED=1 node my-script.js
```

| `MEGINGJORD_HAMR_ENABLED` | Mailbox | Bundle | Telemetry |
|---|---|---|---|
| unset / `0` (default) | GitHub Issues | GitHub Releases | GH Actions artifact |
| `1` | HAMR Worker | HAMR Worker | HAMR Worker |

> **RPC carve-out**: `dispatchMcp` always uses `repository_dispatch` (async) regardless of
> the flag. Interactive low-latency RPC still requires HAMR directly.

## ETag Rate-Budget Optimization (G3)

`readMailbox` sends `If-None-Match: <etag>`. A GitHub `304 Not Modified` response does
**not** count against the 5000 req/hr authenticated REST budget. At steady-state Tier-1
cadence (4 agents, few-dozen/hr writes), rate consumption is well under the ceiling.

## Tier-1 Install (zero Cloudflare)

No changes required. All scripts are deployed via the normal harness deploy:

```bash
npm run deploy:apply     # deploys github-mailbox.js + github-native-client.js etc.
```

The `.github/workflows/` files are committed to the repo and activate automatically.

## When to Use HAMR

Set `MEGINGJORD_HAMR_ENABLED=1` when:
- You need sub-second mailbox latency (HAMR KV vs GitHub API)
- You're operating in Tier-2/3 cross-workspace coordination

For all other Tier-1 uses, the default GitHub-native path is recommended (G3, G5, G6).

<!-- /docs -->
