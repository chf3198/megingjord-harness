# Phase-R: Claude Code Team R&D for #1148 (Universal HAMR Coverage, v2 protocol)

**Author**: Orla Harper (claude-code:opus-4-7@anthropic, role: collaborator)
**Date**: 2026-05-09
**Parent Epic**: #1130 — Optimize and harden HAMR for universal harness governance
**R&D ticket**: #1148 — Cross-team R&D under v2 protocol; replaces cancelled #1131
**Lead team**: cc (this session initiated the R&D per v2 §1)
**Phase**: R (independent first-pass; no peer artifacts read; codex CLI dispatched in parallel)

## Contamination declaration

Heavy. Same operator session in 2026-05-08 authored Epic #1130, original R&D #1131, and the founding 0% utilization assessment. v2 protocol document `research/cross-team-rd-protocol-v2-2026-05-09.md` was also CC-authored as #1146 R&D output. For this Phase-R artifact:

- I have NOT opened `planning/synthesis-1148/artifacts/cx-rd.md` (codex CLI is producing it in parallel right now; PID 9715 active)
- I have NOT opened `planning/synthesis-1148/artifacts/cp-rd.md` (Copilot CLI rate-limited; operator-paste fallback pending)
- I have NOT opened the cancelled #1131 artifacts (per v2 Q6 directive: re-run fresh, do not seed)
- I have re-done websearch research from scratch on 2026-05-09 to ground new claims (5 sources cited below); old in-session knowledge is acknowledged as background but not relied on as evidence

This is a deliberately contaminated authorship — bootstrap constraint of v2's first validation run. Codex's parallel artifact provides the independence check.

## Source inventory

### Web sources (per v2 §4 mandatory ≥5)

- websearch: https://www.braintrust.dev/articles/best-llm-gateways-observability-2026 (accessed 2026-05-09T06:20:00Z) — 4 best LLM gateways for observability (tracing, cost attribution, debuggability)
- websearch: https://portkey.ai/blog/the-complete-guide-to-llm-observability/ (accessed 2026-05-09T06:20:00Z) — 40+ data points captured per request: cost, latency, tokens, caching, guardrails
- websearch: https://www.morphllm.com/llm-gateway (accessed 2026-05-09T06:20:00Z) — single integration point pattern; gateway captures observability without app-side instrumentation work
- websearch: https://www.getmaxim.ai/articles/ai-cost-observability-tools-in-2026-a-practical-comparison/ (accessed 2026-05-09T06:20:00Z) — request-level vs FinOps aggregate-level cost attribution; LiteLLM identified as 100+ provider proxy
- websearch: https://www.getmaxim.ai/articles/top-enterprise-ai-gateways-for-llm-observability-in-2026/ (accessed 2026-05-09T06:20:00Z) — Bifrost as Go-based gateway with cost-before-response governance
- websearch: https://medium.com/@Manjunath-Hanmantgad/how-i-structured-the-llm-observatory-gateway-ingest-and-why-the-boundary-matters-15da1fac5754 (accessed 2026-05-09T06:20:00Z) — gateway-mode vs ingest-mode boundary distinction

### Repo file:line anchors (per v2 §4 mandatory ≥10)

- repo: instructions/hamr-routing.instructions.md#L18-L25 — HAMR contract: "every governed provider call SHOULD flow through scripts/global/hamr-provider-wrapper.js"
- repo: scripts/global/hamr-provider-wrapper.js#L1-L12 — wrapProviderCall signature; opt-in shim
- repo: scripts/global/hamr-provider-wrapper.js#L13-L40 — readTeamConfig + isDisabled (HAMR off-switch)
- repo: scripts/global/token-provider-adapters.js#L1-L30 — anthropic + openrouter adapters; no fleet/Ollama adapter
- repo: scripts/global/cache-stats-emit.js#L1-L40 — appendCacheStat → ~/.megingjord/cache-stats.jsonl
- repo: scripts/global/header-spillover.js — spillover hint when 429
- repo: scripts/global/sticky-route.js — provider stickiness per tier
- repo: scripts/global/cascade-dispatch.js — Free → Fleet → Haiku → Premium escalator
- repo: config/litellm-config.yaml#L8-L28 — Ollama + LiteLLM aliases; deployed config drift observed empirically 2026-05-08
- repo: scripts/global/fleet-rollout-runner.js#L24-L40 — direct Ollama HTTP fetch (KNOWN bypass)
- repo: scripts/global/ollama-direct.js — direct Ollama HTTP (KNOWN bypass)
- repo: scripts/global/free-router.js — Cerebras/Groq path (verify wrap status)
- repo: scripts/global/task-router-dispatch.js — fleet routing (verify wrap status)
- repo: scripts/global/governance-audit.js — composite audit; future home of utilization sensor
- repo: cloudflare/hamr/routes/quota.ts — /quota schema_version 2 + stale flag
- repo: cloudflare/hamr/scheduled.ts — Worker scheduled handler for staleness marking

