# Agent-Teams vs Hand-Rolled Cross-Team Queue — Comparison

Research artifact for #1635 (Phase 3 of Epic #1604, research #1624 F9).
Compares Claude Code's built-in agent-teams primitive (shared task list,
P2P messaging, file locking, dependency tracking) against the harness's
hand-rolled cross-team-queue + signer-substrate gate + auto-apply +
reaper stack (the #1334 family).

## TL;DR verdict

**ORTHOGONAL with PARTIAL OVERLAP.** Agent-teams is a Claude-Code-runtime
intra-team primitive; the hand-rolled stack is a cross-runtime cross-team
protocol. They solve different problems and should coexist.

- Agent-teams cannot be adopted as the harness-wide cross-team protocol
  because Codex and Copilot teams cannot consume it. G5 fail.
- Hand-rolled stack stays canonical for cross-team coordination.
- Agent-teams is an OPT-IN convenience for Claude-Code-Team's INTRA-team
  parallel work, not a replacement for any cross-team artifact.

## Feature-by-feature comparison (AC1)

| Feature | agent-teams (Claude-Code) | Hand-rolled stack | Verdict |
|---|---|---|---|
| Shared task list | Built-in TodoWrite + persistence across agents in same team | CROSS_TEAM_CLAIM comments on Issue | Different scope: agent-teams = intra-team, hand-rolled = cross-team |
| File locking | Filesystem-level mutual exclusion within a team | `locked-paths` field on Projects v2 (#1630) — cross-team-visible | Hand-rolled wins for cross-team; agent-teams covers intra-team |
| P2P messaging | In-runtime agent-to-agent | Comment-based on Issue / Discussion | Different latency / observability profile |
| Dependency tracking | Built-in task graph | Sub-issues (#1631) + `blocked by` / `blocking` Issue links | Hand-rolled wins because cross-runtime; agent-teams complements within a team |
| Claim expiry | In-runtime session lifetime | 24h with reaper (#1589) | Hand-rolled wins for human-time-scale work |
| Cross-runtime reach | None (Claude-Code only) | All three runtimes via Issue comments | Hand-rolled wins on G5 / G9 |

## Backport candidates (AC2)

Features in agent-teams that COULD inform improvements to the hand-rolled
stack (without depending on agent-teams):

1. **Dependency-graph visualization**: agent-teams renders blocked-by /
   blocking as a tree. Hand-rolled could synthesize a similar view from
   Sub-issues data (#1631 AC2 helper sub-issue-link.js can return the
   tree). Filed as informational note on #1648 (Projects v2 helper).

2. **Auto-claim-on-task-start pattern**: agent-teams claims the file when
   a task starts. Hand-rolled requires explicit CROSS_TEAM_CLAIM emission.
   Could be added as a Manager-handoff side-effect — informational note
   on the cross-team protocol Epic #1604 progress comment.

3. **Idempotent claim refresh on heartbeat**: agent-teams refreshes the
   claim periodically while work is active. Hand-rolled relies on the
   24h reaper. Could be added as a Manager-side periodic re-claim
   without invalidating other-team safety properties — informational.

No backport candidates require new tickets. Existing Epic #1604 children
already cover the architectural gaps.

## Decision (AC3)

**STATUS QUO** for cross-team work. Agent-teams remains an opt-in
internal-Claude-Code-Team convenience layer that operators may use during
their own intra-team work but is NOT part of the cross-team contract.

The hand-rolled stack (cross-team-queue + signer-substrate gate +
auto-apply + reaper) remains canonical and continues to evolve through
Epic #1604 children.

## Provider-specific notes (AC4)

- agent-teams' in-runtime P2P messaging cannot become part of the
  harness contract because it is non-observable to Codex / Copilot.
- agent-teams' filesystem-level locking is OK for intra-team but cannot
  replace Projects v2 `locked-paths` because Codex / Copilot cannot
  observe it.
- agent-teams may use TodoWrite freely within a Claude-Code session;
  cross-team coordination still uses Issue comments + Projects v2 board.

## Portability (per G5 contract, #1628)

This research confirms agent-teams is correctly classified as
**Claude-Code-runtime-specific OPT-IN**. The hand-rolled stack remains
the **integral cross-team protocol**.

## Related

- #1635 — parent
- #1334 — cross-team protocol (current canonical)
- #1589 — reaper cron
- #1590 — auto-apply
- #1631 — Sub-issues primitive (dependency tracking)
- #1630 — Projects v2 (locked-paths surface)
- #1628 — G5 Portability contract
