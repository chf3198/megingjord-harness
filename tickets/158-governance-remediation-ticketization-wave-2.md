# Ticket 158 — Governance Remediation Ticketization (Wave 2)

Priority: P0 (Critical)
Type: Task
Area: instructions
Status: done (`closed`)
Parent: #155
Depends on: #157

## Manager Scope

Objective:
- Create the final implementation ticket set for the approved remediation design.

Acceptance Criteria:
1. Tickets are specific, non-overlapping, and testable.
2. Each ticket has objective acceptance criteria and governance metadata.
3. Ticket set supports phased implementation and validation.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`.

## Implementation Evidence

- Created final implementation tickets:
	- #159 Epic-child terminality remediation and normalization
	- #160 Closed-ticket evidence block backfill and normalization
	- #161 Governance verifier v3 (ready-SLA + queue checks)
	- #162 Weekly governance drift scorecard and escalation report

## COLLABORATOR_HANDOFF

- Ticket pack created and aligned to final redesign lanes.

## ADMIN_HANDOFF

- Ticket quality and sequencing verified; transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Final remediation backlog is execution-ready.

## GitHub Evidence Block

- Issue reference/state: `#158` documented as `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent/Depends captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence: ticket set creation and scope-quality review.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure:
	- `npm run lint` → `Scanned 279 files. ✅ All files within 100-line limit.`
	- `npm test` → `31 passed (26.4s)`
	- `node scripts/global/governance-verify.js --json` → `status=fail`, `failedChecks=13`; remediation implementation tickets #159–#162 created.
