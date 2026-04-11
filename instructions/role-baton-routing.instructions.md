---
name: Role Baton Routing
description: Enforce single-thread role handoff across Manager -> Collaborator -> Admin -> Consultant. Prevent concurrent role mixing and require explicit handoff artifacts.
applyTo: "**"
---

# Role Baton Routing

Execute every task through a single active role at a time:

1. **Manager**: scope, constraints, acceptance criteria, gate plan → emit `MANAGER_HANDOFF`.
2. **Collaborator**: implementation and validation → emit `COLLABORATOR_HANDOFF`.
3. **Admin**: operational execution (services, git/PR/release ops) → emit `ADMIN_HANDOFF`.
4. **Consultant**: independent critique and residual-risk assessment → emit `CONSULTANT_CLOSEOUT`.

## Hard rules

- No concurrent role execution.
- Do not skip a role when its scope is applicable.
- Emit the named handoff artifact at each transition before the next role begins.
- If a role cannot proceed due to missing evidence, stop and request the missing evidence from tooling/research (not from the user by default).

## Trivial-task escape

Skip baton only when ALL of these are true:
- Single Q&A, read-only lookup, or informational response.
- No file edits, no terminal commands, no state-changing tool calls.
- Answerable in one response without multi-step research.
If in doubt, run baton. The Manager phase can be one paragraph.

## Local override

A repo may override or simplify the baton sequence via its own `.github/copilot-instructions.md`.
When global and local instructions conflict, local wins for that workspace.

## Skill mapping

- Manager: `role-manager-execution`
- Collaborator: `role-collaborator-execution`
- Admin: `role-admin-execution`
- Consultant: `role-consultant-critique`
- Orchestration: `role-baton-orchestrator`

## De-duplication boundary

- `operator-identity-context` defines authority and automation mandate.
- Role skills define per-role execution contracts.
- Domain skills (`repo-standards-router`, `workflow-self-anneal`, release/security/docs skills) remain source of truth for specialized procedures.
