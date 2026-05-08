# Codex Team Phase-R R&D: Universal HAMR Coverage

## Header

- Parent Epic: #1130, "Optimize and harden HAMR for universal harness governance"
- R&D ticket: #1131, "Cross-team R&D: design universal HAMR coverage strategy"
- Date: 2026-05-08
- Team: Codex Team (`cx`)
- Model: GPT-5 via Codex CLI
- Alias: Nova Harper
- Role: collaborator
- Team&Model: `codex:gpt-5@codex-cli`

## Contamination Declaration

- Read before authoring: #1131 body, #1130 body, sibling issue bodies #1112,
  #1113, #1114, #1125, #1126, `planning/prompts/team-rd.md`,
  `planning/synthesis-1131/README.md`, `planning/synthesis-1131/KICKOFF.md`,
  repo instructions, registry, inventory, HAMR scripts, tests, dashboard code,
  Worker quota/cache routes, and representative grep output.
- Posted before authoring: a minimal Codex Manager scope comment on #1131 with
  no research findings, to satisfy governance handoff before file edits.
- Other-team artifacts: saw the filename `planning/synthesis-1131/artifacts/cc-rd.md`
  in a file listing, but did not open or read it. No Copilot artifact was read.
- Issue comments: did not read existing issue comments.
- Web search: none.
- Scope mismatch noted: `KICKOFF.md` says Q1..Q19, but #1131 currently
  enumerates Q1..Q17 only. This artifact answers Q1..Q17.

## Source Inventory

- HAMR contract and boundaries: `instructions/hamr-routing.instructions.md`.
- Core wrapper and adapters: `scripts/global/hamr-provider-wrapper.js`,
  `scripts/global/token-provider-adapters.js`, `scripts/global/litellm-client.js`.
- Fleet bypass surfaces: `scripts/global/ollama-direct.js`,
  `scripts/global/task-router-dispatch.js`, `scripts/global/task-router.js`,
  `scripts/global/fleet-benchmark-runner.js`,
  `scripts/global/fleet-rollout-runner.js`.
- Free-cloud and partial wrap surfaces: `scripts/global/free-router.js`,
  `scripts/wiki/wiki-llm.js`, `scripts/global/token-telemetry-reconcile.js`.
- Diagnostic probe surfaces: `scripts/global/capability-probe.js`,
  `scripts/global/routing-refresh.js`.
- Observability surfaces: `cloudflare/hamr/routes/quota.ts`,
  `cloudflare/hamr/routes/cache-stats.ts`, `cloudflare/hamr/scheduled.ts`,
  `scripts/global/cache-stats-emit.js`, `scripts/global/cache-stats-push.js`,
  `scripts/global/hamr-periodic-push.sh`, `scripts/global/governance-audit.js`.
- Dashboard/tests/config: `dashboard/js/render-panels.js`,
  `dashboard/js/quota-live.js`, `tests/hamr-provider-wrapper.spec.js`,
  `tests/hamr-team-integration.spec.js`, `tests/fleet-dispatch.spec.js`,
  `config/litellm-config.yaml`, `inventory/devices.json`,
  `inventory/services.json`, `package.json`.
- Search fallback: `rg` was unavailable in this shell, so representative search
  used standard `grep -RInE` over `scripts/global`, `scripts/wiki`, `tests`,
  `config`, and `dashboard`.

## Per-Question Response

