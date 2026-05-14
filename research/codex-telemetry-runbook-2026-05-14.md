# OpenAI Codex Telemetry Runbook (2026-05-14)

**Ticket:** #1484 — Child of Epic #1480
**Scope:** Trustworthy telemetry sources, gaps, and ingestion path for
OpenAI Codex sessions within the Megingjord harness.

---

## Trustworthy Data Sources

### 1. OpenAI API Response `usage` Object
- Available per API call on all non-streaming and streaming (final chunk) responses.
- Fields: `prompt_tokens`, `completion_tokens`, `total_tokens`.
- Newer reasoning models: `completion_tokens_details.reasoning_tokens`.
- **Confidence:** `exact_request` — authoritative source.

### 2. OpenAI Platform Usage Dashboard
- URL: `https://platform.openai.com/usage`
- Granularity: daily/project/user, exportable as JSON or CSV.
- Lag: ~1–24 h behind real-time.
- **Confidence:** `exact_aggregate` — org-verified totals but not per-task.

### 3. Harness `cost-telemetry.jsonl`
- Written by `wrapProviderCall` from response `usage` fields.
- Already normalised to canonical schema:
  `provider, model, input_tokens, output_tokens, cost_usd, confidence_level`.
- For Codex sessions: `provider = openai`, `confidence_level = exact_request`.

---

## Unavailable / Unreliable Data

| Gap | Reason |
|-----|---------|
| Per-task token totals in Codex CLI | CLI does not expose structured per-task totals |
| Real-time cost API | OpenAI has no `/cost` response field; must derive |
| Cache hit/write tokens | Not yet exposed in standard OpenAI chat completions |
| Reasoning token breakdown (older models) | Only available on `o*` model family |

---

## Cost Derivation

Derive cost at ingest time using `pricing-map.json`. Mark
`confidence_level = derived` when pricing map is >7 days stale.

---

## Privacy and Zero-Cost Constraints

- No usage payload (prompt text, completion text) should be stored — tokens only.
- Codex free-tier sessions: `cost_usd = 0`, `confidence_level = exact_request`.
- Do not expose per-user token totals in public dashboard panels.

---

## Mapping to Existing Dashboards

1. `wrapProviderCall` already writes to `cost-telemetry.jsonl` per call.
2. Dashboard `token-spend-report.json` aggregates from that log.
3. Add `provider = openai` filter to dashboard HAMR panel (#1159).
4. The `token-telemetry-summary.json` confidence breakdown should reflect
   `exact_request` once Codex routes through `wrapProviderCall`.

---

## Follow-up Implementation Tickets Recommended

- **impl-A:** Wire Codex CLI sessions through `wrapProviderCall` (if not done in #1481).
- **impl-B:** Add `reasoning_tokens` field support to canonical schema and dashboard.
- **impl-C:** Pricing-map freshness check gate (emit warning if >7 days stale).

---

## Wiki Source Summary

See `wiki/sources/openai-codex-telemetry.md` (added this session).

**Last updated:** 2026-05-14
