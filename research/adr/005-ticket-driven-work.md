# ADR-005: Ticket-Driven Work Management

**Status**: Accepted
**Date**: 2026-04-13

## Context

Work without tickets leads to tracking gaps, orphaned features, and unclear priorities.
We need every task (Epic/Story/Task/Bug/Doc) tracked in GitHub.

## Decision

Implement ticket-first workflow:
1. Manager creates GitHub issue before work begins
2. Branch and commits must reference ticket number
3. Hook validates linkage on every commit
4. PR body includes `Closes #N` for auto-closure
5. Ticket labels track Scrum status (backlog, ready, in-progress, review, done)

Manager skill enforces tickets; Collaborator links all changes to tickets.

## Consequences

Positive:
- Complete audit trail of all work
- Scrum compliance built-in
- Prevents orphaned branches and untracked changes
- GitHub issues become single source of truth
- Burndown tracking and velocity metrics enabled

Trade-offs:
- Requires discipline (can be bypassed via direct commits)
- Extra steps before coding (ticket creation)
