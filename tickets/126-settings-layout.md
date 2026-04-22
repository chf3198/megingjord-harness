# Ticket 126 — Settings view layout and organization

**Status:** done
**Priority:** P1 — Poor UX impeding daily use
**Role:** Collaborator
**Epic:** none

## Problem
1. Fleet Resources cards overflow horizontally on narrow viewports.
2. Config and Resources panels are two separate full-width sections that
   look disconnected.
3. API keys and device configs require scrolling to find edit controls.
4. Modal overlay exists but is not visually obvious enough.

## Acceptance Criteria
- No horizontal scrolling in the Fleet Resources grid at any viewport.
- Cards wrap and stack cleanly at ≤900px width.
- Settings header explains how to edit (modal hint visible).
- Config panel and Resources panel have a consistent visual structure.

## Fix Location
- `dashboard/css/settings.css` — fix grid overflow, card widths, layout
- `dashboard/index.html` — add modal hint banner to settings section
