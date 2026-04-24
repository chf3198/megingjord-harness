# Ticket 138 — Lint/Refactor Remediation Wave 3

Priority: P0 (Critical)
Type: Task
Area: dashboard
Status: done (`closed`)
Parent: #121

## Manager Scope

Objective:
- Continue the lint/remediation program after Wave 2, focusing on the next highest-warning module groups.

Acceptance Criteria:
1. Reduce the current lint baseline from 222 warnings by another bounded, evidence-backed tranche.
2. Prioritize remaining hotspots: `baton-flow`, `wiki-io`, `github-monitor`, `tooltips`, `event-source`, `render-panels`, `ticket-log`, `event-bus`, and `github-sync`.
3. Preserve behavior with automated regression checks for touched modules.
4. Keep all modified files within the repository's 100-line rule.

Constraints:
- Do not relax lint rules globally.
- Prefer explicit browser exports/global declarations or real dead-code removal.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation.

## Implementation Evidence

- JS lint baseline reduced from 222 warnings to 152 warnings (`-70`, ~31.5%).
- Wave-3 hotspot modules remediated:
	- `dashboard/js/baton-flow.js`
	- `dashboard/js/event-bus.js`
	- `dashboard/js/event-source.js`
	- `dashboard/js/github-monitor.js`
	- `dashboard/js/github-sync.js`
	- `dashboard/js/render-panels.js`
	- `dashboard/js/ticket-log.js`
	- `dashboard/js/tooltips.js`
	- `scripts/wiki/wiki-io.js`
- Added explicit browser exports/global declarations and fixed equality/const hygiene in touched hotspot files.

## COLLABORATOR_HANDOFF

- Implemented bounded lint-remediation tranche for Wave 3 hotspots without global rule relaxation.
- Kept all modified files at or below repository 100-line limit.
- Recommended transition: `in-progress -> testing`.

## ADMIN_HANDOFF

- Validation gates:
	- `npm run lint` ✅
	- `npm run lint:js` ✅ (warning count reduced; no errors)
	- `npm test` ✅ (`31/31` passing)
- Recommended transition: `testing -> review`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and closed.
- Wave 3 met scoped AC by delivering a material, evidence-backed reduction in lint debt while preserving behavior.

## GitHub Evidence Block

- Issue reference/state: `#138` marked `done` and locally documented as `closed`.
- Labels/status metadata: Priority/Type/Area/Parent captured in ticket artifact.
- Linked PR/merge evidence: N/A in this local markdown workflow pass (no PR artifact generated in-session).
- Validation evidence: `npm run lint` pass, `npm run lint:js` warning reduction to 152 with no errors, `npm test` 31/31 pass.
