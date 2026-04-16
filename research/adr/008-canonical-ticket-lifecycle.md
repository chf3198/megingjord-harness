# ADR-008: Canonical Ticket Lifecycle and Status-Role Binding

**Status**: Accepted
**Date**: 2025-07-10
**Author**: Manny Scope (Manager), Quinn Critic (Consultant)
**Epic**: #119

## Context

The system used a 5-status model (backlog→ready→in-progress→review→done) that did not
distinguish between the CI/testing phase and the merge phase, and had no explicit role
binding per status. This caused ambiguity in baton handoff timing.

## Decision

Adopt an 8-status canonical model binding each status to an expected baton role:

| Status | Role | Phase |
|---|---|---|
| `backlog` | (none) | Inactive-open triage queue |
| `todo` | manager | Scope definition active |
| `in-progress` | collaborator | Implementation active |
| `ready-for-testing` | admin | Handoff from collaborator; CI pending |
| `testing` | admin | CI/gate verification running |
| `passed-testing` | admin | Gates green; merge complete |
| `done` | consultant | Post-merge critique; CLOSEOUT active |
| `cancelled` | (none) | Abandoned; Manager authority required |

## Key Rules

- BACKLOG = inactive-open (not yet claimed by Manager).
- TODO = Manager active (distinct from BACKLOG).
- PASSED-TESTING confirms merge is already done before Consultant receives baton.
- Only Manager may cancel; reason comment required.
- Consultant reject = governance failure only (missing artifacts/evidence).

## Consequences

- Dashboard `STATUS_META` and `STATUS_ROLE_MAP` updated to reflect all 8 statuses.
- Instruction and skill files updated to use new status labels.
- Multi-ticket TODO model: many TODOs can coexist; only one IN-PROGRESS at a time.

## Alternatives Considered

- **5-status model**: Too coarse; testing and merge phases collapsed into `review`.
- **Linear/Jira model**: Over-specified for solo/small-team agent workflow.

## References

- `research/ticket-status-model.md` — full model specification
- `research/ticket-status-merge-research.md` — merge queue + branching research
- Epic #119
