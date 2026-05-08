# Phase-R: Claude Code Team R&D for #1131 (Universal HAMR Coverage)

**Author**: Orla Harper (claude-code:opus-4-7@anthropic, role: collaborator)
**Date**: 2026-05-08
**Parent Epic**: #1130 — Optimize and harden HAMR for universal harness governance
**R&D ticket**: #1131 — Cross-team R&D: design universal HAMR coverage strategy
**Phase**: R (independent first-pass; no other team artifacts read)

## Contamination declaration

**Heavy contamination present.** Claude Code Team's same operator session (2026-05-08) authored Epic #1130, R&D #1131, AND the foundational critical assessment "fleet did not benefit from HAMR" that motivated #1130. I also performed the IT remediation that brought 36gbwinresource Ollama back online and observed firsthand that direct curl bypasses every cost/observability primitive. Specifically I read or wrote during this session:

- `instructions/hamr-routing.instructions.md` (read)
- `scripts/global/hamr-provider-wrapper.js` (read; never invoked it during the session despite making fleet calls)
- `scripts/global/token-provider-adapters.js` (read)
- `config/litellm-config.yaml` (read; observed deployed-config drift from repo)
- HAMR `/quota` endpoint (probed; observed `stale: true, hit_rate_7d: null`)
- Direct Ollama API on `100.78.22.13:11434` and `100.91.113.16:11434` (called multiple times bypassing HAMR)
- The 0% utilization assessment I delivered to the operator earlier today

**No artifacts in `planning/synthesis-1131/artifacts/` were read** before authoring this — the directory was empty when I started. Independence preserved at the artifact-content level even though the topic overlap with my prior in-session work is total.

## Source inventory

Greppable evidence base (file:line where claims are anchored):

- `scripts/global/hamr-provider-wrapper.js#L1-L40` — `wrapProviderCall(name, fn, opts)` shape; opt-in shim; reads HAMR config from `~/.claude/`, `~/.copilot/`, `~/.codex/`; respects `MEGINGJORD_HAMR_DISABLED=1`
- `scripts/global/token-provider-adapters.js#L1-L30` — adapters for `anthropic`, `openrouter`, OpenAI-compat. **No fleet-specific adapter.**
- `config/litellm-config.yaml` — repo source has 13 model aliases incl. `fleet-large` on `100.91.113.16`. **Deployed gateway on windows-laptop:4000 has only 3 models** (observed today): `mistral`, `phi3-mini`, `qwen2.5-7b`. Drift confirmed.
- `instructions/hamr-routing.instructions.md` — declares "every governed provider call SHOULD flow through `scripts/global/hamr-provider-wrapper.js`" as policy
- `scripts/global/cache-stats-emit.js` — `appendCacheStat()` writes `~/.megingjord/cache-stats.jsonl`
- `scripts/global/header-spillover.js` — spillover hint when 429 received
- `scripts/global/sticky-route.js` — provider stickiness per tier
- HAMR `/quota` endpoint at `https://hamr.chf3198.workers.dev/quota` returns schema_version 2 with `hit_rate_7d`, `providers`, `stale` fields
- Existing wrapper consumers (5 sites): `governance-audit.js`, `wiki/wiki-llm.js`, `token-telemetry-reconcile.js`, `hamr-sync-verify.js` (lib usage). NONE are fleet-side.
- Bypass call sites (greppable): `scripts/global/fleet-rollout-runner.js#L24-L40` uses raw `fetch(http://${host}:11434/api/...)`; multiple ad-hoc curls during today's IT session

## Per-question response

### Adapter design (Q1-Q4)

**Q1 — Fleet adapter shape**: prefer `fleetCall({ tier, model, prompt, opts })` where HAMR resolves host from registry. Caller doesn't need to know `100.78.22.13` vs `100.91.113.16`. Implementation: thin wrapper at `scripts/global/fleet-via-hamr.js` (~50 lines) that picks host via `fleet-config.js`, calls Ollama HTTP, returns through `wrapProviderCall('fleet', () => ollamaCall(...), { tier })`. cacheHeaders + telemetry + spillover auto-applied.

**Q2 — Cloudflare Workers AI adapter**: maps to existing `wrapProviderCall('cloudflare-workers-ai', fn, opts)`. CF AI cache headers use `cf-cache-status` response header; HAMR's `cacheHeaders('cloudflare')` should set `Cache-Control: max-age=300` request-side. `CLOUDFLARE_API_TOKEN` already separated per #1048.

