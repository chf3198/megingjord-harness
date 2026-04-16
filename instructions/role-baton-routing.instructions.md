---
name: Role Baton Routing
description: Enforce single-thread role handoff across Manager -> Collaborator -> Admin -> Consultant. Prevent concurrent role mixing and require explicit handoff artifacts.
applyTo: "**"
---

# Role Baton Routing

The GitHub issue **is** the baton. Execute every task through a single active role at a time. Each role writes a structured comment on the ticket and transitions the status label.

## Status workflow (v0.2 — 8-status canonical model)

```
Status            Role Binding     Gate Condition
─────────────────────────────────────────────────
backlog           (none)           Triaged; not yet assigned to Manager
todo              manager          Manager claimed; scope being defined
in-progress       collaborator     MANAGER_HANDOFF emitted; implementation active
ready-for-testing admin            COLLABORATOR_HANDOFF emitted; CI pre-check needed
testing           admin            Admin running gates/CI
passed-testing    admin            All gates green; merge complete
done              consultant       ADMIN_HANDOFF emitted; critique + closeout
cancelled         (none)           Abandoned at any stage; reason note required
```

Transition guards:
- `backlog → todo`: Manager creates/links issue, writes scope comment.
- `todo → in-progress`: MANAGER_HANDOFF emitted with testable ACs.
- `in-progress → ready-for-testing`: COLLABORATOR_HANDOFF emitted; all ACs ✅.
- `ready-for-testing → testing`: Admin begins gate verification.
- `testing → passed-testing`: All gates pass; merge executed.
- `passed-testing → done`: ADMIN_HANDOFF emitted; Consultant starts.
- `done → (closed)`: CONSULTANT_CLOSEOUT emitted; issue closed.
- `any → cancelled`: Manager authority only; reason comment required.

## Sequence

1. **Manager**: scope, AC, gates → create/link issue → set `status:todo`, `role:manager` → emit `MANAGER_HANDOFF` → swap to `role:collaborator`.
2. **Collaborator**: implement + validate → `status:in-progress` → `status:ready-for-testing` → emit `COLLABORATOR_HANDOFF` → swap to `role:admin`.
3. **Admin**: run gates/merge → `status:testing` → `status:passed-testing` → emit `ADMIN_HANDOFF` → swap to `role:consultant`.
4. **Consultant**: critique + CLOSEOUT → `status:done` → remove `role:*` labels → close issue → emit `CONSULTANT_CLOSEOUT`.

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