- Q1 fleet adapter: production should call `fleetCall({prompt, model, tier, taskClass, routeHint, diagnostic})`; HAMR resolves host/model from policy and inventory, with `hostOverride` only for diagnostics. Evidence: `repo: scripts/global/task-router.js#L24-L41`, `repo: scripts/global/task-router-dispatch.js#L18-L50`, `repo: scripts/global/hamr-provider-wrapper.js#L58-L80`.
- Q2 Cloudflare Workers AI: support provider `cloudflare` through LiteLLM first and a direct adapter only where needed; record exact request/usage metadata and set cache reads to zero unless the response exposes exact cache fields. Evidence: `repo: config/litellm-config.yaml#L62-L78`, `repo: scripts/global/token-provider-adapters.js#L90-L94`, `repo: scripts/global/litellm-client.js#L88-L100`.
- Q3 Cerebras/Groq: use one `openai-compat` request helper but retain named provider adapters for quota, cost, telemetry, and spillover identity. Evidence: `repo: scripts/global/token-provider-adapters.js#L78-L94`, `repo: scripts/global/free-router.js#L41-L63`, `repo: scripts/wiki/wiki-llm.js#L22-L39`.
- Q4 LiteLLM: wrap it rather than replace it; keep named groups, fallback chains, timeout, and budget logic, then wrap direct Ollama fallback under the same contract. Evidence: `repo: scripts/global/litellm-client.js#L1-L8`, `repo: scripts/global/litellm-client.js#L61-L68`, `repo: config/litellm-config.yaml#L80-L115`, `repo: inventory/services.json#L81-L91`.
- Q5 lint: detect raw Ollama URLs, direct OpenAI-compatible/provider fetches, direct LiteLLM chat fetches, raw provider curl, direct SDK calls outside adapters, and `.response` reads from wrapper results. Evidence: `repo: scripts/global/ollama-direct.js#L5-L39`, `repo: scripts/global/task-router-dispatch.js#L25-L50`, `repo: scripts/global/free-router.js#L41-L63`, `repo: scripts/global/routing-refresh.js#L20-L59`, `repo: scripts/wiki/wiki-llm.js#L42-L49`, `repo: scripts/global/hamr-provider-wrapper.js#L62-L80`.
- Q6 diagnostics: diagnostics are not exempt from wrapping; they are excluded from production utilization and tagged `{tier:'diagnostic', diagnostic:true, purpose}`. Evidence: `repo: scripts/global/capability-probe.js#L25-L40`, `repo: scripts/global/capability-probe.js#L43-L58`, `repo: scripts/global/routing-refresh.js#L50-L59`.
- Q7 cutover: Week 0 inventory/advisory lint, Week 1 adapters/dry tests, Week 2 production migrations, Week 3 required production lint, Week 4 audit/dashboard thresholds. Evidence: `repo: instructions/hamr-routing.instructions.md#L71-L79`, `repo: package.json#L38-L58`, `repo: package.json#L101-L114`.
- Q8 fixtures: CI should use mocked `callFn`, stubbed `fetch`, temp stats files, and lint fixtures; live provider tests stay optional. Evidence: `repo: tests/hamr-provider-wrapper.spec.js#L9-L74`, `repo: tests/hamr-team-integration.spec.js#L21-L28`, `repo: tests/hamr-team-integration.spec.js#L58-L66`, `repo: tests/fleet-dispatch.spec.js#L8-L27`.
- Q9 sensor: `production_hamr_utilization_rate_7d = wrapped_production_inference_calls_7d / max(1, wrapped_production_inference_calls_7d + detected_unwrapped_production_inference_calls_7d)`. Report diagnostic coverage separately; stale/missing data is degraded, not zero. Evidence: `repo: scripts/global/cache-stats-emit.js#L16-L41`, `repo: scripts/global/governance-audit.js#L11-L13`, `repo: scripts/global/governance-audit.js#L58-L72`.
- Q10 `/quota`: use both local push cron and Worker scheduled freshness marking; add visible push-failure state because graceful cron exits can hide stale telemetry. Evidence: `repo: cloudflare/hamr/routes/quota.ts#L41-L55`, `repo: cloudflare/hamr/routes/cache-stats.ts#L36-L66`, `repo: cloudflare/hamr/scheduled.ts#L10-L24`, `repo: scripts/global/hamr-periodic-push.sh#L34-L40`.
- Q11 dashboard: add a HAMR panel with coverage rate, stale state, provider rate, production/diagnostic split, spillover, cache hit rate, top bypasses, and batch eligibility. Evidence: `repo: dashboard/js/render-panels.js#L48-L69`, `repo: dashboard/js/quota-live.js#L4-L53`.
- Q12 retention: rotate local JSONL daily/by size, retain 30 days raw locally, push 7-day aggregates to KV, and keep 30-90 day dashboard aggregates with minimal KV detail. Evidence: `repo: scripts/global/cache-stats-emit.js#L9-L10`, `repo: cloudflare/hamr/routes/cache-stats.ts#L58-L64`, `repo: package.json#L51-L52`.
- Q13 inventory: estimated at least 13 actionable surfaces excluding docs: production `ollama-direct`, `task-router-dispatch`, `litellm-client`, `free-router`; diagnostics `fleet-benchmark-runner`, `fleet-rollout-runner`, `capability-probe`, `routing-refresh`; partial wrapper risks `wiki-llm`, `token-telemetry-reconcile`; test/config/dashboard `fleet-dispatch`, `litellm-config`, quota panels. Evidence: Q1-Q12 plus `repo: inventory/devices.json#L1-L1`.
- Q14 order: migrate contract/tests first, then high-volume production paths, partial wrappers, diagnostics, dashboard, and audit. Low-risk probes can prepare early, but production migration moves utilization. Evidence: `repo: tests/fleet-dispatch.spec.js#L46-L58`, `repo: scripts/global/task-router-dispatch.js#L36-L50`, `repo: scripts/global/free-router.js#L41-L63`.
- Q15 rollback: keep `MEGINGJORD_HAMR_DISABLED=1` as emergency rollback, with per-adapter fallback while lint is advisory; promote lint only after dry tests and parity prove safety. Evidence: `repo: scripts/global/hamr-provider-wrapper.js#L33-L40`, `repo: scripts/global/hamr-provider-wrapper.js#L64-L68`, `repo: tests/hamr-provider-wrapper.spec.js#L44-L55`.
- Q16 #1105 miss: it treated HAMR as an available governance control, not as a measured coverage surface. The gap is "wrapper exists" versus "all governed inference paths are wrapper-only." Evidence: `repo: instructions/hamr-routing.instructions.md#L29-L41` plus direct fleet/free call sites above.
- Q17 Codex lens: the local worktree shows fleet routing, direct Ollama dispatch, and tests pinned to direct URLs; therefore host-specific calls belong to diagnostic/admin metadata, not production API shape. Evidence: `repo: inventory/devices.json#L1-L1`, `repo: scripts/global/task-router.js#L24-L41`, `repo: scripts/global/task-router-dispatch.js#L25-L50`, `repo: tests/fleet-dispatch.spec.js#L29-L35`.

