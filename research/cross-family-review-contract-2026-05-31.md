---
title: "Cross-family review contract (Phase-0 #2515 of Epic #2511)"
date: 2026-05-31
epic: 2511
ticket: 2515
lane: docs-research
test_strategy: peer-review
status: draft
---

# Cross-family review contract

Phase-0 synthesis for Epic #2511. Single canonical document harmonizing per-baton-role cross-family review obligations. Reconciles work currently scattered across Epic #2192, closed Epic #2414 family (#2437/#2438/#2439, now reparented to this Epic), Epic #1899, #2509, #2510.

## Why this contract exists

Today (2026-05-31) the harness has substantial cross-family review infrastructure spread across multiple Epics with no single canonical reference. The cross-family rater (qwen-7b for fast, qwen-32b for high-stakes on Tailscale fleet) is used episodically rather than systematically. Each role's review requirement is being designed in different Epics with different conventions. Without a single contract:

- Validators may diverge
- Operators won't know which to invoke when
- Cross-family rater becomes another opt-in tool nobody is required to use

This contract codifies WHO must request cross-family review, WHEN, WHAT family is acceptable, HOW the invocation works, and what enforcement applies.

## 4-role × 5-lifecycle-point coverage matrix

```
                  │ Pre-handoff │ At-handoff │ Mid-phase │ Pre-merge │ Post-merge │
──────────────────┼─────────────┼────────────┼───────────┼───────────┼────────────┤
 Manager          │     N/A     │ EPIC_RESCO │    N/A    │    N/A    │ EPIC_PROG  │
                  │             │ PE consult │           │           │ RESS UPDATE│
──────────────────┼─────────────┼────────────┼───────────┼───────────┼────────────┤
 Collaborator     │ #2438 + 2439│ HANDOFF    │  optional │     N/A   │    N/A     │
                  │ HARD-GATE   │ schema CF  │  fleet    │           │            │
                  │             │ rating req │  review   │           │            │
──────────────────┼─────────────┼────────────┼───────────┼───────────┼────────────┤
 Admin            │ #2510 verify│ HANDOFF    │ pre-merge │ Hard-gate │    N/A     │
                  │ CF rating   │ signer ≠   │ review    │ CI green  │            │
                  │ present     │ collab     │ agents    │ verified  │            │
──────────────────┼─────────────┼────────────┼───────────┼───────────┼────────────┤
 Consultant       │ Epic #2192  │ rubric +   │    N/A    │    N/A    │ rubric in  │
                  │ HARD-GATE   │ G1-G10     │           │           │ CLOSEOUT   │
                  │ fleet review│ score req  │           │           │            │
──────────────────┴─────────────┴────────────┴───────────┴───────────┴────────────┘

 + Operator-internal decisions: #2509 fleet-decision-oracle (any time)
 + Skill-level wrapper: Epic #1899 cross-team adversarial red-team review
```

## Family-independence rule

The reviewing model MUST be from a DIFFERENT family than the reviewed work's author:

| Author family | Acceptable reviewer families | Recommended (fleet, G3 free) |
|---|---|---|
| Anthropic (Claude Code) | Qwen (Alibaba), OpenAI, Google | qwen-2.5-coder:7b or 32b on Tailscale |
| OpenAI (Codex) | Qwen, Anthropic, Google | qwen on Tailscale; Claude as fallback |
| Microsoft/GitHub (Copilot) | Qwen, Anthropic, OpenAI, Google | qwen on Tailscale |
| Google (Antigravity) | Qwen, Anthropic, OpenAI | qwen on Tailscale |

The "fleet first" pattern (G3 zero-cost) is the default. Paid-provider lanes only when fleet inconclusive AND review is high-stakes.

## Per-role obligations (canonical)

### Manager (#2511 contributes, no new ticket)
- AT-HANDOFF: EPIC_RESCOPE / CONSULTANT_EPIC_CLOSEOUT calls cross-family rater when Epic ACs are ambiguous OR Epic spans ≥3 baton cycles
- POST-MERGE: Epic Progress Update may include fleet-rater verdict citation if quality-relevant

### Collaborator (#2438 + #2439)
- PRE-HANDOFF: #2438 quality gate script runs lint + tests + doc-coverage validation + fleet rater BEFORE writing COLLABORATOR_HANDOFF
- AT-HANDOFF: #2439 schema requires `cross_family_rating` field with rater family + verdict + rubric

### Admin (#2510)
- PRE-HANDOFF: #2510 verifies cross_family_rating field present + from genuinely different family + threshold met
- AT-HANDOFF: signer-independence check (admin alias ≠ collaborator alias)
- PRE-MERGE: pre-merge-review/ agents include CF-rater sub-agent for diff-level review

### Consultant (Epic #2192)
- PRE-HANDOFF: Epic #2192 hard-gate enforces fleet review fired at Consultant phase, NOT skipped under time pressure
- AT-HANDOFF: rubric scoring G1-G10 with cross-family verdict citation

### Operator (#2509)
- ANY TIME: routine yes/no dev decisions route through fleet-decision-oracle FIRST; escalate to client only on inconclusive

## Enforcement hierarchy

```
HARD-GATE (CI blocks merge):
  - Epic #2192 Phase-1 (Consultant fleet review required)
  - #2438 Phase-1 (Collaborator pre-handoff gate)
  - #2439 Phase-1 (HANDOFF schema cross_family_rating field)
  - #2510 Phase-1 (Admin verifies field present + valid)

ADVISORY (warn, do not block):
  - #2437 doc-coverage sub-agent (advisory diagnostic)
  - #2509 fleet-decision-oracle (advisory; operator-discipline)
  - Epic #1899 skill (advisory invocation pattern)
```

## Phase-1 child slate (proposed; NOT BINDING — iter-1+ may revise)

1. **AC1**: Author `scripts/global/cross-family-review-contract.js` — shared library that all role-specific validators import for: family-independence check, rubric parse, verdict normalization
2. **AC2**: Refactor #2438 + #2439 + #2510 + Epic #2192 validators to consume the shared library (eliminates per-validator drift)
3. **AC3**: Add `instructions/cross-family-review-contract.instructions.md` referencing this design doc
4. **AC4**: Migrate `inventory/team-model-signatures.json` to declare family field per entry (so family-independence check has registry source-of-truth)
5. **AC5**: Operator skill `xfam-review` (alias of Epic #1899 surface) for ad-hoc invocation from any baton role

## Open questions for Phase-1

1. Should `family` be a frozen enum (anthropic | openai | google | microsoft | alibaba | meta | ...) or computed from team-model registry?
2. What's the rubric-disagreement-tolerance threshold (qwen-32b says 5, Claude self-rates 9 — what do we do)?
3. Should #2509 fleet-decision-oracle BECOME the canonical invocation for ALL roles, or stay operator-specific?
4. How does this contract interact with Antigravity team (separate process; #2362 advisory guard only)?

## Honest scope guard

This Phase-0 deliberately DEFERS:
- Tier-2/3 cross-workspace coordination review (#2490)
- Per-paid-provider cost gating (#2451 + HAMR provider wrapper handles)
- Cross-runtime conformance tests (Epic #2192 AC-E6 already includes)

## Sources

- Epic #2192 (Consultant hard-gate fleet review) + #2193 Phase-0
- closed Epic #2414 + reparented children #2437 #2438 #2439
- Epic #1899 (cross-team adversarial red-team review skill)
- #2509 (operator fleet-decision-oracle, shipped today)
- #2510 (Admin-phase verification, filed today)
- memory: feedback-cross-family-review-model-choice
- memory: feedback-route-decisions-to-fleet-not-client (just written today via #2509)
