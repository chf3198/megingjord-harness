# Phase-R Independent R&D: Copilot Team for #1148

**Date**: 2026-05-09
**Parent Epic**: #1130
**R&D Ticket**: #1148
**Team**: cp
**Substrate**: github-copilot
**Model**: gpt-5.3-codex
**Signed-by alias**: Nova Harper

## Metadata

- artifact: cp-rd.md
- version: 1
- phase: R
- team: cp
- substrate: github-copilot
- model: gpt-5.3-codex
- parent_epic: 1130
- ticket: 1148
- last_activity_utc: 2026-05-09T06:22:07Z

## Contamination declaration

### Mandatory declaration

I authored this artifact independently and did not intentionally read peer R&D artifacts for synthesis-1148.

### What I read before authoring

- Epic #1130 issue body and labels.
- R&D ticket #1148 issue body and labels.
- v2 protocol source via Git object lookup (`git show origin/main:research/cross-team-rd-protocol-v2-2026-05-09.md`) because the referenced file is missing in this branch path.
- Repository governance and HAMR implementation files listed in the source inventory below.
- External web sources listed in the websearch inventory below.

### Accidental exposure note

During a broad repository grep intended to locate the missing protocol file path, two short snippet matches from peer artifact filenames surfaced in search output (`planning/synthesis-1148/artifacts/cc-rd.md` and `planning/synthesis-1148/artifacts/cx-rd.md`). I did not open either file directly and did not use those snippets as design inputs. This artifact’s claims are grounded in issue text, protocol text, local code evidence, and web sources below.

### Independence statement

- no_peer_artifacts_read: true (direct file opens)
- seeded_prior_consensus_used: false

## Summary table

| Area | Current state | Primary risk | Recommended direction |
|---|---|---|---|
| Adapter coverage | Partial and provider-biased | Non-uniform telemetry/cost signals | Expand adapter set with normalized usage mapping |
| Wrapper enforcement | Policy says SHOULD, implementation is opt-in | 0% effective coverage possible on hot paths | Introduce detection + progressive enforcement |
| Freshness pipeline | Scheduled + cron push exists | stale telemetry if producer path is skipped | Keep dual producers and add explicit SLO checks |
| Governance gates | Sync and wrapper tests exist | No direct utilization gate in audit | Add utilization and bypass checks to governance-audit |
| Migration path | Bypass calls exist in scripts | High regression risk if hard cutover | Thin-slice migration with advisory-first lint |

## Source inventory (repo evidence)

The following repository anchors were used directly for claims in this document.

- repo: instructions/hamr-routing.instructions.md#L31-L38
- repo: instructions/hamr-routing.instructions.md#L65-L73
- repo: instructions/hamr-routing.instructions.md#L83-L83
- repo: scripts/global/hamr-provider-wrapper.js#L16-L27
- repo: scripts/global/hamr-provider-wrapper.js#L36-L41
- repo: scripts/global/hamr-provider-wrapper.js#L64-L82
- repo: scripts/global/token-provider-adapters.js#L12-L24
- repo: scripts/global/token-provider-adapters.js#L57-L64
- repo: scripts/global/token-provider-adapters.js#L91-L94
- repo: cloudflare/hamr/routes/quota.ts#L36-L50
- repo: cloudflare/hamr/routes/cache-stats.ts#L6-L8
- repo: cloudflare/hamr/routes/cache-stats.ts#L56-L64
- repo: cloudflare/hamr/scheduled.ts#L10-L23
- repo: cloudflare/hamr/wrangler.toml#L26-L26
- repo: scripts/global/install-cron.sh#L22-L24
- repo: scripts/global/hamr-periodic-push.sh#L24-L40
- repo: scripts/global/cache-hit-gate.js#L11-L12
- repo: scripts/global/cache-hit-gate.js#L55-L57
- repo: scripts/global/cache-stats-emit.js#L10-L11
- repo: scripts/global/cache-stats-emit.js#L26-L41
- repo: scripts/global/hamr-sync-verify.js#L10-L16
- repo: scripts/global/hamr-sync-verify.js#L30-L45
- repo: scripts/global/governance-audit.js#L13-L13
- repo: scripts/global/governance-audit.js#L60-L70
- repo: tests/hamr-team-integration.spec.js#L21-L27
- repo: tests/hamr-team-integration.spec.js#L59-L66
- repo: tests/hamr-team-integration.spec.js#L80-L86

