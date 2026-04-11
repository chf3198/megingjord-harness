# ADR-003: Free-Tier Failover Routing

**Status**: Proposed
**Date**: 2026-04-11

## Context

We use multiple free-tier AI services with different rate limits.
Need a routing strategy that maximizes uptime and minimizes cost.

## Decision

Implement priority-based failover routing:

```
1. Local Ollama     → lowest latency, no cost, limited models
2. Cloudflare AI    → vision tasks, 10K neurons/day
3. Google AI Studio → general LLM, most generous free tier
4. Groq             → fast burst, 1K RPD for large models
5. Cerebras         → ultra-fast, rate-limited free tier
6. Copilot Premium  → frontier models, 300 req/mo (conserve)
```

## Consequences

- **Pro**: Maximizes free-tier usage across all providers
- **Pro**: Graceful degradation when any provider is down/exhausted
- **Con**: Complexity of managing multiple API keys and quotas
- **Con**: Response quality varies across providers/models
