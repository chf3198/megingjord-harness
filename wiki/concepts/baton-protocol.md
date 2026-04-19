---
title: "Baton Protocol (Role Handoff)"
type: concept
created: 2026-04-14
updated: 2026-04-14
tags: [governance, workflow, agile]
sources: []
related: ["[[agent-drift-governance]]", "[[copilot-pro]]", "[[self-annealing]]"]
status: draft
---

# Baton Protocol (Role Handoff)

Single-thread role handoff model for agent task execution.

## Sequence
Manager → Collaborator → Admin → Consultant

## Role Responsibilities
| Role | Duty |
|------|------|
| Manager | Scope, constraints, acceptance criteria |
| Collaborator | Implementation, evidence, tests |
| Admin | PR, merge, deploy, runtime checks |
| Consultant | Independent critique, grading, CLOSEOUT |

## Rules
- Only one role active at a time (the "baton holder")
- Each role posts inline comments on tickets
- Events emitted at every transition
- No role may perform another role's duties

See: [[agile-roles-analysis]], [[agile-roles-cross-verification]]

See also: [[github-integration]], [[workflow-diagrams]]
