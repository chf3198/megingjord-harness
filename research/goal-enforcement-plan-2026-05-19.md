# Phase-1 Implementation Plan — Epic #1962
> Generated from R2 (#1964) Plan v2 (A+ threshold). Consumes R1 (#1963).
> Date: 2026-05-19

## Phase-1 Candidate Slate (9 children)

| Child | Title | Lane | test_strategy | Target goals | Deps |
|---|---|---|---|---|---|
| P1-C1 | G10 reference parity across always-loaded surfaces | docs-research | drift-lint | G1 G8 G10 | none |
| P1-C2 | Promote rubric v2→v3 with G10 evidence boxes | code-change | tdd-pyramid | G2 G10 | P1-C1 |
| P1-C3 | OWASP Agentic Top 10 mapping in instructions + control catalog | docs-research | drift-lint | G1 G4 | none |
| P1-C4 | OpenTelemetry GenAI semantic conventions full adoption | code-change | tdd-pyramid + stress-test | G8 G9 | none |
| P1-C5 | Cedar policy-as-code pilot for signer-alias-canonical | code-change | tdd-pyramid + replay-eval | G1 | P1-C2 |
| P1-C6 | Cyclomatic-complexity lint complement to 100-line cap | code-change | tdd-pyramid | G10 | none |
| P1-C7 | Goal-hijack-resistance adversarial test fixtures | code-change | tdd-pyramid + adversarial-fixture | G1 G2 | P1-C3 |
| P1-C8 | Programmatic enforcement audit gate (per-goal coverage) | code-change | tdd-pyramid | G1 G8 | P1-C1 P1-C3 |
| P1-C9 | PDCA cycle artifact emission per Epic closeout | code-change | tdd-pyramid | G1 G8 | none |

## Dependency Graph

```
P1-C1 → P1-C2 → P1-C5
P1-C1 → P1-C8
P1-C3 → P1-C7
P1-C3 → P1-C8
P1-C4 (standalone)
P1-C6 (standalone)
P1-C9 (standalone)
```

Critical-path bundles (multi-close batching eligible per baton-routing):
- **Bundle A**: C1 + C3 — both docs-research lane, shared docs-drift surface
- **Bundle B**: C8 + C9 — both code-change, both emit JSON artifacts

## v2 Improvements over v1

- **C2 Rubric v3**: p99 perf budget ≤500ms on 10kB closeout text on 2-vCPU runner
- **C4 OTel**: degraded-mode = log to local JSONL if collector down; ≤5ms p99 overhead
- **C5 Cedar**: G3 Fleet-lane for replay-eval; design phase 1 Premium invocation;
  degraded-mode = fallback to JS on Cedar parse error; ≤2ms p99 evaluation
- **C6 Complexity**: portable via `eslint-plugin-complexity` (in-project ESLint);
  baseline violations into `.eslintignore-complexity-soak.json` via replay-eval
- **C7 Fixtures**: G3 Fleet-lane via adversarial-fixture-gen.js (#1875);
  degraded-mode = manual triage (no Tier-2 storm); path `tests/fixtures/goal-hijack/`
- **C8 Audit gate**: degraded-mode = advisory comment if harness-goal-controls.md
  unparseable; ≤1s gate runtime
- **C9 PDCA**: emit to `~/.megingjord/pdca/<epic-N>-closeout.json`;
  degraded-mode = embed in CONSULTANT_CLOSEOUT body if disk write fails
- **All children**: explicit G4 box "no new credential surface" in each AC

## Per-Child G4/G5/G6/G7/G8 Details

| Child | G4 (privacy) | G5 (portability) | G6 (degraded-mode) | G7 (perf) | G8 (evidence) |
|---|---|---|---|---|---|
| C1 | N/A — docs only | N/A | N/A — docs only | N/A | drift-lint CI check |
| C2 | no credential surface | portable JSON schema | scorer returns error if rubric malformed | ≤500ms p99 | tests/rubric-score-g10.spec.js |
| C3 | N/A — docs only | N/A | N/A — docs only | N/A | drift-lint CI check |
| C4 | no credential surface | local JSONL fallback | log JSONL if collector down | ≤5ms p99 | generated/events-otel-audit.json |
| C5 | no credential surface | JS fallback on parse error | fallback to JS impl | ≤2ms p99 | replay-eval pass/fail report |
| C6 | N/A | eslint-plugin-complexity (in-project) | complexity report only (no block) on soak | N/A | lint output + complexity-report.json |
| C7 | no credential surface | fixtures under lint IGNORE_PATHS | manual triage on failure | N/A | tests/fixtures/goal-hijack/ CI gate |
| C8 | no credential surface | parses local MD only | advisory comment if parse fails | ≤1s | CI gate exit code + advisory comment |
| C9 | no credential surface | fallback to comment body | embed in CONSULTANT_CLOSEOUT | N/A | ~/.megingjord/pdca/<N>-closeout.json |

## Self-evaluation (Plan v2)

| Goal | Score/10 | Rationale |
|---|---|---|
| G1 | 10 | Every child: owner-role, lane, test_strategy, baton, mid-flight pivot path |
| G2 | 9 | Every AC verifiable; no opinion-only AC; tdd-pyramid where code touched |
| G3 | 9 | Every child Free/Fleet-lane-eligible; C5 Premium justified (1 invocation, design only) |
| G4 | 9 | Per-AC privacy box across all children |
| G5 | 9 | C6 names eslint-plugin-complexity (portable); all others settings-driven |
| G6 | 9 | Every child names degraded-mode behavior |
| G7 | 9 | C2 C4 C5 C8 explicit p99 budgets; others N/A-declared |
| G8 | 10 | Every child names evidence signal; C9 emits structured artifact |
| G9 | 9 | C5 explicit cross-runtime scoping note; C1 covers all 4 runtimes |
| G10 | 9 | C7 fixtures in lint IGNORE_PATHS; C6 directly enforces; C2 tests it |

**mean: 9.2 / 10 — no goal below 8 — boxes ticked ≥80% — A+ threshold: PASS**

## Filed Phase-1 children

- #1966 P1-C1 — #1967 P1-C2 — #1968 P1-C3 — #1969 P1-C4
- #1970 P1-C5 — #1971 P1-C6 — #1972 P1-C7 — #1973 P1-C8 — #1974 P1-C9

## References

- Parent epic: #1962
- Consumes: R1 research (#1963) at `research/goal-enforcement-2026-05-19.md`
- EPIC_RESCOPE posted on #1962 after Phase-1 children filed
