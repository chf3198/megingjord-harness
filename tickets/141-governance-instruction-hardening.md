# Ticket 141 — Governance Instruction Hardening

Priority: P0 (Critical)
Type: Task
Area: instructions
Status: done (`closed`)
Parent: #139
Depends on: #140

## Manager Scope

Objective:
- Apply minimal governance instruction updates from #140 to prevent repeated workflow/protocol drift.

Acceptance Criteria:
1. Updates are bounded to instruction files and remain concise.
2. Added rules are objective, testable, and non-contradictory.
3. No security/permission scope expansion is introduced.
4. Change list maps directly to #140 findings.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation after #140.

## Implementation Evidence

- Updated `instructions/workflow-resilience.instructions.md`:
	- Added explicit self-anneal trigger for P0/P1 `status:ready` stall >24h without blocker note.
- Updated `instructions/ticket-driven-work.instructions.md`:
	- Strengthened closeout evidence contract with required verification timestamp + exact command/check outputs.
- Existing #140-proposed guardrails remain active:
	- `instructions/epic-governance.instructions.md` re-scope-before-close rule.
	- `instructions/workflow-resilience.instructions.md` local-vs-GitHub divergence trigger.

## COLLABORATOR_HANDOFF

- Minimal, testable, non-security-expanding instruction deltas applied.

## ADMIN_HANDOFF

- Change set mapped directly to #140 findings and validated for non-contradiction.
- Transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Guardrails are objective, bounded, and auditable.

## GitHub Evidence Block

- Issue reference/state: `#141` documented as `done`/`closed` in ticket artifact.
- Applied labels: Priority/Type/Area/Parent/Depends captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow pass (no PR artifact generated in-session).
- Validation evidence: instruction file deltas + lint validation.
