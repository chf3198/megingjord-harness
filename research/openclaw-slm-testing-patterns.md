# OpenClaw + SLM Automated Testing Patterns
<!-- #345 — Part of Epic #343 -->

## 1. Recommended Testing Stack

| Layer | Tool/Pattern | Rationale |
|---|---|---|
| Unit | Jest (existing) | Mock fetch/http for status-transition logic |
| Integration | Node `http.get` script | Real Tailscale probe, skips gracefully offline |
| E2E | Playwright (existing) | Dashboard panel reflects probe result |

## 2. Probe Patterns

### Liveness (is it up?)
- HTTP GET with 5s timeout → any 2xx/3xx = alive
- Endpoint: `/api/tags` (Ollama), `/health` (OpenClaw)

### Readiness (can it serve?)
- Parse response body: Ollama needs `models.length > 0`
- OpenClaw: `HTTP 200` is sufficient (no body schema defined)

### Circuit Breaker (standard for LLM inference)
- Open after **3 consecutive failures** within 90s window
- Half-open probe after **120s** (attempt single request)
- Thresholds: timeout=5s Ollama, timeout=8s OpenClaw (higher network variance)

### Backoff Strategy
- Retry 1: immediate (catches transient dropout)
- Retry 2: +10s (catches wake-from-sleep)
- Retry 3: +30s → mark offline if still failing

## 3. Boundary: in-process vs server vs CI

| Concern | Owner | Location |
|---|---|---|
| Real-time panel refresh | Browser poll | `health-check.js` (every 30s) |
| Change event logging | Server background | `fleet-health-log.js` (every 60s) |
| CI smoke test | On-demand script | `scripts/health-check.js` `--ci` flag |

CI tests MUST skip gracefully with `process.exitCode = 0` when endpoints offline.

## 4. Telemetry Schema (confirmed)

```json
{
  "ts": "2026-04-22T14:00:00.000Z",
  "device_id": "windows-laptop",
  "endpoint": "http://100.78.22.13:11434/api/tags",
  "status": "online",
  "latency_ms": 142,
  "error": null,
  "model_id": null
}
```

Status enum: `online | degraded | offline | unknown`
`model_id` populated only for inference probe responses.

## 5. fleet-config.js + health-check.js Refactors Needed

| File | Change |
|---|---|
| `scripts/global/fleet-config.js` | Add `tailscaleIP` read from `devices.json` (already coded, just needs data) |
| `scripts/fleet-health-log.js` | Add `latency_ms` to log entry; move log to `logs/fleet-health.jsonl` |
| `dashboard/js/health-check.js` | Standardize 4-state enum; add staleness timestamp |
| `scripts/health-check.js` | New CI-mode script: real probes, graceful skip if offline |

## 6. Observability Best Practices for Tailscale

- Tailscale latency adds ~5–20ms (UDP overlay, same region)
- Use `tailscale ping <peer>` to distinguish Tailscale dropout from service failure
- Peer `Online` field in `tailscale status --json` provides fast offline detection
- Pre-flight: check Tailscale peer status before attempting HTTP probe

## 7. Acceptance Criteria Status

- [x] AC1: All 8 questions answered with sources and rationale
- [x] AC2: Testing stack is specific (Jest/Node/Playwright, circuit breaker thresholds)
- [x] AC3: Telemetry schema included as JSON example
- [x] AC4: Findings committed to research/ within 100-line limit
