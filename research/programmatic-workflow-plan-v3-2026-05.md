# Deliverable 4 — Phase-1 Implementation Plan (v3)

Phase-0 ticket: #2038. Parent Epic: #2037.
Iterates Plan v2 with iteration-2 red-team accepted findings (`redteam-classification-2038-iter2-2026-05.md`).

## Delta vs Plan v2 (only changes shown)

### C5 — G2 integration-points (concrete)

How anomaly detection + adversarial fuzz integrate into the pipeline:

- **Anomaly detection runs in CI** as `tests/baton-replay-eval.spec.js` post-step. After replay-eval reverse-engineers structured input from 50+ historical comments + renders them via builder, the spec computes per-field statistics (length, type distribution, enum coverage). Any new render whose input distribution falls >2σ from corpus median emits an event to `~/.megingjord/incidents.jsonl` with `pattern_id: baton-input-anomaly`. The event itself does NOT fail CI (advisory) but feeds `goal-coverage` dashboard (per `instructions/observability.instructions.md`).
- **Adversarial fuzz runs as a CI gate** via `tests/baton-fuzz-corpus.spec.js` (test_strategy: stress-test). The spec loads `tests/fixtures/baton-fuzz-corpus.json` (100+ malformed inputs) and asserts builder rejects every one at the schema-validation boundary. **CI gate fails** if any fuzz input reaches template render. This is a blocking gate, not advisory.
- **G2 quality assurance**: anomaly detection finds emergent governance-clarity gaps (Counter-arg 7); adversarial fuzz finds defensive holes BEFORE production. Both have explicit owners (Manager files anneal ticket for ≥2σ patterns; Admin gates merges on fuzz-corpus pass).

### C6 — G6 "persistent failure" defined

- **Persistent LLM-bridge failure** = ALL of:
  - 3 consecutive `response_format: json_schema` requests within a single build attempt fail schema validation, OR
  - 3 consecutive provider-API calls fail with non-recoverable error (rate limit, auth, model-not-available)
  - Builder has exhausted Fleet → Haiku tiers in that order
- **Graceful degradation chain** (explicit):
  ```
  attempt 1: Fleet (Ollama qwen2.5-coder:32b @ Tailscale)
  attempt 2: Fleet retry
  attempt 3: Fleet retry
  → if all 3 fail, escalate to Haiku
  attempt 4: Haiku (claude-haiku-4-5)
  attempt 5: Haiku retry
  → if both fail, check operator-review-mode availability
  attempt 6: operator-review-mode (if TTY available + non-CI)
  → if operator-review-mode unavailable:
  attempt 7: Premium (claude-opus-4-7 or sonnet-4-6) — last resort
  → if Premium fails: emit incidents.jsonl event + halt with operator-actionable error
  ```
- Each step emits a `baton-builds.jsonl` entry with `tier`, `attempt_n`, `outcome` for forensic audit.
- **G6 resilience**: every failure mode has a named handler; no silent drops; no infinite retry; explicit operator-escalation surface.

### C9 — G8 visibility / auditability / attribution (concrete)

- **Visibility**: dashboard panel `Baton Builder Activity` subscribes to `baton-builds.jsonl` via SSE (per `subscribePanelSSE` in `dashboard/js/panel-anim.js`). Operator sees live builds with status, tier, latency.
- **Auditability**: every entry carries `input_sha256` + `output_sha256` + `schema_sha256` + `template_sha256`. Re-rendering the same input must produce same `output_sha256` (deterministic check). Builds that don't match are auto-flagged.
- **Attribution**: every entry carries `signer` (alias derived via `agent-signature.js` from `team_model` + `role`) plus a `requires_operator: true` flag when operator-review-mode was invoked. Operator interventions are first-class observable events, not hidden.
- All three properties enforced by C9 AC: dashboard panel renders; sha-determinism stress-tested; operator-review-mode invocations carry the flag.

### G10 — per-child line-count budget

