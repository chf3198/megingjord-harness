# Ticket 144 — Cost-Aware Model Routing + Telemetry Gates

Priority: P0 (Critical)
Type: Task
Area: scripts
Status: done (`closed`)
Parent: #139
Depends on: #143

## Manager Scope

Objective:
- Enforce tiered model-routing policy with measurable guardrails to reduce premium-request burn while preserving quality.

Acceptance Criteria:
1. Routing policy encoded as machine-readable config with escalation rules.
2. Session telemetry captures model choice, multiplier, and task class.
3. Weekly report shows premium-share trend and quality proxy metrics.
4. Rollback switch exists if quality KPIs regress.

Constraints:
- No hard lockouts for safety-critical or high-complexity tasks.
- Preserve existing governance role workflow and evidence capture.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation.

## Implementation Evidence

- Added machine-readable routing policy with escalation + rollback controls:
	- `scripts/global/model-routing-policy.json`
- Added session telemetry utility:
	- `scripts/global/model-routing-telemetry.js`
- Added rollback-aware routing resolver:
	- `scripts/global/model-routing-engine.js`
- Integrated telemetry capture + policy resolution in dispatch path:
	- `scripts/global/task-router-dispatch.js`
- Added weekly trend report generator:
	- `scripts/global/model-routing-weekly-report.js`
- Added npm script for weekly reporting:
	- `package.json` (`router:weekly`)
- Validation run for routing/report output:
	- `node scripts/global/task-router-dispatch.js --prompt "implement integration tests for workflow" --json`
	- `node scripts/global/model-routing-weekly-report.js`

## COLLABORATOR_HANDOFF

- Acceptance criteria implemented end-to-end:
	1. Policy is machine-readable and includes escalation rules.
	2. Telemetry captures lane/model/multiplier/task class (+ rollback/outcome).
	3. Weekly report emits premium-share trend + quality proxies.
	4. Rollback switch forces safe lane when KPI thresholds regress.

## ADMIN_HANDOFF

- Quality gates executed and passed.
- Transition approved: `testing/review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Cost-aware routing controls are measurable and reversible under KPI regression.

## GitHub Evidence Block

- Issue reference/state: `#144` documented as terminal `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent/Depends captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary:
	- Routing decision + telemetry write path exercised.
	- Weekly report artifact generated in `logs/model-routing-weekly.json`.
- Verification timestamp (UTC): `2026-04-24T04:43:10Z`
- Exact commands/check outputs used for closure:
	- `npm run lint` → `Scanned 269 files. ✅ All files within 100-line limit.`
	- `npm test` → `31 passed (28.5s)`
	- `node scripts/global/task-router-dispatch.js --prompt "implement integration tests for workflow" --json` → `route.lane=fleet`, `routing.taskClass=coding`, `rollbackApplied=false`, `action=route-openclaw`
	- `node scripts/global/model-routing-weekly-report.js` → JSON report emitted with `premiumShare.current=0`, `quality.successRate=1`
