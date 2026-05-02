# Provider Adapter Layer Implementation (2026-05-01)

**Date:** 2026-05-01
**Ticket:** #771
**Status:** Implemented

## Summary

| Adapter | Source fields | Confidence | Source kind |
|---|---|---|---|
| Anthropic Messages | `usage.input_tokens`, `usage.output_tokens`, cache fields | `exact_request` | `anthropic_messages` |
| OpenRouter | `usage.prompt_tokens`, `usage.completion_tokens`, `usage.reasoning_tokens`, `usage.total_tokens`, `cost` | `exact_request` | `openrouter` |
| LiteLLM spend log | `prompt_tokens`, `completion_tokens`, `total_tokens`, `spend/cost` | `derived` (`estimated` when pricing not fresh) | `litellm_spend_log` |
| Gemini | `usageMetadata` / `usage_metadata` token fields | `exact_request` | `gemini_generate_content` |
| Ollama | `prompt_eval_count`, `eval_count` | `exact_request` | `ollama_generate` |

## Implementation

- Added `scripts/global/token-provider-adapters.js`.
- All adapters emit canonical records through `normalizeTokenRecord()`.
- Missing fields normalize to numeric `0`/`null` via canonical schema defaults.

## Test Coverage

- Added `tests/token-provider-adapters.spec.js`.
- Coverage includes all five adapters and partial payload handling.
- Non-free lane input in tests emits non-`unknown` confidence values.

## Compatibility Notes

- No existing telemetry readers were changed.
- Adapter layer is additive and ready for #773 reporting and #774 reconciliation.

## Actionable Next Steps

1. Wire adapters into ingestion paths used by provider-specific logs.
2. Surface confidence split in dashboard/reporting (#773).
3. Add reconciliation drift checks against aggregate APIs (#774).

**Last updated:** 2026-05-01T00:00:00Z
