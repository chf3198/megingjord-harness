---
name: manager-ticket-lifecycle
description: Manager creates, links, and validates tickets for all work. Enforce ticket-first workflow and Scrum compliance.
argument-hint: "[action: create|link|validate] [context: epic|story|task|bug|doc]"
user-invocable: true
disable-model-invocation: false
---

# Manager: Ticket Lifecycle

## Purpose

Manager enforces ticket-first workflow: every task gets a GitHub issue before work begins.

## Responsibilities

1. **Create** — Issue title, description, labels, estimation
2. **Link** — Branch naming, commit bodies, PR bodies
3. **Validate** — Ensure completeness before Collaborator proceeds
4. **Close** — Only after merge + post-merge checklist passes

## Entry criteria

- Work intent is known
- No existing related ticket

## Exit criteria

- GitHub issue created and assigned
- Linking rules documented in ticket
- Collaborator has clear ticket number to use

## Hard constraints

1. No work starts without a ticket.
2. Branch name must include ticket number.
3. Commit body must reference ticket.
4. PR body must include `Closes #N`.
5. Ticket type must match work scope.

## Template: Create Epic

```markdown
# [Feature Name]

## Description
[1-2 sentence purpose]

## User Story
As a [role], I want [capability], so that [benefit].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Related Stories
- #N
- #M

## Estimation
Story points: [5–13]
```

## Template: Create Story

```markdown
# [Specific Task]

## Description
[What needs to be done and why]

## Acceptance Criteria
- [ ] Must pass lint
- [ ] Must pass smoke tests
- [ ] Must update docs if behavior changes

## Related Tickets
- Epic: #N

## Estimation
Story points: [3–8]
Complexity: [Simple|Moderate|Complex]
```

## Validation Checklist

Before Collaborator begins:
- [ ] Issue created and titled
- [ ] Description explains "what" and "why"
- [ ] Type label applied (epic, story, task, bug, doc)
- [ ] Story points estimated
- [ ] Linked to epic or parent ticket
- [ ] Assigned to engineer
