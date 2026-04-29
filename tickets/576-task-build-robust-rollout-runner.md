# #576 Task: Build robust remote model rollout runner

**Type**: task | **Status**: done | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:done, area:scripts, area:infra

**Linked Epic**: #573 | **Blocked by**: #575

## Summary
Implement resilient remote pull/delete orchestration with progress tracking and safe rollback behavior.

## Scope
- Add rollout script for remote `/api/pull` and `/api/delete` operations.
- Track pull progress (or staged polling) with bounded retries/backoff.
- Enforce pull-before-delete safety and fallback retention.
- Generate final reconciliation report against expected model set.

## Acceptance Criteria
- [x] AC1: Rollout script supports dry-run and apply modes.
- [x] AC2: Pull operations include retry/backoff and terminal reason codes.
- [x] AC3: Delete only executes after successful pull verification.
- [x] AC4: Reconciliation report clearly lists have/missing/failed per device.
- [x] AC5: Lint/tests pass and rerun evidence attached to #573.

## Verification Gates
- **Collaborator**: rollout automation complete.
- **Admin**: apply-mode execution evidence complete.
- **Consultant**: safety/risk posture approved.

## Team&Model
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending

## ADMIN_HANDOFF

- Added `scripts/global/fleet-rollout-runner.js`.
- Produced dry-run evidence at `test-results/573-rollout-dry-run.json`.
- Produced apply-mode evidence at `test-results/573-rollout-apply.json` with timeout and HTTP-4xx reason codes.

## CONSULTANT_CLOSEOUT

- Rollout safety posture improved: pull-before-delete guard and bounded retries are now enforced.
- Evidence clearly distinguishes missing models from failed pulls and missing deletes.
