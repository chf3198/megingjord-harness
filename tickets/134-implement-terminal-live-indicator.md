# Ticket 134 — Implement Terminal-first Fleet Live Indicator

Priority: P1 (High)
Type: Task
Area: scripts
Status: done (`closed`)
Parent: #132
Depends on: #133 (must be completed first)

## Manager Scope

Objective:
- Implement a terminal-based live usage indicator with extremely low resource cost.

Acceptance Criteria:
1. Indicator displays model activity (`idle` vs `active`) and basic health.
2. Polling is bounded (default 3–5s) and low overhead.
3. Works on `windows-laptop` and `penguin-1`.
4. Includes auto-start/attach guidance for persistent terminal view.

Constraints:
- Prefer shell/python script, avoid heavyweight dependencies.
- Preserve model capacity (do not run expensive probes continuously).
- Do not begin implementation until #133 outputs are accepted.
- Implementation must reference research deliverable decisions.

## Implementation Summary

Delivered:
1. `scripts/global/fleet-live-indicator.js`
	- Low-overhead polling (default 3s) for Ollama activity + optional OpenClaw liveliness.
	- Added `--mode=single` to render in-place terminal updates (prevents unbounded scroll growth).
2. Device watchers:
	- Windows visible PowerShell watcher refreshed to redraw screen every 3 seconds.
	- Penguin watcher runs as terminal loop process with in-place updates.
3. UAT stress harness:
	- Added `scripts/global/fleet-live-indicator-stress.js`.
	- Added `scripts/global/fleet-live-indicator-stress.sh` (curl/bash, no Node dependency).
	- Generates bounded inference traffic against Ollama for terminal verification.

## UAT Stress Test Protocol

Goal:
- Let operator visually confirm remote terminal indicators respond under load.

Windows (OpenClaw host) and Penguin (Ollama):
1. Keep visible terminal indicators open.
2. Run stress for 60s on target node:
	- Preferred: `bash scripts/global/fleet-live-indicator-stress.sh --duration=60 --interval=1 --model=<model> --host=http://127.0.0.1:11434 --node=<node>`
	- Optional Node variant: `node scripts/global/fleet-live-indicator-stress.js --duration=60 --interval=1 --model=<model> --host=http://127.0.0.1:11434 --node=<node>`
3. Expected:
	- Indicator shows `state=active` during stress.
	- `until=` refreshes as keep-alive extends.
	- No unbounded line growth in terminal.

Pass Criteria:
- Stress script exits 0.
- Indicator remains responsive and readable.
- No service crash (`ollama` and watcher continue running).

## MANAGER_HANDOFF

- Scope accepted and implemented.

## COLLABORATOR_HANDOFF

- Acceptance criteria implemented and validated locally/remotely.
- Stress harness added for UAT visual verification.
- Recommended transition: `in-progress -> testing`.

## ADMIN_HANDOFF

- Operational checks passed for live watcher + stress script behavior.
- Recommended transition: `testing -> review`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved.
- User UAT sign-off received on 2026-04-23.
- Ticket closed.

## GitHub Evidence Block

- Issue reference/state: `#134` documented as `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent/Depends captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: indicator implementation + stress harness + UAT protocol + sign-off.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure: stress script protocol outputs and subsequent repo lint/test passes.