Repo anchor count used: 27

## Websearch inventory (mandatory external grounding)

- websearch: https://developers.cloudflare.com/workers/configuration/cron-triggers/ (accessed 2026-05-09T06:22:07Z) — scheduled handlers are first-class and cron timing is UTC.
- websearch: https://developers.cloudflare.com/kv/platform/limits/ (accessed 2026-05-09T06:22:07Z) — KV write/read and per-key write-rate limits constrain freshness design.
- websearch: https://console.groq.com/docs/openai (accessed 2026-05-09T06:22:07Z) — Groq is OpenAI-compatible but with explicit unsupported fields.
- websearch: https://learn.microsoft.com/en-us/azure/foundry/openai/reference (accessed 2026-05-09T06:22:07Z) — Azure OpenAI has endpoint/query/header differences and explicit usage payload fields.
- websearch: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching (accessed 2026-05-09T06:22:07Z) — prompt caching has TTL/usage semantics relevant to cache telemetry normalization.
- websearch: https://openai.com/index/api-prompt-caching/ (accessed 2026-05-09T06:22:07Z) — cached token accounting can be directly observed (`cached_tokens`) in usage.
- websearch: https://ai.google.dev/gemini-api/docs/pricing (accessed 2026-05-09T06:22:07Z) — context caching and storage pricing explicitly surfaced for Gemini tiers.
- websearch: https://datatracker.ietf.org/doc/html/rfc9449 (accessed 2026-05-09T06:22:07Z) — DPoP sender-constrained token model and replay/nonce guidance.

Websearch citation count used: 8

## Findings

### F1 — Policy/implementation gap is real and measurable

The routing instruction declares that governed provider calls SHOULD flow through the wrapper, and also documents an explicit opt-out env var.

- repo: instructions/hamr-routing.instructions.md#L31-L38
- repo: instructions/hamr-routing.instructions.md#L83-L83

The wrapper implementation itself is a pure library and can be disabled at runtime.

- repo: scripts/global/hamr-provider-wrapper.js#L36-L41
- repo: scripts/global/hamr-provider-wrapper.js#L64-L82

Implication:

Universal coverage cannot be reached by documentation alone; detection and enforcement have to be added at call-site and governance levels.

### F2 — Adapter normalization is mostly present but incomplete for Epic #1130 scope

Current adapter exports cover many providers (`anthropic`, `openrouter`, `ollama`, `groq`, `cerebras`, etc.) but not an explicit Azure OpenAI adapter label, and no explicit Google AI Studio naming path.

- repo: scripts/global/token-provider-adapters.js#L12-L24
- repo: scripts/global/token-provider-adapters.js#L57-L64
- repo: scripts/global/token-provider-adapters.js#L91-L94

External evidence shows Azure has concrete endpoint/version/header semantics that justify a dedicated adapter shim for deterministic parsing/attribution.

- websearch: https://learn.microsoft.com/en-us/azure/foundry/openai/reference (accessed 2026-05-09T06:22:07Z)

Implication:

Add explicit adapters for `azure-openai` and `google-ai-studio` while reusing common OAI/Gemini shape normalization code.

### F3 — Freshness mechanics are dual-path but still require utilization SLOs

The worker returns `schema_version: 2` and `stale`, and scheduled logic updates staleness based on age.

- repo: cloudflare/hamr/routes/quota.ts#L36-L50
- repo: cloudflare/hamr/scheduled.ts#L10-L23

Wrangler cron is configured every 6h, while operator cron also pushes both cache and health payloads.

