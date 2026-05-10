---
name: Epic Governance
description: Rules governing epic lifecycle — status advancement, role label, progress tracking, and close conditions.
applyTo: "**"
---

# Epic Governance

## Epic vs. Child Ticket — Role Boundary

- Epic always carries `role:manager` — never changes. Active agent role lives on the child ticket, not the epic.

## Epic Status Advancement Rules

| Epic Status | Condition to Enter |
|---|---|
| `backlog` | Created; no children started |
| `triage` | Manager scoping children; at least one child exists |
| `in-progress` | First child ticket moves to `status:in-progress` |
| `dormant` | Active goal; no current work; awaits external trigger or 90d review |
| `deferred` | Active goal; externally blocked; no ETA |
| `review` | All children are terminal (closed); epic-level closeout pending |
| `done` + closed | CONSULTANT_CLOSEOUT emitted on epic; all children confirmed terminal |
| `cancelled` | Manager authority; **goal invalidated** (NOT used for stalled work) |

Epic status is advanced by the Manager agent at each gate — it does **not** auto-advance.

### Epic-only states (dormant + deferred)

- `dormant`: Manager pauses an Epic when a milestone closes and no immediate next step exists. Comment must name the trigger that would resume work.
- `deferred`: Manager marks Epic blocked by external constraint (e.g., third-party beta, plan tier). Comment must name the blocker + ETA condition.
- Both require `role:manager` (Epic invariant).
- Both receive a 90-day review: Manager posts an `EPIC_REVIEW` comment with verdict (stay-dormant, reclassify, or cancel).
- Transitions: `in-progress ↔ dormant`, `in-progress ↔ deferred`, `dormant ↔ deferred`, `dormant → triage` on resume, `deferred → in-progress` when blocker clears, `dormant → cancelled` only after review affirms goal no longer applies.

## Epic Progress Comment Protocol

When any child ticket is closed, the Manager posts a progress update to the epic:

```
## Epic Progress Update — #<child-number> Complete

- Ticket: #N — <title>
- Closed: <date>
- Deliverables: <brief summary>
- Remaining children: #X, #Y, #Z
```

Evidence integrity: progress updates must cover every closed child exactly once; `CONSULTANT_CLOSEOUT` must reference the full linked-child set; any `PR #N` must resolve to a real PR.

## Epic Close Conditions

An epic may close **only when ALL of these are true**:

1. All child tickets are in terminal state (`done`/`cancelled`, issue `CLOSED`)
2. Epic is at `status:review` with `role:consultant`
3. CONSULTANT_CLOSEOUT comment posted on the epic
4. Epic-level resolution label applied (`resolution:released` or `resolution:cancelled`)
5. Evidence-integrity verification passes or has an explicit Manager-approved emergency override

## Re-scope-before-close rule

- If original epic ACs cannot be completed, Manager must publish an explicit re-scope artifact (deferred scope + follow-on child tickets) before review/close.
- Post-hoc scope normalization at Consultant closeout is forbidden.

## EPIC_RESCOPE artifact schema (per Epic #1271 AC7)

When ACs cannot be completed, the Manager publishes one or more `EPIC_RESCOPE` blocks as comments on the Epic before close. Each block declares deferred ACs + reasons + follow-on tickets. `closeout-lint` blocks Epic close if (a) any AC is unchecked AND (b) no `EPIC_RESCOPE` block covers it.

```
EPIC_RESCOPE
deferred_acs: [AC4, AC5]
deferred_reason_per_ac:
  AC4: structural-measurement-window
  AC5: dependent-on-producer
re_evaluate_by: 2026-05-24
follow_on_tickets: [#1234, #1235]
ruleset_bypass_actor: <github-username-or-N/A>
ruleset_bypass_reason: <text-or-N/A>
signed_by: <consultant-alias>
Team&Model: <team:model@substrate>
Role: consultant
```

Schema rules:

- `deferred_acs` — JSON-style array; each AC must reference an unchecked AC in the Epic body
- `deferred_reason_per_ac` — keys must match `deferred_acs`; values from category enum: `structural-measurement-window | dependent-on-producer | scope-cut-to-followon | external-blocker | other`
- `re_evaluate_by` — ISO date for time-windowed deferrals; required when reason is `structural-measurement-window`
- `follow_on_tickets` — JSON-style array of `#N` references; each must resolve to a real issue
- `ruleset_bypass_actor` / `ruleset_bypass_reason` — required when Epic close uses repository ruleset bypass; otherwise `N/A`
- `signed_by` — Consultant alias (Manager-signed RESCOPE artifacts are rejected by `closeout-lint`)

Multiple RESCOPE blocks are allowed (one per deferred AC), or a single block listing several. Validator counts unique `deferred_acs` entries and matches against unchecked-AC set.

## Branch Naming

Branches are created for child tickets only: `<type>/<child-issue-number>-<slug>`

## Forbidden

- Epic carrying any role other than `role:manager`
- Epic closing while any child is still open
- Child ticket branch named after the epic number
