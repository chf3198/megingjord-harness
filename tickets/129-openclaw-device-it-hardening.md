# Ticket 129 — Device-side OpenClaw IT Hardening (Windows Host)

Priority: P1 (High)
Type: Task
Area: infra
Status: done (`closed`)
Parent: #128

## Manager Scope

Objective:
- Complete external IT hardening on `windows-laptop` so OpenClaw is reachable by fleet.

Acceptance Criteria:
1. OpenClaw process listens on fleet-reachable endpoint.
2. Port `4000` is active on tailnet interface.
3. `/health` check succeeds from dev host.

## Implementation Evidence

- Remote host confirmed via SSH: `DESKTOP-909A7KM`.
- Root cause found: gateway configured as loopback-only on `127.0.0.1:18789`.
- Device-side change applied:
  - Updated `%USERPROFILE%\\.openclaw\\openclaw.json` gateway settings:
    - `port: 4000`
    - `bind: tailnet`
    - `tailscale.mode: off`
  - Reinstalled/restarted gateway task: `openclaw gateway install --force --port 4000`.
- Validation:
  - `openclaw gateway status` shows listening on `100.78.22.13:4000`.
  - `curl http://100.78.22.13:4000/health` returns `{"ok":true,"status":"live"}`.
  - `openclaw-preflight --json` returns `ok: true`.

## COLLABORATOR_HANDOFF

- Device-side hardening complete with ACs met.
- Ready for admin verification and consultant closeout.

## ADMIN_HANDOFF

- Verified endpoint is now fleet-reachable and health checks pass.
- Recommended transition: `testing -> review -> done`.

## CONSULTANT_CLOSEOUT

Decision:
- Approved. External IT lane completed.
- Remaining risk is harness coupling (`openclaw-chat` URL resolution), tracked in #130.

## GitHub Evidence Block

- Issue reference/state: `#129` documented as `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: remote endpoint binding hardening + `/health` + preflight success evidence.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure: `openclaw gateway status`, `curl .../health`, and preflight outputs recorded in ticket evidence.