# Deliverable 4 — Phase-1 Implementation Plan (v2)

Phase-0 ticket: #2038. Parent Epic: #2037.
Iterates Plan v1 with v1 self-identified improvements + iteration-1 red-team accepted findings (`redteam-classification-2038-iter1-2026-05.md`).

## Architecture (unchanged from v1, adversarial-defense surfaces added)

```
                 Operator + LLM produces JSON input
                              │
                              ▼
       JSON Schema validation (Draft 2020-12) ◀── schema fixture-integrity (SHA-256)
                              │
                              ▼
              Mustache template render             ◀── template fixture-integrity (SHA-256)
                              │
                              ▼
              Markdown artifact (bytes-identical)
                              │
                              ▼
              Megalint validators (near-100% pass)
                              │
                              ▼
              Emit baton-builds.jsonl (G8 audit)
```

New defense layers (RT7 + RT8 + RT9 accepted):
- SHA-256 fixture-integrity gate on schemas + templates before render
- Adversarial input fuzz corpus in C5 replay-eval
- Per-render audit trail in `~/.megingjord/baton-builds.jsonl`

## Phase-1 child slate (10 children, +C10 vs v1)

| Child | Title | Lane | test_strategy | Target | Deps |
|---|---|---|---|---|---|
| C1 | JSON Schemas for 8 baton-artifact types | docs-research | drift-lint | G1 G8 | — |
| C2 | Mustache templates for 8 artifact types | code-change | tdd-pyramid | G1 G2 | C1 |
| C3 | Builder extension + schema validation | code-change | tdd-pyramid + stress-test | G2 G8 | C1 C2 |
| C4 | Bytes-identical cross-runtime parity test | code-change | tdd-pyramid + stress-test | G5 G9 | C3 |
| C5 | Replay-eval + **anomaly detection** + **adversarial fuzz** | code-change | tdd-pyramid + replay-eval + stress-test | G2 G6 G8 | C3 |
| C6 | LLM-context-to-JSON bridge + **Premium-fallback** + **operator-review-mode** | code-change | tdd-pyramid + eval-harness | G3 G6 G9 | C1 |
| C7 | Instructions co-canonical + **per-call latency budget docs** | docs-research | drift-lint | G1 G7 | C1 |
| C8 | Schema-version + migration + **rollback strategy** | code-change | tdd-pyramid + replay-eval | G6 G10 | C2 C3 |
| C9 | Enforcement label + **`baton-builds.jsonl` compliance log** | code-change | tdd-pyramid | G1 G8 | C3 C5 |
| **C10** | **Schema + template fixture-integrity gate (SHA-256)** | code-change | tdd-pyramid + stress-test | G1 G4 | C1 C2 |

## Dependency graph

```
C1 → C2 → C3 → C4
        ↘   ↘
         C5 → C9
         C8
C1 → C6
C1 → C7
C1 + C2 → C10
```

C10 is parallel-eligible with C3-C9 once C1 + C2 land.

## Per-child v2 deltas (only changes vs v1 shown — full v1 spec carries forward)

### C5 expansion — anomaly detection + adversarial fuzz

- Anomaly detection: replay-eval pipeline flags historical baton comments whose reverse-engineered structured input falls >2σ from corpus distribution (per artifact type). Flagged outliers become candidates for instruction clarification (per Counter-arg 7 — schema is the test of governance clarity).
- Adversarial fuzz corpus: `tests/fixtures/baton-fuzz-corpus.json` with 100+ malformed inputs (truncated UTF-8, type-confused fields, nested arrays where strings expected, oversized strings, schema-injection payloads). Builder must reject all 100 at the schema-validation boundary, never reaching template render.
- AC: ≥95% calibration on historical corpus + 100% adversarial-fuzz rejection + anomaly-detection emits `~/.megingjord/incidents.jsonl` events for ≥2σ outliers.

### C6 expansion — Premium-fallback + operator-review-mode

- **Premium-fallback condition**: explicit decision tree:
  1. Try Fleet (Ollama qwen2.5-coder:32b or equivalent) — 3 retries
  2. If 3 retries fail OR Fleet unreachable → try Haiku — 2 retries
  3. If Haiku fails → check `operator-review-mode` availability
  4. If operator-review-mode available → invoke it (NOT Premium)
  5. ONLY if all above fail → Premium (Sonnet/Opus) — 1 attempt
  6. If Premium fails → emit incident + halt with operator-actionable error
- **Operator-review-mode**: when LLM bridge fails schema validation persistently (3+ attempts), print to stderr:
  - The structured input that was attempted
  - The schema validation errors
  - The relevant schema for hand-fill reference
  - Operator hand-fills via `--input <path>` then re-invokes builder
- AC: cross-provider parity ≥95% schema-valid on Free/Fleet/Haiku tiers; Premium share <5% of all builds (matches G3 mandate); operator-review-mode invoked ≤2% of builds.

### C7 expansion — per-call latency budget documentation

