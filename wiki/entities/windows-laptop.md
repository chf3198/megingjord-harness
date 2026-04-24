---
title: "Windows Laptop (OpenClaw Host)"
type: entity
created: 2026-04-14
updated: 2026-04-23
tags: [fleet, device, openclaw]
sources: ["[[openclaw-windows-optimization-2026]]"]
related: ["[[penguin-1]]", "[[openclaw]]", "[[tailscale-mesh]]"]
status: draft
---

# Windows Laptop (OpenClaw Host)

Secondary fleet machine hosting [[openclaw]] gateway.

## Specs
- CPU: AMD (16 GB RAM)
- GPU: Integrated (sufficient for 7B quantized)
- OS: Windows 11 + WSL2

## Role in Fleet
- Hosts [[openclaw]] API gateway and local Ollama runtime
- Serves 7B models: mistral, qwen2.5:7b, llama3.2
- Reachable from [[penguin-1]] via [[tailscale-mesh]]

## Services
- Ollama on port 11434
- OpenClaw gateway on port 4000 (tailnet bind)
- Tailscale IP (current): 100.78.22.13

## Operational Notes
- 2026-04-23 hardening moved gateway from loopback-only `127.0.0.1:18789`
	to tailnet-reachable `100.78.22.13:4000`.
- Fleet preflight now succeeds against `/health` at port 4000.

See: [[hardware-evaluation]], [[free-tier-inventory]]
