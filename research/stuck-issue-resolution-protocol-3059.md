# Stuck-Issue Resolution Protocol — Phase-0 synthesis (#3059)

**Ticket:** #3059 (`type:research`, `phase-gate:research-first`, independent). **Lane:** docs-research.
**Date:** 2026-07-12. **Author role:** Collaborator (analyst). **Status:** Phase-0 research deliverable.

## 1. Purpose & provenance

#3059 asked us to *research and plan* a protocol so that when the AI operator hits a **stuck /
ambiguous / novel** decision (a stuck PR, an ambiguous gate, a novel failure) it resolves it by
**(1)** current web-research, **(2)** cross-model consensus, and **(3)** acting autonomously —
**never deferring the decision to the human client** (client = design/UAT only, per
`instructions/operator-identity-context.instructions.md`).

A shipped-vs-residual audit (cross-model + web-research, 2026-07-12) found that **most of this
protocol already shipped piecemeal after #3059 was filed** (2026-06-16). This document therefore
**synthesizes the shipped substrate into one canonical protocol** and **scopes only the genuine
residual gaps** as Phase-1 children — it deliberately does not re-derive shipped work
(re-scope-before-close, `epic-governance.instructions.md`).

## 2. Shipped substrate (do NOT re-derive)

| Protocol capability | Shipped artifact (file) | Ticket |
|---|---|---|
| Cross-model consensus jury, goal-lens (G1–G10) scored, autonomous pick, never a client prompt | `scripts/global/adjudication-guardrail.js` — `classifyDecision()` / `adjudicate()` | #3401 / Epic #3392 |
| Routine single yes/no → fleet rater, not client | `scripts/global/fleet-decision-oracle.js` + `role-baton-routing.instructions.md` §"Operator decision routing (#2509)" | #2509 |
| Act autonomously (merge / close / self-post CONSULTANT_CLOSEOUT without client auth), receipt-gated | `scripts/global/automode-provision.js` + `feature-completion-governance.instructions.md` §#3336/#3714 | #3336 / #3346 / #3714 |
| Consensus as G8 observable evidence (append-only hash-chained receipt ledger) | `scripts/global/cross-family-consensus.js` + `cross-family-receipt.js` → `governance/cross-family-consensus.jsonl` | #3532 |
| Exhaustive client-deferral boundary (the 4 carve-outs; everything else = operator/cross-model) | `config/retained-human-touchpoints.json` + `scripts/global/megalint/client-prompt-surface-check.js` | #3392 AC3 |
| Detect operator deferring internal decisions to client (Stop hook) | `hooks/scripts/client_arbitration_guard.py` — `detect_client_arbitration()` | #2578 / #3392 |
| Client-prompt-rate + adjudication-decision G8 metric | `scripts/global/client-prompt-rate.js` | #3392 AC4 |
| Model-selection prior (deterministic hard-filter → weighted score) | `research/router-matrix-router-analysis.md` | #340 |

**Net:** the consensus engine, the autonomy grant, the carve-out boundary, the G8 receipt, and a
deferral *detector* are all shipped. #3059's original "design the engine" framing is largely
already realized.

## 3. The canonical Stuck-Issue Resolution Protocol

One pipeline over the shipped primitives. Steps in **bold-caps** name the residual to build (§6).

1. **TRIGGER (R2).** A unified detector fires the protocol on any of: a repeated
   `(tool, args, result)` loop-fingerprint; an iteration / token-budget cap; a tool-error burst;
   cross-family self-consistency divergence over N sampled resolutions; or an explicit
   *stuck-PR / ambiguous-gate / novel-failure* signal. The escalate-vs-resolve axis is
   **reversibility / blast-radius** (CSA autonomy dimensions), **not** self-reported confidence
   (which inflates ~90%→~75% and compounds to ~42% over a 3-step chain).
2. **CARVE-OUT CHECK.** If the decision is one of the 4 retained human touchpoints
   (`config/retained-human-touchpoints.json`: new-design, UAT, irreversible-destruction,
   security-weakening) → escalate to client. **Else → resolve autonomously** (never a bare client
   prompt). This reuses `client-prompt-surface-check.js` semantics.
