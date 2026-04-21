# Router Analysis: How the LLM Matrix Improves DevEnv Ops Harness Routing

**Status**: Proposed
**Date**: 2026-04-20
**Ticket**: #340
**Last Updated**: 2026-04-20

## Summary

The unified matrix in [model-compare/design-analysis/LLM-EVALUATION-MATRIX.md](model-compare/design-analysis/LLM-EVALUATION-MATRIX.md) is most valuable to the DevEnv Ops Harness router as a routing prior and policy evidence source. It should not be treated as the final decision engine; instead, it should inform a deterministic + weighted router that selects the best candidate under task constraints.

| Benefit | Router Impact |
|---|---|
| Task-fit ranking | Maps intent classes to known-strength models and agent tiers |
| Safe fallback paths | Avoids blind retries on rate-limited or offline providers |
| Cost control | Chooses the lowest-cost model that clears the task bar |
| Explainability | Makes routing decisions auditable and easy to justify |
| Regression detection | Flags when empirical scores or availability drift |

## Findings

### 1. The matrix already encodes useful routing priors
- `Best Use Case` is close to a policy label, not just a narrative note.
- `Empirical` scores identify which providers are actually viable under live load.
- Rate-limit and offline notes create natural fallback branches.
- The table makes cross-tier comparisons possible when task intent is clear.

### 2. The router should be task-centric, not model-centric
The matrix ranks models; the router chooses models for tasks. That means the router still needs task metadata:
- intent class
- privacy / sensitivity
- context length
- latency budget
- tool-use requirement
- availability / rate-limit state

### 3. Deterministic constraints must stay first
Modern routing practice favors deterministic gating before scoring. The first pass should exclude candidates that violate:
- required privacy or on-device constraints
- unavailable / rate-limited providers
- unsupported context or tool requirements
- blocked tiers for the current role or workflow

### 4. The strongest pattern is two-stage routing
1. Filter by hard constraints.
2. Rank remaining candidates using a weighted utility function.

A simple policy shape is:
`utility = task_fit + empirical_quality - cost_penalty - latency_penalty - risk_penalty`

## What the matrix can improve right now

1. **Agent selection**: route security-heavy work to stronger policy models, implementation work to coding-strong models, and lightweight lookups to fast models.
2. **Fallback selection**: prefer Groq/Cerebras/OpenRouter fallbacks based on empirical score and current availability.
3. **Budget selection**: choose the cheapest model that still clears the task’s quality threshold.
4. **Offline handling**: prefer fleet models only when local inference is acceptable and host reachability is healthy.

## Recommended additions for router use

| Field | Why it matters |
|---|---|
| Latency p50 / p95 | Lets the router honor response-time SLAs |
| Context window | Prevents accidental over-selection on long prompts |
| Tool-use reliability | Helps choose models for agentic workflows |
| Availability state | Distinguishes healthy, degraded, rate-limited, and offline |
| Privacy class | Enforces local-only or restricted-routing requirements |
| Fallback eligibility | Controls whether a model can be used as a backup |

## Risks

- **Overfitting to empirical scores**: a high benchmark score can still be the wrong answer for a task.
- **Schema drift**: if the matrix and router metadata diverge, routing will become inconsistent.
- **Static ranking bias**: a fixed table can miss runtime availability changes.
- **Mixed-method confusion**: analytical estimates and live harness scores must stay clearly separated.

## Actionable Next Steps

1. Add router-ready metadata fields to the matrix or adjacent routing config.
2. Implement deterministic pre-filtering before any score-based ranking.
3. Add per-intent winner tracking so the router learns best model per task class.
4. Store availability and rate-limit state separately from the benchmark table.
5. Define a versioned router policy spec for `agents/router.agent.md`.

## Sources

- [LLM Evaluation Matrix](model-compare/design-analysis/LLM-EVALUATION-MATRIX.md)
- [Router agent](agents/router.agent.md)
- [DevEnv Ops README](README.md)
- [OpenAI Cookbook](https://developers.openai.com/cookbook)
- [Claude Platform Docs](https://platform.claude.com/docs/)
- [LangChain Overview](https://docs.langchain.com/oss/python/langchain/overview)
