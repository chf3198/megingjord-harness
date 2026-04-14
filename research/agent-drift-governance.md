# Why AI Agents Drift from Global Skills and Governance

**Ticket**: #59 | **Date**: 2026-04-16 | **Status**: Complete

## Summary Table

| Dimension | Key Finding |
|---|---|
| Root cause | Attention decay on system prompt as context grows |
| Prevalence | ~30% of production trajectories show misbehavior (Wink) |
| Worst drift zone | Instructions in middle of context window |
| Equilibrium? | Drift is bounded, not runaway — correctable with reminders |
| Best mitigation | Periodic instruction reinforcement + executable constraints |
| Copilot-specific | Path-scoped instructions + AGENTS.md layering helps |
| Industry tooling | NeMo Guardrails, Guardrails AI, ContextCov, Wink |

## Report Structure

| Section | File |
|---|---|
| Root Causes | [agent-drift-root-causes.md](agent-drift-root-causes.md) |
| Industry Frameworks | [agent-drift-frameworks.md](agent-drift-frameworks.md) |
| Mitigation Patterns | [agent-drift-mitigations.md](agent-drift-mitigations.md) |
| Copilot Findings | [agent-drift-copilot.md](agent-drift-copilot.md) |
| Key Sources | [agent-drift-sources.md](agent-drift-sources.md) |
| Recommendations | [agent-drift-recommendations.md](agent-drift-recommendations.md) |

## Actionable Next Steps

1. Create ADR for instruction reinforcement hook design
2. Audit skill/instruction corpus for conflicts (R3)
3. Prototype ContextCov-style executable checks for top 5 skills
4. Add drift-detection to self-anneal workflow (R6)
5. Define session anchor template (R5)
