---
title: "DevEnv Fleet Topology"
date: 2026-04-14
source_url: inventory/devices.json
author: devenv-ops
tags: [fleet, tailscale, devices, infrastructure]
status: ingested
---

# DevEnv Fleet Topology

Four-device Tailscale mesh for development and inference.

## Devices

- **penguin** (100.87.216.75) — Primary Chromebook IDE host. 4-6.3GB RAM.
  Runs VS Code, Copilot agent, dashboard server. No local Ollama.
- **penguin-1** (100.86.248.35) — Secondary Chromebook. 2.7GB RAM.
  Runs Ollama with Phi-3.5 mini (tiny inference only).
- **windows-laptop** (100.78.22.13) — 16GB RAM fallback inference +
  OpenClaw host on port 4000.
- **36gbwinresource** (100.91.113.16) — 32GB RAM + Quadro T2000 4GB.
  Runs Ollama on 11434 with qwen2.5:7b-instruct and qwen2.5-coder:7b.
- **chromebook-2** (local dev host) — VS Code + Copilot workstation.

## Routing

Fleet-lane tasks are selected by capability tags in `devices.json`:
36gbwinresource (priority 100) → windows-laptop (40) → penguin-1 (10).
Free-lane tasks use local tools or free cloud APIs.
Premium-lane tasks escalate to Copilot Pro.

## Constraints

Small Chromebook nodes are RAM-constrained; heavy inference is offloaded to
36gbwinresource. Memory watchdog still protects low-memory environments.
