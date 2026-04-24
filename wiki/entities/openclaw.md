---
title: "OpenClaw Gateway"
type: entity
created: 2026-04-14
updated: 2026-04-23
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

## Models Available
- mistral (7B) — primary coding model
- qwen2.5:7b — secondary coding model
- llama3.2 — general purpose

## Current Operational Risk
- Gateway health endpoint instability can make fleet lane unavailable
- Reliability depends on aligned health checks and fallback behavior
- See [[openclaw-windows-optimization-2026]] for hardening plan

## Failover Chain
1. OpenClaw (local fleet) — free, low latency
2. Groq (cloud free tier) — fast, rate limited
3. Cerebras (cloud free tier) — fast, limited models

See: [[free-tier-inventory]], [[tiered-agent-architecture]]
