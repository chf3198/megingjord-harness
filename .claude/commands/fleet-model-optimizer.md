---
description: "Claude Code adapter for the canonical fleet-model-optimizer skill."
argument-hint: "[mode: audit|recommend|transition] [inventory: inventory/devices.json]"
---

# Fleet Model Optimizer

Use the source skill at `skills/fleet-model-optimizer/SKILL.md`.

This command is a thin Claude Code adapter. Follow the canonical skill exactly:
analyze fleet inventory, recommend Ollama models by device capability, and
produce safe pull/delete/transition guidance without forking governance rules.

Signed-by: Quill Harper
Team&Model: codex:gpt-5.4@openai
Role: collaborator
