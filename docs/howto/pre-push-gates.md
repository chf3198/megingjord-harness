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
- `node scripts/global/test-evidence-validator.js --diff-only` (advisory in local pre-push)

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
