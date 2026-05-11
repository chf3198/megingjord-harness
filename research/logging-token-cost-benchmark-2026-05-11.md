---
title: "Logging Token-Cost Benchmark — A vs B vs C"
date: 2026-05-11
parent_epic: 1339
ticket: 1361
author: Orla Harper (claude-code:opus-4-7@anthropic)
phase: Phase 4 — token-cost benchmark (R&D AC3 execution)
---

# Logging Token-Cost Benchmark

Empirical comparison of three schema variants for harness *.jsonl events.
Measures char-count and JSON-byte size as a BPE-token proxy (~4 chars/token,
the industry rule-of-thumb for GPT-family and Claude tokenizers).

## Variants

- **A** — current mixed v1 anneal-style: fields `timestamp`, `status`,
  `pattern_id`, `count`, `window_start`, `evidence`.
- **B** — unified v3 (Epic #1339 C2): adds `version`, `ts`, `service`, `env`,
  `event`, `trace_id`, `session_id`, `surface`, `tier`, `trigger_role`,
  `trigger_type`, `severity` (drawn from anneal v2 contract).
- **C** — v3 + optional `_summary` field (≤200 chars LLM-friendly synopsis).

## Method

Synthetic event generation, 1000 events per variant, identical content where
fields overlap. `Buffer.byteLength(JSON.stringify(event))` for size;
`chars / 4` as the token-proxy. Run: `node scripts/global/token-cost-benchmark.js`.

## Measured per-event cost (1000-event sample)

| Variant | bytes | chars | tokens (proxy) |
|---|---|---|---|
| **A** (v1 mixed) | 282 | 282 | 71 |
| **B** (v3 unified) | 462 | 462 | 116 |
| **C** (v3 + `_summary`) | 572 | 572 | 143 |

## Deltas (relative)

| Comparison | Per-event token Δ | Direction |
|---|---|---|
| B vs A | **+63.4%** | B is MORE expensive |
| C vs B | **+23.3%** | `_summary` adds ~23% |
| C vs A | **+101.4%** | C is roughly 2× A |

## Honest finding

**The R&D's hypothesis was directionally wrong.** Phase-0 R&D (`research/
harness-logging-rd-2026-05-11.md`) predicted that B would *reduce* tokens
≥15% vs A through "field-name standardization." Reality: B is *larger*
because it adds 8+ required fields that v1 didn't have (`version`,
`service`, `env`, `event`, `trace_id`, `session_id`, `surface`, plus
tier/trigger_role/trigger_type/severity carried over from v2 anneal).

The "consolidation" framing was wrong because A was already minimal. There
was no duplication to consolidate; instead, B *adds structure*.

## Cost-benefit reframing

The right question isn't "does B reduce token cost?" — it's "does the
structure B adds justify the +63% size?" Trade-offs:

| Goal | A | B | C |
|---|---|---|---|
| Token cost per event | best | +63% | +101% |
| Schema versioning (G9) | none | yes | yes |
| Required tracing IDs (G1) | none | yes | yes |
| Cross-surface uniformity (G8) | no | yes | yes |
| OpenTelemetry portability (G9) | no | gen_ai.* support | gen_ai.* support |
| LLM-friendly summary (G3 reads) | no | no | yes |
| Governance traceability (G1) | weak | strong | strong |

B's cost is paid in additive structure that all goal-lens scoring rewards
EXCEPT G3. G3's cost is per-write; the structure cost amortizes when an
event is read or queried multiple times by different consumers.

## Re-evaluating C (the `_summary` field)

C adds 23% over B. This is a write-cost. The hypothesis was that LLMs
reading log fragments would prefer the summary over the full event, saving
read-tokens. Measurement note:

- **Single read**: C is strictly more expensive (B's full event fits in
  comparable token budget; C adds the summary on top).
- **Aggregated read** (LLM reading N events to synthesize): if the LLM uses
  `_summary` instead of full content, *one* C-token-count read can replace
  *N* full-event reads. Crossover point: ~5–10 events depending on prompt
  structure.

Recommendation: **defer C until usage data shows LLM-consumer reads exceed
~5× write rate per event**. Below that threshold, the write-cost outweighs
the read-saving. Above it, C wins.

## Cross-effect: governance-audit LLM passes

`scripts/governance-audit.js` and the `manager-side ticket audit pattern`
(`wiki/concepts/ticket-audit-pattern.md`) use LLMs reading event trails.
For those consumers, C *is* probably positive. A small follow-up benchmark
running real audit prompts against A/B/C fixtures would quantify this.

## Recommendations

1. **Ship B unconditionally.** The +63% per-event token cost is justified
   by G1/G5/G6/G8/G9 gains. None of the harness consumers (sensor scripts,
   dashboard panels, governance audit) are bottlenecked on jsonl size at
   harness scale.
2. **Do NOT ship C yet.** Defer until either (a) C8 goal-coverage panel
   instrumentation shows >5× read-vs-write ratio on a representative
   surface, OR (b) a follow-up LLM-driven-read benchmark (real-token
   tiktoken or Anthropic countTokens API) verifies the crossover assumption.
3. **Track per-surface token cost** via the new C8 dashboard panel so the
   trade-off is observable, not assumed.

## Caveats

- **Char-count proxy ≠ real tokens.** BPE tokenizers compress repeated
  substrings; structured JSON often tokenizes *better* than 4 chars/token
  (URLs, common field names like "event" or "timestamp" are single tokens).
  A real-tokenizer benchmark with tiktoken or Anthropic's countTokens would
  yield slightly different numbers but likely the same direction (B > A,
  C > B).
- **Synthetic content.** Real events have variable payload sizes. The
  fixed generators here over-represent fields that all events share and
  under-represent surface-specific payload. A real-data benchmark should
  sample from production `incidents.jsonl` and `cache-stats.jsonl`.

## Output

See `node scripts/global/token-cost-benchmark.js` for the runnable
benchmark. Re-run with different sample sizes via the exported
`runBenchmark(sampleSize)` API for parametric sweeps.

## See also

- Parent Epic: #1339
- R&D source: `research/harness-logging-rd-2026-05-11.md` (AC3 plan)
- C2 schema implementation: `scripts/global/event-schema-v3.js`
- Related: `wiki/concepts/ticket-audit-pattern.md` (LLM-as-consumer pattern)
