# Ticket 124 — Devices section shows "error" status

Priority: P1 (High)
Type: Bug
Area: dashboard
Status: done (`closed`)
Parent: none

## Manager Scope

Objective:
- Use connectivity-accurate device states (`offline` vs software `error`).

Acceptance Criteria:
1. Unreachable endpoints map to `offline`.
2. Device badge semantics avoid false bug signals.

## Implementation Evidence

- `dashboard/js/health-check.js`: non-OK and catch paths return `status: 'offline'`.

## COLLABORATOR_HANDOFF

- Connectivity-state mapping corrected.

## ADMIN_HANDOFF

- Governance artifact normalized to standard format.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and remains closed.

## GitHub Evidence Block

- Issue reference/state: `#124` documented as `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: health-check status mapping normalized to connectivity semantics.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure: `npm run lint` and `npm test` passed in governance remediation reruns.
