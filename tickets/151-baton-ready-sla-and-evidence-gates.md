# Ticket 151 — Baton Ready-SLA + Closure Evidence Gates

Priority: P0 (Critical)
Type: Task
Area: instructions
Status: done (`closed`)
Parent: #147

## Manager Scope

Objective:
- Add enforceable SLA/escalation for `status:ready` and strict closure evidence gates.

Acceptance Criteria:
1. `ready` timeout rule and escalation path are explicit and testable.
2. Closure evidence schema requires PR/merge proof or approved exception.
3. Rules are minimal and non-contradictory with existing baton protocol.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`

## Implementation Evidence

- Updated `instructions/ticket-driven-work.instructions.md`:
	- Added explicit P0/P1 `ready` SLA escalation contract.
	- Added approved closure-evidence exception schema (`exception_type`, `exception_reason`, `exception_approver`, `exception_time_utc`).
- Updated `instructions/workflow-resilience.instructions.md`:
	- Added objective blocker-note minimum fields for ready-stall events.

## COLLABORATOR_HANDOFF

- Rules are explicit, minimal, and testable without contradicting baton protocol.

## ADMIN_HANDOFF

- Validation gates executed:
	- `npm run lint` ✅
	- `npm test` ✅ (31/31)
- Transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Ready-age escalation and closure evidence exceptions are now governed by objective schema.

## GitHub Evidence Block

- Issue reference/state: `#151` documented as terminal `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: instruction deltas + successful lint/test gates.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure:
	- `npm run lint` → `Scanned 279 files. ✅ All files within 100-line limit.`
	- `npm test` → `31 passed (26.8s)`
