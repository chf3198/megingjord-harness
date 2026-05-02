---
title: "36GB Windows Resource"
type: entity
created: 2026-04-28
updated: 2026-05-01
tags: [fleet, device, inference, gpu]
sources: ["[[devenv-fleet-topology]]", "[[fleet-model-upgrades-implementation-2026-05-01]]"]
related: ["[[windows-laptop]]", "[[model-routing]]", "[[openclaw]]"]
status: draft
---

# 36GB Windows Resource

Primary GPU-backed fleet inference node for heavy local coding workloads.

## Specs
- CPU: Intel Core i5-9400H
- RAM: 32GB
- GPU: NVIDIA Quadro T2000 (4GB VRAM)
- OS: Windows 10 Pro
- Tailscale IP: 100.91.113.16

## Services
- Ollama on port 11434
- Models: starcoder2:3b, granite-code:3b, qwen2.5-coder:7b-instruct-q3_K_S, qwen2.5-coder:7b, qwen2.5-coder:32b

## Benchmarks (2026-05-01)
- Primary low-latency model: `starcoder2:3b` Q4_0 — 80.48 tok/s warm at `num_ctx=2048`
- Quality tier: `qwen2.5-coder:7b-instruct-q3_K_S` — 14.77 tok/s warm
- Registry check: `qwen3-coder:4b` unavailable in Ollama at rollout time

## Routing Role
- `tier`: performance
- `inferenceClass`: heavy-coding
- `priority`: 100
- Preferred for: implement, refactor, tests, batch, multi-file

## Operational Notes
- `OLLAMA_KEEP_ALIVE=24h` confirmed at machine scope
- Primary coding route now favors `starcoder2:3b` for 4GB VRAM throughput

See: [[model-routing]], [[devenv-fleet-topology]]