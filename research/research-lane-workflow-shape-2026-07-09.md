# Phase-0 Research — Research-Lane Baton Workflow Shape

> **Ticket:** #2263 (research-first Epic) · **Phase-1 impl child:** #3835
> **Lane:** `lane:docs-research` · **Strategy:** `peer-review`
> **Signed-by:** Nova Mason · **Team&Model:** claude-code:claude@local · **Role:** manager
>
> _Phase-0 groundwork (H1–H4 enumeration + 20-ticket audit) was drafted by a 2026-07-09
> Cursor session on the stranded branch `feat/2263-research-lane-shape`; it never landed. This
> is the adopted, re-signed, and consensus-strengthened finalization._

## Question

Does the research/docs lane (`lane:docs-research` / `lane:research`) need the Collaborator and
Admin baton phases — which assume git/CI work — or is that ceremony? (Epic #2263.)

## Overlap boundary (redundancy/conflict analysis)

| Ticket | Relationship |
|--------|--------------|
| #3583 | Owns Manager lane-**selection** guidance (which lane to pick). #2263 owns research-lane **shape** (roles within the lane). **Complementary.** |
| #3576 | Dormant parent epic of #3583 — no conflict. |
| #3569 | Closed — stop-gate lane carve-out already shipped. |
| #2258 / #2268 | `lane:no-code-remediation` (Manager→Consultant) = the H1 shape for *issue-only* work; distinct from research-with-synthesis. |
| Epic #2261 | CLOSED — delivered the deterministic-guardrail harness. The shipped enforcement is the `baton-gates.yml` lightweight-lane list (NOT an OPA rule). |

## AC1 — H1–H4 tradeoff matrix (goal-lens)

| Hypothesis | Workflow | G1 Gov | G2 Quality | G3 Cost | G8 Observability | Verdict |
|------------|----------|--------|------------|---------|------------------|---------|
| H1 | M→Consultant | Medium | Medium | High | Low — no synthesis signer | Reject |
| H2 | M→Admin→Consultant | Medium | Low — skips synthesis role | Medium | Medium | Reject |
| H3 | M→Collab→Admin→Consultant (status quo) | High | High | Low — ceremony noise | High | Reject (drift) |
| **H3-prime** | **M→Collab(synthesis)→Consultant; Admin N/A unless PR** | **High** | **High** | **High** | **High** | **CHOSEN** |
| H4 | M→Researcher→Adversary→Consultant | High | High | Low — new taxonomy churn | High | Defer (#3069) |

**Chosen: H3-prime.** Collaborator remains substantive (synthesis author). Admin is dropped by
default because CI (`baton-gates.yml`) already skips the collaborator/admin/consultant gates for
lightweight lanes and the audit shows Admin is ceremonial for research. Consultant retains
independent rubric authority (the substantive quality gate for `peer-review`).

## AC2 — 20-ticket sampling audit (closed `lane:docs-research`)

Sample: #3488, #3426, #3415, #3399, #3384, #3381, #3368, #3335, #3299, #3296, #3271, #3254,
#3253, #3252, #3163, #3148, #3138, #3125, #3022, #2982.

| Metric | Count |
|--------|-------|
| Full 4-artifact ceremony | 11/20 |
| Admin N/A or branch N/A (ceremonial) | 10/20 |
| Substantive Collaborator synthesis | 10/20 |
| Consultant-only (no Collab/Admin) | 3/20 |

**Signal:** Collaborator artifacts carry deliverable substance; Admin artifacts are frequently
N/A prose. **Ceremony exceeds enforcement → instruction/CI drift confirmed.**

## AC3 — Cross-model ≥90 consensus (rescoped from "cross-team Codex+Copilot")

The original AC3 ("Codex and Copilot teams agree") is rescoped to a **cross-model ≥90
disjoint-family council** — the sanctioned autonomous substitute (the client is design/UAT only;
cross-team human sign-off is not solo-executable). This also satisfies the #3826 plan-rating
receipt now required to promote/close a green research-first Phase-0.

| Family | Model | Score | Verdict |
|--------|-------|-------|---------|
| mistral | mistral-large-latest | 95 | PASS |
| meta | llama-3.3-70b @groq | 95 | PASS |
| google | gemma-4-31b @nvidia | 96 | PASS |

**median 95, min 95, 3 disjoint families, Gwet AC1 = 1.0** (unanimous meets-bar, chance-corrected).
Verified `kind:review` receipt `05fd75bf1c7f8dba` in `governance/cross-family-consensus.jsonl`
(meta + mistral PASS, ≥2 non-authoring families). Each rater cited the actual files
(`baton-gates.yml`, the DoD table, the audit). (Supersedes the stranded single-groq 85/100.)

## AC4 — Guardrail alignment (rescoped from "OPA rule")

Epic #2261 shipped the guardrail harness; the enforcement source of truth is the
`baton-gates.yml` lightweight-lane list — it already skips `collaborator-gate` / `admin-gate` /
`consultant-gate` for `lane:docs-research` / `lane:research` / `lane:config-only` /
`lane:no-code-remediation` / `lane:docs-only` / `lane:trivial`. **No new OPA rule is required.**
The remaining work is the instruction reconciliation (AC5), delivered by child #3835.

## AC5 — Instruction change (delivered in this change)

`instructions/role-baton-routing.instructions.md` Multi-Lane DoD:
- `research` row → `Manager→Collab(synthesis)→Consultant`; `ADMIN_HANDOFF: N/A unless PR`.
- New **Research lane contract (Refs #2263)** section: eligibility, role sequence, N/A markers,
  enforcement-alignment to `baton-gates.yml`, escalation to `lane:code-change` /
  `lane:no-code-remediation`.
