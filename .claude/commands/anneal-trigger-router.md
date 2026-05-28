---
description: "Classify drift signals and trigger phrases (pull anneal, andon, drift anneal #N, report drift) into tier 1/2/3 routes. Authority-aware dispatcher for distributed self-anneal."
argument-hint: "[signal|trigger-phrase]"
---

# Anneal Trigger Router

## Purpose

Classify drift signals — from sensors, manual pulls, or Consultant goal-failure escalations — into a routing decision per the three-tier model in `instructions/workflow-resilience.instructions.md`. See also `wiki/wisdom/global/concepts/distributed-self-anneal.md` and `wiki/wisdom/global/concepts/andon-pull-protocol.md`.

## Trigger phrases (auto-discovered via this skill's `description:` field)

- `pull anneal`
- `andon`
- `drift anneal #N` (with ticket reference)
- `report drift`

## Routing decision (output JSON shape)

```json
{
  "tier": 1 | 2 | 3,
  "action": "log-only" | "request-pivot" | "request-consultant-escalation",
  "rationale": "string",
  "estimated_severity": "low" | "medium" | "high" | "critical",
  "kill_switch_trip": null | "rate-limit" | "step-counter" | "suppression" | "single-flight" | "authority"
}
```

## Classification rules (evaluated in order)

1. If `trigger_role == consultant` AND signal cites G1–G9 violation → `tier:3, action:request-consultant-escalation`.
2. Else if `severity >= medium` AND (`recurrence >= 2 in 7d` OR `trigger_type == manual-pull`) AND no active session-pivot AND no matching suppression entry → `tier:2, action:request-pivot`.
3. Else → `tier:1, action:log-only`.

## Authority matrix

| Caller role | Permitted output |
|---|---|
| Any | tier:1 (log-only) |
| Any (router applies thresholds) | tier:2 (request-pivot) — router may downgrade to tier:1 |
| Consultant only | tier:3 (escalation) — rejected from other roles |

Caller emitting tier:3 outside Consultant role → router returns `action:log-only, kill_switch_trip:authority`.

## Pivot semantics (executed by `role-baton-orchestrator` when router emits `request-pivot`)

1. `snapshot = {role, ticket_ref, baton_phase, last_event_id, timestamp}`
2. Emit `event:pivot-start` with snapshot.
3. Assume Manager role; run `workflow-self-anneal` (max 3 doc proposals, max 50 step counter).
4. File Manager ticket(s) per anneal output to backlog — docs/process only; code routes through standard baton.
5. Emit `event:pivot-end` with files-created list.
6. Assert `current_role == snapshot.role`; restore baton to `snapshot.ticket_ref` at `snapshot.baton_phase`.

Kill-switch trip during pivot aborts cleanly; original baton state preserved. Emit `event:kill-switch-trip` with `reason`.

## Kill switches (declarative)

| Switch | Limit | Scope | Trip reason |
|---|---|---|---|
| Single-flight | 1 active pivot | per session | `single-flight` |
| Rate-limit | 3 pivots / 24h | per session | `rate-limit` |
| Suppression | matches #1220 entry | per pattern_id | `suppression` |
| Step counter | 50 tool calls | per anneal protocol | `step-counter` |
| Ticket cap | 5 / 7d | per pattern_id | `ticket-cap` |
| Authority | non-Consultant tier:3 attempt | per call | `authority` |

## Anti-patterns

- Caller bypassing router and writing tier:2 events directly to `incidents.jsonl` → governance violation; flagged by Tier-1 aggregator workflow (#1313).
- Multiple parallel pivot requests in one session → first wins; others trip `single-flight`.
- Tier-3 escalation from a Consultant rubric that scored ≥ threshold → router rejects with `action:log-only`.

## Event schema v2 reference

Defined in Epic #1308 architecture contract; full field-by-field spec in `wiki/wisdom/global/concepts/andon-pull-protocol.md`. Router emits events per that schema (`tier`, `trigger_role`, `trigger_type`, `pattern_id`, `severity`, `evidence`, `ticket_ref`, `epic_ref`, `session_id`).

## See also

- `role-baton-orchestrator` — executes the pivot when this router emits `action:request-pivot`
- `role-consultant-critique` — invokes tier:3 escalation when rubric < threshold
- `workflow-self-anneal` — bounded protocol run during the pivot
- `wiki/wisdom/global/concepts/distributed-self-anneal.md`, `wiki/wisdom/global/concepts/andon-pull-protocol.md` — concept-page details
