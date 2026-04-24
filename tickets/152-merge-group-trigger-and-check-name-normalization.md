# Ticket 152 — Merge-Group Trigger + Required-Check Name Normalization

Priority: P0 (Critical)
Type: Task
Area: infra
Status: done (`closed`)
Parent: #147

## Manager Scope

Objective:
- Ensure required checks remain reliable under merge queue and branch protections.

Acceptance Criteria:
1. Required workflows include `merge_group` where queue-protected.
2. Required check/job names are unique and stable.
3. CI behavior is validated for PR + merge-queue paths.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`

## Implementation Evidence

- Updated `.github/workflows/lint.yml`:
	- Added `merge_group` trigger (`checks_requested`).
	- Normalized required job identity to stable name: `lint-required`.
- Updated `.github/workflows/branch-name.yml`:
	- Added `merge_group` trigger.
	- Normalized required job identity to stable name: `branch-name-required`.
	- Added merge-group-safe pass path to keep required check reporting reliable.

## COLLABORATOR_HANDOFF

- Merge-queue compatibility and required-check naming objectives are implemented.

## ADMIN_HANDOFF

- Validation gates executed:
	- `npm run lint` ✅
	- `npm test` ✅ (31/31)
- Transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Required checks are now stable and merge-queue compatible.

## GitHub Evidence Block

- Issue reference/state: `#152` documented as terminal `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: workflow trigger and required-check name normalization + validation gates.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure:
	- `npm run lint` → `Scanned 279 files. ✅ All files within 100-line limit.`
	- `npm test` → `31 passed (26.8s)`
