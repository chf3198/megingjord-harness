---
title: Claude Code IDE Proxy Shim — Research & Design
date: 2026-05-06
epic: 1020
research-ticket: 1021
authored-by: operator-deputy (Claude Code Team runtime)
status: COMPLETE — pending CONSULTANT_CLOSEOUT
---

# Claude Code IDE Proxy Shim — R&D

## Goal

Reduce Claude Code IDE token cost by intercepting the chat backend so sub-Premium-complexity turns route to fleet/free providers while Premium turns pass through to Anthropic Opus unchanged.

## A. Wire-format compatibility

### Anthropic Messages API (current shape)

- **Endpoint**: `POST https://api.anthropic.com/v1/messages`
- **Required headers**: `x-api-key`, `anthropic-version` (`2023-06-01`), `content-type: application/json`.
- **Optional**: `anthropic-beta` (prompt-caching, extended-cache-ttl, etc.).
- **Body**: `{model, messages[], max_tokens, system?, tools?, stream?, temperature?, ...}`.
- **Streaming SSE protocol**: `message_start` → `content_block_start` → multiple `content_block_delta` (with `partial_json` for tool_use) → `content_block_stop` → `message_delta` → `message_stop`.

### Adapter strategy

| Source format | Target backend | Adapter strategy |
|---|---|---|
| Anthropic Messages | Anthropic API | passthrough (Premium lane) |
| Anthropic Messages | Ollama (OpenAI-compat at /v1/chat/completions) | LiteLLM has built-in `anthropic/` ↔ `openai-compat/` translation |
| Anthropic Messages | CF Workers AI (`@cf/qwen/qwen3-30b-a3b-fp8` etc.) | OpenAI-compat at `/v1/chat/completions` per CF AI gateway spec; LiteLLM bridges |
| Anthropic Messages | OpenRouter | OpenAI-compat at `/api/v1/chat/completions`; LiteLLM bridges |

**Key insight**: LiteLLM proxy already supports drop-in Anthropic SDK compatibility — its `/v1/messages` endpoint accepts Anthropic-format requests, routes to any backend via OpenAI-compat conversion, and returns Anthropic-format responses. We do not need to rebuild this adapter from scratch.

### Streaming compatibility

- **Anthropic SSE → Ollama SSE**: Anthropic uses content-block-keyed deltas; Ollama uses `delta.content` strings. LiteLLM's `streamingResponseTransformer` already handles this both directions.
- **Tool-use streaming**: Anthropic emits `partial_json` chunks per `tool_use` content block. Ollama and most fleet models do not natively support this format; LiteLLM accumulates the full tool call before emission, sacrificing streaming granularity for tool calls only. Acceptable trade-off — IDE renders tools after completion.
- **Vision blocks**: pass through to Anthropic only. Fleet does not handle vision today; the proxy must classify vision turns as Premium-mandatory.

## B. Latency budget

Target: ≤50ms p95 for the proxy hop itself (excluding upstream call time).

Path breakdown:
1. **IDE → proxy** (~5ms LAN/localhost).
2. **Parse + classify** (~5–10ms): regex + complexity-score function from `model-routing-engine.js`.
3. **Lane decision** (~2ms): policy lookup in `model-routing-policy.json`.
4. **Provider dispatch** (~5ms LiteLLM call setup).
5. **Upstream call** (variable; not in budget).
6. **Response transform + return** (~5–10ms).

**Total proxy overhead**: ~22–32ms p95. Within budget.

**Cold start risk**: complexity classifier should be pre-warmed (in-process). LiteLLM is started ahead of session start.

## C. Quality regression study

### Methodology

1. **Baseline corpus**: 100 representative IDE turns from the past 30 days (sampled across complexity bands).
2. **Score each turn on Anthropic Opus** (Premium baseline): 5-point rubric (correctness, completeness, efficiency, code quality, judgment).
3. **Re-run each turn through 3 fleet candidates**:
   - Tailscale Ollama: `qwen2.5-coder:7b` on 36GB GPU.
   - Cloudflare Workers AI free: `@cf/qwen/qwen3-30b-a3b-fp8`.
   - Groq free: `llama-3.3-70b`.
