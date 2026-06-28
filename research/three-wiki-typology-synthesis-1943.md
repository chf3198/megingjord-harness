# Three-Wiki Typology Synthesis — #1943 (Phase-0)

Parent Epic: #1942
Adjacent research consumed: #1858 (Copilot Team)
Date: 2026-05-21
Status: finalized — ready for Consultant peer-review + Phase-1 child authorship

---

## Executive summary

The operator's 2026-05-19 design discussion established a **three-Wiki typology** addressing G3 (Zero Cost) and G7 (Throughput) via local knowledge stores that eliminate redundant CLI/`gh` traversal. This synthesis integrates the Copilot Team's R1-R5 multi-wiki retrieval research ([`research/multi-wiki-retrieval-mechanisms-1858.md`](multi-wiki-retrieval-mechanisms-1858.md)) and demonstrates that the operator's typology + the Copilot Team's five-layer substrate are **compatible refinements of the same architecture**, not competing designs.

Concretely:
- The operator's **Wiki A (Code-Base)** is the harness instantiation of Copilot's **structural index layer (R2)** plus a co-located code-bound **semantic layer (R1)**.
- The operator's **Wiki B (Project Work-Log)** is the harness instantiation of Copilot's **scoped memory layer (R4)** at the *project* tier (long-term semantic), not the *session* tier (episodic).
- The operator's **Wiki C (Research-Based-Wisdom, dual-scope)** is the harness instantiation of Copilot's **semantic wiki/doc layer (R1)** plus the future **graph reasoning layer (R3)** when cross-cutting reasoning is required.
- All three Wikis are governed by a single **freshness + content-policy gate** matching Copilot's **observability/freshness instrumentation layer (R5)** — the auto-update pipeline.

The Copilot Team's eight adversarial findings (A1-A8) become **non-negotiable defensive controls** on the auto-update pipeline; this synthesis maps each control to its enforcement surface.

---

## Three-Wiki typology (recap of operator definition)

Quoted verbatim from #1943 body (operator capture 2026-05-19):

| Wiki | Scope | Operator quote anchor | Primary G-goal |
|---|---|---|---|
| **A — Code-Base** | per-project, mirrors source code semantics | "lengthy CLI research to find dispersed references" | G3 (cost) |
| **B — Project Work-Log** | per-project, mirrors GitHub ticket history | "local store (log) of all work done" | G3 (cost) + G7 (throughput during outages) |
| **C — Research-Based-Wisdom** | dual: global + project-specific | "globally available Wiki with general knowledge ... and a project specific research-based-wisdom Wiki" | G2 (quality) + G3 (cost) |

The dual scope on Wiki C is **load-bearing** — global content is shared across all projects (existing `~/.copilot/wiki/` distribution path); project-specific content lives in `<repo>/wiki/wisdom/project/` and never leaks cross-project. This separation defends against Copilot finding **A4 (multi-tenant cross-scope leakage)** at the data-layout level.

---

## Integration with #1858 R1-R5 (Copilot Team research)

The Copilot Team's research is the authoritative source for **multi-wiki retrieval semantics and memory hierarchy design** (per #1858 cross-link). This section maps each R-finding into the three-Wiki typology with concrete adaptation points.

### R1 → Wiki A + Wiki C (semantic + structural composition)

