---
title: "OpenClaw Gateway"
type: entity
created: 2026-04-14
updated: 2026-05-01
tags: [fleet, service, inference]
sources: ["[[openclaw-windows-optimization-2026]]", "[[fleet-model-upgrades-implementation-2026-05-01]]"]
related: ["[[windows-laptop]]", "[[penguin-1]]", "[[model-routing]]", "[[tiered-agent-architecture]]"]
status: draft
---

# OpenClaw Gateway

Self-hosted fleet routing gateway on [[windows-laptop]].

## Architecture
- LiteLLM/OpenClaw proxy: single OpenAI-compatible endpoint
- Ollama backends: local model serving across fleet devices
- Fleet integration: target for `fleet` lane dispatch in task-router
- Network scope: exposed to [[tailscale-mesh]] only

## What It Provides to DevEnv Ops
- Fleet-lane execution endpoint abstraction
- Centralized model selection and fallback policy
- Uniform request/response surface for tooling scripts
- Operational choke-point for reliability telemetry

## Models Available (live as of 2026-05-01)
- `qwen2.5-coder-1.5b` — primary low-latency coding route; 8.36 tok/s warm
- `starcoder2-3b` — fast fallback for short edits; 4.12 tok/s warm
- `qwen2.5-coder-7b` — quality fallback when latency is secondary

Legacy aliases `mistral` and `phi3-mini` were removed from the repo config because those models are no longer installed.

## Performance Constraints
- Host: CPU-only Intel i7-10510U, 16GB RAM, no GPU
- 7B models regressed below target; 1.5B now serves as the primary coding lane
- Use [[36gbwinresource]] for latency-sensitive multi-file generation
- OpenClaw remains the preferred privacy-preserving gateway surface

## Current Operational State
- LiteLLM gateway healthy on port 4000
- `OLLAMA_KEEP_ALIVE=24h` confirmed at machine scope
- Repo config now aligns gateway aliases with installed models

## Failover Chain
1. OpenClaw (local fleet) — free, private, bounded by CPU throughput
2. Groq (cloud free tier) — fast, rate limited
3. Cerebras (cloud free tier) — fast, limited models

See: [[free-tier-inventory]], [[tiered-agent-architecture]]
