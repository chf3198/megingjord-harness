# Deliverable 4 — Phase-1 Implementation Plan (v1)

Phase-0 ticket: #2038. Parent Epic: #2037.

> Plan v1 — to be iterated v2 (and possibly v3) via cross-family red-team before A+ acceptance. Per operator directive, NO development tickets are filed until A+ self-evaluation passes.

## Architecture (incorporates Deliverable 3 design + Deliverable 5 counter-arguments)

```
                     Operator + LLM produces JSON input
                                  │
                                  ▼
                  JSON Schema validation (Draft 2020-12)
                                  │
                                  ▼
                  Mustache template render (deterministic)
                                  │
                                  ▼
                  Markdown artifact (bytes-identical across runtimes)
                                  │
                                  ▼
                  Posted as baton comment via existing gh CLI
                                  │
                                  ▼
                  Megalint validators pass at near-100% rate
```

LLM-filled slots inside the structured input: `rationale` per AC, `synthesis_narrative` at Epic close, `decision_rationale` for anneal decisions, `scope` (short prose), `gates[]` (LLM enumerates from context).

## Phase-1 child slate (9 children)

| Child | Title | Lane | test_strategy | Target | Deps |
|---|---|---|---|---|---|
| C1 | JSON Schemas for 8 baton-artifact types (`inventory/baton-schemas/`) | docs-research | drift-lint | G1 G8 | — |
| C2 | Mustache templates for 8 artifact types (`inventory/baton-templates/`) | code-change | tdd-pyramid | G1 G2 | C1 |
| C3 | Extend `baton-comment-build.js` for template rendering + schema validation | code-change | tdd-pyramid | G2 G8 | C1 C2 |
| C4 | Bytes-identical cross-runtime parity test (`tests/baton-bytes-identical.spec.js`) | code-change | tdd-pyramid + stress-test | G5 G9 | C3 |
| C5 | Replay-eval against historical baton corpus (50+ real comments from `gh issue view`) | code-change | tdd-pyramid + replay-eval | G2 G8 | C3 |
| C6 | LLM-context-to-JSON bridge using Anthropic structured outputs / equivalent for OpenAI / Ollama | code-change | tdd-pyramid | G3 G9 | C1 |
| C7 | Update instructions co-canonical with schemas; each schema-defining doc points at schema | docs-research | drift-lint | G1 | C1 |
| C8 | Schema-version + migration tooling (replay-eval-gated promotion) | code-change | tdd-pyramid + replay-eval | G6 G10 | C2 C3 |
| C9 | Megalint `programmatic-baton-required` label enforcement (advisory → required via replay-eval) | code-change | tdd-pyramid | G1 | C3 C5 |

## Dependency graph

```
C1 → C2 → C3 → C4
        ↘  ↘
         C5 → C9
         C8
C1 → C6
C1 → C7
```

C1 (schemas) is foundational; C2 (templates) depends on schemas; C3 (builder) on both; C4 (parity test) on builder; C5 (replay-eval) on builder; C6 (LLM bridge) parallel; C7 (instructions) parallel; C8 (migration) on templates + builder; C9 (enforcement) on builder + replay-eval.

## Per-child detail

### C1 — JSON Schemas (foundational)

- Author 8 schemas under `inventory/baton-schemas/`:
  - `manager-handoff.schema.json`
  - `collaborator-handoff.schema.json`
  - `admin-handoff.schema.json`
  - `consultant-closeout.schema.json`
  - `consultant-epic-closeout.schema.json`
  - `blocker-note.schema.json`
  - `epic-rescope.schema.json`
  - `epic-amendment.schema.json`
- Each schema is Draft 2020-12 with `$id`, `version`, `required`, full property typing.
- Cross-runtime validator: `node scripts/global/baton-schema-validate.js --schema manager-handoff --input data.json`
- AC: every existing baton artifact in the last 30 days of issue comments validates against its schema (replay-eval).
- Estimated test count: ≥3 per schema (valid input passes, invalid input fails, edge-case input handled).

### C2 — Mustache templates

- 8 `.mustache` files under `inventory/baton-templates/` matching schemas.
- Template engine: `mustache` npm package (~30 lines if vendored).
- AC: rendering an empty schema-valid input produces a structurally-correct comment; rendering a populated input produces a comment that passes ALL megalint validators.

### C3 — Builder extension

- Extend `scripts/global/baton-comment-build.js`:
  - Accept `--input <json-file>` for full structured input
  - Validate against schema before render
  - Render via Mustache
  - Emit to stdout (default) or `--out <file>`
- AC: invoking with 8 sample inputs (one per artifact type) produces 8 valid Markdown comments.

### C4 — Bytes-identical parity

- `tests/baton-bytes-identical.spec.js`: spawns the builder 3 times in different runtime environments; SHA-256 the output; asserts all 3 hashes match.
- Stress mode: 100 iterations of random valid inputs; all 100 must produce identical SHA per-runtime.
- AC: identical input → identical bytes across CC / Copilot / Codex.

### C5 — Replay-eval against historical corpus

- `tests/baton-replay-eval.spec.js`: fetch 50+ recent baton comments via `gh api`; reverse-engineer their structured input; render via builder; assert output matches historical (within whitespace/timestamp variance).
- Calibration: ≥90% parity on the corpus before the builder is promoted from opt-in to required.

