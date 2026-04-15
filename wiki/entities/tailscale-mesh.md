---
title: "Tailscale VPN Mesh"
type: entity
created: 2026-04-14
updated: 2026-04-15
tags: [fleet, network, service, operations]
sources: []
related: ["[[penguin-1]]", "[[windows-laptop]]", "[[openclaw]]"]
status: active
---

# Tailscale VPN Mesh

WireGuard-based mesh VPN connecting all fleet devices.

## Topology
```
chromebook-2 (100.115.92.2) ──→ penguin-1 (100.86.248.35)
         └────────────────────→ windows-laptop (100.78.22.13)
```

## Fleet Management Operations

### SSH Access
Agent uses `sshpass` + `OPENCLAW_DEVICE_PASSWORD` from `.env`:
```
sshpass -p "$OPENCLAW_DEVICE_PASSWORD" ssh admin@100.78.22.13
```
Credentials never hardcoded — sourced from gitignored `.env`.

### Health Monitoring
Dashboard server probes fleet every 60s via Tailscale IPs:
- Ollama: `GET http://<ip>:11434/api/tags`
- OpenClaw: `GET http://<ip>:4000/health`
- Failures logged to `.dashboard/fleet-health.jsonl`

### OpenClaw Control
- Runs as `LiteLLMServe` scheduled task (SYSTEM, ONSTART)
- Auto-starts on Windows login; survives user logoff
- Monitor: `tasklist /FI "IMAGENAME eq python*"`
- Port check: `netstat -aon | findstr :4000`

### Known Failure Modes
- Windows machine at login screen → Tailscale active but
  OpenClaw may timeout until user logs in
- Network transitions → brief connectivity gaps (5-15s)

## Configuration
- MagicDNS: devices addressable by hostname
- ACLs: all fleet devices can reach each other

See: [[hardware-evaluation]], [[network-platform-resources]]
