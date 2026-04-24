# Ticket 125 — Wiki Section Popularity shows only 4 articles

Priority: P2 (Normal)
Type: Bug
Area: dashboard
Status: ready
Parent: none

## Manager Scope

Objective:
- Ensure Wiki section popularity has baseline category coverage without requiring manual clicks.

Current Necessity Review:
- Still necessary. `dashboard/js/wiki-reader.js` currently tracks clicks only.
- No one-time auto-seed path exists for loaded section categories.
- Follow-on note: deferred from closed epic #120 via explicit re-scope artifact.

Acceptance Criteria:
1. On first wiki load per session, each category is tracked once.
2. Popularity bars include all categories with non-zero baseline visibility.
3. Re-renders do not double-count.

Implementation Targets:
- `dashboard/js/wiki-reader.js`
- `dashboard/js/wiki-metrics.js` (if helper/state needed)

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation.
