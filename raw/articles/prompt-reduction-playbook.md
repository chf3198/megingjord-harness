# Prompt Reduction Playbook

**Date**: 2026-04-13
**Status**: Active
**Applies to**: All repos in fleet
**Related**: [tiered-agent-architecture.md](tiered-agent-architecture.md)

## Core Principle

Only **user-sent messages** cost premium requests.
Tool calls, subagent spawns, and agent thinking are **free**.
Maximize work-per-prompt; minimize back-and-forth.

## Quick Reference

| Technique | Savings | Effort |
|---|---|---|
| Auto mode (UI picker) | 10% discount | None |
| 0× models for simple tasks | 100% free | Low |
| Batch tasks in one prompt | ~60% fewer prompts | Low |
| Custom instructions | ~30% fewer prompts | Medium |
| Memory persistence | ~40% across sessions | Low |
| Autopilot mode | Eliminates approval re-prompts | None |
| Subagent delegation | Free (tool call) | None |
| Reusable prompt files | Consistent quality per prompt | Medium |

## Settings Applied (settings.json)

```
summarizeAgentConversationHistory  → true   (auto-compact)
agent.thinkingTool                 → true   (free reasoning)
autopilot.enabled                  → true   (no approval prompts)
requestQueuing.defaultAction       → queue  (no interrupts)
suggestRelatedFilesFromGitHistory  → true   (auto-context)
codesearch.enabled                 → true   (auto-discovery)
agent.maxRequests                  → 999    (was already set)
copilotMemory.enabled              → true   (was already set)
```

## Prompting Techniques

**Comprehensive first prompts**: "Fix null check in handler.ts L42
causing TypeError" beats "Fix the bug" → 1 prompt vs 3.

**Batch tasks**: "Do X, Y, Z" = 1 prompt. Separately = 3 prompts.

**Memory persistence**: Carries context across sessions. Eliminates
"remind me about X" follow-ups.

**Front-load instructions**: `.github/copilot-instructions.md` and
`*.instructions.md` auto-inject context. Agent never asks basics.

**Reusable prompt files**: `.github/prompts/*.prompt.md` for
repeated tasks (deploy, review, onboard). One-click, zero-waste.

## Auto Mode Strategy

Auto model pool (all ≤1× with 10% discount):

| Model | Multiplier | Best For |
|---|---|---|
| GPT-4.1 | 0× | General coding |
| GPT-5.4 mini | 0.3× | Light tasks |
| Claude Haiku 4.5 | 0.3× | Fast analysis |
| Grok Code Fast 1 | 0.225× | Quick edits |
| Raptor mini | 0× | Simple tasks |
| Claude Sonnet 4.6 | 0.9× | Complex reasoning |
| GPT-5.3-Codex | 0.9× | Deep coding |
| GPT-5.4 | 0.9× | Multi-step tasks |

**Auto excludes >1× models** (Opus never selected by Auto).
Select "Auto" in model picker dropdown — no settings.json key.

## Agentic Best Practices (from Anthropic)

1. **Parallel tool calls**: Independent operations run together
2. **Subagent spawning**: Delegate research to subagents (free)
3. **Context compaction**: Auto-summarization extends sessions
4. **Persistence**: Save state to files/memory before compaction
5. **Commit early**: Avoid overthinking; pick approach, execute
6. **Minimize overengineering**: Only do what's directly asked

## Anti-Patterns to Avoid

- Retrying failed prompts verbatim (re-burns premium request)
- "Is this done?" follow-ups (look at output instead)
- Asking one question per prompt (batch them)
- Manual context specification (use instructions files instead)
- Restarting sessions (loses context → repeated setup prompts)

## Actionable Next Steps

- [x] Apply optimization settings to VS Code
- [ ] Select Auto mode in model picker (manual, one-time)
- [ ] Create `.github/prompts/` templates for common tasks
- [ ] Monitor premium request usage for 1 week baseline
- [ ] Test BYOK OpenClaw integration for fleet offloading
