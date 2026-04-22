# Ticket 123 — Context Flow section is empty

**Status:** done
**Priority:** P0 — Feature completely broken
**Role:** Collaborator
**Epic:** none

## Problem
The Context Flow section on the Live view renders empty. The SVG diagram
does not appear even though `renderContextFlow` is called correctly from
Alpine.

## Root Cause
`cfArrows(nodes, arrows)` references `isActive` from global scope, but
`isActive` is only a local parameter of `renderContextFlow`. In the
browser runtime this is a `ReferenceError` that silently causes the
entire `renderContextFlow` call to fail, returning no HTML.

## Acceptance Criteria
- Context Flow SVG diagram renders with all nodes and arrows.
- Animated data packets appear when there are active baton tickets.

## Fix Location
- `dashboard/js/context-flow.js` — pass `isActive` to `cfArrows`