| Child | Budget | Enforcement |
|---|---|---|
| C1 | 8 schema files × ~100 lines each = 800 LOC (JSON, structured) | `lint-readability --max-warnings=460` |
| C2 | 8 templates × ~30 lines each = 240 LOC (Mustache, logic-less) | `lint` (line-length only) |
| C3 | Builder extension <200 LOC net (existing `baton-comment-build.js` is ~180 LOC) | `lint-readability` |
| C4 | Parity test ~80 LOC | `lint-readability` |
| C5 | Replay-eval ~100 LOC + fuzz spec ~80 LOC | `lint-readability` |
| C6 | LLM-bridge ~150 LOC (provider-switch logic + operator-review-mode) | `lint-readability` |
| C7 | Pure docs — no code; updates to existing instructions only | `wiki-lint` |
| C8 | Migration tooling ~100 LOC + rollback handler ~60 LOC | `lint-readability` |
| C9 | Enforcement validator ~60 LOC + dashboard panel ~80 LOC | `lint-readability` |
| C10 | Integrity gate ~80 LOC + checksum-refresh script ~40 LOC | `lint-readability` |

All children stay under the 100-line-per-file cap by composing small modules where needed. Total Phase-1 LOC: ~2000 (well under typical Epic budget).

### C10 — expanded scope (new attack surfaces)

- **Markdown-XSS defense** (iter-2 Attack 1): every string template fill goes through `htmlEscape()` before render. Schema regex patterns reject `<script` / `javascript:` / `on(error|load|click|focus|mouseover)=` / `<iframe` in any string field. Stress test injects 50+ XSS-attempt strings into structured inputs; all must be either escaped or rejected.
- **Config-file-manipulation defense** (iter-2 Attack 2): SHA-256 fixture-integrity gate extended beyond schemas/templates to:
  - `inventory/team-model-signatures.json`
  - `scripts/global/model-routing-policy.json`
  - `scripts/global/routing-provider-adapters.json`
- Same fail-closed semantics. Same `npm run baton:checksum-refresh` regeneration path with CODEOWNERS review.
- Stress test mutates each config file in turn; builder must reject and emit `incidents.jsonl` event.

## v3 self-evaluation against G1-G10

| Goal | v1 | v2 | v3 | Rationale for v3 delta |
|---|---|---|---|---|
| G1 Governance | 9 | 9 | **10** | C10 expansion covers signer-config + routing-policy integrity; signer-alias canonicalization preserved end-to-end |
| G2 Quality | 9 | 10 | **10** | C5 integration-points concrete; anomaly detection feeds dashboard + fuzz is blocking gate |
| G3 Zero Cost | 8 | 9 | **9** | Premium-fallback already explicit; degradation chain detailed in v3 doesn't change cost mandate |
| G4 Privacy | 9 | 9 | **10** | C10 expansion blocks config tampering + XSS attempts that could exfiltrate via embedded `<img>` tracking pixels |
| G5 Portability | 9 | 9 | **9** | Localization correctly rejected; cross-runtime parity bytes-identical (C4) |
| G6 Resilience | 8 | 10 | **10** | Persistent-failure threshold defined + degradation chain explicit |
| G7 Throughput | 8 | 9 | **9** | Latency budget documented (no v3 change needed) |
| G8 Observability | 9 | 9 | **10** | Dashboard SSE + sha-determinism + operator-attribution flag — all three properties enforceable |
| G9 Interoperability | 9 | 9 | **9** | C4 + C6 already strong (no v3 change needed) |
| G10 Maintainability | 9 | 9 | **10** | Per-child line-count budget enumerated; total ~2000 LOC well within G10 envelope |

**Plan v3 mean: 9.6 / 10. Comfortably above A+ threshold.**

Goals at 10: G1, G2, G4, G6, G8, G10. Goals at 9: G3, G5, G7, G9.

## Iteration-3 question for red-team

Specific YES/NO check (not "consider X"):
1. Are the G2, G6, G8, G10 integration-points adequately specified in v3?
2. Do the C10 expansions (XSS-defense + config-file-integrity) close the two attack surfaces from iter-2?
3. Are the per-child line-count budgets credible against the AC scope?
4. Does v3 honestly score 9.6 mean?
5. AGREED-A+ or NOT-YET-A+ ?

## References

- Plan v2: `programmatic-workflow-plan-v2-2026-05.md`
- Iter-2 classification: `redteam-classification-2038-iter2-2026-05.md`
- Iter-1 classification: `redteam-classification-2038-iter1-2026-05.md`
- Counter-arg: `programmatic-vs-llm-counter-argument-2026-05.md`
- Cutting-edge research: `programmatic-governance-research-2026-05.md`
- Inventory: `agile-checklist-inventory-2026-05.md`
- Pattern design: `programmatic-baton-pattern-design-2026-05.md`
