# Ticket 135 — Remote Fleet View Workflow (Terminal/Browser/App)

Priority: P2 (Normal)
Type: Task
Area: infra
Status: done (`closed`)
Parent: #132
Depends on: #133 (must be completed first)

## Manager Scope

Objective:
- Provide a practical way to open and view live fleet indicator surfaces remotely.

Acceptance Criteria:
1. Document remote terminal attach workflow for each fleet device.
2. Define optional browser view path and when to use it.
3. Define app-based path as deferred/optional with trade-offs.
4. Security notes align with tailnet access controls.

## Remote View Workflow (Delivered)

Primary path (terminal-first):
1. Windows: interactive scheduled task opens visible PowerShell watcher.
2. Penguin: visible terminal watcher process displays live status.
3. Remote operator validates activity by watching local device terminal windows.

Optional path (deferred):
- Browser mirror remains optional due higher baseline resource overhead.

Security notes:
- Remote control paths are over tailnet.
- Health checks use low-cost endpoints where possible (`/health/liveliness`).
- No new externally exposed listener required for terminal workflow.

## UAT Workflow

1. Confirm both visible terminals are open.
2. Execute stress generator on one node at a time for clear attribution.
	- `bash scripts/global/fleet-live-indicator-stress.sh --duration=60 --interval=1 --model=<model> --host=http://127.0.0.1:11434 --node=<node>`
3. Verify both indicators react as expected (`idle -> active -> idle`).
4. Capture screenshot evidence and command logs for closeout.

## MANAGER_HANDOFF

- Scope accepted and routed to collaborator.

## COLLABORATOR_HANDOFF

- Workflow documented with terminal-first default and UAT sequence.
- Recommended transition: `in-progress -> testing`.

## ADMIN_HANDOFF

- Verified operational workflow aligns with low-resource and security constraints.
- Recommended transition: `testing -> review`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved.
- User UAT sign-off received on 2026-04-23.
- Keep browser/app paths deferred unless resource profile improves.
- Ticket closed.

## GitHub Evidence Block

- Issue reference/state: `#135` documented as `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent/Depends captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: terminal-first remote workflow + UAT sequence + security notes.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure: UAT stress protocol outputs + repo lint/test pass checks.