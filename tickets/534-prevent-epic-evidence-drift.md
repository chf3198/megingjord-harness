# Ticket 534 — Prevent Epic Evidence Drift in Progress and Closeout Records

Priority: P1 (High)
Type: Task
Area: scripts
Status: done (`closed`)
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

## ADMIN_HANDOFF

- Validation gates executed:
	- `npx eslint -c lint-configs/eslint.config.devenv.js --max-warnings 9999 scripts/global/epic-evidence.js scripts/global/issue-transition.js` ✅
	- `npm run lint:md` ✅
	- `npm run governance:epic -- 331 --json` ✅
	- `node scripts/global/governance-verify.js --json` → no new `534` failures; unrelated historical failures remain ✅
	- `tests/unit-modules.spec.js` ✅
- Linked PR: #535
- Signed-by: Nova Reyes
- Team&Model: copilot:gpt-5.4@local
- Role: admin

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Root-cause control now prevents missing child coverage and invalid PR references from slipping through epic closeout.

Critique:
- Scope is tight and directly addresses the evidence-integrity gap observed on Epic #331.
- Risk is low because the change is limited to governance tooling and policy text.

- Signed-by: Nova Vale
- Team&Model: copilot:gpt-5.4@local
- Role: consultant

## GitHub Evidence Block

- Issue reference/state: `#534` terminal `done` / `closed`.
- Applied labels: `type:task`, `priority:P1`, `area:governance`, terminal closeout state on GitHub issue.
- Linked PR/merge evidence: #535.
- Validation evidence summary: focused JS lint + markdown lint + Epic #331 regression pass + targeted governance verification + unit-modules test pass.
