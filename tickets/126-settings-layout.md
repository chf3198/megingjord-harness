# Ticket 126 — Settings view layout and organization

Priority: P1 (High)
Type: Task
Area: dashboard
Status: ready
Parent: none

## Manager Scope

Objective:
- Complete settings UX/layout hardening for narrow viewports and edit discoverability.

Current Necessity Review:
- Still necessary. Current settings UI remains split into separate full-width panels and does not include the explicit modal-edit hint from AC.

Acceptance Criteria:
1. No horizontal overflow in resources table/cards on narrow widths.
2. Config + resource sections present a consistent, connected structure.
3. Visible hint explains editing flow via modal controls.

Implementation Targets:
- `dashboard/css/settings.css`
- `dashboard/index.html`
- `dashboard/js/settings-panel.js` (if structural hints/actions are added)

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation.

## BLOCKER_NOTE

- owner: collaborator (dashboard-UX specialized)
- unblock_condition: dashboard CSS baseline stable; narrow-viewport regression tests pass
- eta_or_review_time: manager review by 2026-05-07 governance queue
