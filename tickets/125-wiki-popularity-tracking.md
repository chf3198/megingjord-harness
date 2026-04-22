# Ticket 125 — Wiki Section Popularity shows only 4 articles

**Status:** done
**Priority:** P2 — Feature underutilized
**Role:** Collaborator
**Epic:** 120

## Problem
Wiki Health & Metrics → Section Popularity shows only 4 articles with
1 access each. Access tracking relies on manual click events via
`trackWikiAccess()`. Until users click individual article links the
sections never register in popularity metrics.

## Root Cause
`trackWikiAccess` is only triggered by user click. No auto-seeding occurs
when wiki pages first load. The metrics API has no baseline data.

## Acceptance Criteria
- When wiki pages load, all section categories are auto-tracked once.
- Section popularity bars show all categories, not just clicked ones.
- Tracking does not double-count on re-renders.

## Fix Location
- `dashboard/js/wiki-reader.js` — call `trackWikiAccess` per section
  after `loadWikiPages()` resolves, guarded by session flag.
