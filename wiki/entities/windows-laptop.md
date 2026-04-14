---
title: "Windows Laptop (OpenClaw Host)"
type: entity
created: 2026-04-14
updated: 2026-04-14
tags: [fleet, device, openclaw]
sources: []
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
- Hosts [[openclaw]] API gateway (Ollama + LiteLLM)
- Serves 7B models: mistral, qwen2.5:7b, llama3.2
- Reachable from [[penguin-1]] via [[tailscale-mesh]]

## Services
- Ollama on port 11434
- LiteLLM proxy on port 4000
- Tailscale IP: 100.x.x.x (mesh-internal)

See: [[hardware-evaluation]], [[free-tier-inventory]]
