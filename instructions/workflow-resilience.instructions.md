---
name: Workflow Resilience
description: Always-on rules for self-annealing after failures, documentation drift detection, and process hardening. Distilled from workflow-self-anneal and docs-drift-maintenance skills.
applyTo: "**"
---
# Workflow Resilience

## Self-annealing triggers

Run `workflow-self-anneal` skill when any of these conditions is true:
- Same failure pattern appears at least twice in the last 7 days.
- Session had crash, restart, or tooling instability.
- Instructions were contradicted by observed actions.
- Pre-merge gate requires process hardening evidence.
- Repeated carryover or blocked items across iterations.
- PR review or merge latency repeatedly breaches targets.
- Reopened issues or defects trend upward.
- Ticket/epic local markdown state diverges from observable GitHub issue/PR evidence.
- Any P0/P1 ticket remains `status:ready` for more than 24h without a blocker note.

Ready-stall blocker note required fields: `BLOCKER_NOTE`, `owner`, `unblock_condition`, `eta_or_review_time`.

## Self-annealing constraints

- Maximum one anneal pass per invocation.
- Maximum three proposed documentation changes per invocation.
- Never auto-modify security or permission policy — propose changes only.
- If evidence is insufficient, return `NO_CHANGE` with missing-evidence requirements.
- No unbounded loops, recursive retries, or autonomous "improve forever" behavior.

## Self-annealing protocol

1. Detect mismatch between expected and observed behavior.
2. Classify root cause: `ambiguity`, `missing guardrail`, `stale instruction`, `tool fragility`, or `human override`.
3. Assess recurrence risk: `low`, `medium`, or `high`.
4. Propose minimal docs/workflow delta that prevents recurrence.
5. Define objective verification gate confirming the fix works.

## Three-tier escalation model

Anneal triggers route through one of three tiers per Epic #1308. See `[[distributed-self-anneal]]` for full design and `[[andon-pull-protocol]]` for any-role pull mechanics. The base protocol above is the Tier-2 mid-flight pivot phase.

### Tier 1 — Observation (any role)

Append a drift event to `~/.megingjord/incidents.jsonl` (schema v2). No threshold, no ticket. Pure trend capture for the recurrence detector.

### Tier 2 — Mid-flight pivot (auto-ticket)

Triggers when `severity ≥ medium` AND (recurrence ≥ 2 in 7d OR `trigger_type == manual-pull`) AND no active session-pivot AND no matching suppression entry. Effect: orchestrator pauses current baton step, snapshots state, runs the protocol above, files Manager ticket(s) to backlog, restores baton.

### Tier 3 — Consultant goal-failure escalation

Authority: Consultant only. Triggered when consultant rubric finds G1–G9 goal violation post-implementation. Effect: invoke Manager to (a) reopen failed AC/ticket via baton, (b) file new self-anneal Epic for systemic patterns.

### Authority matrix

| Action | Authority |
|---|---|
| Append Tier-1 event | Any role |
| Request Tier-2 pivot | Any role (router classifies) |
| Invoke Tier-3 escalation | Consultant only |
| File Manager ticket from anneal | Manager (auto-routed via Tier-2 workflow) |

### Bounded-loop guards (kill switches)

- Max 1 active pivot per session (single-flight)
- Max 3 pivots per 24h per session (rate-limit)
- Max 5 anneal tickets per 7-day window per `pattern_id` (suppression cooperation with #1220)
- Anneal step counter aborts with `decision: defer` if >50 tool calls
- All trips emit `event:kill-switch-trip` for dashboard observability

## Breaking-Change Recovery Handoff

When Tier-3 Consultant escalation identifies a G1–G9 goal violation caused by a
merged breaking change, invoke the **Breaking-Change Recovery Protocol** from
`instructions/breaking-change-recovery.instructions.md`. The protocol covers
six phases: Detect → Revert → Triage → Fix → Re-merge with smoke evidence →
Casualty re-author. Tier-3 authority (Consultant) initiates; Manager and Admin
execute the revert and fix phases.

## Documentation drift detection

Run `docs-drift-maintenance` skill after any change to:
- Commands, CLI flags, or API behavior.
- Configuration files, defaults, or environment variables.
- Workflows, CI/CD pipelines, or automation scripts.
- UX-visible behavior, user-facing features, or settings.
