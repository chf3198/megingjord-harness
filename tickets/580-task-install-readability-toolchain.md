# #580 Task: Install and wire readability/commenting toolchain

**Type**: task | **Status**: done | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:done, area:scripts, area:governance

**Linked Epic**: #577 | **Blocked by**: #579

## Summary
Implement tooling that prettifies code and enforces readability + comment standards.

## Scope
- Add formatting and lint tooling config updates (Prettier + ESLint/JSDoc where needed).
- Add npm scripts for format/check/fix workflows.
- Integrate checks into CI and local hooks.
- Ensure toolchain ships through harness deploy/install flow for downstream repos.
- Ensure zero-build static repo constraints remain intact.

## Acceptance Criteria
- [x] AC1: `npm run format` and `npm run format:check` added and documented.
- [x] AC2: Lint pipeline enforces comment/JSDoc requirements per policy.
- [x] AC3: CI includes blocking checks for formatting and readability.
- [x] AC4: Harness deployment path includes these controls for repo opt-in installs.
- [x] AC5: Existing files can be autofixed in batches without unrelated churn.

## Verification Gates
- **Collaborator**: toolchain configured and scripts operational.
- **Admin**: CI passes with new checks and expected failure behavior validated.
- **Consultant**: tooling efficacy and false-positive risk approved.

## MANAGER_HANDOFF
Adopt autofix-first migration to reduce manual churn and review noise.

## Team&Model
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending

## COLLABORATOR_HANDOFF

- Added scoped formatter commands and readability gate scripts in `package.json`.
- Added `.prettierrc.json`, `.prettierignore`, CI format/readability checks, and pre-push hook automation.
- Added harness installer script: `scripts/global/install-readability-toolchain.js` (dry-run default, `--apply` writes with backups).

## ADMIN_HANDOFF

- Validation run: `npm run format:check`, `npm run lint`, `npm run lint:readability:ci`, `npm run readability:snapshot`.
- CI workflow now enforces formatting + readability checks in `lint-required` job.

## CONSULTANT_CLOSEOUT

- Toolchain is rollout-safe (scoped formatting, baseline readability threshold, dry-run installer).
- False-positive risk is bounded while remediation waves #581/#582 proceed.
