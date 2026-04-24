# Ticket 156 — Governance Web Research Refresh (Wave 2)

Priority: P0 (Critical)
Type: Research
Area: instructions
Status: done (`closed`)
Parent: #155

## Manager Scope

Objective:
- Refresh first-party web evidence for governance closure gates, merge queue compatibility, and GitHub lifecycle controls.

Acceptance Criteria:
1. At least four first-party sources are captured.
2. Findings are translated into explicit governance levers.
3. Research is documented in `research/` and linked in wiki sources.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`.

## Implementation Evidence

- Completed research artifact: `research/governance-agile-github-remediation-2026-04-23.md`.
- First-party sources captured:
	- PR/issue linking + auto-close behavior
	- Protected-branch required-check constraints
	- Merge queue `merge_group` trigger requirements
	- Projects built-in automation behavior
	- Issue close lifecycle controls

## COLLABORATOR_HANDOFF

- Research objectives satisfied with actionable governance levers.

## ADMIN_HANDOFF

- Artifact integrity verified; transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Evidence quality is sufficient for design finalization.

## GitHub Evidence Block

- Issue reference/state: `#156` documented as `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence: research artifact + source set + governance alignment review.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure:
	- `npm run lint` → `Scanned 279 files. ✅ All files within 100-line limit.`
	- `node scripts/global/governance-verify.js --json` → `checkedTickets=43`, `failedChecks=13` (existing historical drift outside research-scope ticket).
