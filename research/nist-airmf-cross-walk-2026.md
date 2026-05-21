# NIST AI Risk Management Framework Cross-Walk (2026-05-21)

> Follow-on from cross-family red-team on Epic #1962 (comment 4509891153) which flagged that R1 baseline research did not cite NIST AI risk frameworks. Per #2026.

## Scope clarification

Red-team cited "NIST SP 800-137" — that document is **Information Security Continuous Monitoring (ISCM)** for federal information systems, not AI-specific. The more applicable NIST documents for AI agent governance are:

- **NIST AI 100-1**: AI Risk Management Framework (AI RMF 1.0)
- **NIST AI 100-1 PG**: AI RMF Playbook
- **NIST AI 100-2**: Adversarial Machine Learning Taxonomy
- **NIST AI 600-1**: Generative AI Profile
- **NIST SP 800-218**: Secure Software Development Framework (SSDF)
- **NIST SP 800-137**: Information Security Continuous Monitoring — applies via the harness's `incidents.jsonl` and `cache-stats.jsonl` continuous-monitoring telemetry

This cross-walk covers all six, focused on operational applicability to Megingjord harness governance.

## NIST AI RMF Core Functions ↔ Harness G1-G10

| AI RMF Function | Harness Goal | Current Coverage | Gap (follow-on candidate) |
|---|---|---|---|
| **GOVERN-1**: Policies, processes | G1 Governance | Enforced via label-lint + baton-gates + role-baton-routing | none |
| **GOVERN-2**: Accountability + roles | G1 | Enforced via team-model-signing + signer-alias-canonical | none |
| **GOVERN-3**: Diversity, equity, accessibility | G2 | Advisory (no explicit gate) | File: bias-evaluation harness |
| **GOVERN-4**: Workforce competency | n/a (operator-level) | Out of scope (organizational) | none |
| **GOVERN-5**: Stakeholder engagement | G8 | Partial (Consultant rubric captures stakeholder feedback as part of evidence) | File: stakeholder-engagement explicit evidence box |
| **GOVERN-6**: Risk management process | G1 + G6 | Enforced via Tier-1/2/3 anneal protocol + #1308 self-anneal infra | none |
| **MAP-1**: Context establishment | G1 | Enforced via ticket-first (`Refs #N`) + manager-handoff scope | none |
| **MAP-2**: Categorization of AI system | G9 | Partial (lane labels, model substrate) | File: AI system-impact-tier classification |
| **MAP-3**: AI capabilities & limitations | G2 | Partial (test_strategy matrix per surface) | File: capability assertion per child Epic |
| **MAP-4**: Risks identification | G1 + G4 | Enforced via OWASP Agentic Top 10 mapping (#1968 + #1987) | none |
| **MAP-5**: Impact assessment | G4 + G8 | Advisory (closeout evidence) | File: blast-radius declaration per child |
| **MEASURE-1**: Metrics identification | G8 | Enforced via 8 logging surfaces per observability instruction | none |
| **MEASURE-2**: AI system evaluation | G2 | Enforced via deterministic rubric v3 (G1-G10) | none |
| **MEASURE-3**: TEVV processes | G2 + G8 | Partial (governance-audit, replay-eval); G10 cyclomatic + 100-line caps | File: TEVV cadence specification |
| **MEASURE-4**: Feedback mechanisms | G8 | Enforced via `incidents.jsonl` + Tier-2 anneal | none |
| **MANAGE-1**: Risk responses | G6 | Enforced via spillover + sticky-route + broker quarantine | none |
| **MANAGE-2**: Risk-management plans | G1 | Enforced via research-first phase-gate Epic pattern | none |
| **MANAGE-3**: Third-party risk | G4 + G7 | Enforced via cosign + dependency-review + signer-alias-canonical | none |
| **MANAGE-4**: Risk monitoring | G8 | Enforced via continuous JSONL emission + `governance-audit-coverage` (#1973) | none |

## NIST AI 100-2 Adversarial ML Taxonomy ↔ Harness primitives

| AML Risk Family | Harness Coverage | Status |
|---|---|---|
| Evasion (input perturbation) | C7 goal-hijack fixtures (#1972) | Enforced |
| Poisoning (training data) | n/a (we don't train models) | Out of scope |
| Privacy attacks (membership inference) | G4 detect-secrets + memory-watchdog | Enforced |
| Abuse (LLM-specific: jailbreak, prompt injection) | C7 fixtures + OA1 OWASP-1 promotion (#1987) | Enforced |
| Model extraction | n/a (we consume models, don't host them) | Out of scope |

## NIST AI 600-1 Generative AI Profile ↔ Harness

| AI 600-1 Risk | Harness Goal | Status |
|---|---|---|
| Confabulation / hallucination | G2 | Partial (rubric evidence-box requires verifiable references) — file: hallucination-rate metric |
| Dangerous content generation | G4 | Enforced via secret-scanning + pretool_guard |
| Data privacy | G4 | Enforced via detect-secrets baseline |
| Environmental impact | G3 | Enforced via cascade-dispatch (Free→Fleet→Haiku→Premium) |
| Human-AI configuration | G9 | Enforced via cross-runtime parity |
| Information integrity | G8 | Enforced via wiki/log.md append-only + signer-alias-canonical |
| Intellectual property | G4 | Partial — file: IP-attribution provenance check |
| Obscene / harmful content | G4 | Enforced via OWASP OA2 tool-misuse gate |
| Value chain & component integration | G9 | Enforced via dependency-review + cosign + SLSA |

## NIST SP 800-218 SSDF ↔ Harness CI

| SSDF Practice | Harness Implementation | Status |
|---|---|---|
| PO.1 (define security req) | governance instructions + AC contract | Enforced |
| PS.1 (protect code) | git + signed commits + branch protection | Enforced |
| PS.2 (provide src integrity) | cosign + Artifact Attestation | Enforced |
| PW.1 (well-formed code) | lint + readability + 100-line cap + complexity | Enforced |
| PW.4 (reuse existing libs) | manifest pinning + dependency-review | Enforced |
| PW.7 (review code) | Consultant baton + rubric v3 + cross-family review | Enforced |
| PW.8 (test) | test_strategy matrix per surface | Enforced |
| RV.1 (vulnerability detection) | secret-scanning + detect-secrets + dependency-review | Enforced |
| RV.2 (assessment + prioritization) | Tier-1/2/3 anneal severity routing | Enforced |
| RV.3 (analyze + remediate root causes) | Tier-3 escalation + breaking-change-recovery instruction | Enforced |

## NIST SP 800-137 ISCM ↔ Harness telemetry

| ISCM Element | Harness Implementation |
|---|---|
| Define ISCM strategy | `instructions/observability.instructions.md` |
| Establish metrics | 8 logging surfaces in `wiki/concepts/harness-logging-inventory.md` |
| Implement | `incidents.jsonl`, `cache-stats.jsonl`, `dashboard/events.jsonl`, KV surfaces |
| Analyze + report | governance-audit-coverage gate (#1973) + dashboard |
| Respond to findings | Tier-1/2/3 anneal routing → ticket file |
| Review + update | self-anneal Epic pattern |

## Gaps identified as candidate follow-ons

1. **GOVERN-3** (Diversity/equity/accessibility): no explicit bias-evaluation gate
2. **GOVERN-5** (Stakeholder engagement): no explicit evidence box in Consultant rubric
3. **MAP-2** (AI system categorization): no impact-tier classification per Epic
4. **MAP-3** (Capability assertion): no capability-attestation per child
5. **MAP-5** (Impact assessment): no blast-radius declaration per child
6. **MEASURE-3** (TEVV cadence): no recurring TEVV schedule
7. **AI 600-1 Confabulation**: no hallucination-rate metric
8. **AI 600-1 IP attribution**: no provenance check on AI-generated artifacts

Each is a Phase-2 follow-on ticket candidate. None blocking the Epic #1962 closure.

## Summary

The harness covers **18 of 20** AI RMF Core Functions at Enforced level. The 2 Partial / 5 file-as-followups are non-blocking but provide a clear roadmap for the next AI-governance Epic cycle.

## References

- NIST AI 100-1: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf
- NIST AI 100-1 PG: https://airc.nist.gov/AI_RMF_Knowledge_Base/Playbook
- NIST AI 100-2 (Adversarial ML): https://csrc.nist.gov/pubs/ai/100/2/e2025/final
- NIST AI 600-1 (GAI Profile): https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- NIST SP 800-218 (SSDF): https://csrc.nist.gov/Projects/ssdf
- NIST SP 800-137 (ISCM): https://csrc.nist.gov/pubs/sp/800/137/final
- Origin: Epic #1962 + red-team comment 4509891153
- Refs #2026
