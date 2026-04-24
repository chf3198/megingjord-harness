# Ticket 162 — Weekly Governance Drift Scorecard

Priority: P1 (High)
Type: Task
Area: scripts
Status: done (`closed`)
Parent: #163

## Manager Scope

Objective:
- Produce a weekly governance drift report used by Admin/Consultant closeout gates.

Acceptance Criteria:
1. Weekly report includes epic-child integrity, evidence completeness, and ready-SLA metrics.
2. Report snapshots are stored under `logs/` with timestamps.
3. Escalation recommendations are generated from threshold rules.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`.

## Implementation Evidence

- Added weekly scorecard generator: `scripts/global/governance-weekly-report.js`.
- Added npm scripts:
	- `governance:verify`
	- `governance:weekly`
- Report outputs:
	- `logs/governance-weekly.json`
	- `logs/governance-weekly-YYYYMMDD.json`

## COLLABORATOR_HANDOFF

- Weekly drift scorecard implemented with escalation recommendations from threshold rules.

## ADMIN_HANDOFF

- Validation gates executed:
	- `npm run lint` ✅
	- `npm test` ✅
	- `npm run governance:weekly` ✅
- Transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Weekly governance reporting now supports Admin/Consultant closeout evidence cadence.

## GitHub Evidence Block

- Issue reference/state: `#162` documented as terminal `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: weekly scorecard script + log snapshot output + repository validation gates.
