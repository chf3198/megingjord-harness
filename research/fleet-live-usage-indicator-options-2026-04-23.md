# Fleet Live Usage Indicator Options — 2026-04-23

Date: 2026-04-23

## Summary Table

| Topic | Finding | Recommendation |
|---|---|---|
| Are fleet models always running? | No. `ollama ps` on both fleet devices shows no loaded model. | Treat model runtime as on-demand; indicator must detect active vs idle. |
| Lowest-overhead indicator | Terminal TUI/status line polling local endpoints every 3–5s. | Build terminal-first indicator as primary. |
| Remote visibility pattern | Keep indicator running in persistent terminal session, attach remotely via tailnet SSH. | Use always-on terminal pane as first deployment path. |
| Browser/app option | Web UI is possible but costs more CPU/RAM than terminal polling. | Make browser view optional, not default on constrained nodes. |

## Current State Validation

- `windows-laptop`: `ollama ps` returned empty model list (service up, no model loaded).
- `penguin-1`: `ollama ps` returned empty model list (service up, no model loaded).
- OpenClaw endpoint now reachable at `http://100.78.22.13:4000/health`.
- Keep-warm test validated:
  - Windows: `phi3:mini` stayed loaded with `keep_alive="10m"` (visible in `ollama ps`).
  - Penguin-1: `tinyllama:latest` stayed loaded with `keep_alive="5m"` (visible in `ollama ps`).

Conclusion: model serving is available but not continuously loaded. Runtime activity is bursty and should be measured live.

## Should Models Stay Loaded All the Time?

- Not by default on constrained devices.
- Keeping large models permanently loaded reduces free RAM and can hurt concurrent tasks.
- Better pattern: bounded warm pool (`keep_alive` windows) during active work sessions.

Recommended warm profile:
- `penguin-1`: 3–5 minutes for tiny models.
- `windows-laptop`: 10–20 minutes for 7B-class models.
- Idle/off-hours: allow unload to reclaim memory.

## Can Terminal or OpenClaw Dashboard Show Activity?

- Yes, terminal can show activity with very low overhead:
  - `ollama ps` exposes loaded models + expiry (`UNTIL`).
  - OpenClaw log tail exposes gateway events and request lifecycle signals.
- OpenClaw web surface can show gateway state, but a browser should be optional
  on resource-constrained nodes due extra memory overhead.

## Remote "Visible-on-Screen" Terminal Feasibility

- Windows-laptop:
  - Interactive desktop session exists (Explorer/WindowsTerminal in Session 2).
  - Remote SSH/PowerShell execution runs in Session 0.
  - Direct `Start-Process wt.exe` from remote Session 0 returned Access Denied.
  - Implication: visible windows must be launched by an interactive-session startup/task, not direct remote service context.

- penguin-1:
  - GUI session is present (`DISPLAY=:0`), but no terminal emulator currently installed.
  - Implication: visible terminal-on-screen requires installing a lightweight emulator (for example `xterm`) or using another existing UI surface.

## Candidate Solutions

### Option A — Persistent Terminal Indicator (Preferred)

- Run a tiny script locally on each fleet device.
- Poll:
  - Ollama loaded models (`/api/ps` or `ollama ps`)
  - OpenClaw health (`/health/liveliness` + `/health`)
  - Lightweight host stats (CPU%, RAM free, active PID)
- Render one compact line/block in terminal (text + ANSI color).
- Keep running in `tmux`/`screen`; remote attach to view.

Expected resource profile: very low (single process, low-frequency polling).

### Option B — Lightweight Local Web Status Page

- Script writes tiny JSON + static HTML page.
- Open a browser tab on the fleet device for visual status.
- Better readability, but higher baseline memory footprint.

Expected resource profile: low to moderate (browser cost dominates).

### Option C — Native/Desktop Indicator App

- Tray or GUI app with status lights.
- Best UX, worst implementation and maintenance overhead.

Expected resource profile: moderate; platform-specific complexity.

## Sources

- Ollama API docs: https://docs.ollama.com/api
- LiteLLM health endpoints: https://docs.litellm.ai/docs/proxy/health
- Tailscale SSH operational model: https://tailscale.com/kb/1193/tailscale-ssh

## Actionable Next Steps

1. Implement Option A prototype on both fleet devices.
2. Add remote attach workflow doc (`ssh` + `tmux attach`).
3. Add optional browser mirror only if needed after measuring overhead.
4. Capture CPU/RAM overhead metrics at idle and active inference.
5. Promote findings into wiki source/entity/concept pages after validation.

Last updated: 2026-04-23