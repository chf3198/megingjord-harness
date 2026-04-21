---
name: Ticket-Driven Work Management
description: The GitHub issue is the baton. Every task is tracked by an issue with standardized labels and status transitions.
applyTo: "**"
---

# Ticket-Driven Work Management

**Requirement**: Every piece of work must have a GitHub issue ticket.

## Ticket Types

| Type | Purpose | Label |
|---|---|---|
| Epic | Major feature or initiative | `type:epic` |
| Story | User-facing feature | `type:story` |
| Task | Internal/technical work | `type:task` |
| Bug | Defect fix | `type:bug` |
| Doc | Documentation | `type:doc` |
| Research | Investigation/spike | `type:research` |

## Label taxonomy (v1.0 — agent-typed 8-status)

Each status names the active agent type. One glance = who owns it now.

| Status | Active Agent | Gate Condition |
|---|---|---|
| `status:backlog` | — | Queued; unassigned |
| `status:triage` | `role:manager` | Manager scoping AC + gates |
| `status:ready` | — | MANAGER_HANDOFF emitted; awaiting Collaborator pickup |
| `status:in-progress` | `role:collaborator` | Implementation active |
| `status:testing` | `role:admin` | COLLABORATOR_HANDOFF emitted; CI/gates running |
| `status:review` | `role:consultant` | ADMIN_HANDOFF emitted; critique + closeout active |
| `status:done` | — | CONSULTANT_CLOSEOUT emitted; issue closes |
| `status:cancelled` | — | Abandoned; Manager authority; reason required |

- **Priority**: `priority:P1` (urgent) · `priority:P2` (normal) · `priority:P3` (low)
- **Area**: `area:dashboard` · `area:hooks` · `area:skills` · `area:instructions` · `area:agents` · `area:scripts` · `area:infra`
- **Role** (current baton holder): `role:manager` · `role:collaborator` · `role:admin` · `role:consultant`

## Closed ticket normalization

- `done` → `closed` is a single atomic step: emit `CONSULTANT_CLOSEOUT`, set `status:done`, remove all `role:*` labels, close issue.
- Closed tickets are terminal and must not re-enter active Baton views.
- Historical ownership in dashboard/audit views resolves to `manager` after close.

## Valid owner × work-type matrix

| Work type | Primary role | Valid active statuses |
|---|---|---|
| Research | `role:collaborator` | `triage`, `ready`, `in-progress`, `review`, `done` |
| Development | `role:collaborator` | `triage`, `ready`, `in-progress`, `testing`, `review`, `done` |
| UX design | `role:collaborator` | `triage`, `ready`, `in-progress`, `review`, `done` |
| Styling/CSS | `role:collaborator` | `triage`, `ready`, `in-progress`, `review`, `done` |
| Graphic design | `role:collaborator` | `triage`, `ready`, `in-progress`, `review`, `done` |
| Documentation | `role:collaborator` | `triage`, `ready`, `in-progress`, `review`, `done` |
| Bug fix | `role:collaborator` | `triage`, `ready`, `in-progress`, `testing`, `review`, `done` |
| Infra / ops | `role:collaborator` | `triage`, `ready`, `in-progress`, `testing`, `review`, `done` |
| Marketing / comms | `role:collaborator` | `triage`, `ready`, `in-progress`, `review`, `done` |

## Forbidden combinations

- Closed issue + any execution `role:*` label.
- `status:backlog` or `status:ready` or `status:done` or `status:cancelled` with any `role:*` label.
- `status:triage` with non-manager role.
- `status:in-progress` with admin/consultant role.
- `status:testing` with collaborator/consultant role.
- `status:review` with manager/collaborator/admin role.
- `status:done` on an open issue (done must coincide with issue close).

## Manager Responsibilities

1. **Create tickets before work starts** — never code first.
2. **Apply full label set** — type + status:backlog + priority + area.
3. **Write scope comment** — objective, AC, constraints.
4. **Link ticket to branch** — branch: `<type>/<issue#>-<slug>`.
5. **Link ticket to PR** — PR body includes `Closes #N`.
6. **Enforce ticket closure** — close only after merge + Consultant CLOSEOUT.

## Linking Rules

- Branch: `feat/11-ticket-baton-system`
- Commit: `feat(skills): implement ticket-as-baton governance #11`
- PR: Body must include `Closes #11` + validation evidence
