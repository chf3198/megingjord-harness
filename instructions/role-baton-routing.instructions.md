---
name: Role Baton Routing
description: Enforce single-thread role handoff across Manager -> Collaborator -> Admin -> Consultant. Prevent concurrent role mixing and require explicit handoff artifacts.
applyTo: "**"
---

# Role Baton Routing

The GitHub issue **is** the baton. Execute every task through a single active role at a time. Each role writes a structured comment on the ticket and transitions the status label.

## Status workflow (v1.0 — agent-typed 8-status)

Each status names the active agent type. One glance = who owns it now.

```
Status       Active Agent   Gate Condition
──────────────────────────────────────────────────────────────
backlog      —              Queued; unassigned
triage       manager        Manager scoping AC + gates
ready        —              MANAGER_HANDOFF emitted; awaiting Collaborator
in-progress  collaborator   Implementation active
testing      admin          COLLABORATOR_HANDOFF emitted; CI/gates running
review       consultant     ADMIN_HANDOFF emitted; critique + closeout active
done         —              CONSULTANT_CLOSEOUT emitted; issue closes atomically
cancelled    —              Abandoned at any stage; Manager authority; reason required
```

Transition guards:
- `backlog → triage`: Manager creates/links issue, writes scope comment.
- `triage → ready`: MANAGER_HANDOFF emitted with testable ACs; remove `role:manager`.
- `ready → in-progress`: Collaborator picks up; apply `role:collaborator`.
- `in-progress → testing`: COLLABORATOR_HANDOFF emitted; all ACs ✅; swap to `role:admin`.
- `testing → review`: ADMIN_HANDOFF emitted; all gates pass; swap to `role:consultant`.
- `review → done + closed`: CONSULTANT_CLOSEOUT emitted; remove all `role:*`; close issue atomically.
- `any → cancelled`: Manager authority only; reason comment required.

## Sequence

1. **Manager**: scope, AC, gates → create/link issue → set `status:triage`, `role:manager` → emit `MANAGER_HANDOFF` → set `status:ready`, remove `role:manager`.
2. **Collaborator**: pick up → set `role:collaborator`, `status:in-progress` → implement + validate → emit `COLLABORATOR_HANDOFF` → set `status:testing`, swap to `role:admin`.
3. **Admin**: run CI/gates/merge → confirm `status:testing` → emit `ADMIN_HANDOFF` → set `status:review`, swap to `role:consultant`.
4. **Consultant**: critique + closeout → emit `CONSULTANT_CLOSEOUT` → set `status:done`, remove all `role:*`, close issue.

## Closed-state rule

- GitHub `closed` is terminal and must not retain execution-role labels.
- Closed tickets never appear in Agent Baton.
- If a historical owner is displayed after closure, normalize it to Manager rather than Admin/Consultant.

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
- Epic lifecycle overlay rules: see `epic-governance.instructions.md`.
