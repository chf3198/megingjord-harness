# OpenClaw + SLM Monitoring Architecture
<!-- #346 — Part of Epic #343 — Gates #348–#351 -->

## Component Diagram

```
[Tailscale peer check] ──► [fleet-config.js resolveFleet()]
                                     │
                          [fleet-health-log.js startMonitor()]
                          ┌──────────┤ 60s interval
                          │          │
                     [probe()]   [checkAll()]
                          │          │
                    HTTP GET    HTTP GET
                    /api/tags   /health
                          │          │
                    [logEntry()] writes to logs/fleet-health.jsonl
                          │
              [dashboard-server.js /api/fleet-health]
                          │
                  [Alpine fleetStats.health{}]
                          │
          ┌───────────────┼────────────────┐
    [Devices panel]  [Fleet Resources]  [Context Flow]
```

## Polling Strategy (DECISION)

| Parameter | Value | Rationale |
|---|---|---|
| Server background poll | 60s | Matches fleet-health-log existing interval |
| Browser panel poll | 30s | Keeps panels fresh without excess requests |
| Probe timeout (Ollama) | 5s | Existing default; adequate for LAN/Tailscale |
| Probe timeout (OpenClaw) | 8s | Higher variance; prevent premature timeout |
| Probe location | `fleet-health-log.js` (server-side) | Single source; avoids N browser clients polling |

## Keepalive Strategy (DECISION)

| Parameter | Value |
|---|---|
| Keepalive ping (Ollama) | `GET /api/tags` (lightweight, validates model list) |
| Keepalive ping (OpenClaw) | `GET /health` on port 4000 |
| Idle keepalive interval | 90s (when no active baton work in progress) |
| Circuit breaker open | 3 consecutive failures within 90s |
| Half-open probe | 120s after circuit open |

## Status Enum + Transition Table (DECISION)

| From | Event | To |
|---|---|---|
| `unknown` | First successful probe | `online` |
| `unknown` | First failed probe | `offline` |
| `online` | Probe returns 2xx, models present | `online` |
| `online` | Probe slow (>4s) or no models | `degraded` |
| `online` | Probe fails (timeout/ECONNREFUSED) | `offline` |
| `degraded` | Next probe succeeds normally | `online` |
| `degraded` | Probe fails | `offline` |
| `offline` | Probe succeeds | `online` |

## Telemetry Log (DECISION)

- **Storage**: `logs/fleet-health.jsonl` (append-only, move from `.dashboard/`)
- **Retention**: last 500 entries (existing MAX_ENTRIES)
- **Schema**: `{ts, device_id, endpoint, status, latency_ms, error, model_id}`
- **Served by**: `/api/fleet-health` (existing endpoint, currently unused by panels)

## Test Infrastructure (DECISION)

| Layer | File | Trigger |
|---|---|---|
| Unit | `tests/fleet-health.test.js` | `npm test` / CI |
| Integration | `scripts/health-check.js --ci` | On-demand, skips if offline |
| E2E | `tests/context-flow.spec.js` | Playwright, device status reflected |

## Acceptance Criteria Status

- [x] AC1: All 5 design decision areas covered
- [x] AC2: Status enum and transition rules are unambiguous
- [x] AC3: Component diagram shows complete data flow to every panel
- [x] AC4: Telemetry schema is concrete and implementation-ready
- [x] AC5: Architecture doc within 100-line limit
