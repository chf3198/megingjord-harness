# cx Phase-R (independent) — #1131

## Header
- Ticket: #1131 (parent #1130)
- Team: `cx` (Codex)
- Date: 2026-05-08
- Scope: Research-only; no implementation.

## Contamination declaration
- I did **not** read peer artifacts under `planning/synthesis-1131/artifacts/`.
- Inputs used: #1131/#1130 text + repo evidence only.

## Source inventory (repo evidence)
- Routing contract: `instructions/hamr-routing.instructions.md` (HAMR contract + lane boundary).
- Wrapper/adapters: `scripts/global/hamr-provider-wrapper.js`, `scripts/global/token-provider-adapters.js`.
- Freshness/worker: `cloudflare/hamr/routes/quota.ts`, `cloudflare/hamr/routes/cache-stats.ts`, `cloudflare/hamr/scheduled.ts`, `cloudflare/hamr/wrangler.toml`.
- Push/cron: `scripts/global/hamr-periodic-push.sh`, `scripts/global/install-cron.sh`, `scripts/global/cache-hit-gate.js`, `scripts/global/cache-stats-emit.js`, `scripts/global/log-rotate.js`.
- Verification/tests: `scripts/global/hamr-sync-verify.js`, `tests/hamr-team-integration.spec.js`.
- UI/telemetry surfaces: `dashboard/js/quota-live.js`, `dashboard/js/cost-monitor.js`, `dashboard/js/router-tracker.js`.

## Q1–Q17 answers
1. **Adapter core shape**: keep one canonical record `{provider,model,input_tokens,output_tokens,cache_read_tokens,request_id,source_kind,confidence_level}`; this already exists in adapters + wrapper emit path.
2. **Unsupported providers (Azure/Google AI Studio)**: add `azureOpenAI()` + `googleAIStudio()` adapters reusing OAI/Gemini-normalizers; preserve `source_kind` and deterministic field defaults.
3. **Future-proofing**: include `raw_usage` passthrough (optional), and strict stable top-level schema for dashboards/gates.
4. **Confidence levels**: keep tri-state (`exact_request`,`estimated_*`,`unknown`) and gate by lane for governance exceptions.
5. **Wrapper completion**: enforce all non-free provider call sites to go through `wrapProviderCall()` (currently opt-in/no-op possible).
6. **Bypass strategy**: detect direct provider usage via static patterns (`:11434`,`/api/generate`,`fetch(` to known provider hosts) + runtime sampling assertions in tests.
7. **Diagnostic carve-out**: allow explicit `tier=diagnostic` only with required trace tag and local-only destinations; block in CI for production scripts.
8. **CI proof without real provider calls**: unit/integration tests should mock callFn and assert wrapper instrumentation fields (`sticky`,`spillover`,`cache stats`), as current dry-shape tests already do.
9. **Missing metrics panel**: add HAMR panel with hit-rate-7d, stale flag age, spillover count, wrapper coverage ratio, and per-provider adapter confidence.
10. **`/quota` freshness semantics**: keep `schema_version=2` + `stale` as hard contract; add `last_update_ms` + `freshness_slo_ms` for clear operator UX.
11. **Retention/performance**: keep local JSONL append + rotation; bound file size by line-count/bytes and roll gzip archives (already present).
12. **Freshness guardrails**: dual-source freshness (worker cron + local cron pushes) is good; add health SLO alarm if stale > 12h.
13. **Migration inventory baseline**: prioritize scripts/global direct Ollama/provider calls, then scripts root diagnostics, then dashboard API paths.
14. **Runtime sync drift**: strengthen `hamr-sync-verify` as release gate before deploy; fail when required HAMR script set missing in any team runtime.
15. **Safety switch policy**: keep `MEGINGJORD_HAMR_DISABLED=1` for break-glass only; require audit log marker when set in CI/dev scripts.
16. **Ticket slicing (≤0.5d each)**: deliver in thin vertical slices: adapters, wrapper enforcement, lint/CI gates, quota freshness fields, dashboard panel, migration passes.
17. **Cross-team value**: this yields one contract for all three teams (Copilot/Codex/Claude), reducing drift in cost, cache, and spillover telemetry.

## Conflict/opportunity matrix
- **Conflict A**: contract says governed calls route via HAMR, but wrapper is opt-in and can be disabled.
- **Conflict B**: `/quota` exposes stale boolean but dashboard quota view is provider-credit centric, not HAMR-freshness centric.
- **Conflict C**: governance audit currently checks drift/worktrees, not explicit wrapper-utilization compliance.
- **Opportunity 1**: turn existing dry-shape wrapper tests into mandatory CI coverage gate.
- **Opportunity 2**: use existing cache-hit gate + rotate pipeline to define measurable freshness/utilization SLOs.

## Opinionated proposal (recommended)
- Adopt **Contract-First HAMR v2.1**: mandatory wrapper for all non-free lanes, adapter schema frozen, `/quota` freshness enriched, and CI/static gates that block bypass.
- Keep lane-router and HAMR responsibilities separate (router = lane decision; HAMR = cost/observability mechanics).

## Rollout sketch (≤10 child tickets, each ≤0.5d)
1. Add `azure-openai` adapter (0.5d)
2. Add `google-ai-studio` adapter (0.5d)
3. Add adapter schema tests (0.5d)
4. Add static bypass detector script + CI hook (0.5d)
5. Add wrapper-coverage test suite expansions (0.5d)
6. Add `/quota` fields `last_update_ms` + `freshness_slo_ms` (0.5d)
7. Add HAMR dashboard card (0.5d)
8. Add governance-audit check `hamr:wrapper-utilization` (0.5d)
9. Run migration pass on `scripts/global/*` direct callers (0.5d)
10. Run migration pass on root scripts + docs drift patch (0.5d)

## G1–G9 self-rating
- G1 Governance 4/5; G2 Quality 4/5; G3 Zero Cost 4/5; G4 Privacy 4/5; G5 Portability 5/5; G6 Resilience 4/5; G7 Throughput 4/5; G8 Observability 5/5; G9 Interop 5/5.

## Evidence notes (key anchors)
- Wrapper contract + disable switch: `scripts/global/hamr-provider-wrapper.js`.
- Adapter exports include current providers but not Azure/Google AI Studio naming: `scripts/global/token-provider-adapters.js`.
- `/quota` includes `schema_version:2` + `stale`: `cloudflare/hamr/routes/quota.ts`.
- Stale marking schedule every 6h: `cloudflare/hamr/wrangler.toml`, `cloudflare/hamr/scheduled.ts`.
- Local periodic push (graceful cron): `scripts/global/install-cron.sh`, `scripts/global/hamr-periodic-push.sh`.
- Hit-rate floor window: `scripts/global/cache-hit-gate.js`.
- Local telemetry file + rotate defaults: `scripts/global/cache-stats-emit.js`, `scripts/global/log-rotate.js`.
- Dry-shape wrapper tests already exist: `tests/hamr-team-integration.spec.js`.

Signed-by: Caden Vale
Team&Model: codex:gpt-5.3-codex@codex-cli