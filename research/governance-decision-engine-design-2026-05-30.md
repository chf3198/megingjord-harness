---
title: "Governance decision engine design (Phase-1 #2373 of Epic #2356)"
date: 2026-05-30
epic: 2356
ticket: 2373
lane: docs-research
test_strategy: peer-review
status: draft
---

# Governance decision engine — design spec

Phase-1 design deliverable for Epic #2356 (Harden governance guardrails). Specifies the schema + contract for the decision engine that replaces hardcoded per-validator gating logic with a single policy-driven evaluator. Implementation is a separate future child.

## Background

Phase-0 audit `research/governance-guardrail-audit-2026-05-28.md` §2 established the gap: process compliance is voluntary across multiple surfaces; lightweight lanes (docs-research, trivial, no-code-remediation, docs-only) bypass CI baton-gates entirely. Audit recommended Phase-1 implementation order step 1 = policy data + step 2 = engine.

This ticket covers step 1.

## AC1: Policy schema

Location: `config/governance-decision-policy.json`

Top-level shape:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "version": 1,
  "transitions": {
    "manager_to_collaborator": { "default_check_set": "full", "lane_overrides": {...} },
    "collaborator_to_admin":   { "default_check_set": "full", "lane_overrides": {...} },
    "admin_to_consultant":     { "default_check_set": "full", "lane_overrides": {...} },
    "consultant_to_done":      { "default_check_set": "full", "lane_overrides": {...} }
  },
  "check_sets": {
    "full": ["signer-fidelity", "test-evidence", "doc-coverage", "merge-evidence", "lint-required"],
    "docs": ["signer-fidelity", "doc-coverage", "lint-md"],
    "trivial": ["signer-fidelity", "lint-required"],
    "no-code": ["signer-fidelity"]
  },
  "runtime_profiles": {
    "ci":     { "all_checks_blocking": true },
    "local":  { "advisory_after": ["doc-coverage"] },
    "offline": { "skip": ["merge-evidence"] }
  }
}
```

Per-transition × per-lane resolution: `transitions[T].lane_overrides[lane] ?? transitions[T].default_check_set` → `check_sets[<name>]` → list of check IDs to run.

## AC2: Engine contract

```
evaluate(context) -> Decision

context: {
  transition: "manager_to_collaborator" | ...,
  lane: "code-change" | "docs-research" | "trivial" | "no-code-remediation" | "config-only",
  runtime_profile: "ci" | "local" | "offline",
  ticket: { number, labels, comments[], pr_state },
  inputs: { ... per-check evidence ... }
}

Decision: {
  decision: "allow" | "block" | "advisory",
  checks: [ { id, status: "pass"|"fail"|"skip", reason, evidence_ref } ],
  degradations: [ { reason, applied_by_profile } ],
  audit_trace: { policy_version, resolved_check_set, timestamp, signer? }
}
```

- Engine is pure (no IO, no subprocess) — checks receive pre-collected inputs
- Each check is a small pluggable module conforming to `(context) -> CheckResult`
- Audit trace is appended to `~/.megingjord/baton-events.jsonl` per Epic #2451 Move 2 schema v3

## AC3: Per-lane check-set assignment

Per audit §3 quantitative table:

| Lane | Manager→Collab | Collab→Admin | Admin→Consultant | Consultant→done |
|---|---|---|---|---|
| code-change | full | full | full | full |
| docs-research | docs | docs | docs | docs |
| config-only | trivial | trivial | full | full |
| no-code-remediation | no-code | (skipped) | (skipped) | no-code |
| trivial | trivial | trivial | trivial | trivial |

Rationale: lightweight lanes carry lighter sets — but NEVER zero. `signer-fidelity` is universal: every lane verifies that the artifact author matches the registry alias.

## AC4: Migration plan

Three phases:

1. **Shadow mode** (2 weeks): engine runs alongside current hardcoded validators; emits decision events to `baton-events.jsonl` without enforcing. Operators compare engine decisions to ground-truth.
2. **Cutover** (1 week per lane): one lane at a time switches enforcement source from hardcoded → engine. Order: `trivial` → `no-code-remediation` → `docs-research` → `config-only` → `code-change`. Each cutover gated on shadow-mode agreement ≥99%.
3. **Removal** (post-cutover): hardcoded per-validator logic deleted; engine is sole source.

Feature flag: `MEGINGJORD_DECISION_ENGINE` env var; off by default during shadow mode.

## AC5: Cross-link to sibling work

- Epic #2356 (parent) — broader guardrail hardening
- #2357 (Phase-0 audit, closed via PR #2359) — the `research/governance-guardrail-audit-2026-05-28.md` evidence base
- #2441 (sibling, closed) — orphan wiki stubs restored for wikilink integrity
- Epic #2451 Move 2 (#2457, shipped) — `baton-events.jsonl` schema v3 that engine emits to
- Epic #1297 (Policy-as-Code substrate eval, P3 backlog) — adjacent; the engine's policy schema is a candidate for Cedar/OPA migration later

## Out of scope (deferred)

- Engine implementation (`scripts/global/governance-decision-engine.js`) — separate Phase-1 child filed after this design accepted
- Migration of existing per-validator logic into pluggable check modules — separate phase
- Cedar/OPA substrate migration (#1297 scope)
