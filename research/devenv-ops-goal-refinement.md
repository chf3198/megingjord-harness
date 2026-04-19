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

## AI Agent Self-Improvement Areas (10 Domains)

| # | Area | Detect | Correct | Measure |
|---|------|--------|---------|---------|
| 1 | **Prompt/Instruction Drift** | Diff skill text vs observed behavior | Re-read skill, flag divergence | Drift incidents per session |
| 2 | **Context Window Optimization** | Token budget tracking, redundant content | Prune stale context, summarize | Effective token utilization % |
| 3 | **Tool Selection Accuracy** | Wrong tool chosen → error/retry | Log tool-task pairs, learn patterns | First-try success rate |
| 4 | **Error Pattern Recognition** | Repeated same error class | Auto-suggest fix from error log | Unique error classes trending down |
| 5 | **Resource Efficiency** | Memory pressure, long execution times | Graceful degradation, offload | Peak memory, task latency |
| 6 | **Knowledge Freshness** | Wiki/doc last-updated timestamps | Flag stale entries, trigger refresh | % entries updated within 30 days |
| 7 | **Governance Compliance** | Post-action policy check | Block or warn on violation | Violations per commit/session |
| 8 | **Workflow Bottleneck Detection** | Stage timing, failure frequency | Reorder/parallelize stages | P95 pipeline duration |
| 9 | **Output Quality Regression** | Lint warnings trending up, test failures | Tighten checks, add missing tests | Warning count trend, test pass rate |
| 10 | **Model Routing Optimization** | Task complexity vs model capability | Route simple→small, complex→large | Cost per successful task |

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
