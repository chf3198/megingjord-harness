# Ticket 122 — Baton section shows all open tickets as in-progress

Priority: P0 (Critical)
Type: Bug
Area: dashboard
Status: done (`closed`)
Parent: none

## Manager Scope

Objective:
- Prevent Agent Baton flooding by showing only active baton statuses.

Acceptance Criteria:
1. Unlabeled open issues default to `backlog` in sync.
2. Baton list renders active-only statuses (`in-progress`, `review`).

## Implementation Evidence

- `dashboard/js/github-sync.js`: fallback status now resolves to `backlog`.
- `dashboard/js/app.js`: baton list filters to `['in-progress','review']`.

## COLLABORATOR_HANDOFF

- Bug fix implemented and verified in source.

## ADMIN_HANDOFF

- Governance artifact normalized to standard format.

## CONSULTANT_CLOSEOUT

Decision:
- Approved and remains closed.

## GitHub Evidence Block

- Issue reference/state: `#122` documented as `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: sync fallback normalization + baton active-only rendering.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure: `npm run lint` and `npm test` passed in governance remediation reruns.