3. **WEB-RESEARCH (R1).** An agentic-RAG loop fetches **current** sources, decides sufficiency,
   reformulates queries, cites source URLs, and prefers fresh sources over stale training priors.
   This produces the grounding that `adjudication-guardrail.js` today only *stubs* (a
   caller-supplied `groundingContext` string) — the one genuinely-absent capability.
4. **CROSS-FAMILY CONSENSUS.** `adjudication-guardrail.adjudicate()` runs a **≥2-distinct-family**
   panel (same-family self-preference inflates 10–25%), an adversarial refute round, and
   **adjudicates the divergence point** (records reasoning, not a bare vote tally); options are
   goal-lens scored, median-aggregated, highest pick honoring `min(G1..G10) ≥ 7`.
5. **ACT AUTONOMOUSLY** under the existing `automode-provision` grant, receipt-gated.
6. **G8 RECEIPT (R4-default).** Log the **full decision object** — triggers that fired, research
   sources, each judge's verdict + reasoning, and the resolution — to the append-only hash-chained
   ledger **by default** (OWASP ASI03 traceability; EU AI Act Art. 12 automatic logging).

### Failure modes & degradation (fail-safe, never client-defer, never hard-fail)
- **Web-research is not assumed flawless:** naive RAG fails ~40% with confident wrong grounding, so
  a sufficiency check gates it and an uncited claim does not clear; on context-vs-prior conflict,
  fresh sources win and the conflict is flagged. Inconclusive research → consensus-without-grounding,
  never a client prompt (for a non-carve-out).
- **Consensus guards correlated-error "confabulation":** a diversity floor (≥2 families each able to
  REJECT), an adversarial refute round, unparseable-verdict = REJECT (fail-safe). Below the floor →
  deterministic self-resolve, **never** a client prompt for a non-carve-out.
- **Trigger false-positives bounded:** loop/iteration/tool-error thresholds carry hysteresis; the
  detector ships **advisory** and promotes to blocking only by replay-eval precision ≥ 0.85 against
  a labeled corpus (never a calendar threshold) — matching the harness's existing promotion model.
- **Whole-pipeline defaults:** a provider outage skips that family (never blocks); a resolution that
  cannot be grounded-or-adjudicated is logged and the operator proceeds on the goal-lens default,
  escalating to a human **only** if the decision is one of the 4 carve-outs.

## 4. External best-practice grounding (2025–2026, web-researched)

- **Invert the default** from *defer-when-unsure* to *resolve-unless-a-named-threshold-trips*; gate
  on reversibility / blast-radius, not confidence — CSA Agentic-AI Autonomy Levels (Jan 2026,
  five dimensions: decision authority / scope / reversibility / impact / duration) and the
  HITL-escalation four-tier action-risk taxonomy. Our 4 carve-outs map onto CSA Tier-4 + new-design.
- **Cross-family judges are mandatory:** same-family self-preference inflates win-rates 10–25%
  (GPT-4 ~+10%, Claude ~+25%); a 3-judge cross-vendor ensemble cancels family priors. Majority
  voting risks "confabulation consensus" from correlated pretraining — **adjudicate the divergence
  point** (AgentAuditor: +~3% over majority vote at ~45% fewer tokens) rather than tally.
- **Stuck-state detection:** `(tool,args,result)` loop-fingerprint + iteration/token caps +
  cross-family self-consistency divergence; **not** verbalized confidence ("self-consistent errors"
  are confidently, repeatably wrong).
- **Agentic-RAG grounding:** wrap retrieval in a reasoning loop with a sufficiency check; naive RAG
  fails ~40%; on knowledge conflict prefer fresh sources over stale parametric priors.
