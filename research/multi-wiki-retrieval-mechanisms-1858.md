# Multi-Wiki Retrieval Mechanisms and Memory Hierarchy
Issue: #1858 — Research spike for Epic #1857
Date: 2026-05-21
Last-updated: 2026-05-21
Status: finalized — ready for citation by #1943

---

## Executive Summary

Three research iterations (initial synthesis, external market scan, goal-lens
fit) and one adversarial red-team analysis were performed across 2026-05-17 to
2026-05-21. The core conclusion is that no single mainstream system delivers
the full target as a unified primitive; the optimal architecture is a
**standards-first composition** of five specialized layers governed by a
single harness freshness/policy contract.

Eight adversarial blind spots were identified and added to the architecture
contract. Eight implementation child tickets (#1861–#1868) were filed.

This document is the canonical R1–R5 source for #1943 (claude-code Team)
to cite during Phase-0 research on the three-Wiki typology.

---

## Core Findings — R1–R5

### R1: Wiki-only is insufficient for codebase QA

High-quality model answers require **both** semantic wiki content and
structural code context. A wiki that covers concepts and processes cannot
substitute for the file-symbol-signature map models need to navigate a
codebase intentionally before performing deep reads.

**Architecture implication**: the knowledge substrate must maintain at least
two separate layers — a semantic documentation layer and a structural index
layer — with a query router that dispatches to the correct layer per question
type.

---

### R2: Repo maps are critical for coding-context retrieval

State-of-practice (Aider repo map pattern) demonstrates that compact
file + symbol + signature maps with graph-ranked token budgeting enable
models to navigate codebases intentionally. Without a structural index,
models either over-consume tokens reading full files or hallucinate symbol
locations.

**Architecture implication**: the structural-index layer must produce a
compact, token-budget-aware repo map refreshed on branch change and on CI
trigger. Content-trust scoring is required per source file before symbols
land in the LLM-facing map (see adversarial finding A5).

---

### R3: Graph-backed retrieval improves cross-cutting reasoning

Knowledge graph + community summary retrieval (GraphRAG pattern: TextUnits →
entities/relations/claims → clustering → global/local/DRIFT search)
outperforms baseline snippet retrieval for holistic and "connect-the-dots"
questions. However, the graph layer is the highest-risk layer for poisoning
attacks (see adversarial finding A2).

**Architecture implication**: graph retrieval is the preferred layer for
relationship and cross-module reasoning but must be paired with
community-detection anomaly scanning and entity-swap regression tests as CI
gates.

---

### R4: Memory hierarchy must separate stable vs episodic knowledge

Project knowledge systems must separate three distinct tiers:

| Tier | Content | Scope |
|---|---|---|
| Stable procedural | Governance contracts, global instructions, harness rules | Always-on / immutable |
| Long-term semantic | Project research wiki, architectural decisions, cross-module knowledge | Project / versioned |
| Short-term episodic | Current task state, in-flight reasoning, recent tool outputs | Session / thread |

Conflating these scopes produces context-window bloat and stale-knowledge
injection. CrewAI Unified Memory, LangGraph thread/namespace split, and
Claude Code CLAUDE.md scope tiers all independently validate this separation.

**Architecture implication**: at least three explicit scope tiers with
isolated stores, non-overlapping write paths, and scope-gated retrieval.
Documented multi-tenant cross-leakage (up to 95% in 4-tenant corpora) requires
namespace isolation guarantees, not nominal scope labels.

---

### R5: Freshness must be enforced, not aspirational

Knowledge systems need drift detection, provenance, and CI/session gates
to keep docs and indexes synchronized with code evolution. Freshness as a
signal is necessary but **insufficient**: a poisoned wiki page that was
recently updated passes every freshness check.

**Architecture implication**: freshness gates must be paired with a
content-layer policy engine (provenance + content-hash + signature) that
runs at **ingestion** and at **retrieval time**, not only at re-ingestion.
Provenance forgery (swap source-URL content after hash is recorded) requires
retrieval-time hash re-verification.

---

## Market Scan Findings — F6–F8 (Iteration 1)

### F6: No single system covers the full target substrate

Nine systems were reviewed: DeepWiki, Aider repo map, Microsoft GraphRAG,
Claude Code memory/subagents, CrewAI Unified Memory, LangGraph Memory,
AgentOps, AutoGPT Platform, OpenHands. Each addresses one or two layers;
none presents the full governance-first multi-wiki harness contract as one
integrated primitive.

### F7: The strongest practical pattern is compositional

Five layers compose the target substrate:

1. **Semantic wiki/doc layer** — concept, process, decision documentation
2. **Structural symbol/repo map layer** — file, symbol, signature index
3. **Graph reasoning layer** — entity/relation/community summaries
4. **Scoped memory and agent context layer** — session/project/user tiers
5. **Observability/freshness instrumentation layer** — traces, drift alerts

### F8: This validates the harness build strategy

Building a first-class multi-wiki governance contract and plugging specialized
retrieval/indexing backends under one policy is the correct approach.
Adopting any single external system would sacrifice governance control and
portability.

---

## Adversarial Security Findings (Red-Team, Iteration 3)

Eight critical blind spots were identified by the outside-baton adversarial
red-team. Each produced a concrete control addition:

### A1 — Knowledge poisoning (PoisonedRAG)

**Threat**: 5 malicious texts in a corpus of millions → 97% attack success
(USENIX Security 2025). Freshness ≠ correctness. Vector-embedding payloads
bypass content-based filters.

**Control**: ingestion-side content-trust scoring (signed-commit verification,
Unicode-confusable detection, known-source allowlist) + retrieval-time
content-hash + signature mismatch → redact.

### A2 — GraphRAG-specific poisoning (GragPoison, LogicPoison)

**Threat**: three-phase injection attacks and type-preserving entity-swap
attacks documented against community-summary retrieval (arXiv 2501.14050,
2604.02954).

**Control**: periodic community-detection anomaly filtering, degree-
prioritization defense, adversarial entity-swap regression eval as CI gate.

### A3 — MCP CVE surface

**Threat**: tool poisoning via malicious tool-description metadata is the
dominant MCP client-side vulnerability. STDIO-transport RCE affects 150M+
combined framework downloads. "MCP solidified" mis-states the 2026 risk
landscape.

**Control**: CVE-monitoring loop for MCP clients; tool-metadata validation
policy (deny-by-default for unrecognized-origin tools); STDIO-transport
sanitization as defense-in-depth.

### A4 — Multi-tenant cross-scope leakage

**Threat**: up to 95% cross-tenant leakage in 4-tenant corpus from organic
entity connections. KV cache timing creates observable cross-tenant side
channel via Time-To-First-Token differentials.

**Control**: namespace isolation guarantees with documented enforcement;
Burn-After-Use SMTA (92% defense success); side-channel-safe retrieval routing
as explicit CI gate.

### A5 — Structural-index symbol injection (RoguePilot, GlassWorm)

**Threat**: adversary-controlled repo files inject Unicode-confusable
identifiers, deceptive symbols, or token-budget-exhaustion content into the
repo map. Force-pushed malware with preserved metadata propagates into model
context via repo-map ingestion.

**Control**: per-source-file content-trust scoring; signed-commit verification;
Unicode-confusable detection before content lands in LLM-facing map.

### A6 — OPA is downstream of content

**Threat**: OPA evaluates inputs the LLM/agent provides. Poisoned wiki content
passes OPA validation because the gate is positioned after the content layer.

**Control**: content-layer policy engine (provenance + signature + content-hash)
must run **before** content reaches the wiki/index. OPA remains correct for the
action/tool-execution layer.

### A7 — Provenance forgery via URL-swap

**Threat**: attacker plants source link → SHA256 matches at ingestion →
attacker swaps URL content → mismatch is only detectable at re-ingestion,
not at query time.

**Control**: provenance check at **retrieval time** (cheap content-hash lookup)
in addition to re-ingestion verification.

### A8 — Hybrid retrieval bypass via query-classification attacks

**Threat**: adversary crafts queries that route to weaker retrieval layers.
BM25 stuffing and reranker fooling are documented bypass classes.

**Control**: adversarial regression tests on every degradation-ladder step-
down, not just functional tests.

---

## Goal-Lens Fit Matrix (G1–G9)

| Goal | Evidence-Informed Control | Required / Advisory |
|---|---|---|
| G1 Governance | OPA policy-gate layer; deny-by-default on critical drift; content-layer policy engine upstream of OPA | Required |
| G2 Quality | Langfuse eval loops; per-class ≥90% retrieval regression suite with hard-fail on critical class | Required |
| G3 Zero Cost | Local-first default profile (Qdrant Edge, Ollama); explicit cloud escalation criteria | Default |
| G4 Privacy | Sensitivity-aware routing; local-only for restricted scopes; multi-tenant namespace isolation guarantees | Required |
| G5 Portability | Pluggable adapter contracts; MCP + LiteLLM + OpenFeature provider abstraction | Required |
| G6 Resilience | Degradation ladder (graph → hybrid → semantic → exact); adversarial regression per rung | Required |
| G7 Throughput | Token-aware query router budget policy; cached artifact refresh windows | Advisory |
| G8 Observability | OTel GenAI semconv spans; Langfuse/AgentOps-compatible trace schema | Required |
| G9 Interoperability | MCP + OTel + OpenFeature as non-negotiable architecture constraints | Required |

---

## Architecture Contract

### Composable Substrate (five required layers)

```
Semantic Wiki Store         — concept, process, decision docs
Structural Index Store      — repo map, symbols, commands
Graph Index Store           — entities, relations, community summaries
Scoped Memory Store         — session, project, user tiers
Observability/Freshness     — CI gates, trace schema, drift alerts
         ↓
Retrieval Router (query-type dispatch)
         ↓
Freshness + Content Policy Gates
         ↓
Answer with Provenance
```

### Adapter Contracts (required, pluggable)

- `semantic-store-adapter` — wiki/doc store abstraction
- `structural-index-adapter` — repo-map/symbol-index abstraction
- `graph-adapter` — entity/relation/community-summary abstraction
- `memory-adapter` — session/project/user scope abstraction
- `trace-eval-adapter` — OTel-compatible trace/eval abstraction

### Retrieval Router Policy

| Query type | Primary layer | Fallback |
|---|---|---|
| Symbol / code location | Structural index | Semantic wiki |
| Concept / process | Semantic wiki | Graph communities |
| Cross-module / holistic | Graph communities | Semantic wiki |
| Session state / recent output | Scoped memory (session) | — |

### Freshness Policy Gates

- **CI gate** — fail if staleness manifest age > threshold for critical scopes
- **Session-start gate** — drift warning if any scope index is stale since last
  commit
- **Retrieval-time gate** — content-hash re-verification on every retrieved chunk
- **Re-ingestion gate** — provenance SHA256 recomputed + signed on re-ingest

### Progressive Rollout Plan

| Phase | Scope |
|---|---|
| Phase 0 | Local semantic + structural only |
| Phase 1 | Add graph index |
| Phase 2 | Enable hybrid router |
| Phase 3 | Enforce policy gates in CI (per-class ≥90% thresholds) |

---

## Implementation Decomposition (child tickets under Epic #1857)

| Ticket | Scope |
|---|---|
| #1861 | Harden ingestion content trust and poisoning resistance |
| #1862 | Add GraphRAG adversarial defenses and anomaly scanning gates |
| #1863 | Secure MCP integration with metadata validation and CVE watch loop |
| #1864 | Enforce multi-scope isolation and side-channel-safe retrieval routing |
| #1865 | Add structural-index trust controls for repo-map ingestion |
| #1866 | Implement two-layer policy enforcement and retrieval-time provenance checks |
| #1867 | Build adversarial retrieval regression suite and release gates |
| #1868 | Degradation routing and fallback path implementation |

Child tickets #1861–#1868 received multi-phase external-model review (Architect
agent, Claude Opus family, outside-GPT/Codex family). Corrections applied:
per-attack-class ≥90% thresholds, fail-closed critical-class regression, explicit
dependency DAG, measurable side-channel CI gate, fail-closed policy/provenance
outage AC, deny-by-default negative tests.

