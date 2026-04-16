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

## Label taxonomy (v0.2 — 8-status canonical)

Status labels and their role bindings + gate conditions:

| Status | Role Binding | Gate Condition |
|---|---|---|
| `status:backlog` | (none) | Triaged; inactive; not yet assigned |
| `status:todo` | `role:manager` | Manager claimed; scope definition active |
| `status:in-progress` | `role:collaborator` | MANAGER_HANDOFF emitted; implementing |
| `status:ready-for-testing` | `role:admin` | COLLABORATOR_HANDOFF emitted; all ACs ✅ |
| `status:testing` | `role:admin` | Admin running CI/gate verification |
| `status:passed-testing` | `role:admin` | Gates green; merge complete |
| `status:done` | `role:consultant` | ADMIN_HANDOFF emitted; critique active |
| `status:cancelled` | (none) | Abandoned; Manager authority; reason required |

- **Priority**: `priority:P1` (urgent) · `priority:P2` (normal) · `priority:P3` (low)
- **Area**: `area:dashboard` · `area:hooks` · `area:skills` · `area:instructions` · `area:agents` · `area:scripts` · `area:infra`
- **Role** (current baton holder): `role:manager` · `role:collaborator` · `role:admin` · `role:consultant`

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
