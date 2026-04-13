# Tiered Architecture — Research Findings

**Date**: 2026-04-13
**Parent**: [tiered-agent-architecture.md](tiered-agent-architecture.md)

## 1. Copilot Auto Model Selection

- Available since VS Code 1.104
- Chooses between Sonnet 4, GPT-5, GPT-5 mini automatically
- 10% multiplier discount on paid plans (Sonnet 4 → 0.9×)
- Falls back to 0× models when premium requests deplete
- BYOK: add Ollama as built-in provider in model picker
- Local models still require Copilot service (must be online)
- Models need tool-calling support for agent mode

## 2. Premium Request Accounting

Only user prompts count — autonomous tool calls are FREE.

| Multiplier | Models |
|---|---|
| 0× (free) | GPT-5 mini, GPT-4.1, GPT-4o, Raptor mini |
| 0.25–0.33× | Grok Code Fast, Haiku 4.5, Gemini Flash |
| 1× | Sonnet 4/4.5/4.6, GPT-5.x, Gemini 2.5 Pro |
| 3× | Opus 4.5, Opus 4.6 |
| 30× | Opus 4.6 fast mode |

Budget: 300 premium requests/month ($10/month Pro plan).
Cloud agents: 1 request per SESSION × multiplier.

## 3. Ticket Complexity → Tier (Cynefin)

| Domain | Signal | Tier |
|---|---|---|
| Clear | Boilerplate, renames | SML or 0× |
| Complicated | Multi-file, known patterns | Fleet 7B |
| Complex | Architecture, unknowns | Pro 1× |
| Chaotic | Emergency, production down | Pro 3× |

## 4. Sub-7B Coding Benchmarks

| Model | Size | HumanEval | MBPP |
|---|---|---|---|
| Phi-3-mini | 3.8B | 57.3 | 69.8 |
| Qwen2.5-Coder-7B | 7B | ~65* | — |
| Mistral-7B | 7B | 34.1 | 51.5 |
| GPT-3.5 (reference) | Cloud | 62.2 | 77.8 |

*Estimated. Phi-3 Python-heavy. Qwen2.5 supports 92 languages.

## 5. Sub-1B Model Capabilities

| Model | Size | Can do | Cannot do |
|---|---|---|---|
| qwen3.5:0.8b | 0.8B | Classify, route, extract | Code gen |
| gemma3:270m | 270M | Simple classification | Most tasks |
| lfm2.5-thinking:1.2b | 1.2B | Reasoning triage | Reliable code |

Verdict: Oracle/router tier only, not coder tier.

## 6. Multi-Agent Patterns (CrewAI + LangGraph)

**CrewAI**: Hierarchical process — `manager_llm` delegates to
per-agent LLMs, validates outcomes, synthesizes.

**LangGraph**: Five patterns — prompt chaining, parallelization,
routing, orchestrator-worker, evaluator-optimizer.

Our baton maps to **orchestrator-worker + evaluator-optimizer**:
Manager=orchestrator, Collaborator=worker, Consultant=evaluator.

## 7. LiteLLM Routing

- Tag-based: `tags: ["free"]` / `tags: ["paid"]`
- Deployment ordering: `order: 1` primary → `order: 2` fallback
- Weighted: `weight: 2` picks 2× more often
- Cooldowns: auto on 429/auth, configurable duration
- Strategies: shuffle, latency, cost-based, least-busy

## 8. Remote LLM Repo Access

**Core pattern**: LLM ↔ tool-call loop. LLM returns structured
`tool_call` (name + args). HOST executes tool, returns result.
LLM never touches files — the client app does everything.

**Two paths for our fleet**:
1. BYOK: Add OpenClaw to VS Code → VS Code handles tools
2. Script: Build agentic loop (prompt→tool_call→execute→repeat)

Source: OpenAI function calling docs, Anthropic tool use docs.
