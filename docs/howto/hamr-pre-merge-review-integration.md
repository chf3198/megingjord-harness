# HAMR Pre-Merge Review Integration (#1744)

How the new pre-merge-review baton step routes through HAMR `/mcp` capability
dispatch, mirroring the `rotation:check` pattern from #1724.

## New `/mcp` capability: `review:run`

```
POST /mcp
{
  "capability": "review:run",
  "params": {
    "ticket_number": 1234,
    "pr_number": 5678,
    "diff_url": "https://github.com/.../pulls/5678/files",
    "operator_mode": "advisory-only" | "enforcing",
    "sub_agents": ["bug-detect", "security", "test-coverage", "architectural-drift"]
  }
}
```

Response:

```json
{
  "decision": "pass" | "advisory_findings" | "fail",
  "findings_count": 12,
  "severity_distribution": { "high": 0, "medium": 2, "low": 10 },
  "auto_escalate_triggered": false,
  "sub_agent_results": [
    { "sub_agent": "bug-detect", "findings_count": 3, "p95_latency_ms": 18000 },
    { "sub_agent": "security", "findings_count": 5, "p95_latency_ms": 22000 },
    { "sub_agent": "test-coverage", "findings_count": 2, "p95_latency_ms": 15000 },
    { "sub_agent": "architectural-drift", "findings_count": 2, "p95_latency_ms": 20000 }
  ],
  "sarif_artifact_url": "https://hamr.../review-results/<ticket>/<pr>/sarif.json"
}
```

## Sub-agent orchestration: HAMR-side vs caller-side

**Decision: HAMR-side fan-out.**

| Aspect | HAMR-side fan-out (chosen) | Caller-side fan-out (rejected) |
|---|---|---|
| Network calls from caller | 1 | 4 (one per sub-agent) |
| Caller code complexity | Lower | Higher (must implement parallel orchestration) |
| Result aggregation | HAMR aggregates; returns single response | Caller aggregates |
| Failure isolation | One sub-agent failure doesn't block others (HAMR returns partial) | Caller must handle partial failures |
| Cost-routing | HAMR picks lane per sub-agent | Caller routes |
| KV state | One KV write per PR | Same |

Rationale: HAMR is already the cost/observability layer; centralizing
orchestration matches the existing `bundle:fetch` and `doctor:probe` patterns.

## KV storage surface

```
review-state:<ticket_number>:<pr_number>
{
  "first_seen_ts": "2026-05-16T18:00:00Z",
  "last_run_ts": "2026-05-16T18:05:00Z",
  "runs": [
    {
      "sha": "<commit-sha>",
      "ts": "2026-05-16T18:05:00Z",
      "findings_count": 12,
      "severity_distribution": { "high": 0, "medium": 2, "low": 10 },
      "sarif_pointer": "<r2-bucket-path>"
    }
  ]
}
```

Retention: 90 days post-PR-close, then GC'd by daily sweeper.
Size budget: <5KB per PR (10 runs × 500 bytes average).

## SARIF artifact storage

Full SARIF output stored in HAMR R2 (Cloudflare object storage) at
`review-results/<ticket>/<pr>/<sha>.sarif.json`. Pointer returned in the
`/mcp review:run` response.

Why R2 not KV: SARIF files are typically 5-50KB; R2 is cheaper for blob
storage. KV stores the pointer + summary only.

## Latency budget

| Path | p95 budget | Notes |
|---|---|---|
| Cold-PR-first-run | <90s | 4 sub-agents in parallel; longest sub-agent dominates |
| Warm-cache same-SHA re-run | <2s | Cache hit; returns prior result |
| Aggregation overhead | <500ms | HAMR-side merge of 4 sub-agent results |

## Cost routing

Sub-agents stay in HAMR's lane policy:
- `bug-detect`: free or haiku lane (lower complexity)
- `security`: haiku lane (deterministic pattern matching + LLM)
- `test-coverage`: free lane (mostly file-listing + regex)
- `architectural-drift`: premium lane only when diff crosses 3+ modules; haiku otherwise

No auto-promotion to premium beyond the existing routing policy. The 20%
premium-share cap from `instructions/global-task-router.instructions.md`
applies; if exceeded over 7 days, lane downgrades.

## Cache strategy

HAMR prompt-caching applies per-sub-agent. Diff context (typical 5-25KB)
is the cacheable prefix across sub-agents:

```
[CACHEABLE PREFIX: diff + 20KB surrounding context]
[NON-CACHED PER SUB-AGENT: domain prompt]
```

Effective cost: ~1.3-1.5× single-agent (not 4×) per Phase 1.1 estimate.

## Composition with `/mcp rotation:check` (existing)

The two capabilities are orthogonal:
- `/mcp rotation:check` validates Team&Model rotation across baton roles (identity)
- `/mcp review:run` runs the sub-agents and emits findings (substance)

Both fire on the same PR-event but independently. The pre-merge-review
workflow (#1753) calls `rotation:check` for Rule 4 (reviewer ≠ collaborator
team) AND `review:run` for the findings.

## Operator opt-out

`MEGINGJORD_MODEL_REVIEW_DISABLED=1` env var: workflow logs the opt-out
and returns success with `decision: "pass", skipped: "opt-out"`. No HAMR
call made; no cost incurred.

## Phase 3 consumer mapping

- Phase 3.2 (#1753) workflow YAML calls `/mcp review:run`.
- Phase 3.1 (#1752) orchestrator can be invoked locally (without HAMR) for
  operator-side testing; same response shape.

## Out of scope

- R2 bucket provisioning — operational step at deploy time.
- `wrangler.toml` worker route configuration — operational step.
- SARIF schema enforcement — Phase 3.3 (#1754) sub-agent prompts include the schema reference.

## Related

- Phase 1.4 research #1740 (integration with #1716)
- Phase 2 siblings: #1741, #1742, #1743
- Phase 3 consumers: #1752, #1753
- Existing patterns: `cloudflare/hamr/routes/rotation-check.ts` (#1724), `mcp-dispatch.ts` switch