## Conflict / Opportunity Matrix

| ID | Type | Severity | Finding | Recommendation |
| --- | --- | --- | --- | --- |
| C1 | Conflict | High | Wrapper docs omit `ollama`, `litellm`, `cloudflare`, and generic openai-compatible provider coverage. | Add named adapters and update contract. |
| C2 | Conflict | High | Fleet dispatch bypasses HAMR by design today. | Put `fleetCall` behind wrapper before utilization gates. |
| C3 | Conflict | High | LiteLLM has manual stats and direct fallback, not wrapper-mediated coverage. | Wrap LiteLLM and fallback together. |
| C4 | Conflict | Medium | Diagnostics use raw fetch and would pollute production if simply wrapped. | Add explicit diagnostic tier. |
| C5 | Conflict | High | `/quota` depends on local pushes and can stay stale silently. | Keep push plus Worker stale marking, add failure visibility. |
| C6 | Conflict | High | Governance audit has no HAMR utilization sensor. | Add GHS sensor and threshold reporting. |
| C7 | Conflict | Medium | Dashboard quota panel is not a HAMR coverage panel. | Add HAMR-specific panel metrics. |
| O1 | Opportunity | High | Existing token adapters already share OpenAI-compatible normalization. | Extend rather than rewrite. |
| O2 | Opportunity | High | Existing wrapper tests provide dry-call pattern. | Reuse for CI-safe coverage tests. |

## Proposal

1. Keep `wrapProviderCall` as the primitive and add a universal adapter layer in
   `scripts/global/` only.
2. Standardize wrapper results as `{ok, value, sticky, spillover, meta}` and
   either add a short-term `.response` alias or fix current partial callers.
3. Add adapters:
   `fleetCall(request, opts)`, `litellmCall(request, opts)`,
   `openaiCompatCall(provider, request, opts)`, `cloudflareCall(request, opts)`,
   plus thin Anthropic/OpenAI exports for parity.
4. Make provider identity explicit: runtime `codex|copilot|claude-code`, provider
   `ollama|litellm|cloudflare|groq|cerebras|openrouter|anthropic|openai`, tier
   `free|fleet|haiku|premium|diagnostic|observability`.
5. Add `scripts/global/hamr-coverage-lint.js` with advisory mode first and
   required mode after migration.
6. Add HAMR utilization to governance-audit and dashboard using 7-day production
   and diagnostic rates.
7. Preserve zero-cost routing order: the adapter wraps whichever lane the task
   router selected; it must not escalate to a paid lane by itself.

## Rollout Sketch

| Seq | Child work | Effort | Depends on |
| --- | --- | --- | --- |
| 1 | Wrapper result contract/backcompat and provider taxonomy tests. | 0.3d | none |
| 2 | Fleet adapter design implementation with dry tests. | 0.5d | 1 |
| 3 | OpenAI-compatible, Groq, Cerebras, Cloudflare adapters. | 0.5d | 1 |
| 4 | LiteLLM wrapper plus config/runtime drift audit. | 0.4d | 1 |
| 5 | Migrate production call sites: router dispatch, Ollama direct, free router. | 0.5d | 2-4 |
| 6 | Diagnostic tier and probe/benchmark/rollout migration. | 0.4d | 2 |
| 7 | HAMR coverage lint catalog, fixtures, advisory CI. | 0.5d | 5-6 |
| 8 | Utilization sensor, `/quota` freshness visibility, governance-audit hook. | 0.5d | 5 |
| 9 | Dashboard HAMR panel and quota freshness view. | 0.5d | 8 |
| 10 | Docs/runbook and lint cutover to required gate. | 0.4d | 7-9 |

## Self-Rating Against Harness Goals

| Goal | Score | Rationale |
| --- | ---: | --- |
| G1 Governance | 9 | Centers the contract, lint, audit, and baton evidence. |
| G2 Quality | 8 | Uses concrete repo evidence and CI fixture strategy; needs synthesis review. |
| G3 Zero Cost | 9 | Wraps chosen lanes without escalating routing cost. |
| G4 Privacy | 8 | Recommends aggregate telemetry and local raw retention. |
| G5 Portability | 8 | Keeps logic in `scripts/global` and uses inventory/env contracts. |
| G6 Resilience | 8 | Includes fallbacks, stale handling, and rollback modes. |
| G7 Throughput | 7 | Prioritizes high-volume migration, but lint may add temporary friction. |
| G8 Observability | 9 | Adds utilization, freshness, provider, and diagnostic metrics. |
| G9 Interoperability | 9 | Treats Claude Code, Copilot, and Codex as runtimes over shared HAMR paths. |

## Sign-Off

Signed-by: Nova Harper
Team&Model: codex:gpt-5@codex-cli
Role: collaborator
