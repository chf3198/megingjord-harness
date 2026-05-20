# Goal Enforcement Landscape Survey + Gap Analysis (2026-05-19)

Phase-0 R1 research deliverable for Epic #1962. Consumed by R2 (#1964) for Phase-1 plan iteration.

## 1. Microsoft Agent Governance Toolkit (MIT, April 2026)

Open-source framework providing runtime security governance for autonomous AI agents. First to cover 10/10 OWASP Agentic Top 10 with deterministic sub-millisecond policy enforcement.

| Component | Function | Maps to Megingjord primitive | Net-new for us |
|---|---|---|---|
| Agent OS | Policy enforcement layer; every tool call, resource access, inter-agent message evaluated against policy before execution | `hooks/scripts/pretool_guard.py`, `baton-gates.yml` | Centralized policy-as-code surface unifying scattered Boolean gates |
| Agent Mesh | Secure communication + identity framework | `inventory/team-model-signatures.json` + `scripts/global/baton-signing.js` | Zero-trust inter-agent message authentication |
| Agent Runtime | Execution control environment (sandbox, ring privileges, kill switches) | Worktree isolation; `scripts/global/broker.js` quarantine | CPU-privilege-ring style permission escalation control |
| Agent SRE | Reliability engineering | HAMR `/quota`, dashboard cost panels | Site-reliability framing of agent ops |
| Agent Compliance | Marketplace + audit governance | None currently | Auditable compliance evidence pipeline |
| Agent Lightning | Reinforcement-learning oversight | None | Not applicable to our deterministic-flow harness |

**Architecture pattern**: separate policy decision point (PDP) from policy enforcement point (PEP). Our hooks combine both. Splitting them is a Phase-1 candidate.

**Sources**: github.com/microsoft/agent-governance-toolkit, opensource.microsoft.com/blog/2026/04/02, InfoWorld + CSO Online April 2026 coverage, techcommunity.microsoft.com architecture deep dive.

## 2. OWASP Top 10 for Agentic Applications (December 2025; 2026 effective)

