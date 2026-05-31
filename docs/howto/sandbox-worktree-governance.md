# Sandbox Worktree Governance

Sandbox branches are launcher branches for agent sessions, not delivery branches.
Use ticket-linked feature, fix, or hotfix branches for implementation work.

## Launcher Branches

- `sandbox/copilot`
- `sandbox/codex`
- `sandbox/claude-code`

## Session Start Evidence

Before implementation, refresh the launcher and move to a ticket branch:

```bash
bash scripts/worktree-session-start.sh <copilot|codex|claude-code> feat/<issue#>-<slug>
```

Record this evidence at session start:
- `git worktree list` output.
- Branch name follows `feat/<N>-...` or `fix/<N>-...`.
- Ticket linkage exists before edits (`#N`).

## Stale-Worktree Taxonomy

Use inventory and governance outputs as classification evidence.

| State | Meaning | Operator action |
|---|---|---|
| `keep-main` | Canonical operator checkout | Never remove. |
| `keep-active` | Clean, unmerged, ticket-aligned worktree | Keep until PR and closeout complete. |
| `keep-locked` | Owned by another orchestrator or lease lock | Do not modify or remove. |
| `review-dirty` | Local modifications exist | Quarantine or rescue before cleanup. |
| `review-detached` | Detached HEAD; ticket ownership unclear | Classify manually before deletion. |
| `remove-after-merge` | Branch head merged to `origin/main` and clean | Eligible for safe cleanup after evidence checks. |
| `prune-metadata` | Git metadata is stale | Run `git worktree prune`; no branch deletion implied. |

`behind main` alone is warning evidence, not safe-removal evidence.

## Audit Commands

```bash
npm run governance:worktrees
node scripts/global/worktree-governance-audit.js --target=codex --json
```

Valid targets are `copilot`, `codex`, and `claude-code`.

## Cleanup vs Quarantine vs Rescue

Decision rules:
- Safe cleanup: `remove-after-merge`, clean worktree, closed lease, merged branch.
- Quarantine: `review-dirty` or `review-detached` with unclear ownership.
- Rescue: preserve valuable local changes on a rescue branch before cleanup.

Never delete worktrees based only on stale age or behind count.

## Coordination and Handoff Evidence

Use the read-only coordination view:

```bash
node scripts/global/cross-team-coordination-view.js --json
node scripts/global/cross-team-coordination-view.js --json --out .dashboard/cross-team-coordination.json
```

Required evidence checkpoints:
- Handoff: inventory/coordination snapshot plus lease status.
- Post-merge: PR/merge proof and lease close event.
- Scheduled audit: `npm run governance:worktrees` output and stale-lease resolution.
- Closeout: reason each removed worktree met safe-cleanup criteria.

## Branch Cleanup (dry-run only)

```bash
npm run cleanup:branches
npm run cleanup:branches -- --json
```

Three-team safety guarantees:
- `sandbox/*` launcher branches are never cleanup candidates.
- Active leases are treated as owned and skipped.
- Output is plan-only; execute removal commands only after review.

## Related Governance References

- `instructions/sandbox-worktree-governance.instructions.md`
- `docs/worktree-substrate-isolation.md`
- `scripts/global/worktree-inventory.js`
- `scripts/global/worktree-governance-audit.js`
- `scripts/global/worktree-cleanup-plan.js`
