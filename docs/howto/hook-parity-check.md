# Hook-parity check

`scripts/global/hook-parity-check.js` (#1824) performs a 3-way diff across the eight tracked governance hook scripts and discriminates four scenarios that previously all looked like "deployed differs from repo source". Closes the signal-to-noise problem surfaced by the Copilot Team stress test on 2026-05-17 (8 failures, all caused by a stale branch).

## The three sources compared

```
hooks/scripts/*.py  vs  origin/main:hooks/scripts/*.py  vs  ~/.{copilot,codex}/hooks/scripts/*.py
        ↑                          ↑                                  ↑
   current branch               main                          deployed runtime
```

## Five diagnoses

| Diagnosis | Branch | Main | Deployed | Recommended action |
|---|:-:|:-:|:-:|---|
| `ok` | A | A | A | None |
| `branch-stale` | A | B | B | `git rebase origin/main` (or merge main in) |
| `runtime-stale` | A | A | B | `npm run deploy:both:apply` |
| `runtime-and-branch-share-fork` | A | B | A | rebase onto main + verify deploy |
| `branch-and-runtime-diverged` | A | B | C | Manual reconciliation; file incident ticket |
| `not-deployed` | A | A | (absent) | G5 portability opt-out; no action |

## Usage

```bash
# Default human-readable
npm run governance:hook-parity

# Machine-readable
npm run governance:hook-parity -- --json
```

Exit codes:
- `0` — all `ok` (or only `branch-stale`/`not-deployed`, both operational)
- `1` — `runtime-stale` somewhere (run `deploy:both:apply`)
- `2` — `branch-and-runtime-diverged` (real drift; file a ticket)

## When to run this

- **At session start** if you're on a feature branch — catches branch-stale early.
- **Before running the harness stress test** as a Step-0 pre-check (per #1824 AC4).
- **Post-deploy** to confirm sync.
- **CI** as an advisory check (do not block on `branch-stale` — that's normal during in-flight work).

## Why this exists

The 2026-05-17 Copilot Team stress test reported 8 failures. Investigation showed all 8 collapsed to a single root cause: Copilot's branch was 5 commits behind main, so their repo source lacked the #1821 UI-scoping fix that had already merged. The stress test treated this identically to a real drift between repo and runtime. This script discriminates so future operators know whether to **rebase**, **deploy**, or **file a real ticket**.

## Tracked scripts

The 8 governance hooks under `hooks/scripts/`:

- `stop_checks.py` (Stop hook checking logic)
- `stop_reminder.py` (Stop hook orchestrator)
- `manager_ticket_gate.py` (UserPromptSubmit Manager-gate)
- `userprompt_gate.py` (UserPromptSubmit second gate)
- `pretool_guard.py` (PreToolUse gate)
- `tool_activity.py` (state tracker)
- `repo_detection.py` (path/repo classifier)
- `state_store.py` (governance state)

If a new hook joins this set, extend `TRACKED` in the script.

## Tests

`tests/hook-parity-check.spec.js` — 8 cases covering all 5 diagnoses plus the not-deployed path. Stubs `fs.readFileSync` and `git show` to avoid live deploy dependency.

Run via `npm run governance:hook-parity:test`.

## Composition

- Closes #1824.
- Sibling to Epic #1798 / #1815 / #1821 missed-surface chain (this is the meta-fix for stress-test signal discrimination).
- Composes with `npm run hamr:sync-verify` (existing) — that script covers HAMR substrate parity; this covers hook scripts.
- Stress-test prompt template updated to invoke this as Step 0 (see #1824 AC4).

## Related

- `instructions/canonical-governance-anti-duplication.instructions.md` §"Adapter parity" — Claude Code exemption from hook deployment.
- Epic #1771 — replay-based eval (this is an instrumentation pattern, not a calendar wait).
- `[[feedback-cross-family-review-model-choice]]` — operator-side memory pattern.
