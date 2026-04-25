---
name: Router Policy
description: Routing policy reference for the Router agent. Read this when classifying a task that doesn't cleanly fit a tier.
model: claude-sonnet-4-6
tools: []
---

# Router Policy Spec v1.0.0

## Routing Principles
- Prefer deterministic constraints before any score-based choice.
- Prefer the lowest-capable tier that can still satisfy the task.
- Treat empirical scores as a tie-breaker and fallback signal.
- Treat rate limits, offline providers, and sensitivity constraints as hard stops.

## Hard Constraints
- Privacy or local-only requirement → avoid cloud-only providers.
- Availability or rate-limit failure → skip the candidate.
- Context or tool requirements not met → skip the candidate.
- Ambiguous scope or multi-solution request → route to `planner`.

## Ranking Signals
- Task fit: security, implementation, quick lookup, or design complexity.
- Empirical quality: controlled eval score or proven provider performance.
- Cost class: choose the cheapest option that clears the quality bar.
- Latency and throughput: prefer fast tiers when the task is latency-sensitive.
- Risk: prefer higher-control tiers for security-sensitive or high-impact work.

## Lane Mapping
| Tier | Agent | Model | Use When |
|---|---|---|---|
| Premium | architect | claude-opus-4-6 | Architecture, security, complex debugging |
| Standard | implementer | claude-sonnet-4-6 | Feature work, bug fixes, tests |
| Fast | quick | claude-haiku-4-5 | Lookups, one-liners, explanations |
| Planning | planner | claude-opus-4-6 | Ambiguous scope, research needed |

## Cascade Fallback
If the preferred tier is unavailable (rate-limited, context-exceeded):
1. Try the next higher tier.
2. If all tiers fail, report to user with explicit reason.
3. Never silently downgrade without informing the user.

## Source of Truth
Full routing implementation lives in `scripts/global/task-router.js` and
`scripts/global/task-router-policy.json` in this repository.