**Q3 — Cerebras / Groq**: both OpenAI-compatible. Single `openai-compat` adapter accepting a `provider_id` parameter (e.g., `cerebras`, `groq`) so telemetry tags differ. Avoids 6 near-duplicate files.

**Q4 — LiteLLM gateway role**: KEEP AND WRAP. LiteLLM provides routing + retry; HAMR provides cost/observability. Replacing LiteLLM means rebuilding routing logic — out of scope. Wrap via `wrapProviderCall('litellm', () => litellmRequest(...))`. Solves the gateway-config-drift problem orthogonally (file `config/litellm-config.yaml` versus deployed config is a separate sync issue, addressed by #1118 / D-006).

### Enforcement design (Q5-Q8)

**Q5 — Lint patterns to detect**:
- `fetch\(\`?http://[\w.]+:11434` (Ollama HTTP)
- `new OpenAI\(`, `new Anthropic\(` (raw SDKs)
- `axios\.(get|post)` to provider hosts
- `requests\.(get|post)` (Python)
- `curl\s+http` in `.sh` files calling provider endpoints
Build as `scripts/global/lint-hamr-bypass.js`. Greppable, cheap.

**Q6 — Diagnostic carve-out**: file-level annotation `// hamr-bypass-ok: diagnostic` on the line above the bypass. Lint accepts the line. Documented in `instructions/hamr-routing.instructions.md`.

**Q7 — Migration cutover schedule**: 4 weeks. Week 1: ship adapters + lint advisory. Week 2: migrate top-5 highest-volume call sites. Week 3: migrate remaining. Week 4: promote lint to required. Hard-gate after #1133's auto-anneal can detect regression.

**Q8 — CI test fixtures**: HAMR Worker has a `/test/echo` endpoint we can hit; mocks not needed. `tests/hamr-coverage.spec.js` walks every `wrapProviderCall(...)` site, fires `/test/echo`, asserts cacheHeaders applied + `appendCacheStat` called.

### Observability design (Q9-Q12)

**Q9 — Goal Health Score sensor**: `hamr_utilization_rate_7d = wrapped_calls / total_inference_calls` over 7-day window. Per-provider breakdown via `cache-stats.jsonl` provider field. Diagnostic-tier calls excluded from denominator. Threshold: `<80%` → G3 actuator; `<50%` → G8 actuator. Per #1113's #1114 R&D matrix.

**Q10 — `/quota` always-fresh**: BOTH push cron AND Worker scheduled handler. Operator-machine-offline scenario: Worker's scheduled handler reads from KV (last known) and degrades `stale: true`. Cron pushes when machine online. Belt + suspenders.

**Q11 — Dashboard panel**: 4 widgets — (1) coverage rate gauge, (2) per-provider call rate stacked-area, (3) /quota staleness counter, (4) spillover frequency heatmap. Reuses existing dashboard `events.jsonl` consumer pattern.

**Q12 — Telemetry retention**: cache-stats.jsonl 30d local + 90d in HAMR KV. Dashboard data window: 7d default, 90d on demand. Rotation cron runs nightly.

### Migration inventory (Q13-Q15)

**Q13 — Bypass audit**: my grep finds 2 obvious sites (`fleet-rollout-runner.js`, `token-provider-adapters.js` in some flows) plus the IT-session ad-hoc curls (not committed). Estimate: 5-15 sites once exhaustive grep runs across all `*.js`, `*.py`, `*.sh`. Per-area: mostly `scripts/global/` and `tests/`.

**Q14 — Migration order**: high-volume FIRST (fastest signal recovery). Sticky-route + cache-stats benefit most from where calls actually happen. Top-3 likely: cascade-dispatch consumers, wiki-llm (already wrapped — verify), fleet-rollout-runner.

**Q15 — Rollback per migration**: feature flag `MEGINGJORD_HAMR_BYPASS_<SITE>=1` per site for 2 weeks post-migration. After stable, flag removed in cleanup PR.

### Cross-team value (Q16-Q19)

**Q16 — What the prior synthesis (#1105) missed about HAMR**: nothing structural — #1105 covered goals, not coverage. This is a true greenfield Epic. The 5/11 D-N findings from #1105 were content (priority sentence, role-baton, etc.); none touched HAMR coverage as a goal.

**Q17 — Per-team lens**: CC has the operator-session 0% utilization assessment fresh. CP has cross-team write-path knowledge from synthesis-protocol design. CX has fleet/runtime sync visibility (CX-RD C8 surfaced runtime-deploy gap, sibling problem).

**Q18 — Should detector also watch synthesis outcomes**: yes — if a synthesis produces decisions involving inference, HAMR coverage of those decisions should be a `decisions.md` evidence requirement. Couples this Epic with #1112.

**Q19 — Team-specific patterns**: not really — HAMR is provider-side, team-agnostic. Detector is universal; only sensor weights might tune per-team.

## Conflict / opportunity matrix

| ID | Item | Severity | Resolution direction |
|---|---|---|---|
| C1 | LiteLLM deployed-config drifts from repo source | HIGH | Out of scope here; tracked under #1118 D-006 (now merged) |
| C2 | `wrapProviderCall` exists but no fleet-side adapter — 0% wrap rate on fleet today | HIGH | Build `fleet-via-hamr.js` (Q1) |
| C3 | `/quota.stale=true` because emit-cron is intermittent | MEDIUM | Worker scheduled handler (Q10) |
| C4 | Ad-hoc curls in IT diagnostics pollute would-be production telemetry | LOW | `// hamr-bypass-ok: diagnostic` annotation (Q6) |
| C5 | No automated detection of bypass | HIGH | Lint script (Q5) |
| C6 | Prior synthesis #1105 didn't surface this gap | LOW | Cross-team value isn't always coverage; this is fine |

## Proposal

Build the universal-coverage layer as a 5-PR sequence:

1. `scripts/global/fleet-via-hamr.js` — fleet adapter shim. ~50 lines.
2. `scripts/global/lint-hamr-bypass.js` — bypass detector with diagnostic annotation. ~80 lines.
3. `.github/workflows/hamr-bypass-lint.yml` — advisory-first workflow. ~30 lines.
4. Migration of top-5 bypass sites to `wrapProviderCall`. Per-site PRs.
5. Promote bypass-lint to required (after migration stable for 2 weeks).

Plus integration deliverables:

- `governance-audit.js` consumes `hamr_utilization_rate_7d` as a violation signal.
- Dashboard 4-widget HAMR panel (#1130 AC7).
- Documentation: `docs/howto/hamr-coverage.md`.
- `instructions/hamr-routing.instructions.md` updated with universality requirement + diagnostic carve-out syntax.

## Rollout sketch

| Step | Effort | Owner role | Output |
|---|---|---|---|
| 1 | 0.2d | Collaborator | fleet-via-hamr.js + tests |
| 2 | 0.3d | Collaborator | lint-hamr-bypass.js + diagnostic annotation contract |
| 3 | 0.1d | Collaborator | hamr-bypass-lint.yml advisory workflow |
| 4a | 0.3d | Collaborator | migrate fleet-rollout-runner.js |
| 4b | 0.2d | Collaborator | migrate remaining script-side bypasses |
| 5 | 0.2d | Admin | Worker scheduled handler for /quota always-fresh |
| 6 | 0.4d | Collaborator | dashboard 4-widget HAMR panel |
| 7 | 0.2d | Manager | docs/howto/hamr-coverage.md + instructions update |
| 8 | 0.2d | Admin | promote bypass-lint to required after 2 weeks stable |
| **Total** | **~2.1d** | | |

## Self-rating against G1..G9

| Goal | Score | Rationale |
|---|---|---|
| G1 Governance | 9/10 | Cross-team R&D protocol followed; contamination declared honestly |
| G2 Quality | 8/10 | File:line evidence throughout; effort estimates grounded |
| G3 Zero Cost | 9/10 | This R&D done in-session; no fleet escalations |
| G4 Privacy | 9/10 | No secrets opened; no PII |
| G5 Portability | 8/10 | Adapters proposed are settings-driven; no host-coupling |
| G6 Resilience | 8/10 | Belt+suspenders /quota proposal; rollback flags per migration |
| G7 Throughput | 7/10 | Migration sequenced for fastest signal recovery |
| G8 Observability | 9/10 | Goal Health Score sensor wiring detailed |
| G9 Interoperability | 8/10 | All 6 providers covered (Ollama, CF AI, Cerebras, Groq, LiteLLM, Anthropic) |

---

Signed-by: Orla Harper
Team&Model: claude-code:opus-4-7@anthropic
Role: collaborator
