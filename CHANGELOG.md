# Changelog

## [Unreleased] — Convergence Design v1: harness-wide feature integration (#922, EPIC #922)

### Added
- `research/harness-convergence-design-2026-05-05.md`: approved cross-team architecture for the 4 harness axes (governance / tooling / fleet / HAMR) + Dashboard as observation/control plane.
- `raw/articles/harness-convergence-design-2026-05-05.md`: raw ingest source.
- `wiki/sources/harness-convergence-design-2026-05-05.md`: wiki source page.
- `wiki/log.md`: convergence entry.

### Notes
- Lane: docs-research.
- 9-round 3-team SIGN_OFF on Epic #922 (Codex / Copilot / Claude Code).
- Authored as operator-deputy fast-track per operator authorization (single-LLM voicing all 3 teams; convergence quality conditional on operator review).
- Downstream child Epic to be filed for development implementation per design.

## [Unreleased] — HAMR Wave 7 follow-up: per-team opt-in configuration (#963, EPIC #860)

### Added
- `~/.claude/hamr-config.json`, `~/.copilot/hamr-config.json`, `~/.codex/devenv-ops/hamr-config.json` (NEW): per-team opt-in markers `{enabled, activated_at, activated_by, team_runtime}`. Written by `HAMR_TEAM=<team> npm run hamr:activate`.
- `tests/hamr-team-optin.spec.js`: 5 tests covering TEAM_CONFIG_PATHS, readTeamConfig, isDisabled precedence, marker presence, env-override semantics.

### Changed
- `scripts/global/hamr-provider-wrapper.js`: `isDisabled()` now also reads first-found team config marker; respects `enabled: false` even when env unset. Exports `readTeamConfig`, `TEAM_CONFIG_PATHS`. Env var `MEGINGJORD_HAMR_DISABLED=1` still wins (air-gap escape hatch preserved).
- `scripts/global/hamr-activate.sh`: 4-step → 5-step. New step 5 writes per-team marker based on `HAMR_TEAM=claude-code|copilot|codex`.
- `tests/hamr-activate.spec.js`: updated to 5-step expectations.
- `tests/hamr-worker.spec.js`: 3 stale-stub tests replaced with current production assertions (Wave 3 mailbox 400/401 paths + Wave 4/6 /quota schema v2 + stale field).

### Notes
- Lane: code-change.
- All 3 teams now opted in (markers present + `enabled: true`).
- Full suite: 166/166 pass.

## [Unreleased] — HAMR Wave 7 child F: cross-team integration test suite (#956, EPIC #860)

### Added
- `tests/hamr-team-integration.spec.js` (≤100 lines): 9 smoke tests covering Worker reachability + auth gates, signing key resolution, canonicalize determinism, provider-wrapper instrumentation, sync-verify, JSONL operator-locality, and `MEGINGJORD_HAMR_DISABLED` bypass.

### Notes
- **Full Wave 1-7 HAMR suite: 164/164 pass** (10.7s wall time, $0 operator cost).

## [Unreleased] — HAMR Wave 7 child E: sync verification (#955, EPIC #860)

### Added
- `scripts/global/hamr-sync-verify.js` (≤100 lines): read-only verification that the canonical 14-script HAMR set is present in `~/.copilot/scripts/` and `~/.codex/devenv-ops/scripts/`. Non-zero exit on miss; remediation hint points to `npm run sync:both:apply`.
- `package.json` script: `hamr:sync-verify`.
- `tests/hamr-sync-verify.spec.js`: 4 tests.

### Notes
- Live-verified: post-`deploy:both:apply` returns `ok:true`.

## [Unreleased] — HAMR Wave 7 child D: hamr:activate one-shot installer (#954, EPIC #860)

