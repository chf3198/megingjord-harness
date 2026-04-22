# Dashboard Health Reporting Contract
<!-- #347 — Part of Epic #343 — Gates #350 -->

## Canonical State Store (DECISION)

**Chosen**: Alpine `$store` / root-level `fleetStats.health` object.

- `fleetStats.health = { [deviceId]: { status, latency_ms, ts, models } }`
- Populated by `/api/fleet-health` poll in `app.js` every 30s
- Single source of truth — all panels read `fleetStats.health[id].status`

## Panel Contract Table

| Panel | File | Status Values Used | Staleness Behavior | Unknown State |
|---|---|---|---|---|
| Devices | `devices.js` | online/degraded/offline/unknown | Grey badge after 90s no refresh | Show `unknown` badge |
| Fleet Resources | `settings-panel.js` | online/offline/unknown | Dot turns grey after 90s | Grey dot, no tooltip |
| Context Flow | `context-flow.js` | `isActive` bool (not per-device) | Node dims at 50% opacity | Nodes render at 50% |
| Agent Baton | `baton-flow.js` | Resource name (tooltip) | N/A (ticket #329) | No tooltip shown |

## 4-State Badge Spec (CSS)

```css
.health-badge { border-radius:4px; padding:0 0.25rem; font-size:0.6rem; font-weight:700; }
.health-badge.online  { background:#1a4a1a; color:#4caf50; border:1px solid #4caf50; }
.health-badge.degraded{ background:#3a2e00; color:#ffc107; border:1px solid #ffc107; }
.health-badge.offline { background:#4a1a1a; color:#f44336; border:1px solid #f44336; }
.health-badge.unknown { background:#2a2a2a; color:#888;    border:1px solid #555;    }
```

## Staleness Rule

- Panel marks data stale when `Date.now() - ts > 90000` (90s)
- Stale: badge/dot gains `.stale` class → opacity 0.55
- Recovery: next successful `/api/fleet-health` poll removes `.stale`

## Error State Per Panel

| Panel | Error Text | Retry Button | Last-Seen Timestamp |
|---|---|---|---|
| Devices | `"offline"` badge | No (auto-retries via poll) | Shown as `"last seen Xm ago"` |
| Fleet Resources | Grey dot, no text | No | Not displayed |
| Context Flow | Node dims, animation pauses | No | Not displayed |

## Refresh Coordination (DECISION)

- **Single scheduler** in `app.js` polls `/api/fleet-health` every 30s
- **No per-panel polling** — panels are reactive to Alpine state change
- Max acceptable staleness: **90s** (30s poll + 60s server monitor interval)

## Acceptance Criteria Status

- [x] AC1: All 4 panels have explicit display contracts
- [x] AC2: Single canonical state store chosen and justified
- [x] AC3: 4-state badge CSS spec is concrete
- [x] AC4: Staleness and unknown-state behavior defined for each panel
- [x] AC5: Design doc within 100-line limit
