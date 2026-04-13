---
name: role-manager-execution
description: Define scope, constraints, acceptance criteria, and verification gates before implementation begins.
argument-hint: [task-type: feature|bugfix|refactor|governance] [risk: low|medium|high]
user-invocable: true
disable-model-invocation: false
---

# Role: Manager Execution

## Responsibilities

- Create or link a GitHub issue **before any other action**.
- Clarify objective and non-objectives.
- Identify constraints from instructions and repository policy.
- Define objective acceptance criteria.
- Select required gates/tests/checks.

## Ticket-first gate (mandatory)

Before emitting `MANAGER_HANDOFF`, the Manager **must**:

1. Run `gh issue list` to check for an existing issue matching the task.
2. If none exists: `gh issue create --title "<imperative>" --body "..." --label "type: ..."`.
3. Record the issue number in `MANAGER_HANDOFF` as `issue: #N`.
4. All subsequent commits must reference `#N` in the commit message.

**Skip condition**: trivial-task escape (read-only, no file edits, no state changes).

## Entry criteria

- Task intent is known.
- Repository instruction overlays are available.

## Exit criteria

- A GitHub issue exists and is referenced in `MANAGER_HANDOFF`.
- `MANAGER_HANDOFF` is complete and testable.
- Scope boundaries are explicit enough for implementation without reinterpretation.

## Must not do

- Do not implement code changes.
- Do not perform release/merge/admin operations.

## Escalation triggers

- If scope expands materially, regenerate `MANAGER_HANDOFF` before collaborator work continues.

## Required integrations

- Route standards with `repo-standards-router`.
- Use `workflow-self-anneal` only if post-failure/process drift applies.

## Output contract

```text
MANAGER_HANDOFF
issue: #N
objective:
non_objectives:
constraints:
acceptance_criteria:
required_gates:
planned_change_surfaces:
risk_class:
```