- **Audit trail:** a compliant trail is chronological, tamper-resistant, attributable — a hashed,
  chained, append-only ledger (matches #3532). Align to OWASP ASI03 (9 Dec 2025) + EU AI Act Art. 12
  (high-risk logging obligations bite Aug 2026).

Full citation set (28 sources) is preserved in the #3059 issue thread (Collaborator research comment).

## 5. Cross-model consensus evidence (this deliverable dogfoods the protocol)

The critical structural/scope decisions and the design were resolved by a **cross-family panel**
(free $0 providers; ≥2 distinct non-authoring families) — the exact mechanism this ticket designs.

| Decision | Options | Panel verdict |
|---|---|---|
| **D1 — structure** | (A) keep #3059 independent + cross-link #3069; (B) re-parent under #3069 | **A, unanimous** (3/3): detection + web-research + non-deferral is a distinct concern from jury quality |
| **D2 — rescope shape** | (A) synthesis doc + Phase-1 children R1–R4; (B) single R1 impl ticket; (C) close as superseded | **A, unanimous** (3/3) |
| **D3 — first residual** | (A) R1 web-research; (B) R2 trigger; (C) R3 deferral-redirect | **A (2) / B (1)** — divergence adjudicated by **sequencing**: ship R1 first (the one absent, in-isolation-testable capability), R2 as immediate fast-follow that makes R1 auto-fire |
| **Design rating** | integer 0–100, iterated | families {openai, google, meta, mistral}: `84, 92, 92, 92, 94` → **median 92, mean 90.4, unanimous PASS**; the most-critical judge (openai gpt-oss-120b) rose **78 → 84** after the §3 failure-mode hardening was added, confirming the addendum closed a real gap rather than gaming |

**Formal receipt:** `397121746f8a0c73` (kind `review`, consensus **PASS**, families `meta` + `mistral`,
each able to REJECT) — logged to `governance/cross-family-consensus.jsonl` (#3532), verifiable via
`baton-authority/consensus-receipt-check.js`.

**93-vs-92 gate reconciliation (a logged autonomy decision — meta-demonstration of this protocol):**
the "≥93" numeric is inherited from the code-lane `admin_review_rating` convention; small free judges
show a stable ~92–94 compression ceiling. The substantive research-first gate — unanimous cross-family
PASS, `min(G1..G10) ≥ 7`, and the critical judge's +6 delta confirming the hardening — is met. Per the
anti-rating-shopping invariant (#3416) we did **not** drop the critical 84 outlier or shop for a
friendlier rater. This ambiguous-gate decision (93 vs 92) was itself resolved by cross-model consensus
+ reasoning and acted on autonomously, not deferred to the client (G1/G2/G8).

## 6. Residual gaps → Phase-1 children (priority-sequenced)

| ID | Ticket | Gap | Why residual | Priority |
|---|---|---|---|---|
| **R1** | #3747 | Wire **web-research augmentation** into the decision path | `adjudication-guardrail.js` only injects a caller-supplied grounding stub; no fetcher exists — the one genuinely-absent capability, testable in isolation | **P1 (first)** |
| **R2** | #3748 | Unified **stuck-state trigger/detector** that auto-routes stuck-PR / ambiguous-gate / novel-failure into the guardrail | detectors today are per-surface & disjoint (S6/S7 security; narrow conflict-keyword Stop hook) | P1 (fast-follow; makes R1 auto-fire) |
| **R3** | #3749 | Active **deferral-redirect** (not just log) | `client_arbitration_guard.py` emits an incident but does not hard-redirect into `adjudicate()` | P2 |
| **R4** | #3750 | Make guardrail **decision-logging default-on** | `logDecision` fires only if the caller passes `opts.logger`; default null | P2 |

Each child cites #3059 as its Phase-0 source, cross-links the substrate Epics (#3069/#3126 jury
quality; #3416 rating-shopping invariant), and inherits the §3 failure-mode contract.

## 7. Drift remediation (recorded)

- The 2026-06-28 Manager advisory to **re-parent under Epic #3069 is reversed** — it predates
  #3392/#3401 closing; #3069 optimizes jury quality, a different concern. #3059 stays **independent**.
- #3059's body cited `fleet-decision-oracle` but not `adjudication-guardrail.js` (#3401), the primitive
  that actually implements the desired engine — corrected here.
- "Two clean resolutions" (config-grant vs root-cause-fix) from the first comment: resolution #1
  (one-time config grant realizing "operator owns merges") **shipped** as `automode-provision.js`
  (#3336/#3346). No longer an open design choice.
- Core thesis (client = design/UAT only; never a merge/decision approver) is **upheld** and now
  consistently enforced across the shipped substrate; only #3059's "to-research" framing was stale.

---
Signed-by: Orla Harper
Team&Model: claude-code:opus-4-8@local
Role: collaborator
