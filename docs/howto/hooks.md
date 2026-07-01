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

## Merge gate — real-PR verification (#3344)

The `pretool_guard.py` admin-merge gate keys `admin_ops.pr_create` by
`sha1(cwd)+session`. Under cwd-churn (session cwd on `main` while the work lives
in a linked worktree) that flag can be lost, which previously produced a false
"PR creation not recorded" block on a genuine, CI-green PR.

The gate now degrades safely: when `pr_create` is unrecorded it extracts the PR
ref from the merge command and verifies a **real OPEN PR** via a read-only
`live_checks.open_pr_for_ref()` lookup. The merge is allowed **only** on a
confirmed-OPEN PR; it **fails closed** (retains the block) when no PR exists or
the lookup is indeterminate (gh non-zero / timeout / absent). The gate stays
honest — it still blocks a merge that truly has no PR — while no longer
stranding a legitimate Admin merge on lost session state.

## Pre-commit: operator-memory promotion advisory (#2686, Epic #2399 AC5)

A `pre-commit` lefthook runs `scripts/global/feedback-memory-promotion-check.js`.
When a commit **adds** a new operator-memory `feedback_*.md` file (git `A` status,
matched by basename under a `memory` directory segment incl. `.claude/**/memory`),
the check prints an advisory prompting the operator to consider promoting the
rule-of-thumb to canonical `instructions/` (or `wiki/wisdom/global/concepts/`) per
the Epic #2399 pattern.

It is **advisory only** — it always exits 0 and never blocks a commit — and
**idempotent**: it fires only on new additions, never on modified or pre-existing
files. Bypass with `FEEDBACK_MEMORY_CHECK_BYPASS=1`.

## Post-merge worktree teardown actuation (#3357, Epic #3352)

A `post-merge` lefthook runs `scripts/global/worktree-teardown-actuate.js --apply` so that when a
squash-merge lands on `main` locally, any now merged-and-clean worktree is torn down automatically.
It executes `git worktree remove` **without `--force`** — git's own dirty-guard is the authoritative
final gate, so a worktree with uncommitted or unmerged work is refused, never force-removed. Each
teardown emits a redacted v3 audit record (decision + `git worktree remove` exit code/stderr) to the
observability surface. Preview without removing via `npm run worktree:teardown` (dry-run default).
