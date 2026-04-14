---
title: "DevEnv Fleet Topology"
date: 2026-04-14
source_url: inventory/devices.json
author: devenv-ops
tags: [fleet, tailscale, devices, infrastructure]
status: ingested
---

# DevEnv Fleet Topology

Three-device Tailscale mesh for development and inference.

## Devices

- **penguin** (100.87.216.75) — Primary Chromebook IDE host. 4-6.3GB RAM.
  Runs VS Code, Copilot agent, dashboard server. No local Ollama.
- **penguin-1** (100.86.248.35) — Secondary Chromebook. 2.7GB RAM.
  Runs Ollama with Phi-3.5 mini (tiny inference only).
- **windows-laptop** (100.78.22.13) — Dell XPS 13, 16GB RAM.
  Runs OpenClaw/LiteLLM gateway on port 4000, Ollama with
  mistral, phi3:mini, qwen2.5:7b-instruct.

## Routing

Fleet-lane tasks route to OpenClaw. Free-lane tasks use local
tools or free cloud APIs (Groq, Cerebras). Premium-lane tasks
escalate to Copilot Pro (Anthropic, OpenAI).

## Constraints

penguin (IDE host) has limited RAM. Inference offloaded to
windows-laptop via Tailscale VPN. Memory watchdog monitors
penguin for OOM conditions during heavy operations.