### C6 — LLM-context-to-JSON bridge

- `scripts/global/baton-build-from-context.js`:
  - Anthropic: use `response_format: { type: "json_schema", json_schema: ... }`
  - OpenAI / OpenAI-compatible: same pattern (structured outputs)
  - Ollama / Fleet: tool-use mode with JSON Schema validation
- Validates LLM output against schema; retries on validation failure (max 3 attempts); falls back to template-only-mode with operator review on persistent failure.
- AC: cross-provider tested (Anthropic + OpenAI + Ollama-via-fleet); each must produce schema-valid JSON ≥95% of the time.

### C7 — Instruction co-canonicalization

- Update `instructions/role-baton-routing.instructions.md` to point at `inventory/baton-schemas/` as canonical.
- Similarly for `instructions/team-model-signing.instructions.md`.
- AC: drift-lint detects when an instruction text disagrees with a schema; fails CI on mismatch.

### C8 — Schema-version + migration

- Each schema carries `version` field.
- Builder accepts `--schema-version` flag; defaults to latest.
- Migration tool: `node scripts/global/baton-schema-migrate.js --from v1 --to v2 --input old.json` produces forward-migrated JSON.
- Replay-eval-gated promotion: new schema version requires ≥90% parity on historical corpus.
- AC: dual-emission during transition (old + new) for a replay-eval-bounded soak; promotion when calibration corpus shows new ≥95% parity with old.

### C9 — Enforcement label

- `programmatic-baton-required` label opt-in on a ticket forces builder usage.
- Megalint validator detects manual artifact authoring on labeled tickets; fails closeout-schema.
- Calibration: when replay-eval shows new builder ≥95% across all artifact types, label becomes default (instructions amended).
- AC: at least one Phase-1 ticket carries the label and is processed via builder end-to-end.

## Self-evaluation v1 (against G1-G10)

Per the rubric-v3 evidence-box pattern. Each goal scored against the Phase-1 plan itself.

| Goal | Score | Rationale | Improvement needed for A+ |
|---|---|---|---|
| G1 Governance | 9 | Every child has lane + test_strategy + baton expectation; schemas are governance artifacts | — |
| G2 Quality | 9 | Every AC verifiable; deterministic templates + JSON schemas; replay-eval calibration | Strengthen C6 with multi-provider success rate target |
| G3 Zero Cost | 8 | LLM-context-to-JSON bridge runs on Free / Fleet tier; builder is local; schemas don't require LLM | Document Premium fallback condition |
| G4 Privacy | 9 | No credential surface; schemas don't carry secrets | — |
| G5 Portability | 9 | Mustache works in Node/Python; bytes-identical invariant tested | Add Windows runtime parity test |
| G6 Resilience | 8 | Builder validates input before render; C6 has retry + fallback | Add operator-review-mode for persistent C6 failures |
| G7 Throughput | 8 | Template render is sub-ms; no LLM round-trip after structured input | Document expected per-call latency |
| G8 Observability | 9 | Builder emits structured-output trace; replay-eval calibration provides trend | Add `~/.megingjord/baton-builds.jsonl` emit |
| G9 Interoperability | 9 | Same builder callable from all 3 runtimes; output bytes-identical | Add Codex CLI adapter test |
| G10 Maintainability | 9 | 9 children with ≤100-line cap; schemas + templates separate from logic | Add schema-evolution test |

**Plan v1 mean: 8.7 / 10. Below A+ (9.0+) threshold.** Iteration needed.

Goals at 8 (need improvement to clear 9+): G3, G6, G7.

## Improvements identified for Plan v2

1. **G3 8 → 9**: explicit Premium-fallback condition documented in C6 — Premium tier ONLY when 3 retries fail AND fallback-to-operator-review unavailable.
2. **G6 8 → 9**: operator-review-mode for persistent C6 LLM-bridge failures — print structured input + schema + validation errors; operator hand-fills.
3. **G7 8 → 9**: per-call latency budget documented (template render <5ms p99; LLM bridge <30s including retries; full pipeline <35s).

Plus the counter-argument adjustments from Deliverable 5:
4. Schema MUST include LLM-narrative slot fields explicitly named
5. Schema-version + migration is a first-class C8 (already in plan)
6. Optional `team_voice_marker` per C2 templates

## Plan v2 expected mean after improvements: 9.1 / 10. Above A+ threshold.

But — per operator directive — Plan v2 must be validated by cross-family fleet red-team before A+ acceptance. Submitting to qwen2.5-coder:32b next.

## References

- Deliverable 1 (inventory) — `research/agile-checklist-inventory-2026-05.md`
- Deliverable 2 (cutting-edge research) — `research/programmatic-governance-research-2026-05.md`
- Deliverable 3 (canonical pattern) — `research/programmatic-baton-pattern-design-2026-05.md`
- Deliverable 5 (counter-argument) — `research/programmatic-vs-llm-counter-argument-2026-05.md`
- Sibling Epic #2029 (HAMR governance injection) — solves the context-delivery problem this Epic depends on
- Sibling Epic #2041 (red-team integration into Agile) — this iteration validates that Epic's premise
- Existing baton-comment-build.js — the seed implementation to extend
