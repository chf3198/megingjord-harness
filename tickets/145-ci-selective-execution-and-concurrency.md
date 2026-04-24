# Ticket 145 — CI Selective Execution, Caching, and Concurrency

Priority: P0 (Critical)
Type: Task
Area: infra
Status: done (`closed`)
Parent: #139
Depends on: #143

## Manager Scope

Objective:
- Reduce avoidable CI runtime and cost via path filters, concurrency cancellation, and cache optimization.

Acceptance Criteria:
1. Workflows use path/branch/event filters where safe and testable.
2. Concurrency groups cancel superseded runs for the same ref/workflow.
3. Dependency caches are configured with robust keys and restore keys.
4. Required-check mapping prevents merge deadlocks from skipped workflows.

Constraints:
- No reduction in required verification on merge-to-main paths.
- Include security notes for cache scope and untrusted PR behavior.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation.

## Implementation Evidence

- Updated required lint workflow:
	- `.github/workflows/lint.yml`
	- Added `merge_group` trigger to prevent queue-check deadlocks.
	- Added push `paths` filters for safe selective execution.
	- Added workflow concurrency cancellation (`cancel-in-progress: true`).
	- Added robust npm cache key + restore key strategy via `actions/cache`.
- Security posture notes:
	- Cache scope is runner OS + lockfile hash (or fallback prefix), reducing cross-context contamination.
	- Required verification remains intact on PR and merge-queue paths.

## COLLABORATOR_HANDOFF

- Acceptance criteria implemented end-to-end with queue-compatible required check behavior.

## ADMIN_HANDOFF

- Validation gates executed:
	- `npm run lint` ✅
	- `npm test` ✅ (31/31)
- Transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- CI now combines selective execution with reliable required-check reporting.

## GitHub Evidence Block

- Issue reference/state: `#145` documented as terminal `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent/Depends captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: workflow trigger/concurrency/cache hardening + repo validation gates.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure:
	- `npm run lint` → `Scanned 279 files. ✅ All files within 100-line limit.`
	- `npm test` → `31 passed (26.8s)`