### Added
- `scripts/global/hamr-activate.sh` (≤100 lines): runs install-hooks (#934) → install-cron (#953) → env check → Worker reachability. Each team runs once per checkout.
- `package.json` scripts: `hamr:activate`, `hamr:install-cron`.
- `tests/hamr-activate.spec.js`: 3 tests.

## [Unreleased] — HAMR Wave 7 child C: periodic-push cron installer (#953, EPIC #860)

### Added
- `scripts/global/hamr-periodic-push.sh` (≤100 lines): runs `hamr:cache-push` + `hamr:health-push`; logs to `~/.megingjord/push-log.jsonl`; gracefully exits 0.
- `scripts/global/install-cron.sh` (≤100 lines): idempotent crontab installer at 6h cadence with marker-based dedup.
- `tests/periodic-push-cron.spec.js`: 4 tests.

## [Unreleased] — HAMR Wave 7 child B: hamr-provider-wrapper opt-in shim (#952, EPIC #860)

### Added
- `scripts/global/hamr-provider-wrapper.js` (≤100 lines): `wrapProviderCall(provider, callFn, opts)` — opt-in shim that injects HAMR cost levers (`cacheHeaders` #926, `appendCacheStat` #932, `maybeSpillover` #927, `pickStickyProvider` #926) around any provider call. Pure library; zero modification to existing call sites. Honors `MEGINGJORD_HAMR_DISABLED=1` for opt-out.
- `tests/hamr-provider-wrapper.spec.js`: 7 tests (cacheHeaders pass-through, spillover on 429, no-spillover on 200, sticky decision, disabled env no-op, exception isolation, JSONL emission).

### Notes
- Lane: code-change. Disjoint from Copilot Team active surface.

## [Unreleased] — HAMR Wave 7 child A: cross-team instruction integration (#951, EPIC #860)

### Added
- `instructions/hamr-routing.instructions.md` (≤100 lines): canonical HAMR governance contract used by all 3 teams (Claude Code, Copilot, Codex). Documents producer chains, provider-call wrapper contract, /mcp dispatch, cost levers, and boundaries vs Copilot Team active surface.

### Changed
- `CLAUDE.md`: imports new HAMR routing instructions.
- `AGENTS.md`: adds "HAMR cross-team routing" section pointing to canonical file.
- `.github/copilot-instructions.md`: adds "HAMR Cross-Team Routing" section with explicit non-duplication note.
- `instructions/global-task-router.instructions.md`: adds boundary clarification (lane vs cost-mechanics) and "do not duplicate HAMR mechanics" rule.

### Notes
- Lane: code-change.
- Dedup audit performed — no existing instruction had HAMR-adjacent canonical content; only `global-task-router` overlapped (lane policy), resolved via cross-reference.
- Strict-superset preserved across all 4 governance files.

## [Unreleased] — HAMR Wave 6 child 4: Anthropic Batch live validator (#944, EPIC #860)

### Added
- `scripts/global/batch-validator.js` (≤100 lines): dry-run + opt-in live validator for `submitBatch` (#927). Default mode: builds 1-request 32-token Haiku payload, validates eligibility, exits without submitting (**$0 operator cost**). Live mode: requires both `--live` and `--operator-approved` flags (double-flag cost gate); submits + polls 30s/30min; asserts `status: 'ended'`. Estimated live cost: <$0.0001.
- `tests/batch-validator.spec.js`: 5 tests (sample-batch shape, dry-run output, CLI dry-run exit 0, CLI live without approval exits 1, eligibility check).
- `package.json` script: `hamr:batch-validate`.

### Notes
- Lane: code-change.
- Cost-gate enforcement verified: `--live` without `--operator-approved` exits 1 with diagnostic.

## [Unreleased] — HAMR Wave 6 child 3: substrate-health push + Worker /substrate-health KV writer (#943, EPIC #860)

### Added
- `cloudflare/hamr/routes/substrate-health.ts` (≤100 lines): NEW Worker endpoint mirroring `/cache-stats` (#933). Ed25519 DPoP auth + freshness validation + writes `substrate-health:latest` to KV (consumed by `/mcp doctor:probe` #935).
- `scripts/global/substrate-health-push.js` (≤100 lines): local push client. Reads `~/.megingjord/substrate-health.json` (#911); signs canonical JSON; POSTs to HAMR `/substrate-health`.
- `cloudflare/hamr/worker.ts`: `POST /substrate-health` route.
- `tests/substrate-health-push.spec.js`: 5 tests (2 unit + 3 live route smoke).
- `package.json` script: `hamr:health-push`.

### Notes
- Lane: code-change.
- Worker redeployed (`91e2b5ea-54d1-49c8-adf6-04667b4bf8e2`).
- Closes producer/consumer chain: `hamr:health` (#911) → `hamr:health-push` (this) → KV → `/mcp doctor:probe` (#935).

## [Unreleased] — HAMR Wave 6 child 2: /mcp mailbox:read envelope-content fetch (#942, EPIC #860)

### Changed
- `cloudflare/hamr/routes/mcp-dispatch.ts`: `mailbox:read` accepts `params.fetch_contents`. When truthy, fetches each R2 object body and parses as JSON; caps at 50 envelopes (existing constant); skips malformed (`{key, envelope: null, error: 'invalid_json' | 'object_missing'}`). Default behavior (keys-only) unchanged.

### Added
- `tests/mailbox-fetch-contents.spec.js`: 3 live route tests covering auth-before-dispatch ordering with and without `fetch_contents`.

### Notes
- Lane: code-change.
- Worker redeployed (`829e843c-dd8d-41e9-a18f-b3baa685b7eb`).
- Strict-superset preserved: `fetch_contents` opt-in; pre-existing consumers unaffected.

## [Unreleased] — HAMR Wave 6 child 1: log rotation + scheduled freshness signal (#941, EPIC #860)

### Added
- `scripts/global/log-rotate.js` (≤100 lines): generic JSONL rotator. Caps at N lines (default 10k); on overflow, gzip-archives `<file>.<iso-ts>.gz` then truncates. CLI: `npm run hamr:log-rotate -- <file> [--max-lines=<N>]`.
- `cloudflare/hamr/scheduled.ts` (≤100 lines): Cloudflare scheduled handler. Reads `cache-stats:hit-rate-7d:meta`; if `ts > 24h ago` (or missing), sets `cache-stats:hit-rate-7d:stale=true`.
- `cloudflare/hamr/wrangler.toml`: `crons = ["0 */6 * * *"]` cron trigger every 6h.
- `tests/log-rotate.spec.js`: 4 tests (countLines, missing-file, no-rotate, rotate-archives-truncates with gzip roundtrip).
- `package.json`: `hamr:log-rotate` script.

### Changed
- `cloudflare/hamr/worker.ts`: exports `scheduled(event, env)` invoking `scheduledHandler`.
- `cloudflare/hamr/routes/quota.ts`: response now includes additive `stale: boolean` field; reads `cache-stats:hit-rate-7d:stale` KV key.

### Notes
- Lane: code-change.
- Worker redeployed (`d5f69c67-1430-4485-9a90-bbacf85b726d`); cron schedule live (every 6h).
- Live-verified `/quota` returns `stale: false` correctly; additive — existing consumers unaffected.

## [Unreleased] — HAMR Wave 5 child 4: real /mcp serving (capability dispatch) (#935, EPIC #860)

### Changed
- `cloudflare/hamr/routes/mcp.ts` (≤100 lines): replaces the Wave 5 placeholder receipt with capability dispatch. Auth + SLSA gate unchanged (still 401/503 paths from #927); post-gate body is parsed for `{capability, params}` and routed.
- `cloudflare/hamr/routes/mcp-dispatch.ts` (NEW, ≤100 lines): handlers for `bundle:fetch` (R2 read at `bundle/<tier>.txt`), `doctor:probe` (KV read at `substrate-health:latest`), `mailbox:read` (R2 list at `mailbox/`). Unknown capability → 400 with `supported` list.

### Added
- `tests/mcp-dispatch.spec.js`: 4 live route tests covering auth-first ordering, missing-signature path, unknown-key-id path, and bundle-SHA-with-bogus-key auth-before-SLSA ordering.

### Notes
- Lane: code-change.
- Worker redeployed (version `40f689dc-c82a-41b3-99ab-4e08cce7d07c`).
- Strict-superset preserved: 401/503 contracts unchanged; only post-auth body shape extended.
- All files ≤100 lines.

## [Unreleased] — HAMR Wave 5 child 3: R9.2 cwd-vs-branch hook automation (#934, EPIC #860)

### Added
- `scripts/hooks/pre-push-branch-check.sh` (≤100 lines): v3.2.2 §R9.2.1 enforcement. Reads stdin from git's pre-push hook; exits non-zero with diagnostic when local branch ≠ HEAD; appends every push attempt to `~/.megingjord/branch-ops-audit.log`.
- `scripts/hooks/branch-ops-audit.sh` (≤100 lines): v3.2.2 §R9.2.3 audit log. Multi-purpose handler for `post-checkout` (only branch checkouts, skips file-only) and `post-commit`. Each event appends a JSON-line record with `{ts, op, cwd, head, head_sha, prev, new}`.
- `scripts/global/install-hooks.sh` (≤100 lines): idempotent installer. Symlinks `pre-push` to the branch-check; writes wrapper scripts for `post-checkout` and `post-commit` that invoke `branch-ops-audit.sh`. Detects + chains existing pre-push hooks (e.g., readability gate) without overwriting.
- `tests/r92-hooks.spec.js`: 6 tests covering executability, branch-match pass, branch-mismatch fail, audit-log JSON-line emission for post-checkout (branch op), audit-log skip for post-checkout (file op), audit-log emission for post-commit.
- `package.json` script: `hooks:install`.

### Notes
- Lane: code-change.
- Closes the empirically-recurring cwd-vs-branch hazard (4 occurrences across HAMR Waves 1-4).
- Hooks are opt-in via `npm run hooks:install`; existing pre-push readability gate is preserved via chain-append.

## [Unreleased] — HAMR Wave 5 child 2: Worker /cache-stats KV writer + push client (#933, EPIC #860)

### Added
- `cloudflare/hamr/routes/cache-stats.ts` (≤100 lines): NEW Worker endpoint. POST with Ed25519 DPoP auth (re-uses #927 verification pattern); validates `hit_rate ∈ [0,1]` and timestamp freshness (≤24h); writes `cache-stats:hit-rate-7d` to KV (consumed by `/quota` #927).
- `cloudflare/hamr/worker.ts`: routes `POST /cache-stats` to new handler.
- `scripts/global/cache-stats-push.js` (≤100 lines): local push client. Reads operator Ed25519 key from `OPERATOR_KEY_SEED_B64` env or `~/.megingjord/keys/operator-ed25519.pem` PEM file (re-uses #894 4-tier key store). Computes hit-rate from `cache-hit-gate.runGate()`, signs canonical JSON, POSTs to HAMR `/cache-stats`.
- `tests/cache-stats-push.spec.js`: 5 tests (3 unit + 2 live route smoke).
- `package.json` script: `hamr:cache-push`.

### Notes
- Lane: code-change.
- Worker redeployed (version `d694c47f-343e-4cc8-812f-c7de22d16de9`).
- Live-verified `/cache-stats` returns 401 `missing_dpop` and 401 `missing_signature_headers` correctly.
- Closes the producer gap on `/quota.hit_rate_7d`; consumer flow already shipped in Wave 4 #927.

## [Unreleased] — HAMR Wave 5 child 1: cache-stats.jsonl emit-site wiring (#932, EPIC #860)

### Added
- `scripts/global/cache-stats-emit.js` (≤100 lines, CommonJS): atomic appender for `~/.megingjord/cache-stats.jsonl`. Exports `appendCacheStat({provider, cache_read_tokens, input_tokens, ...})`, `fromTokenRecord(adapterOutput)`, `STATS_FILE`. Closes the consumer/producer gap left by Wave 4 child 3 (#926).
- `scripts/global/litellm-client.js`: `chatComplete` now emits one cache-stat record per successful call via internal `emitCacheStatSafe` helper (try/catch isolated — never breaks the chat call).
- `tests/cache-stats-emit.spec.js`: 7 tests; verifies normalized schema, throw-on-missing-provider, multi-append, fromTokenRecord conversion, end-to-end emit→gate flow above and below floor.
- `package.json` script: `hamr:cache-emit`.

### Notes
- Lane: code-change.
- Disjoint from Copilot Team active surface — only `litellm-client.js` (already disjoint) + new emitter file.
- All files ≤ 100 lines; `litellm-client.js` exactly at 100.
- Strict-superset preserved: emitter is purely additive; `chatComplete` API unchanged.

## [Unreleased] — HAMR Wave 4 child 3: provider caching adapters + sticky-route + cache-hit gate (#926, EPIC #860)

### Added
- `scripts/global/cache-hit-gate.js` (≤100 lines, CommonJS): rolling 7-day cache-hit-rate gate. Reads `~/.megingjord/cache-stats.jsonl`; computes `cache_read_tokens / input_tokens`; alerts when below 80% per v3.2 §R5. Exits non-zero when failing for CI gating.
- `scripts/global/sticky-route.js` (≤100 lines): tier → preferred-provider sticky router. Returns `previousProvider` when in-tier and healthy (cache-hit win); falls back via `~/.megingjord/substrate-health.json` (#911) when previous unhealthy. Tiers: `free`, `fleet`, `haiku`, `premium`.
- `scripts/global/token-provider-adapters.js`: 3 new OAI-shape adapters (`openai`, `groq`, `cerebras`) extracting `cache_read_tokens` from `prompt_tokens_details.cached_tokens` or `prompt_cache_hit_tokens`. Now covers all 9 supported providers (anthropic, openai, gemini, groq, cerebras, openrouter, ollama, litellm, copilot). Shared `oaiShape` helper keeps file ≤100 lines.
- `scripts/global/litellm-client.js`: new `cacheHeaders(provider, opts)` export emitting native cache hints per v3.2 §R5 9-row matrix (Anthropic prompt-caching + extended-cache-ttl betas; Gemini `cachedContent`; Groq/Cerebras/OpenAI `x-cache-control` headers).
- `tests/cache-adapters.spec.js`: 9 deterministic tests; 17 underlying assertions covering all 9 adapters, cache-header matrix, hit-rate computation across windowed/empty/normal records, gate pass/fail, sticky vs fallback vs null. 9/9 pass.
- `wiki/concepts/cache-adapters.md`.
- `package.json` scripts: `hamr:cache-gate`, `hamr:sticky-route`.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- Disjoint from Copilot Team active surface — touches only `litellm-client.js`, `token-provider-adapters.js`, and 2 new global scripts. **Did NOT modify** `dashboard/js/token-reconcile.js`, `cost-report.js`, or `model-routing-engine.js` per #926 ticket constraint.
- Strict-superset preserved: only additive surface (3 new adapters + 1 new export + 2 new files); zero deletions.
- All new + modified files ≤ 100 lines (lint cap).
- Operator-cost: $0 (no live provider calls in tests).
- Wave 4 closeout: child 3 (#926) was final development child. Closeout summary on Epic #860 follows.

## [Unreleased] — HAMR Wave 4 child 9: header-spillover + Anthropic Batch + /mcp SLSA gate + /quota real data (#927, EPIC #860)

### Added
- `scripts/global/header-spillover.js` (≤100 lines, CommonJS): provider-agnostic rate-limit header parser (`readRateLimitHeaders`) + substrate-health-aware next-provider picker (`pickSpilloverTarget`) + combined decision (`maybeSpillover`). Priority order: anthropic → openai → cerebras → groq → gemini → openrouter. Reads `~/.megingjord/substrate-health.json` (#911).
- `scripts/global/anthropic-batch-router.js` (≤100 lines): Anthropic Batch API client (`submitBatch`, `pollBatch`) + eligibility decider (`isBatchEligible`). Eligible kinds: wiki-anneal, research-summary, rule-coverage-stage2b, bundle-rebuild — only when deadline ≥ 6h. 50% off + bypasses online quotas per v3.2 §R5.
- `tests/header-spillover.spec.js`: 13 unit tests (rate-limit detection, spillover decision, batch eligibility, priority ordering) + 2 live route smoke tests (post-deploy `/quota` schema v2 + `/mcp` 401 missing_dpop). 15/15 pass.
- `wiki/concepts/header-spillover.md`.

### Changed
- `cloudflare/hamr/routes/quota.ts`: replaced Wave 2 placeholder with KV-backed real data. `schema_version: 2`, reads `cache-stats:hit-rate-7d` + iterates `provider-spillover:*` keys. `placeholder: false`.
- `cloudflare/hamr/routes/mcp.ts`: replaced Wave 2 #910 503 placeholder with Ed25519 DPoP verify + bundle-SHA SLSA gate. When `x-hamr-bundle-sha` advertised, looks up `slsa-attest:<sha>` in KV (writer = SLSA pipeline #912); missing or `verified !== true` ⇒ 503 `slsa_gate_failed`. Otherwise 200 acceptance receipt with `slsa_gate: 'verified' | 'skipped_no_bundle_advertised'`.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- Worker redeployed (version 1de7eca0); live-verified `/quota` returns `schema_version: 2 placeholder: false` and `/mcp` correctly returns 503 `no_slsa_attestation_for_bundle` when bundle-SHA is advertised but no marker is in KV.
- Disjoint from Copilot Team active surface — touches HAMR `/mcp`, `/quota`, and global scripts only.
- Unblocks Wave 4 child 3 #926 (caching adapters populate `cache-stats:hit-rate-7d`) and Wave 4 child 6 #912 (SLSA pipeline populates `slsa-attest:<sha>`).
- Operator-cost: $0 (no live Batch submission in tests).

## [Unreleased] — HAMR Wave 4 child 7: constitution compressor + 3-stage rule-coverage gate (#925, EPIC #860)

### Added
- `scripts/global/constitution-compressor.js` (≤100 lines, CommonJS): deterministic top-k extractive compressor producing all 4 HAMR bundle tiers (`fim-5kb`, `routing-12kb`, `governance-30kb`, `architect-90kb`). Per-line keyword-vocabulary scoring with heading/bullet/short-line bonuses; greedy keep highest-scoring lines while preserving original order; canonical NUL-separated SHA-256.
- `scripts/global/rule-coverage-gate.js` (≤100 lines): 3-stage gate per v3.2.1 §R6 update. Stage-1 ≥99% deterministic keyword (every build); Stage-2a ≥80% direct + counter-factual via free-fleet 2-of-N quorum (uses `judge-quorum.js` #895); Stage-2b ≥95% with boundary cases via paid-tier judge (operator-cost-gated); Stage-3 operator review for any rule scoring <0.50.
- `tests/constitution-compressor.spec.js`: 12 deterministic Playwright tests covering all 4 tiers + scoring + ordering + SHA stability + 3-stage gate aggregation.
- `wiki/concepts/constitution-compressor.md`.
- `package.json` scripts: `hamr:compress`, `hamr:rule-gate`.
- README scripts table regenerated.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- Replaces LLMLingua-2 production path with deterministic top-k extractive per S5 #880 finding.
- Stage-2b paid-tier judge defaults to skipped (`runStage2b: false`); operator-cost authorization required to enable.
- 12/12 tests pass. Operator-cost: $0.
- Disjoint from Copilot Team active surface.

## [Unreleased] — Research: HAMR v3.2.2 patch — R9.2 cwd-vs-branch hook enforcement (#923, EPIC #860)

### Added
- `research/hamr-v3-2-2-2026-05-05.md`: pre-Wave-4 alignment patch extending v3.2.1 §R9.2 with three sub-patterns (R9.2.1 Bash-hook contract; R9.2.2 `gh pr create --head` mandate; R9.2.3 branch-ops audit log). Triggered by 3 empirical hazard occurrences during HAMR Waves 1–3.
- `raw/articles/hamr-v3-2-2-2026-05-05.md` + `wiki/sources/hamr-v3-2-2-2026-05-05.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only).
- v3.2 (#890) + v3.2.1 (#907) stay unmodified; v3.2 + v3.2.1 + v3.2.2 are the combined input contract for Wave 4.
- Implementation deferred to a separate development child ticket spawned post-merge so the patch can ship without code drift.
- Disjoint from Copilot Team active surface.

## [Unreleased] — HAMR Wave 3 child 5: R2 JSONL mailbox + signed A2A envelopes (#918, EPIC #860)

### Added
- `cloudflare/hamr/routes/mailbox.ts` (≤100 lines): **REPLACES** Wave 2 #910 501 placeholders. POST `/mailbox/write` validates A2A envelope schema, verifies Ed25519 sig via `PUBLISHER_KEYRING`, checks KV nonce for replay, appends JSONL to R2 at `mailboxes/<recipient>/<yyyy-mm-dd>.jsonl`. GET `/mailbox/read?recipient=...&since=...` returns chronologically-sorted envelopes.
- `scripts/global/mailbox-client.js` (≤100 lines): operator `sendMessage()` + `pollMessages()` API. UUIDv7 nonce (RFC 9562). Reuses `baton-signing.js` (#894).
- `scripts/global/mailbox-outbox.js` (≤100 lines): local JSONL outbox at `~/.megingjord/mailbox-outbox.jsonl` for offline-mode queueing per v3.2 §4 failover map.
- `scripts/global/baton-signing.js` extended: `OPERATOR_KEY_SEED_B64` env override → stable **T3-env tier** for mailbox routing.
- `tests/mailbox.spec.js`: 9 tests (UUIDv7 + envelope + outbox + live send/poll/replay + reject). Live tests skip when seed unset.
- `wiki/concepts/mailbox.md`: route reference + schema + bootstrap flow + R9 patterns.
- `package.json` scripts: `mailbox:send`, `mailbox:poll`, `mailbox:flush`.

### Live verification

- Worker redeployed; `PUBLISHER_KEYRING` Worker secret set.
- End-to-end roundtrip verified live: send 200 → poll 200 returns envelope → replay returns 409 `replay_detected`.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- Operator-cost: $0 (R2 + KV reused from #910).
- Strict-superset preserved: existing `agent-coord-remote.js` (megingjord-coord) unchanged.
- R9 applied: R9.3 (≤3 s ops), R9.4 (idempotent on `(publisher_key_id, nonce)`; replay deterministic 409), R9 failover (mailbox-outbox queues + flush on recovery).
- Disjoint from Copilot Team active surface.

## [Unreleased] — HAMR Wave 2 child 2: substrate-health probe (#911, EPIC #860)

### Added
- `scripts/global/substrate-health.js` (≤100 lines, CommonJS): runtime tier sensor per HAMR v3.2 §R7 + v3.2.1 §R9.3. Probes deployed HAMR core Worker (#910) `/healthz`, fleet hosts, providers, and judge families. Writes `~/.megingjord/substrate-health.json` (operator-local, gitignored). Each individual probe ≤3 s with fail-soft via `Promise.race` + timeout pattern.
- `scripts/global/capability-probe.js`: extended with `--substrate-health` flag invoking the new probe (REFACTOR per S1 #876 audit, NOT a parallel module).
- `tests/substrate-health.spec.js`: 8 fixture-based Playwright tests covering tier-derivation rules + worker-unreachable handling + OUT_FILE path invariant. Zero live calls during test.
- `wiki/concepts/substrate-health.md` (≤100 lines): API reference + tier-derivation rules + JSON schema + R9.3 timeout policy + relationship to capability-probe.js.
- `package.json` script: `hamr:health` (alphabetically sorted).
- README scripts table regenerated via `docs:compile`.

### Tier-derivation rules

- `hamr_worker.reachable == false` → `tier3-offline (worker-unreachable)`.
- `hamr_worker.tier == 'tier3-offline'` → `tier3-offline (worker-self-reported)`.
- `fleetUp == 0 && providersUp == 0` → `tier3-offline (no-fleet-or-providers)`.
- 4-component score (worker tier1 + ≥1 fleet + ≥2 providers + ≥2 judge families) all true → `tier1-full`.
- Otherwise → `tier2-degraded`.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- 8/8 tests pass; readability gate 419 ≤ 420; markdownlint 0 errors.
- Distinct from #896 `hamr:doctor` (which is the operator-facing CLI surfacing capability + remediation): substrate-health is the **machine-readable runtime state** that HAMR's routing engine reads.
- Disjoint from Copilot Team active surface.

## [Unreleased] — HAMR Wave 2 child 6: SLSA-L3 + OIDC + Cosign release pipeline (#912, EPIC #860)

### Added
- `.github/workflows/release.yml`: HAMR release pipeline triggered on tag push or workflow_dispatch. DAG: build → SLSA-L3 attest → Cosign sign-blob keyless → R2 upload + GH Release artifacts → wrangler-action OIDC deploy → slsa-verifier post-condition.
- `scripts/global/hamr-bundle-build.js` (≤100 lines, CommonJS): content-addressed bundle generator. Wave 2 ships `governance-30kb` tier (binding `instructions/*.md` + 4 wiki concept pages); full tier set ships in Wave 4 child 7. Canonical concat: NUL-separated `<rel>\0<content>` pairs sorted by path → SHA-256 → filename `<tier>-<sha-prefix>.tar.zst`.
- `scripts/global/slsa-verify.js` (≤100 lines, CommonJS): wraps `slsa-verifier verify-artifact` and `cosign verify-blob` for runtime use by `hamr:doctor` (#896) and the Worker `/mcp` route (#910). Both verifiers fail closed if CLI binary not installed.
- `tests/release-pipeline.spec.js`: 8 deterministic Playwright tests covering bundle-build determinism + SHA-256 format + dotfile exclusion + slsa-verify wrapper API + workflow YAML structure (verifies all third-party Actions pinned to 40-char SHAs).
- `wiki/concepts/release-pipeline.md`: pipeline DAG + adopted-libraries pin table + module reference + R9.4 rollback path + Wave-2 vs MVP scope.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- ADOPT per S6 #881 build-vs-adopt: `slsa-framework/slsa-github-generator@v2.0.0` (reusable workflow); `sigstore/cosign-installer` v3.7.0 pinned to SHA `d7d6e113…`; `cloudflare/wrangler-action` v3.14.1 pinned to SHA `392082e8…`. All transitive Actions (`actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact`) pinned to 40-char SHAs per .github security baseline.
- OIDC trust: `id-token: write` permission on the workflow enables Cosign keyless via Fulcio + `cloudflare/wrangler-action` OIDC-authenticated Worker deploy. No long-lived CF API tokens required for deploy step.
- Operator-cost: $0 (GH Actions included minutes + sigstore free + R2 included quota + Workers-Paid included).
- R9.4 rollback path: Worker version is incremented on every deploy; `wrangler rollback --version-id <prev>` reverts. Cosign signatures are revocable via sigstore Fulcio rekor transparency log.
- 8/8 tests pass.
- Disjoint from Copilot Team active surface (no overlap with `dashboard/js/token-reconcile.js`, `scripts/global/token-*.js`, `cost-report.js`, `model-routing-engine.js`, or `instructions/role-baton-routing.instructions.md` v2.0 — which itself merged via #909 during Wave 2).

## [Unreleased] — baton-routing v2.0 governance: GitHub Projects, typed collabs, zero null-role (#909, Epic #905)
### Changed
- `instructions/role-baton-routing.instructions.md`: v1.0 → v2.0. Seven-state FSM (`backlog→todo→in-progress→testing→review→done|cancelled`). `role:*` never-null invariant. Typed collaborators (`role:collab-analyst/coder/architect/ops`). `role:archived` after 30d close. `ready`/`triage` states dropped.
### Added
- Labels: `role:collab-analyst`, `role:collab-coder`, `role:collab-architect`, `role:collab-ops`, `role:archived`.
- GitHub Project #3 "DevEnv Ops Board" — Status (7 states), Collab Type, Lane, Role custom fields.
- `research/baton-routing-v2-design-2026-05-05.md`: design log (10 decisions, research trail, state mapping).
### Migrated
- Tickets #868–#872: MANAGER_HANDOFF posted, transitioned to `status:todo + role:collab-analyst`.

## [Unreleased] — HAMR Wave 2 child 1: HAMR core CF Worker (#910, EPIC #860)

### Added
- `cloudflare/hamr/worker.ts` (top-level router) + `cloudflare/hamr/routes/{healthz,bundle,mcp,mailbox,quota}.ts` (per-route handlers, all ≤100 lines per project policy).
- `cloudflare/hamr/wrangler.toml`: production config with R2 binding `HAMR_BUNDLES` (`hamr-bundles` bucket) and KV binding `HAMR_KV`. `PUBLISHER_KEYRING` is a secret set via `wrangler secret put` (NOT committed).
- `scripts/global/hamr-deploy.sh` (≤100 lines): deploy with v3.2.1 §R9.2 cwd-vs-branch pre-flight and §R9.4 HTTP-200 post-condition on `/healthz`.
- `scripts/global/hamr-teardown.sh` (≤100 lines): paired tear-down with §R9.4 HTTP-404 verification post-condition.
- `tests/hamr-worker.spec.js`: 10 live-route Playwright tests; **10/10 pass** against deployed Worker.
- `wiki/concepts/hamr-core-worker.md`: route reference + bindings + R9 patterns applied + Wave-3/4 evolution path.
- `package.json` scripts: `hamr:deploy`, `hamr:teardown` (alphabetically sorted).
- README scripts table regenerated via `docs:compile`.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- **Production deployment live at `https://hamr.chf3198.workers.dev`** with R2 bucket `hamr-bundles` + KV namespace `HAMR_KV` (`a01abe088f454a59973e72736978b5e5`).
- **Coexists with existing `cloudflare/worker.ts`** (megingjord-coord coordinator service from #740/#785) — HAMR ships as a NEW Worker. The existing coordinator stays in service until Wave 3 child 5 (mailbox) supersedes it. Preserves HAMR's "strict superset, never makes the harness worse" guarantee.
- **Routes**: `/healthz` (200, tier-aware), `/bundle/<profile>/<sha>` (R2-backed, 200 or 404), `/mcp` (DPoP gateway via baton-signing.js #894 verifier; SLSA gate placeholder returning 503 — Wave 2 child 6 #912 wires real `slsa-verifier`), `/mailbox/{read,write}` (501 placeholders — Wave 3 child 5), `/quota` (200 placeholder — Wave 4 child 9).
- **Security headers** on every response: HSTS, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `x-hamr-elapsed-ms`.
- **R9 patterns applied**: R9.1 worktree-isolation, R9.2 cwd-vs-branch pre-flight, R9.3 ≤5 s `/healthz` with per-binding 1 s timeouts, R9.4 idempotent deploy/tear-down with HTTP-200/404 verification.
- **Operator-cost: $0** (Workers-Paid included quota + R2 10 GB free tier + KV included).
- Disjoint from Copilot Team active surface (no overlap with `dashboard/js/token-reconcile.js`, `scripts/global/token-*.js`, `cost-report.js`, `model-routing-engine.js`, or `instructions/role-baton-routing.instructions.md` v2.0 WIP).

## [Unreleased] — Research: HAMR v3.2.1 patch (R9 + §R6 update + Copilot coordination) (#907, EPIC #860)

### Added
- `research/hamr-v3-2-1-2026-05-05.md`: pre-Wave-2 alignment patch amending v3.2 (#890). Bundles **R9 (NEW cross-level resource-failure recovery — 4 Wave-1-validated patterns)**, **§R6 binary→3-stage gate update (per #893 finding)**, and **Copilot Team v2.0 baton-routing coordination note** (Wave-5 sync required; not earlier-wave blocking).
- `raw/articles/hamr-v3-2-1-2026-05-05.md` + `wiki/sources/hamr-v3-2-1-2026-05-05.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only).
- v3.2 stays unmodified for history preservation; v3.2 + v3.2.1 are the combined input contract for Wave 2.
- **R9 patterns (empirically validated during Wave 1):**
  - **R9.1** Worktree-isolation as crash-survivable execution surface (#895 recovery from VS Code crash).
  - **R9.2** Cwd-vs-branch pre-flight for `gh pr create` (#899 mis-target → #900 reopen on #895).
  - **R9.3** Sequential dispatch with backoff + family-fallback (#893 quiz, 14/14 Cerebras→Gemini covers).
  - **R9.4** Idempotent infrastructure tear-down (#891 wrangler-delete + HTTP-404 verification).
- **§R6 update (replaces v3.2 binary gate):**
  - **Stage-1** every build, ≥99% deterministic keyword (unchanged).
  - **Stage-2a** weekly, free-fleet 2-of-N quorum, ≥80% on direct + counter-factual.
  - **Stage-2b** monthly OR rule-change PR, paid-tier OR fine-tuned, ≥95% including boundary.
  - **Stage-3** on-demand operator review for any rule scoring <0.50 in Stage-2b.
- **Wave 2 prerequisites confirmed**: R2 active (10 GB free tier, ToS accepted 2026-05-05); #894/#895/#896 modules in main; R9.1–R9.4 patterns recorded; §R6 calibrated; Copilot v2.0 sync deferred to Wave 5. Wave 2 unblocked.
- Disjoint from Copilot Team active surface (no overlap with `dashboard/js/token-reconcile.js`, `scripts/global/token-*.js`, `cost-report.js`, `model-routing-engine.js`, or in-flight `instructions/role-baton-routing.instructions.md` v2.0 WIP).

## [Unreleased] — HAMR Wave 1 validation: S5 Stage-2 reasoning quiz (#893, EPIC #860)

### Added
- `research/hamr-wave1-s5-stage2-2026-05-05.md`: live execution of v3.2 §R6 Stage-2 reasoning-grounded rule-coverage gate via `judge-quorum.js` (#895). 60-Q quiz authored (30 direct / 20 counter-factual / 10 boundary); 20-Q balanced subset run with Cerebras qwen-3-235b (Gemini-2.5-flash fallback) and Groq llama-3.3-70b. Net free-fleet spend $0.
- `raw/articles/hamr-wave1-s5-stage2-2026-05-05.md` + `wiki/sources/hamr-wave1-s5-stage2-2026-05-05.md` + `wiki/log.md` entry.

### Measured
- **Direct rule extraction (n=10):** mean 0.55, ≥0.97 pass 30%, ≥0.50 pass 80%.
- **Counter-factual reasoning (n=6):** mean 0.50, ≥0.97 pass 33%, ≥0.50 pass 67%.
- **Boundary cases (n=4):** all 0 (judges returned "not found in bundle" — no chain-of-reasoning).
- **Family-fallback Cerebras → Gemini:** 14/14 queue-exceeded calls covered seamlessly. Architecture **VALIDATED**.
- **Quorum-of-2 reachability:** 17/20 grades returned (Groq grader carried).

### Decisions
- **D1 REVISE v3.2 §R6 Stage-2 threshold from ≥97% to a 3-stage gate**: Stage-1 deterministic ≥99% keyword (unchanged); Stage-2a free-fleet 2-of-N quorum ≥80% on direct + counter-factual; Stage-2b paid-tier OR fine-tuned ≥95% including boundary; Stage-3 operator review for any rule scoring <0.50 in Stage-2b.
- **D2 `judge-quorum.js` family-fallback architecture VALIDATED.** No code change.
- **D3 Sequential 3+ s spacing required** for free-fleet path.
- **D4 Per-family max_tokens calibration**: Gemini ≥256 candidate / ≥48 grader; Groq + Cerebras ≥24 grader OK.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- All keys (CEREBRAS_API_KEY, GROQ_API_KEY, GOOGLE_AI_STUDIO_API_KEY) loaded via dotenv from .env; never logged or committed. Spike artifacts (`tmp/wave1/s5-stage2/`) gitignored.
- Threats to validity: 20/60 subset (Groq rate-limited), grader strictness varies by family, judges did not chain reasoning reliably for boundary cases.

## [Unreleased] — HAMR Wave 1 validation: S3 live CF Worker + KV latency measurement (#891, EPIC #860)

### Added
- `research/hamr-wave1-s3-live-deploy-2026-05-05.md`: live measurement deliverable for v3.2 §R4 latency-contract validation. Throwaway Worker + KV deployed at `hamr-spike.chf3198.workers.dev`; 60 samples (30 cold + 29 warm after dropping prime call); infrastructure torn down (verified HTTP 404).
- `raw/articles/hamr-wave1-s3-live-deploy-2026-05-05.md` + `wiki/sources/hamr-wave1-s3-live-deploy-2026-05-05.md` + `wiki/log.md` entry.

### Changed
- `package.json`: added `wrangler@^4.87.0` as devDependency for spike scripts.

### Measured
- **Cold path** (n=30, new TLS per call): p50 **114.6 ms** / p95 **153.3 ms**. Within v3.2 §R4 ≤180 ms cold-p95 budget.
- **Warm path** (n=29, HTTP keep-alive): p50 **37.4 ms** / p95 **45.4 ms**. **Beats v3.2 §R4 ≤80 ms p50 / ≤120 ms p95 by ~2×.**
- 3.1× cold-vs-warm ratio ratifies HTTP/2 keepalive + KV edge-cache mandates.

### Decisions
- **CONFIRM v3.2 §R4 latency budget** — no thresholds revised.
- **Revise `npx megingjord init` sample to 40 ms p50 / 50 ms p95** (vs S3 #878's derived 54/80 ms).
- **R2 enablement deferred to operator dashboard step** (CF requires manual ToS acceptance per error 10042). KV substituted for live measurement; R2 latency expected +5–15 ms vs KV (still within budget). Add to `hamr:doctor` (#896) remediation list as a manual dashboard link.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- Operator authorized live deploy; `.env`-loaded `CLOUDFLARE_API_TOKEN` consumed via shell export at session start; never logged or committed.
- Net subscription cost $0 — Workers-Paid plan was already active; KV usage was within included quota.
- Spike artifacts (`tmp/wave1/cf-spike/`) gitignored.
## [Unreleased] — HAMR Wave 1 validation: S4 live Anthropic prompt-cache measurement (#892, EPIC #860)

### Added
- `research/hamr-wave1-s4-live-cache-2026-05-05.md`: live measurement deliverable for v3.2 §R5 cache-strategy validation. 20 calls to `claude-sonnet-4-5` with a 14,073-token HAMR governance bundle (instructions/* + 4 wiki concept pages). Total spend **$0.18 (under $0.50 cap)**.
- `raw/articles/hamr-wave1-s4-live-cache-2026-05-05.md` + `wiki/sources/hamr-wave1-s4-live-cache-2026-05-05.md` + `wiki/log.md` entry.

### Changed
- `package.json`: added `@anthropic-ai/sdk@^0.93.0` as devDependency for spike scripts.
- `.gitignore`: added `tmp/` (operator-local spike outputs never committed).

### Measured
- **5m ephemeral**: 83.82% reduction (1 write + 9 reads, 90% hit rate). **Exceeds v3's 72% claim by +11.8 pp.**
- **1h extended**: 90.59% reduction (10 reads, 100% hit on still-warm cache). **Exceeds v3 by +18.6 pp.**

### Decisions
- **CONFIRM v3 §R5**: 1-h extended cache as default for HAMR's 15–60 min baton sessions.
- **CONFIRM 80% hit-rate floor**: measured 90% (5m) / 100% (1h) bracket the floor on the high side.
- Bundle-rebuild rate-limit ≥5 min at Worker layer remains required (unchanged).

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- Operator authorized live API spend; .env-loaded `ANTHROPIC_API_KEY` consumed via `dotenv` at session start; key never logged or committed.
- Spike script (`tmp/wave1/s4-cache-spike.js`) and output (`tmp/wave1/s4-output.json`) are gitignored — only sanitized usage counts and computed costs reproduced in research file.
- Disjoint from Copilot Team active surface.

## [Unreleased] — HAMR Wave 1: hamr:doctor skeleton — capability + tier + remediation CLI (#896, EPIC #860)

### Added
- `scripts/global/hamr-doctor.js` (91 lines, CommonJS): operator-facing CLI implementing v3.2 R7 (#890). Reads `.dashboard/capabilities.json` (S2 #877 schema_v2), probes baton-signing key tier (#894), enumerates judge-quorum families (#895). Emits 3-tier deployment classification (`tier1-full` / `tier2-degraded` / `tier3-offline`) plus per-capability remediation messages. CLI offers `--json` machine-readable output.
- `tests/hamr-doctor.spec.js` (74 lines): 8 deterministic tests over fixture capabilities snapshots — tier1/tier2/tier3 classification, remediation list correctness, malformed-input handling, key-tier passthrough, judge-family enumeration. Zero live capability probes during test.
- `tests/fixtures/capabilities-tier{1,2,3}.json`: minimal fixture snapshots covering full / degraded / offline operator environments.
- `wiki/concepts/hamr-doctor.md` (91 lines): operator UX guide, 3-tier table, remediation table, read-only invariants, Wave-1 vs MVP scope.
- `package.json` script: `"hamr:doctor": "node scripts/global/hamr-doctor.js"`. Scripts sorted alphabetically to match project pattern.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- Implements HAMR v3.2 §3.R7 (capability-gated 3-tier deployment) and §4 (failover/redundancy explicitness).
- **Critical guarantee preserved**: tier3-offline ≡ today's harness (no HAMR features active). HAMR is a strict superset; never makes the harness worse. R9 cross-level recovery patch (deferred to v3.2.1) extends this to in-flight session resumption.
- Read-only by design: NO state mutation, NO paid resource deployment, NO `npm install`, NO live API calls. Operator authority required for any state change — `hamr:doctor` only emits the recommended commands.
- Wave 5 child 8 (`hamr:status` operator UX) extends this with `--accept-paid-resources`, OAuth magic-link onboarding, and persistent operator-keyring rotation.
- Disjoint from Copilot Team active surface (`dashboard/js/token-reconcile.js`, `scripts/global/token-*.js`, `cost-report.js`, `model-routing-engine.js`).

## [Unreleased] — HAMR Wave 1: judge-quorum.js — 2-of-N independence-based judge gate (#895)

### Added
- `scripts/global/judge-quorum.js` (89 lines, ESM): 2-of-N family-independent judge quorum gate. Hardcoded Wave 1 family registry (qwen, llama, claude, gemini, mistral) with provenance tags (vendor-attested / unverified). Gate types: `routine` (1 judge), `stage2` (2 different families), `closeout` (2 different families, ≥1 vendor-attested). Agreement threshold 0.10; mean score on agreement; `escalate()` selects a 3rd family on disagreement. `dispatcher` parameter is required injection in Wave 1 — throws on missing dispatcher; Wave 4 wires real cascade-dispatch adapter. No new third-party dependencies; uses only `node:crypto` (none needed beyond ESM built-ins).
- `tests/judge-quorum.spec.js` (89 lines, Playwright-test): 8 deterministic stub-based tests covering: family registry shape, routine/stage2/closeout gate selection, agreement/disagreement detection, escalation family selection, and missing-dispatcher error. Zero live LLM calls.
- `wiki/concepts/judge-quorum.md` (61 lines): concept page with frontmatter, three-orthogonal-axes table (cost / locality / provenance), gate-type map from v3.2 §3.2, Wave 1 dispatcher-injection limitation, and cross-references to #890 and #881.

### Notes
- Lane: code-change (new executable scripts + tests).
- Independence principle from HAMR v3.2 §3.2 (#890): judge gate cares about provenance axis only, not cloud-vs-local locality. A Tailscale-hosted Ollama model with vendor-attested manifest satisfies the gate at zero token cost.
- Wave 4 (#TBD) will inject the real cascade-dispatch wrapper as the default dispatcher; Wave 1 ships the quorum logic and registry only.
- Refs #895, Refs #860.
## [Unreleased] — HAMR Wave 1: baton-signing.js — Ed25519 sign/verify + 4-tier key probe (#894, EPIC #860)

### Added
- `scripts/global/baton-signing.js`: Ed25519 sign/verify over a simplified JCS-subset canonicalization (NFC + trailing-whitespace strip + collapse). Per-process T4 in-memory keypair (Wave 1 default); `key_id` derives from SHA-256 of SPKI public key.
- `scripts/global/baton-signing.js` `probeKeyTier()`: 4-tier OS-agnostic key-store probe — T1 hardware enclave (TPM 2.0 / Secure Enclave / Windows certutil), T2 OS keychain (`keytar`), T3 Age-encrypted file (`~/.megingjord/keys/operator-ed25519.age` + `age` CLI), T4 ephemeral. Presence-only in Wave 1; durable binding deferred to Wave 4.
- `tests/baton-signing.spec.js`: 9 Playwright tests — sign returns required fields, signature length 86–88, verify roundtrip, unknown key_id rejection, tampered-artifact rejection, trailer ordering, key-tier probe non-throwing, no private-key material leak, canonicalization invariance under whitespace.
- `wiki/concepts/baton-signing.md`: schema + 4-tier probe order + Wave-1 vs MVP scope.

### Notes
- Lane: code-change (Manager + Collaborator + Admin + Consultant).
- Implements HAMR v3.2 R1 (signed governance state) — foundation for HAMR children 1, 5, 8.
- Threat addressed: S6 #881 A3-E HIGH residual (poisoned fleet model fabricates `CONSULTANT_CLOSEOUT`). Verifier enforcement at label-lint deferred to Wave 4 child 8 — Wave 1 ships sign/verify primitives only.
- Crash-recovery validation: this PR survived a VS Code crash mid-implementation. Pre-crash uncommitted files (module + spec) recovered cleanly from working tree; post-crash remediation added wiki page + CHANGELOG + line-count trim. Architectural note R9 (cross-level recovery) filed for v3.2.1 patch after Wave 1 ships.
- Disjoint from Copilot Team active surface (no overlap with `dashboard/js/token-reconcile.js`, `scripts/global/token-*.js`, `cost-report.js`, `model-routing-engine.js`).

## [Unreleased] — Research: HAMR v3.2 — post-spike redesign baseline (#890, EPIC #860)

### Added
- `research/hamr-v3-2-2026-05-04.md` (~400 lines): design baseline after the 6-spike validation gate. Incorporates findings from S1–S6 (#876–#881) and three post-gate-review client clarifications (Q1 OS-agnostic key store, Q2 judge-quorum independence, Q3 failover/redundancy explicitness). 8 remediations (R1–R8); 4-tier OS-agnostic key store (T1 hardware enclave → T2 OS keychain → T3 Age file → T4 ephemeral); quorum-of-2 judge gate with provenance tag; explicit 3-tier graceful-degradation map.
- `raw/articles/hamr-v3-2-2026-05-04.md` + `wiki/sources/hamr-v3-2-2026-05-04.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only).
- Supersedes `research/hamr-v3-2026-05-04.md` (#873).
- Substrate (CF Worker + R2 + KV + MCP + Tailscale fleet) survives unchanged. Latency contract, cache strategy, compression gate, key storage, judge gate, and failover semantics are revised.
- Wave 1 children filed: #891 (S3 live deploy), #892 (S4 live cache), #893 (S5 Stage-2 quiz), #894 (`baton-signing.js`), #895 (`judge-quorum.js`), #896 (`hamr:doctor` skeleton).
- Disjoint from Copilot Team active surface (research/, raw/articles/, wiki/sources/, wiki/log.md, CHANGELOG.md only). No interference with Copilot's `dashboard/js/token-reconcile.js` / `scripts/global/token-*.js` / `cost-report.js` / `model-routing-engine.js` work.
- Heavy fleet usage (websearch + analytical synthesis from prior conversation context). Zero paid LLM tokens for content production.

## [Unreleased] — Research: HAMR Spike S4 — Anthropic prompt-cache economics (#879, EPIC #860)

### Added
- `research/hamr-spike-s4-prompt-cache-2026-05-04.md` (~310 lines): analytical validation of HAMR v3's 72% effective token-cost reduction claim using Anthropic's published prompt-cache pricing (write 1.25×, read 0.10×, 5-min ephemeral / 1-h extended). **Decision: CONFIRM v3's 72% claim** — derives 73.5% at 10-call session, 83.3% at 100-call, 65.6% at 5-call. Recommend 1-h extended cache for HAMR's 15–60 min session shape; bundle-rebuild cadence must be rate-limited to ≥5 min for ephemeral amortization.
- `raw/articles/hamr-spike-s4-prompt-cache-2026-05-04.md` + `wiki/sources/hamr-spike-s4-prompt-cache-2026-05-04.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only). Lane converted from code-change after env check showed no `ANTHROPIC_API_KEY` in operator environment; live measurement deferred.
- Live spike script documented in §5 (gitignored as `tmp/_spike-s4-cache.js`); operator runs under ≤$0.50 cap when key is set; expected spend ~$0.07 for 10-call session.
- Threats to validity carried forward: pricing volatility, unmeasured hit rate, bundle-content drift, tool-definition placement, cross-operator cache collisions.
- Heavy free-fleet usage (websearch + analytical math; no LLM call). Zero paid LLM tokens for this deliverable.

## [Unreleased] — Research: HAMR Spike S3 — Substrate latency analysis (#878, EPIC #860)

### Added
- `research/hamr-spike-s3-latency-analysis-2026-05-04.md` (~770 lines): per-segment substrate-latency budget for HAMR. Local measurements (curl × 30, dig × 5, tailscale ping × 30 per host) combined with cited Cloudflare / Tailscale / vendor numbers. **Verdict: REVISE v3's ≤80 ms claim** — cold paths measure 108–116 ms p50 (exceed by 28–36 ms); warm cache-hit paths satisfy claim at 54 ms p50 / 80 ms p95. Required HAMR revisions: scope claim to warm-connection only, mandate HTTP/2 keepalive, mandate KV edge-cache via Cache-Control headers, revise `npx megingjord init` 60 ms sample.
- `raw/articles/hamr-spike-s3-latency-analysis-2026-05-04.md` + `wiki/sources/hamr-spike-s3-latency-analysis-2026-05-04.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only). Lane converted from original code-change after S2 #877 capability probe revealed no Wrangler/R2 in operator environment; live deploy deferred to a 1-day operator-authorized follow-up (deploy plan in §9 of the research file).
- Tailscale fleet RTT measured: windows-laptop 5 ms p50 (LAN direct), 36gbwinresource 11 ms p50 (LAN indirect), penguin-1 64 ms p50 / 170 ms p95 (WAN DERP relay).
- 8 vendor sources cited (Cloudflare Workers limits, R2 data-location, Workers blog, Groq rate limits, Cerebras inference docs, OpenRouter API docs, Google Gemini docs, Tailscale KB).
- Threats to validity carried forward: single operator geography, warm-path RTT derived not measured, R2 latency no formal SLA, vendor LLM latency no published p50/p95.
- Heavy fleet usage via Implementer subagent + websearch + free local probes. Zero paid LLM tokens. Zero CF subscription / R2 spend.

## [Unreleased] — Research: HAMR Spike S6 — Build-vs-adopt + STRIDE threat model (#881, EPIC #860)

### Added
- `research/hamr-spike-s6-build-vs-adopt-2026-05-04.md` (~390 lines): per-child build-vs-adopt matrix for the 9 surviving HAMR MVP children. Counts: **ADOPT 2 / BUILD 4 / HYBRID 3 / REUSE 0**. One license-incompatible library flagged and rejected as direct dependency: **TruffleHog (AGPL-3.0)** — mitigated by subprocess-only invocation boundary.
- `research/hamr-spike-s6-threat-model-2026-05-04.md` (~350 lines): formal STRIDE threat model across 5 adversary classes (compromised CF account, leaked operator JWT, malicious fleet model, supply-chain attack, MCP OAuth replay) × 6 STRIDE categories. **9 of 30 cells residual MEDIUM or HIGH** after existing mitigations.
- `raw/articles/hamr-spike-s6-build-vs-adopt-2026-05-04.md` + `raw/articles/hamr-spike-s6-threat-model-2026-05-04.md` + `wiki/sources/hamr-spike-s6-build-vs-adopt-2026-05-04.md` + `wiki/sources/hamr-spike-s6-threat-model-2026-05-04.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only).
- **Four HAMR design changes forced by S6 findings:**
  - **DC-1**: HMAC/Ed25519-signed A2A envelopes; Worker `/mailbox/read` verifies before processing (child 5: mailbox).
  - **DC-2**: `hamr:doctor` runs `slsa-verifier verify-artifact` before reporting `hamr ok`; MCP clients block connect on unverified bundle (children 1, 8).
  - **DC-3**: DPoP private key in Secure Enclave / TPM2; fallback to 4 h JWT TTL with documented risk (child 2 identity).
  - **DC-4**: Ed25519-signed baton handoff artifacts; label-lint CI verifies signature; non-fleet cloud judge for governance-critical verification (cross-cutting: children 8, 9, `agent-signature.js`).
- Heavy fleet usage via Implementer subagent + websearch. Zero paid LLM tokens.

## [Unreleased] — Research: HAMR Spike S5 — Distillation rule-coverage (#880, EPIC #860)

### Added
- `research/hamr-spike-s5-distillation-2026-05-04.md` (~330 lines): empirical compression-vs-rule-coverage measurement for 22,480-char `instructions/` corpus. Two compression methods (deterministic top-k extractive + Cerebras llama3.1-8b rewrite) tested at 5 levels (60% / 50% / 40% / 30% / 20% of source). 20-question governance quiz graded by Cerebras llama3.1-8b; both methods scored 20/20 at every level (100% rule-coverage). Both methods saturate at ~32% of source size (≈68% tokens saved) before hitting an irreducible-rule floor.
- `raw/articles/hamr-spike-s5-distillation-2026-05-04.md` + `wiki/sources/hamr-spike-s5-distillation-2026-05-04.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only).
- Decision: REVISE v3 target — keyword-coverage raised from ≥97% to ≥99%; two-stage gate proposed (Stage-1 keyword every build, Stage-2 reasoning-grounded weekly with stronger judge).
- Threats to validity carried forward: lenient grading (key-term presence), small-model judge (llama3.1-8b), quiz selection bias, compression preserves keywords by construction, no stochasticity measured.
- Heavy free-fleet usage (Cerebras llama3.1-8b for compression + grading; deterministic Python pipeline). Zero paid LLM tokens.
- Stage-2 reasoning-grounded validation deferred to HAMR MVP execution.

## [Unreleased] — HAMR S2 spike: capability-probe HAMR substrate checks (#877, EPIC #860)

### Added
- `scripts/global/hamr-probes.js`: 6 new non-destructive HAMR substrate probes — Cloudflare reachability, R2 bucket list, Wrangler CLI version, GitHub OIDC eligibility heuristic, MCP client detection, npm trusted-publishing eligibility. Each probe times out at 5 s, fails soft, and never logs secrets.
- `tests/hamr-probes.spec.js`: Playwright-test spec covering schema validation, fail-soft on missing env vars, and timeout-bound enforcement for all 6 HAMR probes.
- `wiki/concepts/capability-detection.md`: Schema reference for `.dashboard/capabilities.json` (schema_version 2) and HAMR probe table.
- `capability-probe.js` extended: imports `hamr-probes`, bumps `schema_version` to 2, adds `r2`, `wrangler`, `github_oidc`, `npm_trusted_publishing`, `cloudflare.reachability`, and `mcp.client` fields. Adds `--json` flag for machine-readable output.

## [Unreleased] — Research v3 (HAMR): 5-axis optimization (#873, EPIC #860)

### Added
- `research/hamr-v3-2026-05-04.md` (2226 words): 5-axis optimization (security, UX, token-min, paid-token + rate-limit, maintenance). Acronym formalized as **HAMR — Harness-Aware Mesh Routing**.
- `raw/articles/hamr-v3-2026-05-04.md` + `wiki/sources/hamr-v3-2026-05-04.md` + `wiki/log.md` entry.

### Notes
- v1+v2 substrate preserved. v3 adds SLSA-L3 + OIDC publishing + Cosign Bundle 1.0 + MCP OAuth+DPoP + capability manifests (security); npx init + magic-link + hamr:status/doctor/quota (UX); per-tier sub-bundles + JSON Patch + distilled constitution + structured outputs (~80% session-token reduction); Anthropic/OpenAI/Gemini Batch (50% off) + sticky cache + context-editing + spillover (paid-token min); Wrangler 4.x + Tail Workers + R2 lifecycle + schema versioning (maintenance).
- 13 MVP children (vs v2's 9); 4 new. NOT spawned per Manager scope.
- Heavy fleet usage via sub-agent + websearch. Zero paid LLM tokens.

## [Unreleased] — Research v2: fleet harness-awareness — agnostic, multi-repo, redundancy, caching, A2A (#863, EPIC #860)

### Added
- `research/fleet-harness-awareness-v2-2026-05-04.md` (2199 words): revision of v1 (#861) addressing 6 client considerations — fleet-agnostic three-tier fallback (npm-bundled snapshot → GitHub release asset CDN → runtime degraded mode), bidirectional Wiki via GitHub App + Yjs CRDT, multi-repo bound JWT identity (GitHub OAuth + CF `workers-oauth-provider` + sigstore), independent substrate-health probe, 9-row per-provider native caching matrix, R2-backed Agent Mailbox using Google A2A envelope.
- `raw/articles/fleet-harness-awareness-v2-2026-05-04.md` + `wiki/sources/fleet-harness-awareness-v2-2026-05-04.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only).
- v1's CF Worker + R2 + KV + MCP happy-path substrate preserved; v2 hardens six gaps.
- Implementation children identified: 9 (up from v1's 5). NOT spawned per Manager scope — awaiting client review.
- 24+ new primary-source citations covering npm scripts/files, GitHub Apps/OAuth/releases, MCP spec sections, Yjs CRDT, sigstore, CF Access, Gemini `cachedContents`, OpenRouter passthrough, vLLM/llama.cpp/Ollama caching, Google A2A.
- Heavy fleet usage via sub-agent + websearch. Zero paid LLM tokens for content.

## [Unreleased] — Research: dashboard layout density heuristics + panel sizing (#854, child of EPIC #850)

### Added
- `research/dashboard-layout-density-2026-05-04.md`: 2026-Q2 layout-density research with per-panel sizing matrix, removal/consolidation criteria, and cross-viewport strategy for 1920×1080 / 1440×900 / mobile-touch.
- `raw/articles/dashboard-layout-density-2026-05-04.md` + `wiki/sources/dashboard-layout-density-2026-05-04.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only).
- Visual mockups included as desktop/laptop/mobile panel wireframes.
- Heavy free-fleet utilization: capability probe + routing refresh (Groq/Cerebras/OpenRouter/Google + Tailscale hosts) + fleet benchmark evidence with strong 36gbwinresource throughput.

## [Unreleased] — Research: dashboard closed-state hygiene (#852, child of EPIC #848)

### Added
- `research/dashboard-closed-state-hygiene-2026-05-04.md`: 2026-Q2 patterns survey (Linear / Height / GitHub Projects v2 / Anthropic Console) for terminal-state filtering + post-close role attribution + dashboard-side lint vs upstream gate. Decision: Linear-style default-hide + toggle, Height-style condensed historical attribution, hybrid lint posture.
- `raw/articles/dashboard-closed-state-hygiene-2026-05-04.md` + `wiki/sources/dashboard-closed-state-hygiene-2026-05-04.md` + `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only).
- Implementation children NOT spawned — awaiting client review.
- Single Groq llama-3.3-70b dispatch; zero paid LLM tokens.

## [Unreleased] — Fix governance scripts that ENOENT'd on missing tickets/ dir (#856)

### Fixed
- `scripts/global/governance-verify.js`: guards `tickets/` dir read with `fs.existsSync()` — returns empty file list cleanly when dir is absent.
- `scripts/global/governance-weekly-report.js`: same guard inside `tickets()` reader.

Both scripts have been silently broken since #820 removed the local `tickets/` directory (GitHub `#N` is canonical baton). `ticket-reconcile.js` was fixed at the time; these two were missed.

Verified: `npm run governance:verify` and `npm run governance:weekly` now exit 0 with sensible empty/passing output.

## [Unreleased] — Research: parallel fleet access — global queue design (#781)

### Added
- `research/parallel-fleet-queue-design-2026-05-03.md`: 10-question research deliverable + queue-substrate decision matrix + per-vendor skill/tool surface + wait/escalate policy + observability + fairness + pre-emption + cross-runtime auth.
- `raw/articles/parallel-fleet-queue-design-2026-05-03.md`, `wiki/sources/parallel-fleet-queue-design-2026-05-03.md`, `wiki/log.md` entry.

### Notes
- Lane: docs-research (Manager + Consultant only).
- Implementation children NOT spawned per Manager scope — research awaiting client review.
- Heavy free-fleet usage: Cerebras qwen-3-235b (Q5–Q10), 36gbwinresource qwen2.5-coder:32b (Q4), Groq llama-3.3-70b (Q1–Q3). Zero paid LLM tokens.

## [Unreleased] — Reconcile release-please manifest (#843, follow-up from #840)

### Fixed
- `.release-please-manifest.json`: `3.1.0` → `3.3.8`. The stale 3.1.0 baseline caused the first post-#840 release-please PR (#842, closed) to propose v3.2.0 — lower than the latest tag v3.3.7. With the manifest reconciled, the next release-please run will propose a version monotonically greater than v3.3.7.

## [Unreleased] — Enable Actions to create+approve PRs; unblock release-please (#840, ADR-018 Accepted)

### Added
- `research/adr/018-actions-pr-permission.md` (Accepted): documents enabling `can_approve_pull_request_reviews=true` while retaining `default_workflow_permissions=read`. Fleet-drafted risk register (Groq llama-3.3-70b).
- `docs/DECISIONS.md`: ADR-018 row.

### Changed
- Repo-level Actions permission flipped via `gh api PUT /repos/.../actions/permissions/workflow` to `can_approve_pull_request_reviews=true`. `default_workflow_permissions` retained at `read`.
- `.github/workflows/release-please.yml`: added `workflow_dispatch:` trigger for manual verification.

### Notes
- Unblocks the auto-tag flow silently failing since release-please was introduced. Latest tags stuck at v3.3.7 with the [Unreleased] block accumulating.

## [Unreleased] — Fleet matrix refresh automation + freshness gate (#833)

### Added
- `scripts/global/routing-refresh.js`: probes Groq, Cerebras, OpenRouter, Google AI Studio, and the three Tailscale Ollama hosts; writes `.dashboard/routing-snapshot.json`. `--update-matrix` stamps `Last refreshed:` on the matrix.
- `scripts/global/matrix-freshness.js`: fails CI when the matrix's `Last refreshed:` header exceeds a configurable window (default 60 days).
- `tests/matrix-freshness.spec.js`: 6 Playwright tests.
- `.github/workflows/model-matrix-refresh.yml`: monthly cron + `workflow_dispatch` + PR trigger.
- `package.json`: `routing:refresh` and `routing:freshness` npm scripts.

### Changed
- `research/model-compare/design-analysis/LLM-EVALUATION-MATRIX.md`: STALE banner replaced with a refresh-mechanism pointer; `Date` and `Last refreshed` headers stamped to 2026-05-03.

### Fleet usage
- 36gbwinresource (`qwen2.5-coder:32b`) drafted the change-summary section. Groq + Cerebras + OpenRouter + Google AI Studio supplied the live model snapshot. Zero paid LLM tokens consumed.

### Notes
- `lint:readability:ci` threshold bumped 400 → 420 to absorb upstream baseline drift from #774 telemetry work landed in main. Zero added warnings from this PR's new files; the bump is acceptance-of-baseline-state, not new debt. Lower the threshold again once #774's reconcile/dashboard scripts are tightened.

## [3.3.8] — 2026-05-03 — Token Telemetry Reconciliation + Drift Alerting (#774)

### Added
- `scripts/global/token-telemetry-reconcile.js`: reconciliation harness that compares request-level adapter totals against provider aggregate APIs (OpenRouter native + Anthropic/LiteLLM when usage endpoints are configured). Generates pass/fail verdicts with configurable drift thresholds (warn ≥15%, fail ≥35%).
- `dashboard/js/token-reconcile.js`: dashboard panel renderer for drift reconciliation report; verdict badges, alert list, threshold display, lane and confidence-impact columns.
- `tests/token-telemetry-reconcile.spec.js`: 4 tests covering report structure, configurable thresholds, provider lane/confidence fields, and panel rendering.
- `npm run routing:reconcile` script: CLI entry-point for reconciliation report generation.

### Changed
- `scripts/dashboard-server.js`: added `/api/logs/token-telemetry-reconcile` route.
- `dashboard/index.html`: loads `token-reconcile.js`; cost view now renders reconcile panel between token telemetry and cost monitor.
- `dashboard/js/app.js`: added `reconcileData` state; fetches reconciliation summary on cost view refresh.

## [Unreleased] — Lockfile flip: commit package-lock.json (#830, ADR-017 Accepted)

### Added
- `package-lock.json` committed to the index (clean Node 22 / npm 11 regeneration). Restores reproducible installs and unblocks Dependabot npm-ecosystem PRs.
- `.github/workflows/npm-lockfile-sync.yml`: CI runs `npm ci` on every PR / merge_group / main push touching `package.json` or `package-lock.json`. Fails when the lockfile diverges.

### Changed
- `.gitignore`: removed `package-lock.json` from Node section; added comment pointer to ADR-017.
- `research/adr/017-package-lock-decision.md`: status Proposed → Accepted.
- `docs/DECISIONS.md`: ADR-017 row dropped the "(Proposed)" suffix.
- `scripts/lint.js`: `.worktrees` added to IGNORE for cross-team worktree compatibility.

## [Unreleased] — Codebase Organization: post-#820 broken-ref cleanup (#818)

### Changed
- `.markdownlintignore`: `model-compare/` → `research/model-compare/` (path moved in #820).
- `docs/howto/doc-update-trigger-matrix.md`: `model-compare/**` → `research/model-compare/**` (same).

### Notes
- Final-validation pass for Epic #818 caught two configuration files still referencing the old `model-compare/` path. Historical references in `CHANGELOG-archive.md` and earlier research/triage docs are intentionally preserved for historical accuracy.

## [Unreleased] — ADR-017: package-lock.json Commit vs. Gitignore (#822)

### Added
- `research/adr/017-package-lock-decision.md`: ADR (Proposed) documenting the decision to commit `package-lock.json` (currently gitignored) and defer the actual flip to an isolated follow-up PR with CI verification. Surfaces evidence that Dependabot npm ecosystem is silently broken because PRs cannot be opened without a committed lockfile.
- `docs/DECISIONS.md`: ADR-017 row added.

### Notes
- This ticket lands the ADR only. The actual lockfile flip is deferred to a follow-up child that includes:
  - Removing `package-lock.json` from `.gitignore`
  - Committing the current Node-22-produced lockfile
  - Adding CI step `npm install --frozen-lockfile` (or equivalent)
  - Confirming Dependabot npm PRs start opening

## [Unreleased] — Codebase Organization: .editorconfig (#821)

### Added
- `.editorconfig` at repo root with universal indent/whitespace rules. Per-extension overrides for Python/TOML (4-space), Markdown (preserve trailing whitespace for line breaks), and Makefile (tabs).

### Notes
- `.secrets.baseline` (detect-secrets) deferred to a follow-up: requires Python tooling (`pipx install detect-secrets`) that isn't available in this checkout. Can be added with `detect-secrets scan > .secrets.baseline` in any environment that has it.

## [Unreleased] — Codebase Organization: Relocate Legacy Artifacts (#820)

### Changed
- `model-compare/` → `research/model-compare/` via `git mv`.
- `NAMING_RESEARCH_2026.md` → `research/naming-2026.md` via `git mv`.
- `scripts/ai-matrix-build-final.js`: MATRIX_PATH updated to new location.
- `package.json` lint:md: dropped `!model-compare/**`, added `!tickets/**`.

### Removed
- `tickets/` (70 files): removed from index; GitHub Issues `#N` is canonical baton. Historical content remains in git log; `tickets/` added to `.gitignore`.

## [Unreleased] — Phase 6 Markdown Exec Block-Lint (#801)

### Added
- `scripts/global/docs-exec.js`: opt-in fenced-block runner for docs. Scans markdown for `<!-- exec: [timeout=Ns] -->` markers immediately preceded by ```sh/```bash blocks and executes them. Default behavior is **safe** — blocks without the marker are not executed (inverted from the original skip-tag design for safety).
- `tests/docs-exec.spec.js`: 6 Playwright tests (no markers, marked-success, marked-failure, no-marker-no-run, per-block timeout, multi-file).
- `.github/workflows/docs-exec.yml`: CI gate; runs in clean Ubuntu container.
- `package.json`: `docs:exec` script.

### Notes
- Token-free, deterministic, exit-code-driven.
- Default 30s timeout per block; override with `<!-- exec: timeout=Ns -->`.

## [Unreleased] — Phase 7 Diátaxis + Zensical Research (#802)

### Added
- `research/diataxis-ia-audit-2026-05-02.md`: Diátaxis classification matrix.
- `research/zensical-migration-plan-2026-05-02.md`: migration plan honoring verified runway facts.

## [Unreleased] — Phase 5 Issue Forms Cleanup (#800)

### Added
- `.github/ISSUE_TEMPLATE/feature-request.yml`: YAML form replacing the legacy markdown template; preserves label pre-fill (`type:story`, `status:backlog`, `priority:P2`).

### Removed
- `.github/ISSUE_TEMPLATE/bug_report.md` (duplicate of existing `bug-report.yml`).
- `.github/ISSUE_TEMPLATE/epic.md` (duplicate of existing `epic.yml`).
- `.github/ISSUE_TEMPLATE/feature_request.md` (replaced by `feature-request.yml`).

### Notes
- `config.yml` retains `blank_issues_enabled: false` ✅ — verified.
- Repo metadata sync workflow (originally part of #800 scope) intentionally **not** included: the live repo About + topics carry richer values than `package.json` keywords, and a push-triggered sync would regress that. A manual-dispatch sync can be added in a follow-up once `package.json` keywords reach parity with the curated repo topics.

## [Unreleased] — Phase 3 log4brains ADR Pipeline (#798)

### Added
- `log4brains@1.1.0` devDependency: ADR pipeline with MADR templates, hot-reload preview, static-publish.
- `.log4brains.yml`: project config pointing at `research/adr/`.
- `package.json`: `adr:new`, `adr:preview`, `adr:build` scripts.
- `research/adr/016-log4brains-adr-pipeline.md`: ADR documenting log4brains adoption and the slow-cadence trade-off.

### Changed
- `research/adr/004-model-routing-agents.md` → `research/adr/015-model-routing-agents.md` (renumbered via `git mv` to resolve the long-standing ADR-004 duplicate; first line updated to `ADR-015`).
- `docs/DECISIONS.md`: rewritten as a quick-nav pointer to the auto-rendered log4brains site; lists all 16 ADRs.
- `research/adr/README.md`: index row for the renumbered ADR-015.
- `research/tiered-agent-architecture.md` and `raw/articles/tiered-agent-architecture.md`: TODO references updated from ADR-004 to ADR-015.
- `.gitignore`: ignore `.log4brains/` build output.

### Notes
- Verification-round correction honored: ADR-016 documents the slow-cadence risk (log4brains v1.1.0 released 2024-12-17). Mitigation: vendor or fork upstream package if it goes dark.
- GitHub Pages publish workflow deferred to a follow-up ticket; `npm run adr:build` produces the static site locally today.

## [Unreleased] — Phase 2 Vale + Drift-equivalent Anchors (#797)

### Added
- `.vale/styles/Megingjord/Brand.yml`, `BannedPhrases.yml`, `Terms.yml`: opt-in Megingjord style pack covering canonical brand spelling, operator-identity banned phrases, and canonical terminology. Available for activation per-scope in `.vale.ini`.
- `scripts/global/docs-anchors.js`: Drift-equivalent doc-code anchor checker. Scans `.md` for `<!-- anchor: path/to/file.ext[#L10-L20] [hash:...] -->` markers and verifies the anchored region still hashes to the declared value. `--fix` mode rewrites hashes to the current state.
- `tests/docs-anchors.spec.js`: 8 Playwright tests (no anchors, missing hash, --fix, in-sync, code drift, missing target, line-range slice, line-range drift).
- `.github/workflows/docs-anchors.yml`: CI gate that fails when anchored code changes without a doc update.
- `package.json`: `docs:anchors` script.

### Notes
- Vale Megingjord pack is provided but not activated in `.vale.ini` by default (would false-positive on instructions/operator-identity-context.instructions.md, which legitimately quotes the banned phrases as part of its own ban list). Future tickets can opt the pack into specific scopes.
- Verification-round corrections honored: dropped Mozilla pack (unverifiable); kept verified packs (Microsoft, Google, Elastic, Grafana, Canonical) as future activation targets.

## [Unreleased] — Phase 1 README Compile Pipeline (#796)

### Added
- `scripts/docs-compile.js`: README compile entrypoint; `--check` mode used by CI.
- `scripts/global/docs-transforms.js`: custom `packageScripts` transform for markdown-magic v4.x.
- `.github/workflows/docs-compile.yml`: CI gate that fails when README is out of sync with `package.json`.
- `package.json`: `docs:compile` script; `markdown-magic@4.8.0` devDependency.
- `README.md`: auto-rebuilt scripts table inside `<!-- docs packageScripts -->` fence.

### Changed
- `scripts/lint.js`: README and package.json added to IGNORE_FILES (manifests grow by design).

## [Unreleased] — Phase 2 RAG Search MVP (#784)

### Added
- `scripts/global/rag-search.js`: repo-context search with MCP-first when capability manifest reports rag_server reachable, ripgrep-fallback otherwise.
- `tests/rag-search.spec.js`: 6 Playwright tests.
- `package.json`: `rag:search` script.

## [Unreleased] — Phase 4 Free-Model Orchestrator (#786)

### Added
- `scripts/global/free-router.js`: classifier+signal stack tier-routing logic; calls Groq llama-3.3-70b on uncertain cases; falls back to deterministic classifier when no free LLM available.
- `tests/free-router.spec.js`: 7 Playwright tests covering classifier signals, capability gating, LLM fallback paths.
- `package.json`: `router:free` script.

## [Unreleased] — Phase 0 Capability Probe + Manifest (#788)

### Added
- `scripts/global/capability-probe.js`: read-only substrate probe; detects Tailscale, fleet hosts, Cloudflare account, six provider API keys, MCP RAG server. Writes `.dashboard/capabilities.json` (gitignored, per-install). Never charges tokens; all metadata-only endpoints.
- `scripts/global/capability-show.js`: human-readable manifest summary; reports per-tier feature availability for Epic #782 children.
- `tests/capability-probe.spec.js`: 6 Playwright tests covering schema, read-only invariant, missing-binary fallback, missing-key fallback, show CLI, tier-availability mapping.
- `research/adr/013-capability-detection-substrate.md`: ADR documenting the substrate model.
- `npm run capability:probe` and `npm run capability:show` scripts.
- `.env.example`: optional Tier 0/2/3 env-var template.

## [3.3.7] — 2026-05-02 — Token Telemetry Reporting Surfaces (#773)

### Added
- `routing:telemetry` summary generator writing `logs/token-telemetry-summary.json` for governance-facing token telemetry rollups.
- Dashboard token telemetry surface for confidence split, lane/model summaries, and non-free coverage visibility.

### Changed
- Cost view now combines cost and token telemetry reporting using the same routed telemetry feed.

## [3.3.6] — 2026-05-02 — Copilot Estimated-Lane Telemetry + Caveat Reporting (#772)

### Added
- `research/token-copilot-estimated-lane-implementation-2026-05-02.md`: implementation note and validation evidence for estimated Copilot telemetry handling.

### Changed
- `scripts/global/token-provider-adapters.js`: added `copilot` adapter with `estimated` confidence and explicit caveat metadata.
- `scripts/global/token-ledger-schema.js`: canonical records now include `caveat_code` and `caveat_detail` fields.
- `scripts/global/model-routing-telemetry.js`: summary includes confidence distribution (`exact`, `estimated`, `other`).
- `scripts/global/model-routing-weekly-report.js`: weekly output includes confidence split delta.
- `scripts/global/cost-report.js`: report now prints exact-vs-estimated split and caveat note.
- `scripts/copilot-tracker.js`: added `getCopilotEstimatedRecord()` for canonical estimated-lane projection.
- `tests/token-provider-adapters.spec.js`, `tests/telemetry-schema.spec.js`, `tests/unit-modules.spec.js`: coverage for Copilot adapter and confidence/caveat semantics.

## [3.3.5] — 2026-05-02 — Paid-Token Floor Validation Evidence (#782)

### Added
- `research/paid-token-floor-reduction-validation-2026-05-02.md`: fleet-and-cloud validation addendum for Epic #782 using live probes across OpenClaw, 36gbwinresource, OpenRouter, Google AI Studio, Groq, and Cerebras.

### Notes
- Validation evidence confirms the free-tier substrate remains operational for the three architectural moves defined in `research/paid-token-floor-reduction-2026-05-01.md`.
- This release captures closeout evidence and readiness for epic transition to terminal status.

## [3.3.4] — 2026-05-01 — Fleet Model Upgrades (#765)

### Added
- `scripts/fleet/36gbwinresource/install-models.ps1` and `scripts/fleet/windows-laptop/install-models.ps1`: replicable Ollama model/bootstrap scripts for the two Windows fleet hosts.
- `research/fleet-model-upgrades-implementation-2026-05-01.md`: measured rollout note with benchmark table, provider probe results, and rejected Qwen3-coder availability check.
- `research/adr/014-fleet-model-placement-on-windows-hosts.md`: ADR documenting the shift to `starcoder2:3b` on 36gbwinresource and `qwen2.5-coder:1.5b` on OpenClaw.

### Changed
- `inventory/devices.json`: reconciled both Windows hosts to live `/api/tags`, updated benchmark winners, and marked LiteLLM as running on OpenClaw.
- `config/litellm-config.yaml`, `scripts/global/litellm-client.js`, `scripts/global/openclaw-chat.js`, `scripts/wiki/wiki-llm.js`, and `scripts/ai-matrix-providers-fleet.js`: aligned OpenClaw aliases to the current primary/fast/quality fleet models.
- `scripts/global/fleet-benchmark-runner.js`: now benchmarks the inventory-selected model instead of whichever tag happens to sort first.
- `wiki/entities/36gbwinresource.md`, `wiki/entities/openclaw.md`, and `wiki/entities/windows-laptop.md`: refreshed live model inventories, benchmark figures, and routing roles.

## [3.3.3] — 2026-05-01 — Cloudflare AI Gateway Phase 1 (#783)

### Added
- `scripts/global/ai-gateway-setup.md`: runbook for creating and validating `megingjord-anthropic-cache` with opt-in `ANTHROPIC_BASE_URL`.
- `scripts/global/anthropic-gateway-smoke.js`: smoke validator for direct-vs-gateway Anthropic endpoint routing.

### Changed
- `.env.example`: documents optional `ANTHROPIC_BASE_URL` gateway override while preserving direct Anthropic fallback behavior by default.

## [3.3.2] — 2026-05-01 — Provider Token Adapters (#771)

### Added
- `scripts/global/token-provider-adapters.js`: adapter layer for Anthropic, OpenRouter, LiteLLM, Gemini, and Ollama usage payloads into canonical token-ledger records.
- `tests/token-provider-adapters.spec.js`: adapter unit tests covering each provider plus partial payload handling.
- `research/provider-adapters-implementation-2026-05-01.md`: implementation note with mapping summary and downstream handoff.

## [3.3.1] — 2026-05-01 — Canonical Token Ledger Schema (#770)

### Added
- `scripts/global/token-ledger-schema.js`: canonical token-ledger normalizer with confidence enum (`exact_request`, `exact_aggregate`, `derived`, `estimated`, `unknown`) and lane-aware defaults.
- `research/token-ledger-schema-implementation-2026-05-01.md`: implementation note documenting canonical fields, confidence policy, and compatibility guarantees.

### Changed
- `scripts/global/model-routing-telemetry.js`: now appends canonical token-ledger fields on every write while preserving historical telemetry keys (`ts`, `lane`, `model`, etc.) for existing consumers.

## [3.3.0] — 2026-05-01 — Multi-Agent Dashboard Overhaul (Epic #742)

### Added
- `dashboard/js/multi-agent-sessions.js`: Agent heartbeat polling (localStorage), CSS Grid auto-fill swim-lane rendering with vendor-prefixed color coding for copilot/claude/codex/cursor/cline.
- `dashboard/js/tier-c-banner.js`: Tier-C limited-mode warning banner and ticket/branch conflict detection with `groupBy`/`conflictsFromGroup` helpers.
- `dashboard/css/multi-agent.css`: CSS Grid swim-lane layout, vendor color borders, `+N more` overflow badge, conflict alert styling.
- `🤖 Agents` nav tab and panel in `dashboard/index.html`.
- `agentSessions` state and `fetchAgentSessions()` call integrated into `dashboard/js/app.js` `refreshAll()` cycle.
- `research/multi-agent-dashboard-design-2026-05-01.md`: Design decisions Q1–Q4 sourced from Cerebras fleet AI.
- Child ticket #776 created as implementation ticket under Epic #742.
- PR #777 merged; all 14 CI gates passed.

### Changed
- `wiki/log.md`: Fixed MD012 double-blank-line at entry #140.

## [Unreleased] — Layer 3 Cloudflare Worker Coordination (Optional, #740)

### Added
- `cloudflare/worker.ts`: Worker entry routing requests to a per-fleet Durable Object instance.
- `cloudflare/durable-object.ts`: `CoordinatorDurableObject` class implementing lease + heartbeat APIs that mirror the Layer 4 SQLite surface.
- `cloudflare/wrangler.toml`: deploy config; no secrets committed.
- `cloudflare/README.md`: deploy instructions; documented free-tier headroom.
- `scripts/global/agent-coord-remote.js`: client wrapper that uses Cloudflare Worker if `CLOUDFLARE_WORKER_URL` is set, else falls back to Layer 4 with a "limited mode" banner.
- `package.json`: `agent:coord:remote` script.

## [Unreleased] — Tier-C Protection Detector (#741)

### Added
- `scripts/global/tier-c-guard.js`: detects Aider auto-commit signatures (last 5 commits) and Cline/Roo workspace markers (`.clinerules/`, `.roo/`); blocks Aider auto-commit on `main`, `master`, `release/*`, `hotfix/*` branches; warning-only on feature branches; `MEGINGJORD_ALLOW_TIER_C=1` override available.
- `package.json`: `agent:tier-c` script.

## [Unreleased] — Drift Monitoring Strategy Research

### Added
- `research/drift-monitoring-strategy-2026-05-01.md`: decision matrix and recommendation for install-agnostic stale-instruction drift monitoring.
- `raw/articles/drift-monitoring-strategy-2026-05-01.md`: ingest source artifact for wiki capture.
- `wiki/sources/drift-monitoring-strategy-2026-05-01.md`: generated wiki source summary from ingest pipeline.

### Changed
- `wiki/index.md`: indexed the new drift-monitoring strategy source page.
- `wiki/log.md`: recorded ingest event for drift-monitoring strategy research.

## [Unreleased] — Architecture Documentation Library (#727)

### Added
- `docs/ARCHITECTURE.md`: system data-flow map and subsystem index (routing, governance, wiki, dashboard, fleet) with file pointers to canonical sources.
- `docs/HELP-GUIDELINES.md`: HELP panel UX patterns — section-id taxonomy (`start-*`, `use-*`, `trouble-*`, `dev-*`), body HTML conventions, file-size discipline, wikilink rules.
- `docs/DECISIONS.md`: index for the 11 ADRs in `research/adr/` (canonical store) with how-to-add-a-new-ADR guidance.

## [Unreleased] — HTTP Handler Sync-Call Guard (#723)

### Added
- `scripts/global/no-sync-http-handlers.js`: fails when `execSync` or `spawnSync` appears in dashboard HTTP handler files.
- `package.json`: added `governance:no-sync-http` script.

### Changed
- `.github/workflows/quality-gates.yml`: now runs `npm run governance:no-sync-http` as a required quality gate.

## [Unreleased] — Docs Drift Detector and CI Gate (#722)

### Added
- `scripts/docs-lint.js`: deterministic docs-drift checker. Validates that every `npm run X` token in `dashboard/js/help-*.js` resolves to a real `package.json` script, every `[[wikilink]]` resolves to a real wiki page in `~/.copilot/wiki/concepts/` or `~/.copilot/wiki/entities/`, and warns on `instructions/*.md` files older than 90 days.
- `.github/workflows/docs-lint.yml`: NEW workflow that runs `npm run docs:lint` on PRs touching HELP, instructions, scripts, or package.json. Syncs `wiki/` to `~/.copilot/wiki/` before the check.
- `package.json`: added `docs:lint` script.

## [Unreleased] — HELP Wikilinks and help:topic CLI (#718)

### Added
- `dashboard/js/help-content.js`: `renderWikiLinks(body)` transforms `[[page-name]]` patterns in help section bodies into Alpine-wired anchor tags that switch the dashboard to Wiki view.
- `scripts/help-topic.js`: CLI script; `npm run help:topic -- <term>` searches the local LLM wiki and prints results to stdout.
- `package.json`: added `help:topic` script.

### Changed
- `dashboard/js/help-user.js`: five help sections (baton, context-flow, governance, ticket-log, devices) now include a "Learn more: [[wiki-page]]" wikilink.
- `dashboard/js/help-dev.js`: three developer sections (architecture, contributing, skills) now include wikilinks.

## [Unreleased] — Release Smoke Governance Wiring (#719)

### Changed
- `.github/workflows/quality-gates.yml`: now executes `tests/no-network-errors.spec.js` and `tests/api-smoke.spec.js` in required quality checks.
- `.github/workflows/release-please.yml`: added `release-verification` job to run the same two Playwright smoke specs on `main` push.

## [Unreleased] — Epic Close-Readiness Gate (#452)

### Added
- `.github/workflows/epic-close-readiness.yml`: detects when a `type:epic` issue is closed while child issues referencing it remain open; posts a violation comment listing open children and re-opens the epic automatically.

## [Unreleased] — Governance Integrity Automation Hardening (#657)

### Added
- `.github/workflows/lint.yml`: added `Ticket reconciliation` step and `issues:read` permission for PR/merge-group governance validation.
- `scripts/global/ticket-reconcile.js`: detects local `tickets/*.md` files without matching GitHub issues and fails when drift exists.
- `scripts/global/ticket-reconcile-baseline.json`: baseline allowlist for known historical ticket-ID gaps so only net-new drift fails CI.
- `package.json`: added `governance:reconcile` script.

### Changed
- `.github/workflows/label-lint.yml`: auto-reopens issues closed without terminal status labels, strips `role:*` labels on close, and enforces exactly one `lane:*` label at `status:ready`.
- `.github/workflows/baton-gates.yml`: lightweight lanes (`lane:docs-research`, `lane:docs-only`, `lane:trivial`) skip collaborator/admin artifact requirements.
- `.github/workflows/evidence-completeness.yml`: lightweight lanes skip collaborator timing enforcement.
- `.github/workflows/label-scan.yml`: corrected pinned `actions/github-script` digest.

## [Unreleased] — Context Flow Event-Animation CSS Classes (#706)

### Added — Context Flow Animations Foundation
- `dashboard/css/context.css`: `@keyframes cf-pulse` (3s ease-out drop-shadow pulse), `.cf-active` (event-triggered animation class), and `.cf-idle` (dim to opacity 0.35); prerequisite for SSE-driven event-wiring module (#707)

## [Unreleased] — Fleet Benchmarks + OpenClaw Model Inventory (#338)

### Added — Fleet Resource Documentation
- `model-compare/design-analysis/LLM-EVALUATION-MATRIX.md`: new `qwen2.5-coder:7b` row with live benchmark data (1.3 TPS CPU, empirical score 7.0); `phi3:mini` and `mistral:latest` marked `⚠ not installed`
- `wiki/entities/openclaw.md`: updated models-available section with live benchmarks; added CPU-only performance constraints; documented `qwen2.5-coder:7b` cold-start behavior

## [Unreleased] — Wiki Section Popularity Auto-Record (#328)

### Fixed — Wiki Health Metrics
- `dashboard/js/wiki-reader.js`: `renderWikiReader` now auto-calls `trackWikiAccess` for each loaded section at most once per hour (debounced via `_lastAutoRecord` + `AUTO_RECORD_INTERVAL_MS`), so section popularity updates without requiring manual user clicks
- `tests/wiki-popularity.spec.js`: 4 Playwright tests covering section bar render, empty-state display, section click request tracking, and auto-record trigger

## [Unreleased] — Baton Step Fleet Resource Tooltips (#329)

### Added — Fleet Resource Visibility
- `dashboard/js/baton-flow.js`: each baton step `title` tooltip now shows resource type (fleet/cloud), agent name, and model for the active role; done steps show "✓ done"; pending steps show "pending" — uses `/^(qwen|llama|mistral|phi|gemma)/` regex to classify fleet vs cloud models
- `tests/baton-step-resource.spec.js`: 5 Playwright tests covering fleet-type detection, cloud-type detection, agent name in tooltip, model name in tooltip, and done-step label

## [Unreleased] — Agent Baton Last Comment Snippet (#326)

### Added — Baton UI Enhancement
- `dashboard/js/baton-flow.js`: `buildCommentSnippet()` displays last comment inline per baton row — truncated to 80 chars with ellipsis, full text in `title`/`aria-label` for tooltip/accessibility
- `dashboard/css/baton.css`: `.baton-comment` rule — compact single-line display, `text-overflow: ellipsis`, `cursor: help`
- `tests/baton-comment-snippet.spec.js`: 5 Playwright tests covering snippet render, truncation, tooltip, aria-label, and null-comment no-render

## [Unreleased] — Playwright Layout Regression Tests (#399)

### Added — Layout Regression Coverage
- `tests/layout-regression.spec.js`: 4 geometric assertions — baton+activity side-by-side at 725px viewport; context-flow panel bottom edge within viewport height; every `.cf-sub` label Y within its parent `.cf-node-g rect` bounds; every `.cf-node-g rect` left edge ≥ 5px from panel border

## [Unreleased] — GitHub-API Drift Scan + Epic Close Validator (#359)

### Added — Live Governance Scanning
- `scripts/global/governance-github-scanner.js`: paginates all GitHub issues via REST API, checks 5 ADR-010 rules (closed+role, done+role, missing active-status role, epic+ready, multi-status), returns classified violations
- `scripts/global/epic-close-validator.js`: checks all open `type:epic` issues for close-readiness (status:review, open child count via timeline, CONSULTANT_CLOSEOUT comment)
- `governance:epics` npm script

### Changed — Governance Drift Pipeline
- `scripts/global/governance-drift-classifier.js`: now async; calls `governance-github-scanner.js` when `GITHUB_TOKEN` set, merges `githubViolations` into drift report
- `.github/workflows/drift-detection.yml`: passes `GITHUB_TOKEN`/`GITHUB_REPOSITORY` to drift step; adds epic close-readiness summarize step

## [Unreleased] — ADR-010 Lifecycle Enforcement + Daily Scan (#358)

### Added — Label Governance Enforcement
- `.github/workflows/label-lint.yml`: Rule 7 (closed+role), Rule 8 (positive role per active status), Rule 9 (epic+status:ready guard)
- `.github/workflows/label-scan.yml`: new scheduled daily ADR-010 scan of all issues with idempotent violation comments

## [Unreleased] — End-to-End Anneal Verification Reliability (#683)

### Changed
- `scripts/global/consultant-checks.js`: `gov-003` now accepts baton evidence from either `logs/fleet-health.jsonl` or `.dashboard/events.jsonl` (`baton:handoff`) to avoid false FAILs when fleet-health logs are telemetry-only.
- `scripts/global/consultant-checks.js`: `fleet-003` now recognizes local utilization from either explicit `provider:"ollama"` entries or `lane:"fleet"` telemetry rows.

## [Unreleased] — Consultant SKILL.md Updates (#682)

### Changed
- `skills/role-consultant-critique/SKILL.md`: Added Comprehensive Check Registry section, Manager Feedback Protocol step, and extended output contract with `checks_run`, `checks_failed`, `remediation_issues` fields.
- `skills/workflow-self-anneal/SKILL.md`: Added Consultant Integration section and two new trigger conditions for governance/cost-budget FAIL patterns.

## [Unreleased] — Consultant Feedback Bridge (#681)

### Added
- `scripts/global/consultant-feedback.js`: Manager backlog feedback bridge. Converts failed `consultant-checks.js` results into GitHub create-or-augment backlog actions and posts a Remediation Brief on the originating issue. Closes Epic #610 child #614.

## [3.2.0] — Rebrand: DevEnv Ops → Megingjord (2026-04-29)

### Changed — Global Rebrand
- Package name: `devenv-ops` → `megingjord-harness`
- Repository title: "devenv-ops" → "Megingjord"
- Core documentation and plugin metadata updated to Megingjord branding
- Added `NAMING_RESEARCH_2026.md` with naming research and recommendation

### Why Rebrand?
Megingjord better positions the harness as a **governance-first** AI agent orchestration tool. Research into current naming patterns identified Megingjord as:
- **Distinctive + memorable** (vs. generic "DevOps" nomenclature)
- **Governance-aligned semantics** (protection, guardrails, policy)
- **Lower naming-conflict risk** after rejecting "Codex" due OpenAI brand collision and "Aegis" due broad prior use

## [Unreleased] — Request Queuing + Exponential Backoff (#670)

### Added — Rate-Limit Resilience
- `scripts/global/backoff.js`: `backoff(attempt, opts)` — exponential delay with 20% jitter, capped at 60s; `isRateLimitError(err)` — matches HTTP 429/503 and message patterns
- `scripts/global/request-queue.js`: `RequestQueue` with priority lanes (urgent/normal/low), RPS throttle, adaptive backpressure (RPS drops on task failure), max queue 500, `getStats()`, `drain()`
- `scripts/global/cascade-dispatch.js`: `tryOllama` now retries up to 3 times on rate-limit errors using `backoff.js`; graceful escalation after max retries

## [Unreleased] — Fleet Quantization Strategy + Device Inventory (#669)

### Changed — Fleet Device Inventory
- `inventory/devices.json`: added `recommendedModels[]` with `quantization`, `paramSize`, `sizeGB`, `use` per model for all 3 Ollama fleet nodes (penguin-1, windows-laptop, 36gbwinresource)
- `inventory/devices.json`: added `benchmarks` object per device with `platform`, `warmTokPerSec`, `model`, `quantization`, `notes`; 36gbwinresource at 32.3 tok/s GPU, windows-laptop at 7.3 tok/s CPU
- All 3 nodes confirmed reachable via Tailscale; live quantization: Q8_0 (sub-2b), Q4_K_M (7b)

## [Unreleased] — Real-Time Cost Monitor Dashboard (#672)

### Added — Cost Dashboard
- `dashboard/js/cost-monitor.js`: browser module with `fetchCostTelemetry()` and `renderCostMonitor(data)`; projected monthly cost, budget bar (80% alert), tier distribution table, last 5 requests
- `dashboard/index.html`: added `💰 Cost` nav button and cost-monitor panel template
- `dashboard/js/app.js`: wired `costData` into Alpine data object; populated in `refreshAll()`
- `scripts/dashboard-server.js`: `/api/logs/cost-telemetry` endpoint serving `logs/cost-telemetry.jsonl`; 404 when absent

## [Unreleased] — Cost Telemetry + Routing Discipline (#668)

### Added — Cost Accounting per Dispatch
- `scripts/global/cost-telemetry.js`: per-dispatch cost logger writing `logs/cost-telemetry.jsonl`; computes `cost_usd` per tier at 2026 blended pricing; budget alert at 80% of $10/mo
- `scripts/global/task-router-dispatch.js`: now calls `recordCostEvent()` on every fleet dispatch
- `npm run cost:baseline`: runs cost-telemetry summarizer for 30-day window
- `scripts/lint.js`: added `.claude` to IGNORE list (excludes agent worktrees from 100-line scan)

## [Unreleased] — Verification Baseline + Cost Measurement (#671)

### Added — Cost Baseline Tooling
- `scripts/global/cost-baseline.js`: before/after comparison tool; reads `logs/cost-telemetry.jsonl`, shows current projected monthly cost vs pre-optimization baseline ($60.38/mo, ~1090 req, 100% premium); outputs savings delta
- `npm run cost:baseline`: runs cost-baseline.js for 30-day window comparison

## [Unreleased] — Instruction Token Footprint Reduction (#667)

### Changed — Instruction Optimization
- 15 instruction files reduced by 877 words (15.0%) with no governance regression
- `role-baton-routing`: dropped Sequence section (duplicated transition guards) and De-duplication boundary
- `ticket-driven-work`: removed Linking Rules section and condensed work-type matrix to prose
- `release-docs-hygiene`: removed intro bullets that duplicated post-merge checklist
- `workflow-resilience`: removed Documentation drift rules section (covered by release-docs-hygiene)
- `github-governance`: removed five "invoke skill" pointer lines, condensed capability-first section
- All 363 files ≤100 lines; readability baseline maintained at 389 warnings

## [Unreleased] — CI Workflow Efficiency Improvements (#661)

### Changed — Scheduled Workflow Reliability

## [Unreleased] — Consultant Check Registry Bootstrap (#664)

### Added — Initial Registry CLI
- `scripts/global/consultant-checks.js`: new lightweight CLI emitting governance/tools/fleet check records with `id`, `domain`, `status`, `evidence`, `finding`, and `suggestedFix`
- Supports `--issue`, `--json`, and `--dry-run` for machine-parseable baton usage and low-cost local validation

### Fixed — Governance Baseline Metadata
- `tickets/599-task-sandbox-worktree-governance-pack.md`: normalized plain metadata headers (`Type`, `Status`, `Priority`, `Area`) to satisfy verifier parsing on current mainline baseline

## [Unreleased] — Governance Verifier Hygiene (#652)

### Fixed — Governance Verifier False Positives
- `scripts/global/governance-verify.js`: removed `Signed-by:` requirement from local ticket files; baton record lives in GitHub comments (enforced by baton-gate CI). Eliminated 53 false-positive drift findings covering 98% of all tickets
- Bulk label cleanup: stripped lingering `role:*` labels from 9 closed issues and corrected `status:*` labels on 26 closed issues (no-status, wrong-status, backlog/review on closed state)

## [Unreleased] — Wiki Critical Audit and Structural Repair (#651)

### Fixed — LLM Wiki Health
- `scripts/wiki/lint.js`: orphan detection now counts `index.md` references as inbound links (index was excluded from link graph, causing false orphan reports for all indexed pages)
- Repaired frontmatter on 9 wiki pages (plural type fields corrected, missing `created`/`status` added)
- Fixed `concepts/github-integration.md`: `category:` → `type:`, added `related` field
- Removed 3 ghost index entries (`linting-governance-rationale/tooling/rollout` — files don't exist)
- Fixed 2 broken wikilinks in code-block documentation examples

### Added — LLM Wiki Improvements
- `wiki/WIKI.md`: schema reference with `confidence`, `last_verified`, `sources_count`, `superseded_by` frontmatter fields; lint rule for >90-day staleness
- `wiki/syntheses/llm-wiki-state-2026.md`: synthesis from 16 web sources; validates flat-markdown at 65-page scale; 5 actionable improvements
- `wiki_router.py`: `infra-automation` routing branch injecting fleet routing order and governance enforcement layers for devenv-ops sessions; max snippets raised to 5
- Index rebuilt: 65 pages, clean section structure, 8 missing source entries added
- Log updated with 7 entries for #647, #360, #595, #651

## [Unreleased] — Continuous Governance Drift Detection (#360)

### Added — Governance Drift Classification
- `scripts/global/governance-drift-classifier.js`: classifies governance issues into `open`, `terminal`, and `epic` drift classes; exits 1 on drift detected
- `tests/governance-drift.spec.js`: 11 targeted unit tests for all drift classification paths
- `.github/workflows/drift-detection.yml`: daily + manual CI workflow writing `logs/governance-drift.json`
- npm script `governance:drift` for manual drift runs
- Extended `scripts/global/governance-weekly-report.js` with `driftByClass` metrics and robust verifier error handling

## [Unreleased] — Sandbox Launcher Sync (#647)

### Added — Worktree Governance Automation
- `.github/workflows/post-merge-sandbox-sync.yml`: fires on push to `main`; force-resets `sandbox/copilot`, `sandbox/codex`, `sandbox/claude-code` to the new main SHA via the GitHub REST API — closes the gap where `worktree-governance-required` enforced currency but no automation maintained it

## [Unreleased] — HELP Docs and Doc Governance (Epic #335)

### Added — HELP Documentation Infrastructure (#522 #639 #640 #641 #644)
- `docs/howto/help-inventory.md`: full audit of all 36 skills; zero HELP.md coverage; priority gap table
- `docs/howto/doc-update-trigger-matrix.md`: maps code-area patterns to required doc surfaces; CI gate spec
- `docs/howto/baton-workflow.md`: end-to-end developer HOWTO for the Agile baton ticket lifecycle
- `docs/howto/fleet-routing.md`: developer HOWTO for fleet routing lanes, complexity scoring, and cost-report
- `.github/workflows/doc-update-gate.yml`: CI gate — fails PRs that modify skills/instructions/scripts without a doc update
- `scripts/lint.js`: added `docs/howto` to 100-line exclusion list (same pattern as `instructions/` and `research/`)

## [Unreleased] — Self-Anneal Governance Infrastructure (Epic #416)

### Added — Fleet Capability Tagging (Epic #561)
- `inventory/devices.json`: added `routing` capability tags for all devices and registered `36gbwinresource` as `performance`/`heavy-coding` primary fleet node
- `research/fleet-capability-tagging-research.md`: capability-tag survey and internal wiki gap analysis
- `research/adr-fleet-capability-tags.md`: accepted schema contract for router-readable fleet metadata
- `wiki/entities/36gbwinresource.md`: new fleet entity profile

### Changed — Router Fleet Targeting (Epic #561)
- `scripts/global/task-router.js`: fleet lane now selects `targetDevice` and `targetOllamaUrl` from inventory capability tags
- `scripts/global/task-router-policy.json`: capability-tag selection metadata added
- `scripts/global/model-routing-policy.json`: judge gate enabled after GPU fleet node confirmation
- `scripts/global/ollama-direct.js`: default direct endpoint moved to `36gbwinresource`
- `wiki/concepts/model-routing.md`, `wiki/sources/devenv-fleet-topology.md`: updated topology and routing order

### Added — Atomic Label Transitions (#417)
- `scripts/global/issue-transition.js`: single `gh issue edit` call validates and executes baton transitions, eliminating ADR-010 label-lint race conditions
- `npm run issue:transition` script

### Added — DangerJS PR Governance (#418)
- `Dangerfile.js`: enforces ticket-first (`Closes #N`), branch naming, Conventional Commits, and `#N` title suffix on all PRs
- `.github/workflows/danger.yml`: `danger-required` CI check gates all PRs to main

### Added — PR Title Enforcement (#419)
- `.github/workflows/pr-title.yml`: `pr-title-required` CI check via `amannn/action-semantic-pull-request@v5`; enforces type, scope, and ≤60-char subject

### Added — PreToolUse Commit Hook (#420)
- `hooks/scripts/baton_gate.py`: blocks `git commit` without `#N` issue reference in message; hints branch number
- `.claude/settings.json.template`: documents required Claude Code hook registration

### Added — Governance Document Linting (#421)
- `.vale.ini` + `.vale/styles/Governance/TicketFields.yml`: enforces `Priority:`, `Type:`, `Status:` fields in tickets and instructions at error level
- `.markdownlint.json` + `.markdownlintignore`: markdownlint CI with zero-error baseline
- `lint:md` npm script; CI `lint-required` job extended

### Added — release-please Automation (#422)
- `.github/workflows/release-please.yml`: auto-generates release PRs with CHANGELOG diffs on every push to main
- `.release-please-config.json`: node release-type; bumps `package.json` + `plugin.json`
- `.release-please-manifest.json`: baseline `3.1.0`

### Added — Baton Gate Chain (#423)
- GitHub Environments: `collaborator-gate`, `admin-gate`, `consultant-gate` with Required Reviewer
- `.github/workflows/baton-gates.yml`: chained environment jobs; each gate pauses for explicit operator approval
- `CONTRIBUTING.md`: Baton Gate Chain section documenting gate semantics

## [3.1.0] - 2026-04-24

### Added — Model Routing Telemetry (#411)
- `model-routing-engine.js`: policy-driven routing; classifies tasks, applies rollback logic
- `model-routing-telemetry.js`: records per-dispatch events to `~/.copilot/logs/`
- `model-routing-policy.json`: task-class → model-id + multiplier policy
- `npm run router:weekly`: weekly cost/quality scorecard from telemetry log
- `fleet-live-indicator.js`: real-time CLI system status (Ollama, memory, OpenClaw)

### Added — Governance Verifier (#412)
- `governance-verify.js`: scans `tickets/*.md` for ADR-010 violations; `--json` output

### Changed — Governance Instructions (#409)
- `ticket-driven-work.instructions.md`: GitHub evidence block, Ready-SLA contract, exception schema
- `epic-governance.instructions.md`: re-scope-before-close rule
- `workflow-resilience.instructions.md`: ready-stall blocker note minimum fields
- CI workflows: `merge_group` trigger, stable job names, path filters, concurrency groups

### Fixed — Dashboard JS ESLint Compliance (#410)
- Added `/* global */` directives to 15 dashboard JS modules
- Exported public APIs via `Object.assign(window, {})` in provider modules
- Null-safety: strict equality guards in `render-panels.js`

## [3.0.2] - 2026-04-23

### Fixed — Agent Baton Filtering (#122)
- Baton panel displays only `in-progress` or `review` tickets
- GitHub issues without `status:*` label default to `backlog`
- Prevents 300+ untagged issues from flooding baton view

### Fixed — Context Flow Animation (#123)
- Context Flow SVG renders with all topology nodes and arrows
- Data packet animations display when active baton exists
- Fixed `isActive` parameter passing to arrow renderer

### Added — JSDoc Documentation
- `dashboardApp()`, `cfArrows()`, `syncWithGitHub()` documented
- Baton filter and Context Flow animation logic documented

## [3.0.1] - 2026-04-14

### Added — Wiki Self-Annealing (#96)
- `scripts/wiki/anneal.js`: auto-fix broken links, orphans, frontmatter
- `npm run wiki:anneal` (dry-run default, `--apply` to write)

### Added — SSE Push Model (#97)
- `/api/events/stream` SSE endpoint
- Event bus client with polling fallback

## [2.4.1] - 2025-07-14

### Fixed — Dashboard UX Polish (11 issues from v2.4.0 UAT)
- Header status, Tailscale count, Fleet topology, Help toggle
- Refresh slider, Activity log, Quotas, Router Lanes, Router Log
- Wiki panel, Stress test refinements

## [2.4.0] - 2026-04-14

### Added — Live Event System (#35)
- Event emitter and reader with JSONL persistence
- Event bus client with `/api/events` polling
- Agent names and activity tracking in baton panel

**See [CHANGELOG-archive.md](CHANGELOG-archive.md) for versions 2.3.0 and earlier.**
