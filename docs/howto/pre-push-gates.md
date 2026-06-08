# Pre-push gates (Lefthook parity)

## Purpose

Local pre-push runs the same deterministic gate set used for CI lint/governance checks.
This reduces avoidable CI reruns by failing fast before push.

## Install

1. Install dependencies: `npm install`
2. Install hooks: `npm run prepare`
3. Verify config exists: `lefthook.yml`

## Gates executed (parallel)

- branch-name regex check (`hooks/scripts/validate-branch-name.sh`)
- `npm run lint`
- `npm run lint:readability:ci`
- `npm run lint:js` (advisory while legacy baseline warnings are being burned down)
- `npm run lint:md`
- `npm run lint:py`
- `npm run lint:sh` (advisory while legacy baseline warnings are being burned down)
- `node scripts/global/megalint/index.js`
- `node scripts/global/closeout-preflight.js`

### Server-state-only gates (not available pre-push)

Some validators inherently require server-state inputs (PR body labels, PR comments, PR file list) that aren't available pre-push without a round-trip to GitHub. These are documented here for clarity but do NOT run as local pre-push hooks:

- **test-evidence** (`scripts/global/test-evidence-validator.js`) — needs `test_strategy` declared in MANAGER_HANDOFF + per-strategy evidence (spec files in PR diff, evidence comments in trail). Runs server-side via `.github/workflows/test-evidence.yml` on PR open/sync. Prior `--diff-only` invocation was removed (#1613) — the flag was never implemented; the call silently failed under `|| true`.

The local pre-push gate distinction:
- **Blocking gates**: branch-name regex, lint-js, lint-md, lint-readability, megalint, closeout-preflight — these BLOCK push on failure.
- **Advisory gates**: lint-py, lint-sh — these run but suppress failures (`|| true`) while baseline warnings are being burned down.
- **Server-state-only gates**: test-evidence — these CANNOT run locally; documented for operator awareness but not invoked by lefthook.

## Manual run

- `npm run hooks:pre-push`

## Emergency bypass

- Git-native bypass: `git push --no-verify`
- Script bypass with explicit warning output:
  - `PUSH_GATES_BYPASS=1 npm run hooks:pre-push`
  - `npm run hooks:pre-push -- --bypass`

Bypass warning includes the full gate list so skipped controls are visible in terminal scrollback.

## CI parity

The lint workflow calls the same command:

- `npm run hooks:pre-push`

This keeps local and CI execution paths aligned.

## Pre-flight admin-override bypass guard (#2706, Epic #2709)

Beyond pre-push, `hooks/scripts/pretool_guard.py` enforces at tool-call time: an
admin-override merge (a PR landed with the `--admin` branch-protection bypass) is
**denied** unless the Epic #2517 exception is already recorded on the active ticket —
the `merge-bypass:admin-exception` label, or a `BLOCKER_NOTE` with `bypass_reason:` +
`approver:` in the PR body. Record the exception **before** the override.

The guard is **fail-closed** (an unverifiable exception denies, never silently allows)
and crash-safe (wrapped in `try/except`, so a guard bug yields a recoverable deny, not
a session brick). This converts the bypass-exception link from a post-merge-only CI
backstop to a pre-flight control — the "prevention over reaction" mandate.

Companion: `scripts/global/gate-failure-tier1.js` auto-emits the Tier-1 incident on an
operator-caused gate failure, so self-anneal escalation no longer depends on the
operator remembering to log it (the gap behind #2703).
