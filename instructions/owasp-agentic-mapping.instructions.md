---
name: OWASP Agentic Top 10 Risk Mapping
description: Maps OWASP Top 10 for Agentic Applications (Dec 2025) to harness goals, current enforcement coverage, and candidate mitigations. Load when assessing agentic security posture.
applyTo: "**"
---

# OWASP Top 10 for Agentic Applications — Harness Mapping

Source: OWASP Top 10 for Agentic Applications (December 2025; 2026 effective).

## Risk Mapping Table

| # | Risk | Harness Goals | Current Coverage | Candidate Mitigation |
|---|---|---|---|---|
| OA1 | Goal Hijacking | G1 G2 | Advisory (`operator-identity-context`, ticket-first) | Goal-hijack-resistance test fixtures; separate planning from execution |
| OA2 | Tool Misuse | G1 G4 | **Enforced** (`pretool_guard.py`, permissions allowlist) | Per-tool blast-radius declarations |
| OA3 | Identity Abuse | G1 G4 | **Enforced** (`team-model-signing`, signer-alias-canonical) | Cross-family signer-independence tests |
| OA4 | Memory Poisoning | G2 G4 | Partial (`memory-watchdog`) | Schema validation on auto-memory writes |
| OA5 | Cascading Failures | G6 | Partial (header-spillover, sticky-route TTL) | Explicit circuit-breaker contracts |
| OA6 | Rogue Agents | G1 G9 | **Enforced** (broker quarantine, baton single-thread) | Inter-agent message tamper-evidence |
| OA7 | Supply Chain | G4 | **Enforced** (dependency-review, secret-scanning, cosign) | SLSA provenance + Artifact Attestation |
| OA8 | Insecure Communications | G4 | Partial (DPoP for HAMR; not all cross-runtime comms) | Zero-trust mesh for cross-runtime baton |
| OA9 | Human-Agent Trust Exploitation | G1 G8 | Advisory (closeout evidence required) | Tamper-evident audit ledger (wiki/log.md) |
| OA10 | Code Execution | G4 | **Enforced** (no LLM eval, no shell from prompts) | Sandbox boundaries auditable |

## Coverage Classification Legend

- **Enforced**: deterministic gate; blocks on violation
- **Partial**: guardrail present; gaps identified; advisory on breach
- **Advisory**: guidance required; no blocking gate today

## Relationship to Harness Goals

Every OA risk maps to one or more G1-G10 goals:

- G1 Governance: OA1, OA2, OA3, OA6, OA9
- G2 Quality: OA1, OA4
- G4 Privacy & Security: OA2, OA3, OA4, OA7, OA8, OA10
- G6 Resilience: OA5
- G8 Observability: OA9
- G9 Interoperability: OA6

## Sources

- Research: `research/goal-enforcement-2026-05-19.md` §2 (Phase-0 R1, Refs #1963 AC3)
- goteleport.com/blog/owasp-top-10-agentic-applications
- paloaltonetworks.com/blog/cloud-security/owasp-agentic-ai-security

## Related

- `wiki/concepts/harness-goal-controls.md` — per-goal enforcement catalog with OWASP risk rows
- `instructions/harness-goals.instructions.md` — canonical G1-G10 definitions
- `instructions/global-standards.instructions.md` — always-loaded priority sentence
