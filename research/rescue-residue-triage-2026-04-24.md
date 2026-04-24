# Rescue Residue Triage (2026-04-24)

Date: 2026-04-24

## Summary

- Input: the quarantined rescue worktree after merged recoveries #460/#462 and #461/#463.
- Rescue still showed 84 modified/untracked entries relative to its own branch base.
- 37 of those already match current `main` and need no further action.
- 47 still differ from current `main`; triage shows they are mostly regressions, not missed features.

## Disposition

| Bucket | Examples | Decision | Reason |
|---|---|---|---|
| Already recovered | most `dashboard/css/*`, `dashboard/js/app.js`, `scripts/global/governance-verify.js` | no action | current `main` already contains the rescued version |
| Dashboard compatibility leftovers | `dashboard/index.html`, `dashboard/js/event-bus.js`, `dashboard/js/github-monitor.js`, `dashboard/js/health-check.js`, `dashboard/js/provider-presets.js` | reject | rescue copy is older than the merged #461 version and would drop compatibility hooks |
| Governance/hook regressions | `hooks/scripts/*`, `instructions/ticket-driven-work.instructions.md`, `instructions/role-baton-routing.instructions.md`, `instructions/workflow-resilience.instructions.md` | reject | removes ready-SLA, evidence, close-normalization, or wiki reminder behavior now present on `main` |
| Routing regression | `scripts/global/task-router-dispatch.js` | reject | strips model-routing resolution and telemetry from dispatch flow |
| Knowledge regressions | `wiki/concepts/*`, `wiki/entities/openclaw.md`, `research/zero-drift-adherence-rd-2026-04-24.md`, `tickets/163-epic-zero-drift-adherence-rd.md`, `tickets/164-zero-drift-adherence-research-baseline.md` | reject | rescue copy downgrades or deletes already-merged knowledge artifacts |
| Queue-hygiene salvage | `tickets/126`, `tickets/130`, `tickets/131`, `tickets/133`, `tickets/137`, `tickets/146` | follow-up `#465` | blocker-note backfills are useful, but should be handled intentionally across local tickets and GitHub evidence |
| Security micro-fix | `agents/security-scanner.agent.md` | follow-up `#466` | `Bearer ` pattern tightening may reduce false positives, but deserves a tiny dedicated review |
| Markdown noise | `skills/docs-drift-maintenance/SKILL.md`, `skills/openrouter-free-failover/SKILL.md` | reject | whitespace/duplicate-heading churn with no material value |

## Recommendation

1. Treat `/home/curtisfranks/devenv-ops-rescue` as archival evidence, not a third recovery lane.
2. Use `#465` for the only governance-positive batch worth recovering next.
3. Use `#466` if the scanner micro-fix is still desired after priority review.
4. Leave the remaining residue quarantined; reintroducing it would weaken current governance or overwrite merged work.