## Per-question response

### Q1 — Adapter design per provider

**Position**: build adapter shims in `scripts/global/`; each is ≤80 lines and delegates to `wrapProviderCall(name, fn, opts)` internally. Caller signature is intent-based (`fleetCall({tier, model, prompt, opts})`) — HAMR resolves host/model from registry. Per Braintrust 2026 LLM gateway best practices, gateways must be **infrastructure-layer not app-layer** — this enforces single integration point.

### Q2 — Cloudflare Workers AI

**Position**: route via existing LiteLLM gateway as the FIRST path (already supports `cloudflare/@cf/...` aliases). Direct adapter `cloudflareCall` only as a 2nd-tier fallback if LiteLLM is unavailable. Per Maxim 2026 comparison: "Bifrost is the only tool that handles AI cost observability at the infrastructure layer" — same principle: handle it once at the gateway, not duplicated per provider.

### Q3 — Cerebras / Groq

**Position**: single `openaiCompatCall(provider_id, request, opts)` adapter accepting provider tag. Both providers are OpenAI-API-compatible. Avoid 2-4 near-duplicate files. Telemetry differentiates by `provider_id` in cache-stats records.

### Q4 — LiteLLM gateway role

**Position**: WRAP not REPLACE. LiteLLM provides routing/retry/budget; HAMR provides cost/observability AROUND it. Both layers are valuable. Per Maxim 2026: LiteLLM is "widely adopted in the AI engineering community for cost tracking and provider abstraction" — replacing it is reinventing.

### Q5 — Lint patterns

**Position**: detect via static grep:
- `fetch(.*:11434` (Ollama HTTP)
- `new OpenAI\(`, `new Anthropic\(` (raw SDKs)
- `axios\.(get|post)` to provider hosts
- `requests\.(get|post)` (Python)
- `curl\s+http` in `.sh` calling provider endpoints

Build as `scripts/global/lint-hamr-bypass.js`. Greppable pattern catalog; cheap to maintain.

### Q6 — Diagnostic carve-out

**Position**: WRAP, do NOT exempt. Tag with `tier: 'diagnostic'` so production utilization metric excludes them but they remain visible in observability. Per Portkey 2026: "events for safety or governance alerts" — diagnostics are visibility data, not invisibility.

### Q7 — Migration cutover

**Position**: 4-week schedule.
- Week 1: ship adapters + lint advisory
- Week 2: migrate top-5 highest-volume sites
- Week 3: migrate remaining
- Week 4: promote lint to required (hard-gate)

### Q8 — CI test fixtures

**Position**: existing `tests/hamr-team-integration.spec.js` provides the dry-call pattern. Reuse it. Mock callFn, stub fetch, assert wrapper instrumentation fields. CI should NOT make real provider calls.

### Q9 — Goal Health Score sensor

**Position**: `production_hamr_utilization_rate_7d = wrapped_production_calls / (wrapped_production_calls + detected_unwrapped_production_calls)` over 7-day window. Diagnostics excluded from denominator. Stale data degraded to `null`, not zero.

### Q10 — /quota always-fresh

