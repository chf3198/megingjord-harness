---
title: "Tailscale VPN Mesh"
type: entity
created: 2026-04-14
updated: 2026-04-14
tags: [fleet, network, service]
sources: []
related: ["[[penguin-1]]", "[[windows-laptop]]", "[[openclaw]]"]
status: draft
---

# Tailscale VPN Mesh

WireGuard-based mesh VPN connecting all fleet devices.

## Topology
```
penguin-1 ←──Tailscale──→ windows-laptop
    └────────Tailscale────────→ chromebook-2 (TBD)
```

## Configuration
- Each device gets a 100.x.x.x address
- MagicDNS: devices addressable by hostname
- ACLs: all fleet devices can reach each other
- Exit node: windows-laptop (optional)

## Use Cases
- [[penguin-1]] → [[openclaw]] API calls
- Remote SSH access between fleet machines
- Future: [[chromebook-2]] integration

See: [[hardware-evaluation]], [[network-platform-resources]]