---

## Cross-Links and Integration Points

- **Epic #1857** — parent epic (multi-wiki fleet model availability)
- **#1943 / #1942** (claude-code Team) — three-Wiki typology (Code-Base,
  Work-Log, Research-Based-Wisdom) + auto-update pipeline. Per #1942 AC-R8
  and #1943 AC8, that team will **cite and integrate** this document's R1–R5
  findings rather than duplicate them. This document is the authoritative
  source for multi-wiki retrieval semantics and memory hierarchy design.
- **#1673** — unified wiki health contract (structural health, orphan/frontmatter)
- **#868** — wiki retrieval foundation (hybrid retrieval; implementation of R1)
- **#869** — NLP-based chunking strategy (implementation of R1/R2)

---

## Open Questions (deferred to implementation phase)

1. What freshness SLO (hours vs commits) is mandatory per scope tier?
2. Which generated artifacts are required vs optional at project bootstrap?
3. What minimum query coverage test count gates CI per retrieval class?
4. How are project-specific freshness exceptions declared without breaking
   the portability contract?
5. What is the minimum viable MCP CVE monitoring loop that does not add
   operational burden?

---

*Compiled by: Soren Harper (Collaborator) + Soren Vale (Consultant)*
*Team&Model: copilot:claude-sonnet-4.6@github-copilot*
*Source ticket: #1858 | Refs: #1857, #1861–#1868, #1942, #1943*