- Documented latency budget (in `instructions/role-baton-routing.instructions.md`):
  - Template render (deterministic): <5ms p99
  - Schema validation: <10ms p99
  - LLM bridge (single attempt, Free/Fleet): <30s p99
  - LLM bridge (full 6-step Premium-fallback worst case): <120s p99
  - Full pipeline (LLM → schema → template → emit): <35s p99 happy-path, <125s worst-case
- AC: latency probe in C4 parity test emits per-stage timing; CI gate fails if p99 exceeds 2× documented budget.

### C8 expansion — rollback strategy

- Each schema-version bump carries a `migration_id` + reverse-migration script.
- Replay-eval-gated promotion (unchanged from v1).
- **NEW**: If new-schema-version replay-eval drops below 90% parity with old schema on the calibration corpus AT ANY POINT post-promotion, automatic revert:
  - Restore previous schema version as default
  - Emit `incidents.jsonl` event with `pattern_id: schema-regression`
  - File auto-Tier-2 anneal ticket (per `feedback_anneal_emission_during_implementation`)
- AC: rollback exercised in stress test — inject corrupt schema, verify revert + incident emission.

### C9 expansion — `baton-builds.jsonl` compliance log

- Every builder invocation appends to `~/.megingjord/baton-builds.jsonl`:
  - `ts`, `version`, `service: baton-builder`, `env`, `event: render`
  - `schema_version`, `template_version`, `artifact_type`
  - `input_sha256`, `output_sha256`, `template_sha256`, `schema_sha256`
  - `render_duration_ms`, `validation_duration_ms`
  - `team_model`, `role` (from input)
- Uses `scripts/global/event-schema-v3.js` per `instructions/observability.instructions.md`.
- Redaction applied via `scripts/global/log-redaction.js`.
- AC: every Phase-1 ticket produces ≥1 entry; entries are queryable + visible in dashboard.

### C10 (new) — schema + template fixture-integrity gate

- Each schema file under `inventory/baton-schemas/` carries a sibling `<name>.sha256` checksum.
- Each template file under `inventory/baton-templates/` carries a sibling `<name>.sha256` checksum.
- Builder verifies SHA-256 of loaded schema + template BEFORE render. Mismatch → fail-closed (emit incident, exit non-zero).
- Checksums are regenerated only via `npm run baton:checksum-refresh`, which itself requires `area:governance` review (CODEOWNERS).
- Defends against RT7 (schema injection) + RT8 (template manipulation).
- Pattern: same as #2027 fixture-integrity for OWASP fixtures.
- AC: stress test injects 10 mutated schemas + 10 mutated templates; builder rejects all 20 at integrity-gate; CI test passes.

## v2 self-evaluation against G1-G10

| Goal | v1 score | v2 score | Rationale for delta |
|---|---|---|---|
| G1 Governance | 9 | **9** | Schemas + templates as canonical artifacts; C10 adds integrity gate |
| G2 Quality | 9 | **10** | C5 anomaly detection + adversarial fuzz + ≥95% calibration |
| G3 Zero Cost | 8 | **9** | C6 explicit Premium-fallback condition (Premium only after Fleet → Haiku → operator-review fail) |
| G4 Privacy | 9 | **9** | C10 integrity gate strengthens defense surface; no new privacy concerns |
| G5 Portability | 9 | **9** | Cross-runtime parity already validated; localization correctly rejected as out-of-scope |
| G6 Resilience | 8 | **10** | C6 operator-review-mode + C5 adversarial fuzz + C8 rollback strategy + auto incident emission |
| G7 Throughput | 8 | **9** | C7 explicit latency budget; CI gate enforces 2× ceiling |
| G8 Observability | 9 | **9** | C9 baton-builds.jsonl + C5 anomaly emission; already at 9 |
| G9 Interoperability | 9 | **9** | C4 + C6 already strong; no change |
| G10 Maintainability | 9 | **9** | 10 children with ≤100-line cap; C8 schema-evolution + rollback |

**Plan v2 mean: 9.2 / 10. Above A+ threshold (9.0+).**

## Open question forwarded to red-team iteration 2

Does qwen2.5-coder:32b agree that:
1. The 3 rejected findings (hallucinated arxiv URLs, localization tangent, cross-LLM consistency duplicate) are correctly rejected with rationale?
2. The 6 accepted improvements are correctly mapped to children?
3. C10 (new) adequately defends RT7 + RT8?
4. The 9.2 mean honestly reflects the goal-coverage delta?

## References

- Plan v1: `programmatic-workflow-plan-2026-05.md`
- Iter-1 red-team classification: `redteam-classification-2038-iter1-2026-05.md`
- Counter-arg: `programmatic-vs-llm-counter-argument-2026-05.md`
- Cutting-edge research: `programmatic-governance-research-2026-05.md`
- Inventory: `agile-checklist-inventory-2026-05.md`
- Pattern design: `programmatic-baton-pattern-design-2026-05.md`
- Sibling Epic #2029 (HAMR governance injection)
- Sibling Epic #2041 (red-team integration into Agile) — meta-finding on hallucinated citations forwarded