- repo: cloudflare/hamr/wrangler.toml#L26-L26
- repo: scripts/global/install-cron.sh#L22-L24
- repo: scripts/global/hamr-periodic-push.sh#L24-L40

Cloudflare docs confirm scheduled handlers and UTC cron semantics, but propagation and runtime realities mean stale windows can still occur.

- websearch: https://developers.cloudflare.com/workers/configuration/cron-triggers/ (accessed 2026-05-09T06:22:07Z)

Implication:

Retain dual-source freshness (worker + operator), then gate on explicit freshness SLO in governance.

### F4 — Cache telemetry exists but needs provider-harmonized economics

Local cache-stat emission and hit-rate gate already exist.

- repo: scripts/global/cache-stats-emit.js#L26-L41
- repo: scripts/global/cache-hit-gate.js#L11-L12
- repo: scripts/global/cache-hit-gate.js#L55-L57

Provider docs expose materially different cache semantics (OpenAI cached tokens, Anthropic cache creation/read split, Gemini context cache/storage pricing).

- websearch: https://openai.com/index/api-prompt-caching/ (accessed 2026-05-09T06:22:07Z)
- websearch: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching (accessed 2026-05-09T06:22:07Z)
- websearch: https://ai.google.dev/gemini-api/docs/pricing (accessed 2026-05-09T06:22:07Z)

Implication:

Normalize to a shared telemetry schema with provider-native fields preserved in `raw_usage` and mapped into canonical `cache_read_tokens`, `cache_write_tokens`, and `storage_cache_tokens` where available.

### F5 — Governance checks currently do not enforce universal coverage directly

`governance-audit` runs governance checks but has no direct `hamr_utilization_rate_7d` check today.

- repo: scripts/global/governance-audit.js#L13-L13
- repo: scripts/global/governance-audit.js#L60-L70

`hamr-sync-verify` ensures script deployment parity but not call-site utilization.

- repo: scripts/global/hamr-sync-verify.js#L10-L16
- repo: scripts/global/hamr-sync-verify.js#L30-L45

Implication:

Add two new audit checks: utilization floor and bypass detector status.

### F6 — Test baseline is good for wrapper behavior, not full bypass prevention

Integration tests verify wrapper instrumentation and disabled-path behavior.

- repo: tests/hamr-team-integration.spec.js#L59-L66
- repo: tests/hamr-team-integration.spec.js#L80-L86

Quota contract is asserted too.

- repo: tests/hamr-team-integration.spec.js#L21-L27

Implication:

Add static and dynamic bypass coverage tests to complement wrapper tests.

### F7 — OpenAI-compatible providers are not identical in parameter support

Groq’s OpenAI compatibility page documents unsupported fields and behavior differences.

- websearch: https://console.groq.com/docs/openai (accessed 2026-05-09T06:22:07Z)

Implication:

Adapter layer should maintain provider capability metadata (supported params, coercions) to avoid false parity assumptions.

### F8 — Security model for signed governance calls should preserve proof-of-possession discipline

DPoP standard guidance reinforces anti-replay and nonce usage to constrain token misuse.

- websearch: https://datatracker.ietf.org/doc/html/rfc9449 (accessed 2026-05-09T06:22:07Z)

Implication:

HAMR signed control-plane calls should keep nonce/replay hardening patterns consistent with existing DPoP-aligned posture.

## Conflict / opportunity matrix

| ID | Type | Description | Evidence | Direction |
|---|---|---|---|---|
| C-1 | Conflict | SHOULD policy but optional runtime disable | repo: instructions/hamr-routing.instructions.md#L31-L38 | move to enforceable gates |
| C-2 | Conflict | Audit lacks utilization metric | repo: scripts/global/governance-audit.js#L13-L13 | add `hamr_utilization_rate_7d` check |
| C-3 | Conflict | Sync verify checks deploy parity, not usage parity | repo: scripts/global/hamr-sync-verify.js#L30-L45 | add call-site bypass scan |
| C-4 | Conflict | Cache semantics vary widely by provider | websearch inventory above | canonical + provider-specific fields |
| O-1 | Opportunity | Dual freshness paths already implemented | repo: cloudflare/hamr/scheduled.ts#L10-L23 | add SLO alarms only |
| O-2 | Opportunity | Wrapper and quota tests exist | repo: tests/hamr-team-integration.spec.js#L21-L27 | expand with bypass fixtures |
| O-3 | Opportunity | Existing cron cadence aligns with periodic telemetry windows | repo: scripts/global/install-cron.sh#L22-L24 | tie cadence to freshness budget |

