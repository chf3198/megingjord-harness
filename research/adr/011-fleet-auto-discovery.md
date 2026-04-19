# ADR-011: Fleet Auto-Discovery Architecture

**Status**: Accepted
**Date**: 2026-04-19

## Context

The harness must scale from zero devices (solo developer) to enterprise-level
fleets without code changes. Current fleet-config.js uses a static inventory
file with optional Tailscale overlay. This works but requires manual inventory
maintenance and doesn't support dynamic environments.

## Decision

Adopt a pluggable discovery backend architecture with three tiers:

### Tier 1: Static Inventory (always available)
- `inventory/devices.json` as baseline — works with zero network
- Manual configuration for air-gapped or minimal environments
- Graceful degradation: harness runs fully in solo mode

### Tier 2: Network Discovery (auto-detected)
- **Tailscale**: `tailscale status --json` for VPN-connected peers
- **mDNS/Avahi**: `avahi-browse` for local network devices
- **ENV overrides**: `FLEET_IP_<DEVICE>` for manual IP injection

### Tier 3: Registry Discovery (enterprise)
- Optional HTTP registry endpoint (`FLEET_REGISTRY_URL`)
- Periodic polling with configurable interval
- JWT or API key authentication

### Discovery Pipeline
```
Static Inventory → Network Overlay → Registry Merge → Resolved Fleet
```

Each backend is a function returning `{ id, ip, status }[]`.
Backends run in order; later results override earlier ones.
Missing backends are silently skipped (no hard dependencies).

### Scaling Properties
| Fleet Size | Mode | Discovery |
|------------|------|-----------|
| 0 | Solo | Static only, local execution |
| 1-5 | Small | Static + Tailscale |
| 5-20 | Medium | Static + Tailscale + mDNS |
| 20+ | Enterprise | All + Registry |

## Consequences

- `fleet-config.js` gains a `backends` array (pluggable)
- Solo mode requires zero configuration (existing behavior preserved)
- New backends can be added without modifying core discovery logic
- Registry backend is optional — no enterprise dependency for small fleets
