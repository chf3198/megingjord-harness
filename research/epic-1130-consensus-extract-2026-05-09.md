# Epic #1130 — Universal HAMR Coverage Consensus Extract

**Date**: 2026-05-09
**Source**: 6 artifacts produced by partial v2 cross-team R&D synthesis (#1148, closed)
**Author**: Orla Reyes (admin role; CC owned the synthesis-1148 baton)
**Reason for extract**: operator priority pivot to cost-reduction; cross-team protocol perfection deferred to v2.1; ship #1130 children directly.

## Source artifacts

```
   planning/synthesis-1148/artifacts/cc-rd.md      194 lines  Phase-R
   planning/synthesis-1148/artifacts/cp-rd.md      315 lines  Phase-R
   planning/synthesis-1148/artifacts/cx-rd.md      349 lines  Phase-R
   planning/synthesis-1148/debate/cc-wave-1.md     136 lines  Wave-1
   planning/synthesis-1148/debate/cp-wave-1.md     posted by Copilot Chat
   planning/synthesis-1148/debate/cx-wave-1.md     176 lines  Wave-1
```

## Extracted decisions (3-team consensus or 2-team-with-concession)

### D-1148-001 Build fleet adapter shim (closes 0% utilization gap)

**Cost-impact**: HIGHEST. Today every fleet inference call bypasses HAMR; cost telemetry is invisible. Closing this gap unlocks G3 (Zero Cost) sensor visibility AND lets cascade-dispatch route more work to free fleet lanes.

**Consensus**: 3-team agree.

- CC Q1 — `fleetCall({tier, model, prompt, opts})` shape; HAMR resolves host
- CP F5 + proposal — wrapper enforcement at call sites; static bypass detector
- CX three-layer model — adapter contract is layer 2

**Implementation**: `scripts/global/fleet-via-hamr.js` (~80 lines). Wraps Ollama HTTP in `wrapProviderCall('fleet', ...)` with proper tier tags + cacheHeaders + telemetry emission + spillover.

**Effort**: 0.5d.

### D-1148-002 Wrap LiteLLM gateway (don't replace)

**Cost-impact**: HIGH. LiteLLM already routes to 13+ models in repo config; wrapping it gives free cost telemetry on existing routes without per-route work.

**Consensus**: 3-team agree.

**Implementation**: extend `scripts/global/litellm-client.js` to call through `wrapProviderCall('litellm', ...)`. Existing LiteLLM retry/budget preserved.

**Effort**: 0.3d.

### D-1148-003 Bypass-detect lint (advisory → required progression)

**Cost-impact**: HIGH. Prevents new bypass sites from being added; locks in cost visibility going forward.

**Consensus**: 3-team agree.

**Implementation**: `scripts/global/lint-hamr-bypass.js` detecting:
- `fetch.*:11434` (Ollama HTTP)
- `new OpenAI(`, `new Anthropic(` (raw SDKs)
- `axios.(get|post)` to provider hosts
- `requests.(get|post)` (Python)
- `curl http` in `.sh` files calling provider endpoints

Allow `// hamr-bypass-ok: diagnostic` annotation for explicit carve-out (per D-1148-004).

**Workflow**: `.github/workflows/hamr-bypass-lint.yml` advisory-first. After 2 weeks stable, promote to required.

**Effort**: 0.4d.

### D-1148-004 Diagnostic carve-out: wrap-and-tag (NOT exempt)

**Cost-impact**: MEDIUM. Without this, IT diagnostic curls would either fail the lint or pollute production telemetry.

**Consensus**: 3-team agree (CC initially proposed exempt-via-annotation; CC conceded to wrap-and-tag in Wave-1).

**Implementation**: extend `wrapProviderCall` to accept `tier: 'diagnostic'` tag. Production utilization metric excludes diagnostic-tier calls from numerator AND denominator. Annotation `// hamr-bypass-ok: diagnostic` reserved ONLY for genuinely-uncoverable cases (rare).

**Effort**: 0.2d.

### D-1148-005 /quota always-fresh (push cron + Worker scheduled + push-failure visibility + 12h SLO)

**Cost-impact**: MEDIUM. Stale telemetry hides cost lever performance.

**Consensus**: 3-team agree.

**Implementation**: keep existing dual-source. Add to `cloudflare/hamr/routes/quota.ts`: `last_update_ms`, `freshness_slo_ms` fields. Worker scheduled handler at `cloudflare/hamr/scheduled.ts` continues marking stale; ALSO emit visible `push_failure_count_24h` field. SLO alarm if stale_age > 12h.

**Effort**: 0.3d.

### D-1148-006 Goal Health Score sensor: `wrapped/(wrapped+detected_unwrapped)`

**Cost-impact**: MEDIUM. THE measurable metric for HAMR coverage success.

**Consensus**: 3-team agree (CC initially proposed `wrapped/total`; CC conceded to CX formula in Wave-1).

**Implementation**: extend `scripts/global/governance-audit.js` to compute `production_hamr_utilization_rate_7d` from cache-stats.jsonl + bypass-lint scan results. Emit to `/tmp/governance-audit.json`. Threshold: <80% → governance violation; <50% → operator escalation.

**Effort**: 0.4d.

### D-1148-007 Provider-harmonized cache economics (CP F4)

**Cost-impact**: HIGH. Same input prompt produces materially different cache cost reports across OpenAI vs Anthropic vs Gemini. Without normalization, cost projections are wrong by 30-50%.

**Consensus**: 2-team explicit (CP F4 surfaced; CC conceded in Wave-1; CX implicitly aligned via three-layer adapter contract).

**Implementation**: extend `scripts/global/token-provider-adapters.js` to normalize cache fields:
- canonical: `cache_read_input_tokens`, `cache_creation_input_tokens`, `cache_storage_tokens`
- preserve provider-native via `raw_usage` debug-tier (NOT consumer-load-bearing per CC challenge)
- per-provider normalization rules documented

**Effort**: 0.5d.

### D-1148-008 Dashboard HAMR panel

**Cost-impact**: LOW (visibility, not direct cost reduction). Defer if budget tight.

**Consensus**: 3-team agree.

**Implementation**: `dashboard/js/hamr-panel.js` (4 widgets — coverage gauge, per-provider rate, /quota staleness counter, spillover heatmap). Reuse existing dashboard `events.jsonl` consumer.

**Effort**: 0.4d.

### D-1148-009 Wrapper result contract `{ok, value, sticky, spillover, meta}` standardization (CX proposal)

**Cost-impact**: LOW (cleanliness, not cost). Defer if budget tight.

**Consensus**: CX-only formal proposal; CC agreed in Wave-1.

**Implementation**: refactor `wrapProviderCall` return shape; migrate ~5 callers. Backward-compat wrapper-result alias for transition period.

**Effort**: 0.3d.

### Decisions explicitly DEFERRED

- **Azure-OpenAI + Google-AI-Studio adapters** (CP F2): no current harness consumption; CC challenged as speculative; revisit when explicit consumption proven.
- **DPoP / RFC 9449 anti-replay on /mcp** (CP F8): security hardening, not cost; defer to a security-focused Epic.
- **CX three-layer "control plane" framing**: adopt as architectural skeleton (the children below are organized by it), but do NOT build a separate "activation contract" layer — CC challenge accepted, collapse into existing `hamr-sync-verify` + `hamr_activation_check.py`.

## Cost-priority sequencing (operator directive: ship cost reductions FAST)

```
   PHASE 1 — Maximum cost impact (~1.2d total)
   ─────────────────────────────────────────────
   Child A   D-1148-001 fleet adapter shim         0.5d
   Child B   D-1148-003 bypass-detect lint advisory 0.4d
   Child C   D-1148-002 wrap LiteLLM               0.3d

   PHASE 2 — Cost-visibility instrumentation (~1.2d)
   ──────────────────────────────────────────────────
   Child D   D-1148-007 cache-economics normalization 0.5d
   Child E   D-1148-006 GHS sensor wired in audit   0.4d
   Child F   D-1148-005 /quota always-fresh fields  0.3d

   PHASE 3 — Migration + diagnostic (~0.7d)
   ─────────────────────────────────────────
   Child G   D-1148-004 diagnostic carve-out         0.2d
   Child H   migrate top-5 production bypass sites  0.5d

   PHASE 4 — Lint promotion + remaining (~0.4d)
   ────────────────────────────────────────────
   Child I   bypass-lint promote to required        0.1d
   Child J   migrate remaining bypass sites         0.3d

   DEFERRABLE (low cost-impact)
   ─────────────────────────────
   D-1148-008 dashboard panel                       0.4d
   D-1148-009 wrapper-result contract refactor      0.3d

   Total Phase 1-4 only:    ~3.5d
   Total with deferrables:  ~4.2d
```

Phase 1 alone (~1.2d) closes the 0% utilization gap and starts emitting cost telemetry. Operator gets immediate visibility into where cost is going. Phase 2-4 builds on that foundation.

## Sources

- All 6 artifacts referenced above (3 R&D + 3 Wave-1 in `planning/synthesis-1148/`)
- Cross-team finding map: `planning/synthesis-1148/artifacts/INDEX.md` (if present; rebuilt during Phase-D)
- v2 protocol design: `research/cross-team-rd-protocol-v2-2026-05-09.md` (#1146 R&D output)
- HAMR contract: `instructions/hamr-routing.instructions.md`
- Provider wrapper: `scripts/global/hamr-provider-wrapper.js`

---

Signed-by: Orla Reyes
Team&Model: claude-code:opus-4-7@anthropic
Role: admin
last_activity_utc: 2026-05-09T07:00:00Z
