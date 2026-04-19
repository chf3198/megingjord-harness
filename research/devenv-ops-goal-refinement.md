# DevEnv Ops Harness — Goal Refinement Research

**Date**: 2025-07-16
**Status**: Active
**Purpose**: Synthesize research into generalized OKR goals for the harness

## Research Sources

| Source | Topic | Key Insight |
|--------|-------|-------------|
| Perdoo OKR Guide 2026 | Goal-setting | Objectives=directional, KRs=measurable outcomes |
| WhatMatters.com | OKR types | Committed, aspirational, learning OKRs |
| Anthropic: Building Effective Agents | Agent patterns | Evaluator-optimizer loops, error recovery |
| MetaGPT (arXiv:2308.00352) | Multi-agent SOPs | SOP-encoded workflows reduce cascading errors |

## AI Agent Self-Improvement Areas

Areas where an AI dev harness can self-correct and self-improve:

1. **Prompt/Instruction Drift** — detect when skills/instructions diverge from behavior
2. **Context Window Management** — optimize what enters the context window
3. **Tool Selection Accuracy** — learn which tools solve which problem classes
4. **Error Pattern Recognition** — detect recurring failures and auto-remediate
5. **Resource Efficiency** — memory, token, and compute budget awareness
6. **Knowledge Freshness** — detect stale wiki/docs, trigger refresh cycles
7. **Governance Compliance** — verify own outputs against policy constraints
8. **Workflow Bottleneck Detection** — identify slow/failing pipeline stages
9. **Output Quality Regression** — detect declining code/doc quality over time
10. **Model Routing Optimization** — select best model for task complexity

## Generalization Principles (from user feedback)

- Goals must be hardware-agnostic (nil fleet → enterprise)
- Goals must be project-type-aware (web app ≠ VS Code extension ≠ CLI tool)
- Goals must be language-agnostic where possible, language-specific where needed
- Goals must accommodate AI technology evolution
- Agent enhancement tools (wiki, memory, etc.) are means, not ends

## Actionable Next Steps

1. Write OKR-structured goals (O1–O6) incorporating above principles
2. Create GitHub Epic with sub-tickets for implementation
3. Map each goal to existing open tickets where applicable
