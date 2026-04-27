---
name: Epic Governance
description: Rules governing epic lifecycle — status advancement, role label, progress tracking, and close conditions.
applyTo: "**"
---

# Epic Governance

## Epic vs. Child Ticket — Role Boundary

- Epic always carries `role:manager`. This never changes during the epic's lifecycle.
- The active agent role lives on the **child ticket**, not the epic.
- Agent Baton: the child ticket at `status:in-progress` is the active work item; the epic is context only.

## Epic Status Advancement Rules

| Epic Status | Condition to Enter |
|---|---|
| `backlog` | Created; no children started |
| `triage` | Manager scoping children; at least one child exists |
| `in-progress` | First child ticket moves to `status:in-progress` |
| `review` | All children are terminal (closed); epic-level closeout pending |
| `done` + closed | CONSULTANT_CLOSEOUT emitted on epic; all children confirmed terminal |
| `cancelled` | Manager authority; all children must be cancelled or closed first |

Epic status is advanced by the Manager agent at each gate — it does **not** auto-advance.

## Epic Progress Comment Protocol

When any child ticket is closed, the Manager posts a progress update to the epic:

```
## Epic Progress Update — #<child-number> Complete

- Ticket: #N — <title>
- Closed: <date>
- Deliverables: <brief summary>
- Remaining children: #X, #Y, #Z
```

Evidence integrity requirements:
- Progress updates must cover every closed linked child exactly once before epic closeout.
- `CONSULTANT_CLOSEOUT` must reference the full linked-child set for the epic.
- Any `PR #N` reference in epic closeout must resolve to a real pull request.
- Stale automated governance comments should be removed once the epic is normalized.

## Epic Close Conditions

An epic may close **only when ALL of these are true**:

1. All child tickets are in terminal state (`done`/`cancelled`, issue `CLOSED`)
2. Epic is at `status:review` with `role:consultant`
3. CONSULTANT_CLOSEOUT comment posted on the epic
4. Epic-level resolution label applied (`resolution:released` or `resolution:cancelled`)
5. Evidence-integrity verification passes or has an explicit Manager-approved emergency override

## Re-scope-before-close rule

- If original epic acceptance criteria cannot be completed within current tranche,
  Manager must publish an explicit re-scope artifact before review/close.
- Post-hoc scope normalization at Consultant closeout is forbidden.
- Re-scope artifact must list deferred scope and linked follow-on child tickets.

## Branch Naming

Branches are created for **child tickets**, never for epics directly.
Format: `<type>/<child-issue-number>-<slug>`

## Forbidden

- Epic carrying any role other than `role:manager`
- Epic closing while any child is still open
- Child ticket branch named after the epic number