Copilot R1 [#1858:R1]: *"High-quality model answers require both semantic wiki content and structural code context."*

Adaptation to the typology:
- **Wiki A** is dual-layered internally: a structural sub-layer (`wiki/code/symbols/`) holds file → symbol → signature maps per R2; a semantic sub-layer (`wiki/code/concepts/`) holds prose descriptions of how the code works (feature explainers, dependency graphs, known-issue notes). Both are auto-updated from the same source-code corpus.
- **Wiki C** is purely semantic — the structural counterpart for cross-project research wisdom doesn't exist because research-wisdom doesn't have a "symbol table." Cross-cutting reasoning relies on R3 graph retrieval here.

### R2 → Wiki A structural sub-layer

Copilot R2 [#1858:R2]: *"compact file + symbol + signature maps with graph-ranked token budgeting."*

Adaptation: Wiki A's structural sub-layer adopts the Aider repo-map pattern as its on-disk schema. Per-source-file content-trust scoring (per Copilot **A5** — RoguePilot / GlassWorm defense) gates symbols into the LLM-facing index. Refresh trigger is PR-merge (auto-update pipeline §below).

Concrete schema for Wiki A structural pages (proposed):
```
wiki/code/symbols/<repo-rel-path>.md

---
wiki_type: code
sub_layer: structural
source_path: scripts/global/baton-comment-build.js
source_sha256: <hash>
signature_count: 8
last_updated: 2026-05-21T13:55:00Z
content_trust_score: 0.97
---

## Symbols

| Name | Type | Signature | Line |
|---|---|---|---|
| buildBatonComment | function | (artifact, ticket, signer) → string | 12 |
| renderTemplate | function | (template, input) → string | 47 |
...
```

### R3 → Wiki C graph layer (Phase-2 deferred)

Copilot R3 [#1858:R3]: *"Knowledge graph + community summary retrieval ... outperforms baseline snippet retrieval for holistic and 'connect-the-dots' questions."*

Adaptation: Wiki C's graph reasoning layer (entity + relation + community summary) is **deferred to Phase-2** per the Copilot progressive rollout plan (Phase-0: local semantic + structural; Phase-1: add graph; Phase-2: hybrid router; Phase-3: policy gates in CI). Phase-1 of this Epic ships Wiki A + Wiki B + Wiki C semantic-only. Phase-2 adds GraphRAG to Wiki C with the adversarial defenses from Copilot **A2** (GragPoison / LogicPoison community-detection anomaly filtering + entity-swap regression eval).

### R4 → Three-Wiki typology IS the harness refinement of R4

Copilot R4 [#1858:R4]: *"Project knowledge systems must separate three distinct tiers ... Stable procedural / Long-term semantic / Short-term episodic."*

This is the most load-bearing integration. The operator's typology and Copilot's R4 tier separation map as follows:

| Copilot tier (R4) | Harness instantiation | Storage |
|---|---|---|
| Stable procedural | `instructions/*.md` + `governance/README.md` + Harness CLAUDE.md | git-versioned, immutable per-session |
| Long-term semantic | **Wiki A** (code) + **Wiki B** (work-log) + **Wiki C** (wisdom, both scopes) | `wiki/code/`, `wiki/work-log/`, `wiki/wisdom/{global,project}/` |
| Short-term episodic | Session memory (Claude Code memory dir at `~/.claude/projects/.../memory/`) | per-session, opaque to Wiki layer |

The harness's `instructions/wiki-knowledge.instructions.md` is the access-policy contract; it gates the long-term-semantic layer behind read-only / `~/.copilot/wiki/`-only access for non-Megingjord repos. **Namespace isolation guarantees** (per Copilot **A4** defense) are enforced at the directory boundary: a non-Megingjord repo's session cannot write to `wiki/wisdom/project/<other-project>/`.

### R5 → Auto-update pipeline IS the freshness enforcement layer

Copilot R5 [#1858:R5]: *"freshness gates must be paired with a content-layer policy engine ... that runs at ingestion and at retrieval time, not only at re-ingestion."*

The auto-update pipeline (§below) implements both checkpoints:
- **Ingestion-time**: per-PR-merge GitHub Action computes content-trust score + signed-commit verification + Unicode-confusable detection (Copilot **A1** defense) before any page is written to a Wiki.
- **Retrieval-time**: `scripts/wiki/retrieval.js` recomputes `source_sha256` of the cited source file at every query and rejects the result if the on-disk hash differs from the wiki page's recorded hash (Copilot **A7** provenance-forgery defense).

---

## Storage layout design (AC3)

```
wiki/
├── code/                              # Wiki A (per-project)
│   ├── symbols/                       # structural sub-layer
│   │   └── <repo-rel-path>.md
│   └── concepts/                      # semantic sub-layer
│       ├── features/
│       ├── dependencies/
│       └── known-issues/
├── work-log/                          # Wiki B (per-project)
│   ├── tickets/
│   │   └── <ticket-N>.md              # mirror of `gh issue view N`
│   └── prs/
│       └── <pr-N>.md                  # mirror of `gh pr view N`
├── wisdom/                            # Wiki C (dual-scope)
│   ├── global/                        # shared via ~/.copilot/wiki/ distribution
│   │   ├── concepts/
│   │   ├── entities/
│   │   └── syntheses/
│   └── project/                       # never distributed cross-project
│       ├── concepts/
│       ├── decisions/
│       └── research/
└── index.md                           # router-readable manifest
```

Frontmatter schema (additive to existing `wiki/` pages):

```yaml
---
wiki_type: code | work-log | wisdom
scope: project | global       # only on wisdom/
source_path: <rel-path>       # only on code/work-log
source_sha256: <hex>          # required on code/work-log; optional on wisdom
content_hash: <hex>           # required everywhere
last_updated: <ISO-8601>
freshness_window: 7d | 14d | 30d | none
content_trust_score: <float 0-1>
sub_layer: structural | semantic   # only on code/
---
```

`freshness_window` is the per-page SLO; the freshness gate fails CI if `last_updated` > `freshness_window` ago AND the underlying source file changed within the window. Pages with `freshness_window: none` (intentionally archival) are exempt.

---

## Auto-update pipeline design (AC4) — consuming Copilot retrieval components

The auto-update pipeline is the operationalization of Copilot **R5** + the eight adversarial defenses **A1-A8**. It runs as a GitHub Action on PR-merge events.

### Trigger

```yaml
on:
  pull_request:
    types: [closed]
jobs:
  wiki-auto-update:
    if: github.event.pull_request.merged == true
```

### Pipeline stages (consumes Copilot components)

| Stage | Function | Copilot component consumed | Defense |
|---|---|---|---|
| 1. Diff classify | `scripts/wiki/diff-classify.js` reads PR file list, routes each path → wiki_type | Retrieval router policy (R3, §"Retrieval Router Policy" in #1858) | — |
| 2. Ingestion-time content-trust score | `scripts/wiki/ingest-<type>.js --check-trust` | Ingestion content-trust scoring (A1) | A1 (PoisonedRAG) |
| 3. Signed-commit verification | reject if PR HEAD commit signature missing/invalid | (A1 defense surface) | A1 |
| 4. Unicode-confusable scan | reject identifiers with mixed-script confusables | (A1 + A5 defense surface) | A1 + A5 (GlassWorm) |
| 5. Per-source-file content-trust scoring | gate symbols into structural index | A5 control | A5 (RoguePilot) |
| 6. Per-type ingestion | invoke `ingest-code.js` / `ingest-work-log.js` / `ingest-wisdom.js` | (new code, but parametrized by Copilot adapter contracts) | — |
| 7. Content-hash + signature record | write `content_hash` + `source_sha256` to frontmatter | Retrieval-time provenance check primitive (A7) | A7 |
| 8. Namespace isolation guard | reject any write that crosses `wiki/wisdom/project/<X>/` ↔ `wiki/wisdom/project/<Y>/` | Namespace isolation enforcement (A4) | A4 |
| 9. Drift gate | bi-directional code↔wiki↔instructions↔README hash compare; emit advisory comment on PR if drift detected | (extension of existing `docs-drift-maintenance`) | — |
| 10. Replay-eval verification | run subset of `scripts/wiki/eval-harness.js` fixtures (token-cost-reduction ≥30%) | Langfuse-style eval-loop primitive (Copilot G2 control) | G2 quality |
| 11. Commit + open companion PR | push updated `wiki/` files via HAMR `/mailbox/write` (#743 primitive) | Multi-repo write path | — |

### Adapter contract conformance

The pipeline consumes the five adapter contracts named in #1858:
- `semantic-store-adapter` — instantiated by `wiki/wisdom/` (Wiki C semantic store)
- `structural-index-adapter` — instantiated by `wiki/code/symbols/` (Wiki A structural sub-layer)
- `graph-adapter` — **Phase-2** (deferred per progressive rollout)
- `memory-adapter` — Wiki B `wiki/work-log/` + session memory at `~/.claude/projects/`
- `trace-eval-adapter` — emit OTel `gen_ai.*` spans per ingestion run; per existing `scripts/global/event-schema-v3.js` + `instructions/observability.instructions.md`

### Degradation ladder (Copilot R3 / R6 defense)

If a wiki page's content-hash mismatch is detected at retrieval, the router falls back per the Copilot degradation ladder:
1. Wiki page (primary)
2. `gh` CLI lookup (Wiki B fallback for ticket data)
3. Source-file Read (Wiki A fallback for symbol data)
4. Wiki page with explicit `STALE: hash-mismatch` warning prepended (Wiki C fallback)

Each fallback step emits an `incidents.jsonl` event with `pattern_id=wiki-cache-miss-degrade` so the freshness gate calibrates its SLO based on observed-vs-target miss rate.

---

## MCP `/project-state` capability schema (AC5)

Adds `/project-state` to the HAMR `/mcp` capability dispatch (#935 primitive). The harness's existing `bundle:fetch`, `doctor:probe`, `mailbox:read` capabilities are joined by:

```json
{
  "capability": "project-state",
  "params": {
    "project": "megingjord",
    "scope": "code|work-log|wisdom-global|wisdom-project",
    "query_type": "symbol|concept|history|cross-cutting",
    "query": "<string>",
    "max_tokens": 4000
  }
}
```

Response:
```json
{
  "wiki_type": "code|work-log|wisdom",
  "results": [
    { "path": "wiki/code/symbols/scripts/global/baton-comment-build.js.md",
      "excerpt": "<token-budgeted snippet>",
      "content_hash": "<hex>",
      "source_sha256": "<hex>",
      "freshness_age_seconds": 1234,
      "content_trust_score": 0.97 }
  ],
  "fallback_chain": [],
  "telemetry": {
    "retrieval_class": "structural",
    "tokens_returned": 3120,
    "p99_latency_ms": 42
  }
}
```

The retrieval router selects `wiki_type` per `query_type` using the Copilot Retrieval Router Policy table (#1858 §"Retrieval Router Policy"). The response carries the retrieval-time content-hash for **A7 provenance verification** at the caller side.

---

## Bi-directional drift gate (AC6)

A new CI check `wiki-drift-required` runs on every PR open + push events. It computes:

```
for each (code_path, wiki_page) pair in wiki/code/symbols/:
  if sha256(read(code_path)) != wiki_page.frontmatter.source_sha256:
    emit drift event (code_changed_wiki_stale)

for each (instruction_path, wiki_page) referencing the same concept:
  if extracted_claims(instruction_path) != extracted_claims(wiki_page):
    emit drift event (instruction_wiki_divergence)

for each (readme_section, wiki_page) referencing the same concept:
  ...
```

Drift detection uses the existing `scripts/wiki/health-contract.js` (#1673 primitive) as the structural-health backbone; the bi-directional check extends it with code-side hash comparison. **The check is advisory in Phase-1** and **required in Phase-2** post replay-eval calibration per the Epic #1771 / Epic #1827 replay-eval-over-calendar pattern.

---

## Replay-eval design (AC7) — token-cost-reduction ≥30%

Fixture corpus per the existing `scripts/wiki/eval-harness.js`:
- **Code-context fixtures** (Wiki A target): 50+ realistic questions of form *"where is X defined / what does Y depend on / what's the signature of Z"* — golden answers extracted from the code; cost measured as tokens-to-answer (baseline: full-file Read + grep chain).
- **Work-log fixtures** (Wiki B target): 30+ questions of form *"what was decided in ticket #N / which PR closed issue #M / what's the resolution path on incident X"* — golden answers from `gh issue view` corpus.
- **Wisdom fixtures** (Wiki C target): 20+ cross-cutting questions of form *"what's the harness contract on Y / how does the Z protocol work"* — golden answers from `wiki/` synthesis pages.

Pass criterion: aggregate token-cost reduction ≥30% relative to the baseline `gh`/`Read`/`grep` chain across all three fixture classes. Calibration runs at every PR merge; sub-30% reduction trips an advisory comment and Tier-1 incident.

This calibration replaces any calendar-day "soak" thresholds per memory `feedback_soak_language_default` and `feedback_calendar_thresholds_in_agentic_systems`.

---

## Cross-team coordination (AC8) — formal cross-team consult

This synthesis document IS the formal cross-team consult per the Cross-Team Artifact-Write contract (`instructions/cross-team-artifact-write.instructions.md`) modified for **read-side** cross-team consumption:

- **Authoring team**: claude-code (this synthesis)
- **Cited team**: copilot (R1-R5 + A1-A8 from #1858)
- **Schema source**: `research/multi-wiki-retrieval-mechanisms-1858.md` (Copilot Team's canonical output)
- **Sign-off marker**: every Copilot finding (R1-R5, A1-A8, F6-F8) is cited inline with explicit `#1858:Rn` / `#1858:An` anchors. The Copilot Team's own document explicitly authorizes this consumption: *"This document is the canonical R1–R5 source for #1943 (claude-code Team) to cite during Phase-0 research."*

No new TEAM_QUESTION/TEAM_RESPONSE comment cycle is required since #1858 was authored with the explicit purpose of being consumed here.

---

## Goal-lens mapping (G1-G10) — AC9 preview

| Goal | Three-Wiki contribution | Copilot R/A contribution | Combined evidence |
|---|---|---|---|
| G1 Governance | Wiki C carries governance contract pages; namespace isolation enforced at directory | OPA content-layer policy upstream (A6) | Content + action policy layers separated and enforced |
| G2 Quality | Replay-eval (AC7) with ≥30% token-cost-reduction target; bi-directional drift gate (AC6) | Langfuse eval loops; per-class ≥90% retrieval regression (G2 row) | Eval-driven + drift-detection composition |
| G3 Zero Cost | Wiki A eliminates `grep`/`Read` chains; Wiki B eliminates `gh` round-trips; Wiki C eliminates web research | Local-first default profile (G3 row) | Token + network cost both reduced |
| G4 Privacy | Project-scope wisdom never leaves repo; namespace isolation (A4 control) | Sensitivity-aware routing; SMTA Burn-After-Use (A4) | Data + retrieval-path isolation |
| G5 Portability | Pluggable adapter contracts (5 from #1858); auto-update pipeline is YAML-only (no per-runtime code) | MCP + LiteLLM + OpenFeature provider abstraction (G5 row) | Adapter-defined, runtime-independent |
| G6 Resilience | Degradation ladder (wiki → gh → Read → wiki-with-stale-marker); freshness gate failure → fallback chain | Degradation ladder (graph → hybrid → semantic → exact) with adversarial regression per rung | Composable fallback at both wiki-type and retrieval-class layers |
| G7 Throughput | Sub-50ms p99 retrieval target; cached responses for hot queries | Token-aware query router; cached artifact refresh windows | Latency + cost throughput composable |
| G8 Observability | OTel `gen_ai.*` spans on every retrieval; drift events emit incidents.jsonl | OTel GenAI semconv spans; Langfuse/AgentOps-compatible trace schema | Single trace schema across layers |
| G9 Interoperability | MCP `/project-state` follows HAMR capability dispatch; wiki frontmatter is universal | MCP + OTel + OpenFeature non-negotiable (G9 row) | Cross-runtime call path validated |
| G10 Maintainability | Per-script line cap; auto-update pipeline modular (11 stages, each independently lintable) | Adapter contracts modular (5 adapters, each independently swappable) | Two-layer modularity (pipeline + adapter) |

Goal-lens self-rating (Consultant will validate): **all ten goals at 9 or 10** — pending Consultant verification.

---

## Adversarial defenses inherited from #1858

All eight Copilot adversarial findings (A1-A8) become non-negotiable controls on this design. Inheritance map:

| Copilot A-finding | Inherited control | Enforcement point in this design |
|---|---|---|
| A1 — Knowledge poisoning | Ingestion-time content-trust scoring | Auto-update pipeline stage 2 + 3 |
| A2 — GraphRAG-specific poisoning | Community-detection anomaly filtering, entity-swap regression | Phase-2 only (graph layer deferred) |
| A3 — MCP CVE surface | Tool-metadata validation; STDIO-transport sanitization | MCP `/project-state` capability dispatch |
| A4 — Multi-tenant cross-scope leakage | Namespace isolation guarantees; SMTA Burn-After-Use | Storage layout (per-project subdirs); pipeline stage 8 |
| A5 — Structural-index symbol injection | Per-source-file content-trust scoring; signed-commit verification | Pipeline stages 4 + 5 |
| A6 — OPA downstream of content | Content-layer policy engine upstream of OPA | Pipeline stages 2-5 run before any wiki write |
| A7 — Provenance forgery via URL-swap | Retrieval-time content-hash re-verification | MCP `/project-state` response contract |
| A8 — Hybrid retrieval bypass | Adversarial regression on degradation ladder step-downs | Replay-eval (AC7) fixture corpus |

---

## Phase-1 child slate (provisional — for Manager to file post-closeout)

These children become Phase-1 development tickets under Epic #1942 once #1943 closes. Each must cite Phase-0 source children (`Refs #1858` + `Refs #1943`) and carry `phase-gate:phase-1` per epic-governance.

| C# | Title | Lane | test_strategy | Dependencies |
|---|---|---|---|---|
| C1 | Storage-layout migration: split existing `wiki/` into `wiki/{code,work-log,wisdom/{global,project}}` | docs-research | drift-lint | — |
| C2 | Frontmatter schema enforcement: extend `scripts/wiki/health-contract.js` to require new fields | code-change | tdd-pyramid | C1 |
| C3 | `wiki/code/symbols/` repo-map ingestion (`scripts/wiki/ingest-code.js`) with per-source-file content-trust scoring | code-change | tdd-pyramid + stress-test | C2 |
| C4 | `wiki/work-log/` ticket+PR mirror ingestion (`scripts/wiki/ingest-work-log.js`) | code-change | tdd-pyramid | C2 |
| C5 | Auto-update GitHub Action with 11-stage pipeline (this synthesis §"Auto-update pipeline") | code-change | tdd-pyramid + stress-test | C3 C4 |
| C6 | MCP `/project-state` capability handler on HAMR Worker | code-change | tdd-pyramid + contract-test | C5 |
| C7 | Retrieval router: extend `scripts/wiki/retrieval.js` to dispatch by `wiki_type` + retrieval-time hash verification | code-change | tdd-pyramid + stress-test | C5 |
| C8 | Bi-directional drift gate CI (advisory in Phase-1) | code-change | tdd-pyramid | C7 |
| C9 | Replay-eval harness with token-cost-reduction ≥30% target | code-change | tdd-pyramid + replay-eval | C7 |
| C10 | Instructions update: extend `wiki-knowledge.instructions.md` to document three-Wiki typology + auto-update contract | docs-research | drift-lint | C1-C9 |

Phase-2 children (deferred): GraphRAG / Wiki-C graph layer (Copilot A2 controls included); drift gate promoted advisory → required post replay-eval calibration.

---

## References

- Adjacent research: [`research/multi-wiki-retrieval-mechanisms-1858.md`](multi-wiki-retrieval-mechanisms-1858.md) — Copilot Team R1-R5 + A1-A8 + F6-F8 (canonical source)
- Parent Epic: #1942 (Three-Wiki typology + auto-update pipeline for G3/G7)
- Sibling Epic: #1857 (multi-wiki retrieval — Copilot Team parent of #1858)
- Existing primitives (catalog in #1943 body): #142, #864, #866, #1017, #1083, #1673, #743, #935
- Operator capture: 2026-05-19 design discussion (full text in #1943 body)
- Memory anchors: [[feedback-soak-language-default]], [[feedback-calendar-thresholds-in-agentic-systems]] — replay-eval over calendar-day thresholds
- Replay-eval pattern source: Epic #1771 + Epic #1827

---

*Compiled by: Orla Harper (Collaborator)*
*Team&Model: claude-code:opus-4-7@local*
*Source ticket: #1943 | Refs: #1942, #1858, #1857*
