# Ticket 142 — Governance Verification Harness + Drift Checks

Priority: P0 (Critical)
Type: Task
Area: scripts
Status: done (`closed`)
Parent: #139
Depends on: #141

## Manager Scope

Objective:
- Add practical verification checks that make governance drift observable before ticket/epic closure.

Acceptance Criteria:
1. Verification checklist is documented with explicit pass/fail criteria.
2. Checks cover baton artifacts, epic close conditions, and closure state normalization.
3. Checks can be run with existing repo tooling (no heavy new dependencies).
4. Evidence format is defined for Admin/Consultant phases.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation after #141.

## Implementation Evidence

- Added executable harness: `scripts/global/governance-verify.js`
	- Checks priority normalization, closed-ticket role normalization, closeout section presence, evidence block presence, and epic closed-with-open-children violations.
	- Supports machine-readable mode: `--json`.
- Added checklist/runbook: `research/governance-verification-checklist-2026-04-23.md`
	- Includes explicit pass/fail criteria and Admin/Consultant evidence block format.
- Added wiki operational guidance:
	- `wiki/sources/governance-verification-harness-2026.md`
	- `wiki/index.md`
	- `wiki/log.md`
- Harness execution evidence:
	- Command: `node scripts/global/governance-verify.js --json`
	- Result: `status=fail`, `failedChecks=13` (historical drift made observable).

## COLLABORATOR_HANDOFF

- Verification checks implemented and documented; failures now observable and actionable.

## ADMIN_HANDOFF

- Objective checks and evidence schema confirmed.
- Transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Harness meets acceptance by making governance drift measurable prior to closure.

## GitHub Evidence Block

- Issue reference/state: `#142` documented as `done`/`closed` in ticket artifact.
- Applied labels: Priority/Type/Area/Parent/Depends captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow pass (no PR artifact generated in-session).
- Validation evidence: harness script + checklist + JSON execution output + wiki linkage.
