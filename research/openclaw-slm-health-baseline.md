# OpenClaw + SLM Health Baseline Research
<!-- #344 — Part of Epic #343 -->

## 1. Reachability State (April 22 2026)

| Device | Tailscale IP | Port | Probe Result |
|---|---|---|---|
| windows-laptop | 100.78.22.13 | 11434 (Ollama) | ✅ HTTP 200 — 3 models returned |
| windows-laptop | 100.78.22.13 | 4000 (OpenClaw) | ❌ No response (ECONNREFUSED) |
| penguin-1 (SLM) | 100.86.248.35 | 11434 (Ollama) | ❌ Offline — last seen 1 day ago |

## 2. Protocols and Ports

| Service | Protocol | Port | Auth | Healthy Response |
|---|---|---|---|---|
| Ollama | HTTP REST | 11434 | None | `GET /api/tags` → 200 `{models:[...]}` |
| OpenClaw | HTTP REST | 4000 | None observed | `GET /health` → historically 200 |
| OpenClaw (alt) | HTTP REST | 4000 | None | `GET /health/liveliness` (fleet-health-log) |

## 3. Observed Failure Modes (from `.dashboard/fleet-health.jsonl`)

| Mode | Frequency | Root Cause |
|---|---|---|
| `TIMEOUT` — Ollama (SLM) | ~4x/day | CB-1 sleeps / network dropout |
| `TIMEOUT` — Ollama (Win) | ~1x/day | Windows idle sleep |
| `TIMEOUT` — OpenClaw | Correlates with Win TIMEOUT | OpenClaw co-hosted; same sleep |
| `resolvedIP: null` | Always on cold start | No `tailscaleIP` in devices.json |

## 4. Root Cause: IP Resolution Failure

`fleet-config.js` resolves device IPs via:
1. `process.env.FLEET_IP_<ID>` (not set in current `.env`)
2. `d.tailscaleIP` (missing from `inventory/devices.json`)

Result: `resolvedIP: null` for all remote devices → proxy returns 404 → dashboard
shows `error` for all fleet health panels. Fix: add `tailscaleIP` to inventory.

## 5. health-check.js Gap Analysis

| Gap | Impact |
|---|---|
| OpenClaw uses `/openclaw/health` path; server hits `${OPENCLAW}/health` (port 4000) | Correct path but port 4000 unresponsive |
| No 4-state enum (online/degraded/offline/unknown) | `degraded` only set if openclaw ok but ollama not — incomplete |
| No staleness tracking — browser polls but no age indicator | Panel shows stale status silently |
| fleet-health-log uses `/health/liveliness` vs health-check uses `/health` | Inconsistent endpoint, both fail |

## 6. Existing Observability

- ✅ `scripts/fleet-health-log.js` writes JSONL to `.dashboard/fleet-health.jsonl` (60s interval)
- ✅ Log captures offline/recovered events with timestamp and error code
- ❌ No latency recording (no `latency_ms` field)
- ❌ No model_id in log schema
- ❌ No dashboard UI consuming `/api/fleet-health` endpoint (endpoint exists, unused)
- ❌ Log path is `.dashboard/` not `logs/` (diverges from epic AC5)

## 7. Acceptance Criteria Status

- [x] AC1: All 8 questions answered with evidence
- [x] AC2: Endpoint manifest documented
- [x] AC3: 4 failure modes catalogued with root-cause analysis
- [x] AC4: Findings committed to research/ within 100-line limit
