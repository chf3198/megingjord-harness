# ADR-010: Ticket Status–Role Ownership Binding Model

**Status**: Accepted
**Date**: 2026-04-16
**Author**: Manny Scope (Manager), Cody Builder (Collaborator)
**Tickets**: #118, #133, #134
**Supersedes**: Informal model in `manager-ticket-lifecycle` skill

## Context

Research ticket #118 established a status–assignment–work relationship model
that was absorbed informally into Epic #119 and ADR-008. No authoritative ADR
existed binding each `status:` label to an explicit role owner and permitted
actions. This caused:

- Labels applied inconsistently at close time (observed in #133 audit: 40+ defects)
- Ambiguity about which role may transition a ticket forward
- No canonical reference for automated label-lint tooling

ADR-008 defined an 8-status model. This ADR defines who **owns** each status
and what **actions are permitted** at each stage.

## Decision

Each `status:` label has exactly one **owner role** and one **permitted transition**:

| Status | Owner | May Transition To | Role Label |
|---|---|---|---|
| `status:backlog` | (none) | `status:ready` | — |
| `status:ready` | manager | `status:in-progress` | `role:manager` |
| `status:in-progress` | collaborator | `status:review` | `role:collaborator` |
| `status:review` | admin | `status:done` | `role:admin` |
| `status:done` | consultant | (closed) | — |

### Label rules

1. **Single status at all times** — two `status:` labels is always an error.
2. **Single role label** — only the current baton holder's `role:` is present.
3. **On close** — all `role:` labels removed; `status:done` is the only status.
4. **Backlog** — no `role:` label; ticket is unclaimed.
5. **Only Manager may set `status:ready`** from backlog (scope sign-off required).
6. **Only Manager may cancel** — sets `status:cancelled`, adds close comment.

### Enforcement

- Issue templates default to `status:backlog` (no role label).
- GitHub Actions label-lint workflow (ticket #135) enforces rules 1–4 on
  `issues` events (opened, labeled, unlabeled, closed).
- `gh issue edit` scripts in this repo must follow the transition table.

## Consequences

- All tickets must carry exactly one `status:` label at all times.
- Automated lint will reject dual-status and wrong-role-on-closed states.
- `manager-ticket-lifecycle/SKILL.md` references this ADR as canonical source.
- Existing pre-ADR-010 tickets are grandfathered; new tickets must comply.

## Alternatives Considered

- **Role-free model** (status only): Simpler, but loses baton accountability.
  Rejected — role visibility is core to the agent handoff protocol.
- **Jira-style transitions API**: Over-engineered for GitHub-native solo workflow.

## References

- ADR-008: `research/adr/008-canonical-ticket-lifecycle.md`
- Skill: `skills/manager-ticket-lifecycle/SKILL.md`
- Research: `#118` (Ticket Status-Assignment-Work Relationship Model)
- Hygiene audit: `#133`
