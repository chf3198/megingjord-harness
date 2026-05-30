# State-authority migration runbook (Epic #2451)

How to roll out the GitHub-as-event-source baton architecture across the harness fleet.

## Pre-flight

Before any rollout step:

1. Verify `gh` CLI authenticated in target session: `gh auth status`
2. Verify HAMR worker reachable (only if rolling Move 3): `curl https://hamr.chf3198.workers.dev/healthz`
3. Snapshot current state files: `tar -czf ~/.copilot-hooks-state-pre-rollout.tar.gz ~/.copilot/hooks/state/`
4. Confirm `npm run hamr:activate` succeeded recently

## Rollout sequence

Strict order; do not skip ahead.

### Move 1 — derive_roles_from_github resolver (#2456, shipped)

**Goal:** make local `roles{}` dict stop being authoritative.

**Enable:**
```bash
export MEGINGJORD_DERIVE_ROLES_FROM_GH=1
```

**Verify:**
- Run any session that touches code. Confirm Stop-hook does NOT block on "Admin role not complete" once GitHub issue carries `role:admin` label.
- `python3 -c "import os; os.environ['MEGINGJORD_DERIVE_ROLES_FROM_GH']='1'; from github_role_resolver import derive_roles_from_github; print(derive_roles_from_github(<ticket-n>))"`

**Rollback:** `unset MEGINGJORD_DERIVE_ROLES_FROM_GH`. Resolver passthrough re-engages legacy `roles{}` reads. Zero state migration needed.

**Bound:** 60s TTL cache + 300s max-stale on G6 fallback. Memory unbounded by design (ticket count is bounded by operator's active work).

### Move 2 — baton-events.jsonl emitter (#2457, shipped)

**Goal:** event-sourced audit + replay log.

**Enable:**
```bash
export MEGINGJORD_BATON_EVENT_LOG=1
```

**Verify:**
- Complete a baton cycle. Confirm event appears at `~/.megingjord/baton-events.jsonl`
- `tail -1 ~/.megingjord/baton-events.jsonl | jq` shows v3 schema (ts, version=3, service=baton, env, event)
- PII redaction working: `grep "sk-ant" ~/.megingjord/baton-events.jsonl` should return nothing

**Rollback:** `unset MEGINGJORD_BATON_EVENT_LOG`. Emitter no-ops. Existing log file untouched.

**Rotation:** governed by `scripts/global/log-rotation.js` (90d hot + gzip archive at 50MB). No operator action required.

### Move 3 — HAMR merge-claim primitive (#2458, shipped)

**Goal:** cross-team merge serialization.

**Pre-condition:** HAMR Worker deployed with merge-claim routes. Verify:
```bash
curl https://hamr.chf3198.workers.dev/merge-claim/status/1 | jq
```
Expected: `{"held": false}` (or similar; not 404).

**Enable:**
```bash
export MEGINGJORD_MERGE_CLAIM=1
export HAMR_TEAM=claude-code   # or codex, copilot, antigravity
```

**Verify:**
- `python3 -c "from merge_claim_client import status; print(status(<ticket-n>))"` returns dict, not None
- During an admin merge, observe a single acquire+release cycle in HAMR logs

**Rollback:** `unset MEGINGJORD_MERGE_CLAIM`. Client returns sentinel `feature-off` claim; admin merges proceed without serialization. Any in-flight claims expire via 60s KV TTL.

## Recommended rollout cadence

| Week | Flags set | Goal |
|---|---|---|
| 0 | none | Baseline measurement; observe legacy false-positive rate via incidents.jsonl |
| 1 | `DERIVE_ROLES_FROM_GH=1` | Validate Move 1 in isolation; observe Stop-hook block frequency drop |
| 2 | + `BATON_EVENT_LOG=1` | Validate Move 2 emitter doesn't add latency; verify schema compliance |
| 3 | + `MERGE_CLAIM=1` | Cross-team coordination; pre-condition: ≥2 teams active simultaneously |
| 4+ | maintain all 3 | Steady-state; address #2461 memory cleanup follow-on |

## Monitoring

| What to watch | Where |
|---|---|
| Stop-hook block frequency | `~/.megingjord/incidents.jsonl` (filter `event=stop-block`) |
| Resolver gh-CLI fail rate | Tail Stop hook stderr; absence of derived-state on TTL miss = degradation |
| Baton event log volume | `wc -l ~/.megingjord/baton-events.jsonl` over time; budget ~1000/day typical |
| HAMR merge-claim acquire conflicts | HAMR Worker logs: `wrangler tail` filter on `/merge-claim/` |

## Rollback decision matrix

| Symptom | Likely cause | Action |
|---|---|---|
| Stop-hook still blocks on Admin | Resolver returned None (offline) or feature flag not set in session | Check env, check `gh auth status`, fall back: `unset MEGINGJORD_DERIVE_ROLES_FROM_GH` |
| Baton events not appearing | Feature flag off OR write permission on ~/.megingjord/ | Verify env, check `ls -la ~/.megingjord/baton-events.jsonl`; emitter silently no-ops on IOError per G6 |
| Merge-claim acquire 409 | Another team holds claim; expected serialization | Wait 60s for TTL or coordinate with held_by_team |
| Merge-claim acquire null | HAMR unreachable | Client returns None; admin should proceed without serialization (degrade to legacy race-prone behavior) |

## Per-Move backward-compat guarantees

- **Move 1**: When env flag off, `derive_roles_from_github` returns None; `effective_roles` returns the state-dict unchanged. Zero existing-caller behavior change.
- **Move 2**: When env flag off, `emit_baton_event` returns False without writing. Zero existing-caller behavior change. Existing log file at ~/.megingjord/baton-events.jsonl (if any) is read-only artifact, not consumed by gate logic.
- **Move 3**: When env flag off, client returns sentinel `feature-off` claim; release is a no-op. Admin merge proceeds normally with legacy race behavior.

## After full rollout: #2461 memory cleanup

Once Moves 1-3 are steady-state for ≥2 weeks, file the memory anchor cleanup per #2461 — `feedback_state_store_dual_variants` and 7 related anchors are then provably obsolete and should be retired with `superseded-by-#2451` notes.

## Related

- Epic #2451 — parent
- #2452 — Phase-0 research synthesis (sources)
- #2456 #2457 #2458 — implementation children (shipped)
- #2460 — offline behavior tests (parallel)
- #2461 — memory anchor cleanup (post-rollout)
- #2091 — adjacent (state isolation) — recommend close-as-superseded after Move 1 reaches steady state
