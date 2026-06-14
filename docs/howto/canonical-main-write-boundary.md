# Canonical-main write boundary (IT vs delivery)

**Audience:** all teams — Claude Code, Copilot, Codex, Antigravity.
**Rule (G1, #2107/#2995):** the main checkout (`~/devenv-ops/`) is **canonical-only**.
You may write there **only** to gitignored paths; **all tracked-file work needs a
ticket + dedicated worktree/branch.** This holds for every team and every role,
**including IT** — IT markers waive ticket/baton *ceremony*, never this boundary.

## What is allowed where

| Action in `~/devenv-ops/` (main) | Allowed? |
|---|---|
| Edit a **gitignored** path (`.env`, `.npmrc`, `node_modules/`, `tmp/`, `.cache/`, …) | ✅ yes |
| Edit/create a **tracked** file (the codebase) | ❌ no → use a worktree |
| `git checkout`/`switch` off `main` | ❌ no → use a worktree |
| Shell write to a tracked file (`> f`, `>> f`, `sed -i f`, `tee f`, `cp/mv … f`) | ❌ no (#2995) |

## The correct path for tracked work

```bash
# 1. ticket first (every tracked change needs an issue)
gh issue view <N>
# 2. dedicated worktree + branch off main (never edit main directly)
git worktree add ~/devenv-ops-<N> -b fix/<N>-slug origin/main
ln -s ~/devenv-ops/node_modules ~/devenv-ops-<N>/node_modules   # or: npm run worktree:bootstrap
# 3. do all edits, commits, and the PR from the worktree
cd ~/devenv-ops-<N> && <edit/test/commit/push/PR>
```

## IT role specifically

IT-ops markers (`[it-ops]`, `chore(it-ops):`, `MEGINGJORD_IT_OPS=1`) waive the
**ticket + baton** requirement for genuine local/fleet maintenance — they do **not**
authorize editing tracked files in the canonical checkout. An IT change that touches
a tracked file is delivery work: open a ticket and use a worktree (see
`instructions/role-baton-routing.instructions.md` IT-role note).

## How it's enforced

`hooks/scripts/canonical_main_enforcer.py` (via `pretool_guard.py`) denies, in the
main checkout:
- structured edit-tool writes to tracked/non-gitignored paths,
- branch switches off `main`,
- **shell-level writes** to tracked files — redirects, `sed -i`, `tee`, `cp`, `mv`
  (#2995, closing the prior terminal-write blind spot).

Denials emit a machine-readable message pointing you to a worktree. If you hit one,
you are editing main directly — stop and follow the correct path above.

> Residual: arbitrary in-process writers (e.g. a `python -c "open(...,'w')"` script)
> are not parsed; the guard covers the common shell idioms. Prefer the edit tools +
> a worktree so the structured enforcer always applies.
