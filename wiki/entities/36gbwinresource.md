---
title: "36GB Windows Resource"
type: entity
created: 2026-04-28
updated: 2026-04-28
tags: [fleet, device, inference, gpu]
sources: ["[[devenv-fleet-topology]]"]
related: ["[[windows-laptop]]", "[[model-routing]]", "[[openclaw]]"]
status: draft
---

# 36GB Windows Resource

Primary fleet inference node for heavy local coding workloads.

## Specs
- CPU: Intel Core i5-9400H
- RAM: 32GB
- GPU: NVIDIA Quadro T2000 (4GB VRAM)
- OS: Windows 10 Pro
- Tailscale IP: 100.91.113.16

## Services
- Ollama on port 11434
- Models: qwen2.5:7b-instruct, qwen2.5-coder:7b

## Routing Role
- `tier`: performance
- `inferenceClass`: heavy-coding
- `priority`: 100
- Preferred for: implement, refactor, tests, batch, multi-file

See: [[model-routing]], [[devenv-fleet-topology]]