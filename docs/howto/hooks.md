# Hooks — operator reference

Governed hook scripts live in `hooks/scripts/` and deploy to runtime homes via
`npm run deploy:apply` / `npm run deploy:cursor:apply`. See
[hook-parity-check.md](hook-parity-check.md) for cross-runtime parity verification.

## Baton sequencing (#3204, extends #2876)

On ticket branches (`feat/<N>-*` / `fix/<N>-*`), the first file edit in a session
requires:

1. **Authoritative `MANAGER_HANDOFF`** on the linked issue — the **latest**
   handoff must include `worktree_branch:` matching the current branch.
2. **Collaborator phase** — auto-promoted to `collaborator` on first edit when
   authoritative handoff exists (`pretool_guard.py` + `userprompt_gate.py`; #3206).

Implementation: `hooks/scripts/baton_handoff_checks.py`, wired from
`pretool_guard.py`, `userprompt_gate.py`, and `tool_activity.py`.

Stale historical handoffs without `worktree_branch:` no longer satisfy the gate.

## Key scripts

| Script | Role |
|--------|------|
| `pretool_guard.py` | Pre-edit and admin sequencing gates |
| `manager_ticket_gate.py` | Ticket-first on Manager scope |
| `userprompt_gate.py` | Finish-intent and baton phase promotion |
| `baton_handoff_checks.py` | Branch-scoped MANAGER_HANDOFF authority |

See [pre-push-gates.md](pre-push-gates.md) for push/merge gate ordering.
