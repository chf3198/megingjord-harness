---
title: "OpenClaw Gateway"
type: entity
created: 2026-04-14
updated: 2026-04-14
tags: [fleet, service, inference]
sources: []
related: ["[[windows-laptop]]", "[[penguin-1]]", "[[tiered-agent-architecture]]"]
status: draft
---

# OpenClaw Gateway

Self-hosted LLM inference gateway on [[windows-laptop]].

## Architecture
- Ollama backend: model serving (7B quantized)
- LiteLLM proxy: unified API, failover, rate limiting
- Exposed to [[tailscale-mesh]] network only

## Models Available
- mistral (7B) — primary coding model
- qwen2.5:7b — secondary coding model
- llama3.2 — general purpose

## Failover Chain
1. OpenClaw (local fleet) — free, low latency
2. Groq (cloud free tier) — fast, rate limited
3. Cerebras (cloud free tier) — fast, limited models

See: [[free-tier-inventory]], [[tiered-agent-architecture]]
