# Ticket 146 — Weekly Cost→Quality Self-Anneal Scorecard

Priority: P1 (High)
Type: Task
Area: dashboard
Status: ready
Parent: #139
Depends on: #143

## Manager Scope

Objective:
- Create an automated weekly scorecard and decision loop for cost→quality optimization.

Acceptance Criteria:
1. Scorecard includes spend proxy, cycle time, pass rate, and rework/rollback indicator.
2. Weekly trend output saved under logs/ with timestamped snapshots.
3. Anneal recommendations are generated from threshold rules (promote/demote levers).
4. Output is consumable by Manager/Admin/Consultant ticket closeout evidence.

Constraints:
- Keep implementation lightweight (no heavy infra dependencies).
- Preserve <=100-line file rule in any new script/modules.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation.
