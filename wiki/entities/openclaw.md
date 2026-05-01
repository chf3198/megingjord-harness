---
title: "OpenClaw Gateway"
type: entity
created: 2026-04-14
updated: 2026-05-01
tags: [fleet, service, inference]
sources: ["[[openclaw-windows-optimization-2026]]"]
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
- qwen2.5:7b-instruct — general instruction following; ~1–2 tok/s CPU
- qwen2.5-coder:7b — coding-tuned; ~1.3 tok/s CPU cold-start

**Removed**: mistral:latest, phi3:mini, llama3.2 (no longer installed)

## Performance Constraints
- Host: CPU-only (Intel i3-N305, 8 cores, ~6.3 GiB RAM, no GPU)
- Inference speed: 1–2 tok/s for 7B quantized models
- Use GPU nodes (36gbwinresource: 9+ tok/s) for latency-sensitive tasks
- OpenClaw is preferred for privacy-critical or offline-required workloads

## Current Operational Risk
- CPU-only inference limits throughput for interactive tasks
- Gateway health endpoint instability can make fleet lane unavailable
- See [[openclaw-windows-optimization-2026]] for hardening plan

## Failover Chain
1. OpenClaw (local fleet) — free, low latency
2. Groq (cloud free tier) — fast, rate limited
3. Cerebras (cloud free tier) — fast, limited models

See: [[free-tier-inventory]], [[tiered-agent-architecture]]
