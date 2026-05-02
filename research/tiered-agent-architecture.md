# Tiered Agent Architecture

**Status**: Proposed
**Date**: 2026-04-13
**Research**: [tiered-research-findings.md](tiered-research-findings.md)
**Depends on**: [workflow-design.md](workflow-design.md)

## Purpose

Cost-optimized multi-tier architecture using the full fleet
(SML, OpenClaw, Copilot Pro) to minimize premium request burn.

## Fleet

| Tier | Host | Models | Role |
|---|---|---|---|
| SML | penguin-1 | qwen3.5:0.8b, lfm2.5:1.2b | Oracle/Router |
| Mid | windows-laptop (OpenClaw) | qwen2.5:7b, phi3:mini | Junior Coder |
| Pro | Copilot Pro | Auto, GPT-5 mini, Sonnet 4 | Executive |

## Three-Cascade Cost Model

```
User prompt → VS Code Copilot
    │
    ▼
 PHASE 1: FREE (0× models)
 GPT-5 mini, GPT-4.1, GPT-4o
 Handles: Q&A, boilerplate, renames
    │ exceeds capability?
    ▼
 PHASE 2: FLEET ($0, our compute)
 OpenClaw via BYOK: qwen2.5:7b, phi3:mini
 Handles: multi-file edits, known patterns
    │ exceeds capability?
    ▼
 PHASE 3: PREMIUM (1×–3×)
 Auto selects Sonnet 4 (0.9×) or Opus
 Handles: architecture, complex refactors
```

## Role-to-Tier Mapping

| Baton Role | Primary Tier | Why |
|---|---|---|
| Manager | Pro (0×/1×) | Needs strong reasoning for scope |
| Collaborator | Fleet (7B) | Most code is known-pattern work |
| Admin | Pro (0×) | Git ops need tool-calling support |
| Consultant | Pro (0×/1×) | Needs broad reasoning for critique |

## SML Oracle Role (Not Coder)

Sub-1B models cannot code reliably. They serve as:
- **Complexity classifier**: Cynefin scoring (Clear→Chaotic)
- **Routing oracle**: Suggest tier for incoming tasks
- **Field extractor**: Parse ticket metadata from text
- **Template selector**: Choose boilerplate by type

## Key Research Insights

1. **Only user prompts cost** — tool calls are FREE
2. **0× models are unlimited**: GPT-5 mini, GPT-4.1, GPT-4o
3. **Auto mode gives 10% discount** on paid models
4. **Phi-3-mini (3.8B) ≈ 92% of GPT-3.5** on HumanEval
5. **BYOK** lets us add OpenClaw to VS Code model picker
6. **LLMs never touch files** — host app executes all tools
7. **LiteLLM tag routing** can separate free/paid tiers

## Implementation Phases

| Phase | Action | When |
|---|---|---|
| 1 | Add OpenClaw as BYOK Ollama in VS Code | Now |
| 2 | Switch to Auto mode, monitor usage weekly | Now |
| 3 | Build SML oracle HTTP API on penguin-1 | Future |
| 4 | Build agentic loop script for OpenClaw | Future |

## Open Questions

1. Do Ollama models support tool calling for agent mode?
2. Can BYOK models participate in Auto selection?
3. Tailscale→OpenClaw latency for multi-tool-call loops?
4. Agentic loop: VS Code extension or standalone CLI?

## Actionable Next Steps

- [x] Apply prompt-reduction settings to VS Code
- [x] Document playbook: [prompt-reduction-playbook.md]
- [ ] Select Auto mode in model picker (manual)
- [ ] Test OpenClaw BYOK integration in VS Code
- [ ] Benchmark Tailscale→OpenClaw tool-call latency
- [ ] Prototype SML classifier with lfm2.5-thinking
- [x] ADR-015 documents this architecture decision (originally ADR-004; renumbered 2026-05-02 in Phase 3 of #795)