| # | Risk | Maps to | Current coverage | Candidate mitigation |
|---|---|---|---|---|
| 1 | Goal Hijacking | G1 G2 | Advisory (operator-identity-context + ticket-first) | Goal-hijack-resistance test fixtures; separation of planning from execution |
| 2 | Tool Misuse | G1 G4 | Enforced (permissions allowlist, `pretool_guard.py`) | Per-tool blast-radius declarations |
| 3 | Identity Abuse | G1 G4 | Enforced (team-model-signing, signer-alias-canonical) | Cross-family signer-independence test (already #1875 stress) |
| 4 | Memory Poisoning | G2 G4 | Partial (memory-watchdog) | Schema validation on auto-memory writes |
| 5 | Cascading Failures | G6 | Partial (header-spillover, sticky-route TTL) | Explicit circuit-breaker contracts |
| 6 | Rogue Agents | G1 G9 | Enforced (broker quarantine, baton single-thread) | Inter-agent message tamper-evidence |
| 7 | Supply Chain | G4 | Enforced (dependency-review, secret-scanning) | SLSA provenance + cosign attestation already shipped |
| 8 | Insecure Communications | G4 | Partial (DPoP for HAMR; not all comms) | Zero-trust mesh for cross-runtime |
| 9 | Human-Agent Trust Exploitation | G1 G8 | Advisory (closeout evidence) | Tamper-evident audit ledger (wiki/log.md already append-only) |
| 10 | Code Execution | G4 | Enforced (no LLM eval, no shell from prompts directly) | Sandbox boundaries auditable |

**Sources**: goteleport.com/blog/owasp-top-10-agentic-applications, aigl.blog, paloaltonetworks.com/blog/cloud-security/owasp-agentic-ai-security, trydeepteam.com OWASP framework page, auth0.com lessons, F5 + Promptfoo + HumanSecurity coverage.

## 3. OPA Rego vs AWS Cedar — Policy-as-Code Comparison

| Criterion | OPA Rego | AWS Cedar | Megingjord fit |
|---|---|---|---|
| Maturity | CNCF graduated (8+ years) | Newer (2023+) | OPA more proven |
| Expressiveness | High (Datalog-derived) | Moderate (PARC structure) | Mixed; Rego wins for complex rules |
| Determinism | Mixed (Wiz + natoma.ai cite non-determinism risk) | Strong (designed for safe evaluation) | Cedar wins for our deterministic-rubric philosophy |
| Validation | Schema-as-data optional | Schema-validation mandatory | Cedar safer for governance code |
| Extensibility | Built-in functions + custom | Constrained intentionally | Rego flexible; Cedar predictable |
| Tooling | rich (Conftest, Gatekeeper, REPL) | growing (cedar-policy crate, CLI) | OPA more tooling today |
| Performance | Sub-millisecond typical | Sub-millisecond typical | Tie |
| Failure mode | Can panic on edge cases (Wiz citation) | Type-safe at parse | Cedar safer |

**Recommendation**: Pilot Cedar for one Boolean gate (a high-stakes, deterministic check such as signer-alias-canonical) with comparative replay-eval against the existing JavaScript implementation. Reserve OPA for cases needing complex multi-fact reasoning (none identified currently). If Cedar pilot lands with 100% replay-eval parity, promote Cedar to the canonical policy language for boolean gates.

**Sources**: openpolicyagent.org/docs, cedar-policy.dev, natoma.ai MCP access-control guide, wiz.io/academy OPA primer, devsecopsschool.com 2026 OPA guide, codilime.com OPA-for-AI-agents.

## 4. OpenTelemetry GenAI Semantic Conventions

`gen_ai.*` namespace exited experimental for client spans in early 2026 (per Uptrace + Elastic + OpenTelemetry blog April 2025 → 2026 maturity).

Current adoption in `scripts/global/event-schema-v3.js`: partial. Helper `isOtelGenAI()` exists but emission across all surfaces is incomplete. Specifically:

- `~/.megingjord/incidents.jsonl` — partial (event schema v3 supports `gen_ai.*` but legacy events lack it)
- `~/.megingjord/cache-stats.jsonl` — none
- `dashboard/events.jsonl` — partial
- KV surfaces — none (operational metrics, not span data)

**Phase-1 candidate**: emit `gen_ai.request.model`, `gen_ai.operation.name`, `gen_ai.system`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` for every governed provider call. Wrapper at `scripts/global/hamr-provider-wrapper.js` is the right insertion point.

**Sources**: opentelemetry.io/blog/2025/ai-agent-observability, uptrace.dev/blog/opentelemetry-ai-systems, elastic.co/blog/2026-observability-trends-generative-ai-opentelemetry, callsphere.ai blog.

## 5. ISO/IEC 42001 PDCA Mapping

Plan-Do-Check-Act AI Management System structure. Becoming de facto compliance standard alongside EU AI Act high-risk obligations (effective August 2, 2026).

| PDCA | Megingjord coverage | Gap |
|---|---|---|
| Plan | Manager scope + AC + gates per baton | None — strong |
| Do | Collaborator implements; signed commits | None — strong |
| Check | Admin gates + Consultant rubric + governance-audit | G10 not yet rubric-scored; rubric-v2 -> v3 needed |
| Act | Tier-1/2/3 anneal protocol; auto-file follow-on | Strong; could add formal PDCA-cycle metric |

**Phase-1 candidate**: emit a PDCA-cycle JSON artifact per Epic at terminal close; build ISO 42001 compliance evidence dossier.

**Sources**: insightassurance.com 2026 gold-standard piece, logicgate.com ISO 42001 guide, secureprivacy.ai implementation guide, ttms.com explainer, ey.com ethical-AI primer.

## 6. NIST AI Agent Standards Initiative (February 2026)

Announced February 2026; focused on enforceable security and identity standards for agentic architectures. Current public scope: identity, capability minimization, audit trail. Direct overlap with our team-and-model signing layer + baton single-thread invariant. No drop-in standard yet — track for adoption signals.

**Phase-1 candidate**: add NIST-aligned identity-layer test fixtures; document our team-and-model signing as candidate NIST-style identity primitive.

**Sources**: cited in goteleport.com OWASP coverage + codilime.com OPA-for-AI primer.

## 7. Self-Attribution Bias Research

arxiv 2603.04582 ("Self-Attribution Bias: When AI Monitors Go Easy on Themselves"), arxiv 2604.02174 ("Quantifying Self-Preservation Bias in Large Language Models").

Confirmed pattern: same-model rater inflates scores on its own work, largest on incorrect code and harmful actions — precisely where reliable self-monitoring matters most. Mitigations identified:

1. Deterministic evidence-box checklist (we already have this via rubric-v2 #1575).
2. Cross-family judge — independent model rates from different family. We have this (memory: qwen2.5-coder on fleet).
3. Pre-commit verifier agent — separate model checks output before submission. Microsoft Agent Governance Toolkit "Verifier" pattern.
4. Replay-eval against historical corpus — calibration without calendar threshold (we use this via Epic #1771).

Our rubric v2 + cross-family red-team practice + replay-eval is well-aligned. Gap: no pre-commit verifier agent; Phase-1 could add one as a wrapper around the consultant-checks.

**Sources**: arxiv.org/pdf/2603.04582, arxiv.org/pdf/2604.02174, augmentcode.com pre-merge verification guides.

## 8. Gap Matrix — Goal-by-Goal

| Goal | Enforcement gaps | Evidence gaps | Phase-1 candidate |
|---|---|---|---|
| G1 Governance | Policy scattered across hooks + workflows; no unified PDP/PEP split | OK | Policy-as-code unification pilot (Cedar) |
| G2 Quality | Rubric covers G1-G9 only; LLM-judge cross-check not composable in classifier | OK | Rubric v3 with G10 + LLM-judge composition spec |
| G3 Zero Cost | Cascade-dispatch present; OWASP-aligned per-tool cost cap absent | OK | Tool blast-radius declarations including cost cap |
| G4 Privacy | detect-secrets covers code/artifacts; agent memory writes not schema-validated | OK | Schema validation on auto-memory writes |
| G5 Portability | OK | OK | None at Phase-1 |
| G6 Resilience | Spillover + sticky-route present; explicit circuit-breaker contract per provider absent | OK | Circuit-breaker contract per provider |
| G7 Throughput | OK | OK | None at Phase-1 |
| G8 Observability | OTel `gen_ai.*` partial adoption | KV surfaces missing OTel | Full OTel GenAI adoption |
| G9 Interoperability | Cross-runtime tamper-evident inter-agent message format absent | OK | Inter-agent message-signing contract |
| G10 Maintainability | Not in rubric v2 | 100-line cap enforced; complexity ≤10 not enforced | Rubric v3 with G10 boxes; cyclomatic-complexity lint |

## 9. Phase-1 Candidate Slate (preliminary; R2 finalizes)

1. G10 reference parity across all 4 always-loaded surfaces (priority sentence, `goal_lens.py`, wiki pages).
2. Rubric v3 (`inventory/rubric-g1-g10-v3.json` + scorer + schema-validator update + classifier test).
3. OWASP Agentic Top 10 mapping in instructions + control-catalog row per risk.
4. OTel GenAI full adoption in `hamr-provider-wrapper.js` and all `*.jsonl` emitters.
5. Cedar policy-as-code pilot for one Boolean gate (signer-alias-canonical), with replay-eval parity check.
6. Cyclomatic-complexity lint (complement to existing 100-line cap) — G10 evidence box.
7. Goal-hijack-resistance test fixtures per OWASP risk #1.
8. Schema-validate auto-memory writes (G4 + memory-poisoning mitigation).
9. Tool-blast-radius declarations including per-tool cost cap (G3 + OWASP #2).
10. Inter-agent message-signing contract for cross-runtime baton handoffs (G9 + OWASP #6).
11. Programmatic enforcement audit gate that fails if any goal lacks Enforcement OR Evidence.
12. PDCA cycle artifact emission per Epic terminal close (ISO 42001 alignment + G8).

## 10. Open questions for R2 to resolve

- Which subset of the 12 candidates is in Phase-1 vs deferred? Constraints: realistic single-Epic scope, dependency ordering, A+ self-evaluation threshold.
- Order of execution: foundational (G10 parity + rubric v3) before vertical-by-goal experiments.
- Bundling strategy: which Phase-1 children share branch + PR per the multi-close batching contract.
- Adversarial red-team scoping: which fleet model + which areas the red-team covers (deferred from R1 to R2).

## References

- Parent Epic: #1962
- Sibling research: #1948 (bulletproof testing) + #1956 (cross-runtime config governance)
- Closed predecessors: #1024, #1103, #1105, #1113, #1339, #1530, #1575, #1746
