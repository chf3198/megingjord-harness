# Phase-0 Research — Research-Lane Baton Workflow Shape

> **Ticket:** #2263 (research-first Epic) · **Date:** 2026-07-09
> **Lane:** `lane:docs-research` · **Strategy:** `peer-review`
> **Signed-by:** Cyrus Harper · **Team&Model:** cursor:claude-sonnet-4@cursor-ide

## Overlap boundary

| Ticket | Relationship |
|--------|--------------|
| #3583 | Consumes this deliverable for lane-selection guidance — complementary |
| #3576 | Dormant parent of #3583 — no conflict |
| #3569 | Closed — lane carve-out shipped |
| #2258/#2268 | `no-code-remediation` lane — distinct (issue-only, no synthesis) |

`overlap_decision:` proceed — #2263 owns research-lane shape; #3583 owns Manager lane-selection table.

## AC1 — H1–H4 tradeoff matrix

| Hypothesis | Workflow | G1 Gov | G2 Quality | G3 Cost | G8 Observability | Verdict |
|------------|----------|--------|------------|---------|------------------|---------|
| H1 | M→Consultant | Medium | Medium | High | Low — no synthesis signer | Reject |
| H2 | M→Admin→Consultant | Medium | Low — skips synthesis role | Medium | Medium | Reject |
| H3 | M→Collab→Admin→Consultant (status quo) | High | High | Low — ceremony noise | High | Partial |
| **H3-prime** | **M→Collab→Consultant; Admin N/A unless PR** | **High** | **High** | **High** | **High** | **Chosen** |
| H4 | M→Researcher→Adversary→Consultant | High | High | Low — new taxonomy | High | Defer (#3069) |

**Chosen: H3-prime.** Collaborator remains substantive (synthesis author). Admin dropped by default
because CI (`baton-gates.yml`) already skips collab+admin gates for lightweight lanes; 10/20 closed
tickets posted ceremonial Admin N/A. Consultant retains independent rubric authority.

## AC2 — 20-ticket sampling audit

Sample: #3488, #3426, #3415, #3399, #3384, #3381, #3368, #3335, #3299, #3296, #3271, #3254,
#3253, #3252, #3163, #3148, #3138, #3125, #3022, #2982.

| Metric | Count |
|--------|-------|
| Full 4-artifact ceremony | 11/20 |
| Admin N/A or branch N/A | 10/20 |
| Substantive Collaborator | 10/20 |
| Consultant-only (no Collab/Admin) | 3/20 |

**Signal:** Collaborator artifacts carry deliverable substance; Admin artifacts are often N/A prose.
Ceremony exceeds enforcement — instruction/CI drift confirmed.

## AC3 — Cross-model consensus

```
RESEARCH_REDTEAM_ACCEPT: score=85/100 | reviewer=groq@free-cloud | iterations=1
VERDICT: ACCEPT — H3-prime aligns governance, reduces ceremony, preserves Consultant independence.
```

## AC4 — Guardrail alignment

Epic #2261 shipped. Enforcement source of truth: `baton-gates.yml` lightweight lane list
(`lane:docs-research`, `lane:research`, etc.) skips collaborator-gate and admin-gate.
No new OPA rule required — instruction alignment is the Phase-1 deliverable.

## AC5 — Instruction change (summary)

Update `instructions/role-baton-routing.instructions.md` Multi-Lane DoD:

- `research` row: `Manager→Collab(synthesis)→Consultant`
- N/A markers: `ADMIN_HANDOFF: N/A unless PR exists`
- Add research-lane contract section (Refs #2263)
