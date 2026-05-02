# ADR-015: Model Routing via Custom Agents

**Status**: Accepted
**Date**: 2025-07-13
**Renumbered**: 2026-05-02 — was ADR-004 (duplicate of `004-global-task-router.md`); renumbered to 015 in Phase 3 of #795 to resolve the duplicate while preserving git history via `git mv`.

## Context

VS Code Copilot's AUTO model selector picks from a pool
(Sonnet 4, GPT-5, GPT-5 mini) based on system health —
not task complexity. It excludes Opus-class models entirely.
We need deterministic model routing that matches model cost
and capability to task requirements.

## Decision

Override AUTO with a tiered custom-agent system:

| Tier | Agent | Model | Use Case |
|------|-------|-------|----------|
| Deep | architect | Opus 4.6 | Architecture, security, multi-system |
| Plan | planner | Opus 4.6 | Research, read-only planning |
| Standard | implementer | Sonnet 4.6 | Features, bugs, tests, docs |
| Fast | quick | GPT-5 mini | Lookups, one-liners, explanations |
| Route | router | Sonnet 4.6 | Classify complexity, hand off |
| Audit | governance-auditor | Sonnet 4.6 | Post-merge governance |
| Release | release-reviewer | Sonnet 4.6 | Pre-release integrity |
| Security | security-scanner | Sonnet 4.6 | Credential exposure scan |

Additionally, VS Code settings pin built-in workflows:
- `chat.planAgent.defaultModel` → Opus 4.6
- `github.copilot.chat.implementAgent.model` → Sonnet 4.6
- `inlineChat.defaultModel` → Sonnet 4.6

## Mechanism

The `model` field in `.agent.md` YAML frontmatter pins each
agent to a specific model, bypassing AUTO entirely.
The `handoffs` field enables agent-to-agent transitions with
pre-filled prompts for workflow continuity.

## Consequences

- **Pro**: Opus used only when justified (architecture, planning)
- **Pro**: Deterministic — same task type always gets same model
- **Pro**: Handoffs create composable agent workflows
- **Pro**: Source-controlled in `agents/` dir, deployed like skills
- **Con**: User must pick the right agent (or start with Router)
- **Con**: Model names are VS Code version-dependent strings