**Position**: BOTH push cron AND Worker scheduled handler. Belt+suspenders. Add `last_update_ms` + `freshness_slo_ms` fields for operator UX. Visible push-failure state (don't silently swallow).

### Q11 — Dashboard panel

**Position**: 4-widget HAMR panel:
1. coverage rate gauge (production)
2. per-provider call rate stacked-area
3. /quota staleness counter + push-failure flag
4. spillover frequency heatmap

Reuse existing dashboard `events.jsonl` consumer.

### Q12 — Telemetry retention

**Position**: cache-stats.jsonl 30d local + 90d in HAMR KV. Dashboard window 7d default + 90d on demand. Nightly rotation cron.

### Q13 — Migration inventory

**Position**: estimate 13-15 actionable surfaces (CX-RD will likely have fuller inventory; converge in Phase-D). Top tier: `fleet-rollout-runner.js`, `ollama-direct.js`, `task-router-dispatch.js`, `free-router.js`. Mid tier: `wiki/wiki-llm.js` (already wrapped — verify), `token-telemetry-reconcile.js`. Bottom tier: probes/benchmarks.

### Q14 — Migration order

**Position**: high-volume PRODUCTION first (fastest signal recovery on utilization metric). Diagnostics LAST (low signal value; high churn).

### Q15 — Rollback per migration

**Position**: per-site feature flag `MEGINGJORD_HAMR_BYPASS_<SITE>=1` for 2 weeks post-migration. After stable, flag removed in cleanup PR. Global break-glass `MEGINGJORD_HAMR_DISABLED=1` retained for emergency rollback only with audit-log marker.

### Q16 — What did the prior synthesis miss about HAMR

**Position**: nothing — the prior synthesis (#1105) was about goal-priority hardening, not HAMR coverage. The 0% utilization gap was a SIDE finding during cancelled #1131 R&D. v1 protocol failed at the meta-level (not the HAMR-content level).

### Q17 — Per-team lens

**Position**: CC has the operator-session 0% utilization assessment fresh (highest contamination, declared above). CP has cross-team write-path expertise from prior synthesis-protocol design. CX has fleet/runtime sync visibility (the runtime-deploy gap finding from #1105 D-006). Each lens valuable; converge in Phase-D.

## Conflict / opportunity matrix

| ID | Type | Item | Severity |
| --- | --- | --- | --- |
| C1 | Conflict | wrapProviderCall is opt-in (`isDisabled` shortcut); 0% fleet wrap rate today | HIGH |
| C2 | Conflict | LiteLLM deployed-config drifts from repo source (3 vs 13 models observed empirically 2026-05-08) | HIGH |
| C3 | Conflict | /quota stays `stale: true` when push cron is intermittent; no failure visibility | MEDIUM |
| C4 | Conflict | Diagnostic curls have no tier annotation; pollute production metric | LOW |
| C5 | Conflict | Numbering collisions if multiple teams propose decisions in parallel (v2 §6 fixes via central allocator) | MEDIUM |
| O1 | Opportunity | Existing token-provider-adapters.js shapes are reusable; extend rather than rewrite | HIGH |
| O2 | Opportunity | Existing tests/hamr-provider-wrapper.spec.js dry-call pattern reusable for CI fixture | HIGH |
| O3 | Opportunity | Bifrost / Portkey patterns from 2026 industry can inform implementation | MEDIUM |

## Proposal

5-PR sequence (single-team-shippable since architectural intent is settled):

1. `scripts/global/fleet-via-hamr.js` (~50 lines) — fleet adapter shim
2. `scripts/global/lint-hamr-bypass.js` (~80 lines) — bypass detector with `tier:'diagnostic'` carve-out
3. `.github/workflows/hamr-bypass-lint.yml` — advisory→required workflow
4. Per-site migration PRs (top-5 sites first)
5. `governance-audit.js` extension — utilization sensor; dashboard panel update; /quota enrichment

## Rollout sketch

| Step | Effort | Owner role | Output |
| --- | --- | --- | --- |
| 1 | 0.3d | Collaborator | fleet-via-hamr.js + tests |
| 2 | 0.4d | Collaborator | lint-hamr-bypass.js + diagnostic-tag contract |
| 3 | 0.1d | Collaborator | hamr-bypass-lint.yml advisory |
| 4a | 0.4d | Collaborator | migrate top-5 production sites |
| 4b | 0.3d | Collaborator | migrate remaining bypass sites |
| 5 | 0.4d | Admin | utilization sensor + /quota fields + dashboard panel |
| 6 | 0.2d | Manager | docs/howto/hamr-coverage.md + instructions update |
| 7 | 0.1d | Admin | promote lint to required after 2 weeks stable |
| **Total** | **~2.2d** | | |

## Self-rating G1..G9

| Goal | Score | Rationale |
| --- | ---: | --- |
| G1 Governance | 9 | v2 protocol followed; contamination declared honestly |
| G2 Quality | 8 | 6 websearch + 16 repo anchors; per-question response complete |
| G3 Zero Cost | 9 | This R&D in-session; codex parallel run uses operator's auth |
| G4 Privacy | 9 | No secrets opened; no PII |
| G5 Portability | 8 | Adapters proposed are settings-driven; no host-coupling |
| G6 Resilience | 8 | Belt+suspenders /quota; rollback flags per migration |
| G7 Throughput | 7 | Migration sequenced for fastest signal recovery |
| G8 Observability | 9 | GHS sensor wiring detailed; 4-widget dashboard |
| G9 Interoperability | 8 | All 6 providers covered (Ollama, CF, Cerebras, Groq, LiteLLM, Anthropic) |

---

Signed-by: Orla Harper
Team&Model: claude-code:opus-4-7@anthropic
Role: collaborator
last_activity_utc: 2026-05-09T06:30:00Z
