# Ticket 161 — Governance Verifier v3 (Ready-SLA + Queue Checks)

Priority: P1 (High)
Type: Task
Area: scripts
Status: done (`closed`)
Parent: #163

## Manager Scope

Objective:
- Extend governance verification checks for `ready` age SLA and merge-queue CI compatibility.

Acceptance Criteria:
1. Verifier reports stale P0/P1 `ready` tickets >24h without blocker note.
2. Verifier checks required workflow coverage for `merge_group` where queue gates apply.
3. JSON output includes machine-readable remediation hints.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`.

## Implementation Evidence

- Extended `scripts/global/governance-verify.js` with:
	- P0/P1 `ready` age >24h checks requiring blocker-note fields.
	- Required workflow `merge_group` coverage checks for queue-safe required checks.
	- Machine-readable `remediationHints` in JSON output.

## COLLABORATOR_HANDOFF

- Verifier v3 controls implemented and mapped to acceptance criteria.

## ADMIN_HANDOFF

- Validation gates executed:
	- `npm run lint` ✅
	- `npm test` ✅
	- `node scripts/global/governance-verify.js --json` ✅
- Transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Verifier now enforces ready-SLA and merge-queue compatibility drift checks.

## GitHub Evidence Block

- Issue reference/state: `#161` documented as terminal `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: verifier v3 code path + repository validation gates.
