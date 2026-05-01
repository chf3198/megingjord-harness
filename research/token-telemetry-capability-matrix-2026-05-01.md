# Token Telemetry Capability Matrix (2026-05-01)

**Date:** 2026-05-01
**Scope:** Exact vs estimated token/cost observability across non-free and free model lanes used by this harness.

## Summary Table

| Surface | Per-request token fields | Aggregated usage API | Cost fidelity | Verdict |
|---|---|---|---|---|
| GitHub Copilot (IDE) | Not exposed as universal raw per-call ledger | Seat/usage surfaces exist, not full token ledger | Approx/partial | Cannot guarantee exact internal token spend |
| Claude Code OTel | Yes (`input_tokens`, `output_tokens`, cache fields on `api_request`) | Yes (OTel metrics + Admin APIs) | Estimated in OTel, stronger in Admin APIs | High-confidence telemetry lane |
| Anthropic Messages API | Yes (`usage.input_tokens`, `usage.output_tokens`, cache fields) | Yes (`usage_report/messages`) | Strong for org analytics | Exact request usage available |
| OpenRouter | Yes (`usage.prompt_tokens`, `completion_tokens`, `reasoning`, cache) | Yes (`/generation` by ID) | Includes route/provider cost fields | Strong request+audit lane |
| LiteLLM Proxy | Depends on upstream response + model map | Yes (`/spend/logs`, reports, daily activity) | Strong if pricing map fresh | Reliable for routed multi-provider ops |
| Gemini API | Yes (`usage_metadata` + `count_tokens`) | Project billing/reporting outside response path | Strong for API calls | Exact request usage available |
| Ollama | Yes (`prompt_eval_count`, `eval_count`) | No first-party billing API | N/A (self-host) | Exact token counts, no spend data |

## Findings with Source Links

- Anthropic Claude Code monitoring exports token and cost metrics/events via OTel (`claude_code.token.usage`, `claude_code.api_request`), with clear caveat that cost metrics are approximations for CLI telemetry: https://code.claude.com/docs/en/monitoring-usage
- Anthropic Admin Usage & Cost APIs provide org-level usage/cost reports and explicitly document limits (for example Priority Tier cost model exclusions in cost endpoint): https://platform.claude.com/docs/en/build-with-claude/usage-cost-api
- Anthropic Claude Code Analytics API provides per-user/day model breakdown with token counts and estimated cost fields; not real-time and currently first-party Claude API scope only: https://platform.claude.com/docs/en/build-with-claude/claude-code-analytics-api
- Anthropic Messages response exposes `usage` with `input_tokens`, `output_tokens`, cache fields, and service tier/geography metadata for request-level normalization: https://platform.claude.com/docs/en/api/messages/create
- OpenRouter returns usage accounting in every response (prompt/completion/reasoning/cache + cost) and also supports retrieval by generation ID for asynchronous audit: https://openrouter.ai/docs/use-cases/usage-accounting and https://openrouter.ai/docs/api-reference/get-a-generation
- LiteLLM provides spend tracking and detailed spend logs/report APIs, including per-user/team breakdown and request-linked metadata; accuracy depends on model pricing map freshness: https://docs.litellm.ai/docs/proxy/cost_tracking
- Gemini exposes `count_tokens` preflight and post-call `usage_metadata` fields (`prompt`, `candidates`, `cached`, `thoughts`, total), enabling exact request token instrumentation: https://ai.google.dev/gemini-api/docs/tokens
- Ollama API responses expose prompt and generation token counts (`prompt_eval_count`, `eval_count`) suitable for local/fleet token telemetry even without billing signals: https://github.com/ollama/ollama/blob/main/docs/api.md

## Decision Implications for Epic #768

1. Treat Copilot lane as **confidence:estimated** unless/until exact provider token APIs are available for this org plan/surface.
2. Treat Anthropic, OpenRouter, Gemini, and Ollama request-level usage fields as **confidence:exact_request**.
3. Treat LiteLLM spend as **confidence:derived_exact_when_mapped** and enforce pricing-map freshness checks.
4. Maintain both request-level logs and aggregate reports; they answer different governance questions.

## Canonical Schema Recommendation (research output)

- Required normalized fields: `provider`, `model`, `timestamp`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `reasoning_tokens`, `total_tokens`, `cost_usd`, `confidence_level`, `request_id`, `source_kind`.
- Confidence enum: `exact_request`, `exact_aggregate`, `derived`, `estimated`, `unknown`.
- Non-free/rate-limited lanes must emit `confidence_level != unknown` for acceptance.

## Actionable Next Steps

1. Open/complete a dedicated research child ticket under Epic #768 attaching this matrix and schema proposal.
2. After research sign-off, create implementation children for: schema, adapters (Anthropic/OpenRouter/LiteLLM/Gemini/Ollama/Copilot), storage/reporting, and alerting.
3. Add validation harness to compare adapter totals vs provider aggregate APIs where available.
4. Gate rollout with a non-free coverage check (target: 100% non-free lanes mapped with confidence labels).

**Last updated:** 2026-05-01T00:00:00Z
