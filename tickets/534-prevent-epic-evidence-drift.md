# Ticket 534 — Prevent Epic Evidence Drift in Progress and Closeout Records

Priority: P1 (High)
Type: Task
Area: scripts
Status: in-progress
Parent: #397

## Manager Scope

Objective:
- Add a live GitHub epic evidence control that catches missing child coverage, invalid PR references, and stale governance-noise warnings before epic closure.

Acceptance Criteria:
1. Epic verification compares linked children against progress updates and closeout references.
2. Epic verification rejects `PR #N` closeout references when no matching PR exists.
3. Epic closure flow blocks on evidence-integrity failures and surfaces warnings for stale governance comments.
4. Epic governance instructions define the new evidence-integrity rule set.
5. Validation includes Epic #331 as the regression case.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`.
- Signed-by: Nova Mason
- Team&Model: copilot:gpt-5.4@local
- Role: manager

## Implementation Evidence

- Added `scripts/global/epic-evidence.js` for live GitHub epic evidence verification.
- Wired `scripts/global/issue-transition.js` to block `review -> done` for epics when evidence checks fail.
- Updated `instructions/epic-governance.instructions.md` with mandatory evidence-integrity requirements.
- Added `npm run governance:epic -- <issue#>` entry point for targeted checks.

## COLLABORATOR_HANDOFF

- Root-cause fix implemented in live GitHub validation and epic closure gating.
- Signed-by: Nova Harper
- Team&Model: copilot:gpt-5.4@local
- Role: collaborator
