# Developer HOWTO: Fleet Routing Cascade

How task routing works in Megingjord, how to test it, and how to read cost reports.
Refs #640 #335 #573

## Overview

Every task is routed through a four-lane cost-ascending cascade. The goal is to use
the cheapest capable model — local Ollama first, Sonnet only when complexity requires it.

```
free → fleet → haiku → premium
  $0      $0    $0.08x    1.0x
```

The routing pipeline has three stages:

1. **classify** (`task-router.js`) — assigns a lane and computes a complexity score
2. **resolve** (`model-routing-engine.js`) — applies complexity thresholds and rollback policy
3. **dispatch** (`task-router-dispatch.js`) — executes against the resolved backend

## Lanes

| Lane | Backend | Cost | Use when |
| --- | --- | --- | --- |
| `free` | Claude auto-tier | $0 | Lookups, Q&A, docs, boilerplate |
| `fleet` | Ollama (qwen2.5:7b-instruct) | $0 | Medium implementation, config gen, log analysis |
| `haiku` | claude-haiku-4-5-20251001 | ~$0.08x | Single-file refactors, test gen, code review |
| `premium` | claude-sonnet-4-6 | 1.0x | Multi-file architecture, security, ambiguous debugging |

## Complexity Scoring

The classifier emits a `complexity` score in `[0.0, 1.0]` based on the ratio of
premium-tier keywords to total keyword weight in the prompt.

| Score range | Lane assigned |
| --- | --- |
| `[0.0, 0.3)` | fleet |
| `[0.3, 0.7)` | haiku |
| `[0.7, 1.0]` | premium |

These thresholds are configurable in `scripts/global/model-routing-policy.json`:

```json
"complexityThresholds": {
  "haiku": 0.3,
  "premium": 0.7
}
```

## Testing a Routing Decision

```bash
# Route a prompt and see the decision (no execution)
node scripts/global/task-router-dispatch.js --prompt "write unit tests for auth.js" --json

# Route and execute against fleet (Ollama must be reachable)
node scripts/global/task-router-dispatch.js --prompt "write unit tests for auth.js"

# Override the model
node scripts/global/task-router-dispatch.js --prompt "..." --model qwen2.5:14b-instruct
```

Output fields:
- `route.lane` — lane selected by classifier
- `routing.lane` — lane after threshold and rollback enforcement
- `routing.complexity` — 0.0–1.0 score
- `decision.action` — what actually happened (`route-fleet`, `recommend-haiku`, `fleet-unavailable`, etc.)

## Reading the Cost Report

```bash
npm run cost-report
```

Sample output:

```
=== Routing Cost Report ===
Samples (last 30 days): 47

Tier distribution:
  free     ████████████         60.0%
  fleet    ████████             38.0%
  haiku                          1.0%
  premium                        1.0%

Estimated monthly cost: $0.54
  (based on 1090 req/mo baseline)
Premium share: 1.0%
Avg multiplier: 0.012
Success rate: 97.9%
```

A warning fires when premium share exceeds 20%. If you see it, run
`npm run routing:report` to see the 7-day trend and check whether rollback
policy has already engaged.

## Fleet Node Requirements

Fleet dispatch requires a reachable Ollama instance. The primary target is
`36gbwinresource` (GPU node, `100.91.113.16:11434`). The fallback is
`windows-laptop` (`100.94.84.232:11434`).

**Critical**: Set `OLLAMA_KEEP_ALIVE=24h` as a Windows system environment variable
on any fleet node running Ollama. Without this, Ollama evicts models after 1 minute
of idle time, causing every fleet dispatch to wait for a cold reload (~30 s).

See `research/ollama-keepalive-runbook.md` for the full setup procedure.

## Rollback Policy

If premium share exceeds 20% over the last 7 days, `model-routing-engine.js`
automatically forces all tasks to fleet lane until the share drops.

```bash
# Check current distribution
npm run routing:report

# Check 7-day rolling baseline
npm run routing:baseline
```

The rollback threshold and force-lane are configured in `model-routing-policy.json`
under `rollback`.

## Adjusting Routing Thresholds

Edit `scripts/global/model-routing-policy.json`:

```json
"complexityThresholds": {
  "haiku": 0.3,   // raise to send more tasks to fleet
  "premium": 0.7  // raise to send more tasks to haiku
}
```

After editing, run the routing policy tests to verify boundary behavior:

```bash
npx playwright test tests/routing-policy.spec.js
```

## Policy Files

Two policy files govern routing — they must stay consistent:

| File | Controls |
| --- | --- |
| `scripts/global/task-router-policy.json` | Keyword weights, lane classification, `defaultLane` |
| `scripts/global/model-routing-policy.json` | Model IDs, complexity thresholds, rollback, fleet targets |

Both set `defaultLane: "fleet"`. If they diverge, `resolveRouting()` in
`model-routing-engine.js` applies `model-routing-policy.json`'s threshold logic
on top of the classifier's lane from `task-router-policy.json`.