4. **Score via judge-quorum (#895)**: 2-of-N panel of paid + free judges.
5. **Compute pass rate per complexity band** (1=trivial, 5=Premium-mandatory).

### Hypothesized lane thresholds

| Complexity band | Suggested lane | Rationale |
|---|---|---|
| 1–2 (lookup, slot-fill) | Fleet (qwen2.5-coder:7b) | matches per S5 #893 finding |
| 3 (single-file edit) | Haiku (claude-haiku-4-5) | known-pattern coding |
| 4 (multi-file refactor) | Premium (Opus 4.7) | safer to keep on Opus until measured |
| 5 (architecture, debug) | Premium mandatory | cannot route |

### Cutover criteria per lane

- Fleet pass rate ≥ 85% on bands 1–2 → activate.
- Fleet pass rate < 85% on bands 1–2 → lower threshold, keep on Anthropic Haiku free-tier as fallback.

## D. Authentication + secret handling

### Anthropic API key

- IDE stores key at `~/.config/claude-code/api_key` (or env). Proxy intercepts but **never logs**.
- Pass-through path: proxy forwards `x-api-key` unchanged to Anthropic.
- Fleet path: proxy uses `OPERATOR_KEY_SEED_B64` (#894) signing for fleet-bound traffic; never sends Anthropic key to fleet.

### Audit log

Each routing decision recorded with: `{ts, complexity, lane, provider, model, est_tokens_in, est_tokens_out, est_cost_usd}` to `~/.megingjord/ide-proxy-decisions.jsonl`. No request body content. No API keys.

### Secret-leak prevention

- Linter rule extension: scan proxy code paths for any logging of `body.messages[*]`, `body.system`, or API-key headers.
- Reviewer responsibility: every PR touching proxy code paths must confirm "no body content logged."

## E. Failure modes

```
Failure                                  Behavior                        Restore
──────────────────────────────────────  ──────────────────────────────  ──────────
Fleet (Tailscale Ollama) unreachable    Spillover to Anthropic Haiku    auto on next probe
                                        (cheap-cloud lane); record
                                        in cost-telemetry.
──────────────────────────────────────  ──────────────────────────────  ──────────
Anthropic rate-limited (429)            maybeSpillover (#927) returns   auto on retry-after
                                        next provider; proxy re-routes.
──────────────────────────────────────  ──────────────────────────────  ──────────
Proxy itself crashes                    IDE has fallback: `MEGINGJORD_  manual restart;
                                        HAMR_DISABLED=1` env reverts    proxy is opt-in.
                                        IDE to direct Anthropic.
──────────────────────────────────────  ──────────────────────────────  ──────────
Wire-format adapter bug                 Feature flag per-route disable; fix bug, redeploy
                                        affected lane reverts to        proxy.
                                        passthrough.
──────────────────────────────────────  ──────────────────────────────  ──────────
Fleet returns malformed response        Validate response shape before  auto fall to
                                        return; on parse failure,       Premium
                                        re-dispatch to Premium.
```

## F. Implementation architecture options

| Option | Where | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **A. Local proxy server (Node)** | operator localhost | full control; can read `cascade-policy-overrides.json` directly; LAN latency | one-process-per-operator; needs supervisor (e.g., systemd, launchd, pm2) | **RECOMMENDED for MVP** |
| **B. Cloudflare Worker proxy** | edge | always-on; integrates with HAMR Worker; no local install | cannot read local files; cold-start latency; Anthropic key must reach Worker (security risk) | defer to v2 |
| **C. SDK-level shim** | inside Claude Code | zero hop overhead; most efficient | Claude Code is a closed-source IDE; cannot modify directly | NOT FEASIBLE |
| **D. OpenRouter MITM** | OpenRouter as gateway | uses OpenRouter routing; works with existing OR free models | adds 3rd-party dep; OR rate limits; not under our control | DEFER |

**Recommendation**: Option A (local Node proxy server using LiteLLM Python or LiteLLM SDK as core). Operator runs `npm run hamr:ide-proxy` to start; `~/.config/claude-code/api_endpoint` is set to `http://127.0.0.1:11437/v1/messages`.

### Fallback strategy: LiteLLM proxy directly

LiteLLM proxy server already exposes an Anthropic-compatible `/v1/messages` endpoint that accepts Anthropic SDK requests, routes to any configured provider, and returns Anthropic-format responses. We may **adopt** LiteLLM proxy directly with our own `litellm-config.yaml` rather than building a custom Node proxy. Key benefits:
- ~0 day-engineer custom code (config-only).
- Battle-tested wire-format adapter.
- Built-in cost tracking, guardrails, load balancing.
- SOC-2 Type 2 + ISO 27001 certified for enterprise contexts.

**Open question for child ticket**: build custom Node proxy vs. adopt LiteLLM proxy + write a thin pre-routing layer. Decision deferred to first dev child after R&D approval.

## G. Recommended child-ticket sketch

| # | Title | Effort | Owner | Dep |
|---|---|---|---|---|
| 1 | Adopt LiteLLM proxy as IDE backend; wire `litellm-config.yaml` for Anthropic-compat `/v1/messages` | 1d | Claude Code | none |
| 2 | Implement complexity-score classifier (extracted from `model-routing-engine.js`) as a LiteLLM pre-router hook | 1.5d | Claude Code | 1 |
| 3 | Per-call cost-telemetry emit to `~/.megingjord/ide-proxy-decisions.jsonl` | 0.5d | Claude Code | 1, 2 |
| 4 | Activation script: `npm run hamr:ide-proxy:start/stop`, with PID file + supervisor-friendly shape | 0.5d | Claude Code | 1 |
| 5 | Live measurement child: A/B test 100 baseline turns vs. routed turns; produce cost-reduction + quality-parity report | 1d | Claude Code (post-impl) | 1–4 |
| 6 | Documentation: `instructions/ide-proxy.instructions.md` + `wiki/concepts/ide-proxy.md` | 0.5d | Claude Code | 1–4 |

**Total**: ~5 day-engineer end-to-end. Parallelizable to ~2 calendar days with single engineer + observation periods between deploys.

## H. Acceptance criteria for implementation phase

### Per-child gates

Each implementation child must:
- [ ] Honor `MEGINGJORD_HAMR_DISABLED=1` env override.
- [ ] Pass strict-superset check (existing direct-Anthropic path remains functional).
- [ ] Add unit + integration tests; tests pass in CI.
- [ ] Update CHANGELOG.

### Epic-level acceptance

- [ ] Live measurement: ≥30% IDE turn count routed to non-Anthropic.
- [ ] Live measurement: ≥25% session-token-cost reduction vs. baseline.
- [ ] Quality measurement: zero regression on Premium-tier turns (judge-quorum vs. baseline ≥ 95%).
- [ ] Operator can opt out via env var or per-team config marker (#963).
- [ ] Audit log under `~/.megingjord/ide-proxy-decisions.jsonl` shows per-call lane decisions.

## Sources

- [Anthropic Messages Streaming docs](https://docs.anthropic.com/en/api/messages-streaming)
- [Streaming Tool Calls — DEV Community](https://dev.to/gabrielanhaia/streaming-tool-calls-parse-anthropic-sse-without-loading-the-whole-message-2on)
- [LiteLLM proxy (LLM Gateway) docs](https://docs.litellm.ai/docs/providers/litellm_proxy)
- [LiteLLM Anthropic provider](https://docs.litellm.ai/docs/providers/anthropic)
- [LiteLLM Ollama provider](https://docs.litellm.ai/docs/providers/ollama)
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare Workers AI free-tier guide](https://costbench.com/software/llm-api-providers/cloudflare-workers-ai/free-plan/)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
