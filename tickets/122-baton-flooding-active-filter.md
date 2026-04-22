# Ticket 122 — Baton section shows all open tickets as in-progress

**Status:** done
**Priority:** P0 — Critical UX regression
**Role:** Collaborator
**Epic:** none

## Problem
The Agent Baton panel floods with many tickets (338, 337, 324, etc.) all
showing the Collaborator role. `syncWithGitHub` assigns `in-progress`
as fallback status for any open GitHub issue with no status label, so all
open issues appear as active baton work.

## Root Causes
1. `github-sync.js`: `fallbackStatus = 'in-progress'` for all open issues.
2. `app.js`: batonState includes ALL non-done/cancelled tickets.

## Acceptance Criteria
- Baton shows only tickets with explicit `in-progress` or `review` status.
- GitHub issues without a `status:*` label default to `backlog`.
- At most 10 tickets visible in the baton at one time.

## Fix Locations
- `dashboard/js/github-sync.js` — change fallback to `backlog`
- `dashboard/js/app.js` — filter batonState to active-only statuses