## Opinionated design proposal (cp)

### Proposal title

Universal HAMR Coverage v2.1 — enforceable, measurable, provider-normalized.

### Core design points

1. Keep `wrapProviderCall()` as single instrumentation boundary for governed calls.
2. Add explicit adapter coverage for `azure-openai` and `google-ai-studio` names.
3. Introduce static bypass lint for known direct endpoints/patterns, advisory first.
4. Add governance-audit utilization floor and bypass-rule compliance checks.
5. Preserve dual telemetry freshness producers; add stale-age threshold alarming.
6. Normalize cache telemetry into canonical fields while preserving provider-native payload.
7. Distinguish diagnostic traffic with explicit `tier: diagnostic` tagging and reporting.
8. Gate promotion from advisory to required only after migration inventory reaches 100% planned sites.

### Why this shape

- Highest governance leverage with lowest architectural churn.
- Avoids replacing working primitives (wrapper, KV routes, cron) and instead closes enforcement gaps.
- Supports Epic #1130 ACs directly with measurable metrics.

## Rollout sketch (<=10 child tickets, each <=0.5d)

1. Define canonical telemetry schema extension (`raw_usage`, cache write/read split) — 0.5d.
2. Add `azure-openai` adapter mapper — 0.5d.
3. Add `google-ai-studio` adapter mapper — 0.5d.
4. Add static bypass detector script and CI advisory hook — 0.5d.
5. Add governance-audit check: `hamr_utilization_rate_7d` threshold and violation payload — 0.5d.
6. Add governance-audit check: bypass detector pass/fail ingestion — 0.5d.
7. Add dashboard HAMR panel with stale-age and utilization — 0.5d.
8. Migrate top-volume direct callsites (first pass) — 0.5d.
9. Migrate remaining known callsites and enable required lint gate — 0.5d.
10. Docs update for universality requirement and diagnostic carve-out usage — 0.5d.

## Risks and mitigations

- Risk: false positives from static bypass detection.
  - Mitigation: explicit suppressions only for documented diagnostic paths and short expiry comments.
- Risk: utilization metric drift due to uncounted denominator events.
  - Mitigation: define denominator from routing telemetry + wrapper telemetry reconciliation check.
- Risk: provider schema churn.
  - Mitigation: preserve `raw_usage` and add adapter contract tests per provider.
- Risk: stale telemetry during operator downtime.
  - Mitigation: keep worker scheduled staleness updates and show stale age prominently in dashboard.

## Validation plan

- Unit tests:
  - Adapter mapping snapshots for all supported providers.
  - Wrapper instrumentation contract tests for disabled/enabled modes.
- Integration tests:
  - Existing quota schema + wrapper tests remain green.
  - Add bypass detector fixture set (pass/fail samples).
- Governance tests:
  - Audit emits failure when utilization below configured floor.
  - Audit emits failure when bypass detector finds unsuppressed direct callsites.

## Actionable next steps

1. Create child tickets per rollout sketch, preserving <=0.5d scope.
2. Land schema extension and adapter additions first (foundation).
3. Run advisory lint for one full cycle and collect violations.
4. Migrate callsites in ranked order by observed volume.
5. Enable required gate and audit threshold after migration completion.
6. Update operator docs and runbook with diagnostic tagging policy.

## Last-updated

2026-05-09T06:22:07Z

## Sign-off

Signed-by: Nova Harper
Team&Model: copilot:gpt-5.3-codex@github-copilot
Role: collaborator
