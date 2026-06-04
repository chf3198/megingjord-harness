# State-Isolation Migration (operator guide)

Epic #2091 made harness session state **isolated by construction** so hooks no longer
fire false "Admin baton incomplete" alarms on another team's residue. This guide tells
operators what changed and what (if anything) they must do.

## What changed (C1–C8, all shipped)

| Fix | Child | Effect on you |
|---|---|---|
| Per-session state-file keying | C5 #2106 | State file is `repo-<cwd-hash>-<session-id>.json` — each session gets its own; no cross-session bleed |
| Session-ID generation | C1 #2102 | A session ID is emitted at session start and used in the key above |
| Session-start rotation | C2 #2103 | A fresh state file is created per session; prior files are not read |
| Session-end archive | C3 #2104 | State is archived at session end; no residue accumulates |
| Per-worktree `core.hooksPath` | C4 #2105 | Hooks scope to the worktree they fire from — no cwd-confusion across worktrees |
| Canonical-main read-only enforcer | C6 #2107 | Tracked-file writes under `~/devenv-ops/` are rejected; work in a worktree |
| Audit log | C7 #2108 | `~/.megingjord/state-isolation.jsonl` records session-start/end + allowlist decisions |
| Replay-eval | C8 #2109 | CI proof that the keying yields zero pollution false-positives |

## What you must do

- **Nothing for new sessions** — keying + rotation are automatic via the session hooks.
- **Do your work in a worktree**, never by editing tracked files in the canonical `~/devenv-ops/`
  checkout (the C6 enforcer rejects it and redirects you). Per-operator config / build
  artifacts (`.env`, `node_modules/`, `dist/`, …) remain writable there.
- **Pre-existing worktrees**: if a worktree predates C4, re-run `npm run worktree:bootstrap`
  (or `scripts/worktree-session-start.sh`) once to pick up `core.hooksPath`.

## Verifying isolation

```bash
ls ~/.megingjord/state/        # one repo-<hash>-<session>.json per active session
tail ~/.megingjord/state-isolation.jsonl   # session-start/end + allowlist-decision events
```

## Scope boundary (important)

This Epic eliminates the **cross-session/cross-worktree state-pollution** class of false
"Admin baton incomplete" alarms. A *second*, distinct cause — the `code_touched` flag being
set by **read-only** Bash commands (tracker-accuracy) — is owned separately by **#2647**.
If you still see a phantom admin-baton nag on a read-only / issue-only session, that is the
tracker-accuracy class (owned by #2647), not a regression of this Epic.

## References

- `wiki/wisdom/project/research/harness-state-isolation.md` — Phase-0 synthesis (#2092).
- `instructions/global-standards.instructions.md` — canonical-main read-only policy (#2107).
- Epic #2091 · audit emitter #2108 · replay-eval #2109 · promotion criteria #2111.
