---
title: "Penguin-1 (SML Chromebook)"
type: entity
created: 2026-04-14
updated: 2026-04-14
tags: [fleet, device, chromebook]
sources: []
related: ["[[windows-laptop]]", "[[tailscale-mesh]]", "[[openclaw]]"]
status: draft
---

# Penguin-1 (SML Chromebook)

Primary development machine. Lenovo Chromebook with Linux (Crostini).

## Specs
- CPU: Intel Celeron N4020 (2C/2T)
- RAM: 2.7 GB usable (shared with ChromeOS)
- Storage: 64 GB eMMC
- OS: ChromeOS + Crostini Linux container

## Role in Fleet
- Runs VS Code + Copilot Pro (primary coding interface)
- Ollama: tiny models only (tinyllama, phi-2)
- Connected to [[windows-laptop]] via [[tailscale-mesh]]
- Uses [[openclaw]] for 7B+ inference offloading

## Constraints
- Memory pressure requires [[hardware-evaluation]] vigilance
- No Docker (Crostini limitation)
- Browser tabs compete for RAM with dev tools

See: [[hardware-evaluation]], [[tiered-agent-architecture]]
