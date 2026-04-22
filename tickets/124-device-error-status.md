# Ticket 124 — Devices section shows "error" status

**Status:** done
**Priority:** P1 — Misleading status information
**Role:** Collaborator
**Epic:** none

## Problem
SML Chromebook (penguin-1) and OpenClaw Host (windows-laptop) display
`error` status in the Devices section. The badge color is red. The word
"error" implies a bug rather than unreachability.

## Root Cause
`checkOllama` returns `{ status: 'error' }` when the HTTP response is
non-OK (e.g. proxy returned 502/503 because device is unreachable). This
is not a software error — it is a network/connectivity state.

## Acceptance Criteria
- Unreachable devices show `offline` status badge (not `error`).
- Device cards include a tooltip note explaining the offline reason.

## Fix Location
- `dashboard/js/health-check.js` — return `offline` not `error` on !r.ok
