---
title: Review-score calibration and escalation — web-search research
type: research
created: 2026-05-17
status: active
ticket: 1747
parent_epic: 1745
---

# Review-score calibration + escalation practices (#1747)

## Purpose

Closes #1747 (Phase 1 of Epic #1745). Web-search-sourced findings pressure-testing the proposed 1–100 / F / B+ / A+ framing against 2026 calibration, escalation, and governance practices. Recommendation: **adopt 1–100 in principle but bin into 5 ordinal bands via percentile-derived thresholds, not arithmetic ones; gate hard-fail mode behind a human-calibrated corpus; defer raw-numeric escalation in favor of confidence-AND-cross-reviewer-agreement triggers**.

## Research questions answered

### Q1: How do modern rubrics avoid false precision when a single numeric score drives review?

**Finding**: Practitioners convert raw scores to ordinal bins. The 2026 published pattern (Rubric-Based Evals & LLM-as-a-Judge, Adnan Masood, Medium, April 2026) uses percentile partitioning at the 20th/40th/60th/80th percentiles to produce 5 ordinal intervals of roughly equal size. This avoids pretending the difference between 73 and 74 is meaningful — only the band is.

> "Each scaled score list is sorted and partitioned at the 20th, 40th, 60th and 80th percentiles, producing five ordinal intervals of roughly equal size. Marks falling below a cut-off receive the lower bin label (0–4)."

The single-threshold approach Epic #1745 currently proposes ("<70 = F") is **brittle** without calibration data. Percentile-banding from the calibration corpus is the contemporary technique.

### Q2: What calibration/guardrail patterns protect numeric-score-driven escalation?

**Finding 2a — Human-calibration floor**: Run human review on ≥10% of LLM judge outputs. If disagreement >20%, the rubric or judge prompt needs revision (Deepchecks LLM-judge calibration guide, 2026). Without this floor, raw judge scores drift over time and across contexts.

**Finding 2b — Confidence-based escalation (not raw-score)**: Modern systems use confidence thresholds, not score thresholds, for escalation:

> "Confidence Check ≥ 0.9 returns response; < 0.9 escalates to Mid-Tier. Medium complexity ≥ 0.85 returns; < 0.85 escalates to Frontier."

Applied to the harness: a score of 65/100 with reviewer confidence 0.45 is a calibration problem (low signal), not a goal failure. A score of 65/100 with confidence 0.95 is a real Tier-3 candidate.

**Finding 2c — Dynamic thresholds, not fixed bands**: Singapore's Model AI Governance Framework for Agentic AI (January 2026) explicitly recommends dynamic escalation thresholds that adapt based on the agent's current risk score, sensitivity of the resource accessed, and drift flagged by behavioral tracking. Fixed `<70 = F` is contemporary anti-pattern.

**Finding 2d — False-positive tuning takes 2–3 months**: Operational governance reports (2026) consistently note that tuning agentic escalation thresholds is a months-long calibration exercise. Hard-fail mode SHOULD be advisory-only until that calibration is complete. Path D rollout via replay-eval (#1771) is the right shape — but the calibration corpus must precede promotion.

### Q3: What evidence/explanation/audit trails are recommended when scores trigger operational follow-up?

**Finding 3a — Policy + version provenance required**: Enterprise governance frameworks (2026) mandate every score→action mapping cite:

1. The matched policy rule (which rubric box failed?).
2. The policy version snapshot (which rubric version was active?).
3. The reviewer identity + team/model (who scored it?).
4. The decision lineage (what was the action — file ticket, log event, escalate?).

The harness's existing `incidents.jsonl` schema v2 has: `pattern_id`, `evidence`, `ticket_ref`, `epic_ref`, `proposal_id` — fields cover most of this. **Gap**: no current field for `rubric_version` or `policy_version_snapshot` on the score-emission side.

**Finding 3b — Verifiable + judged hybrid**: The 2026 standard separates:
- **Verifiable rewards**: deterministic unit tests ("did the code solve the problem?")
- **LLM rubrics**: subjective judgments ("is the code readable, efficient, secure?")

These are not interchangeable and should not be averaged together. The harness's `rubric-g1-g9-v2.json` evidence-command DSL (contains/regex/not_regex) is actually a verifiable-rewards style system — that's good. The risk is conflating it with LLM-as-judge scoring later.

### Q4: What thresholds/banding approaches are used in adjacent governance systems?

**Finding 4a — ISS Governance QualityScore**: real-world enterprise governance system uses banded scores against multiple dimensions. Notable: per-dimension scoring + composite, not single composite alone.

**Finding 4b — Internal audit ratings**: divided opinion in 2026 industry on whether to include numeric ratings AT ALL in audit reports. Risks cited: false equivalence between dissimilar findings, over-precision, ranking-game dynamics. The harness should consider WHETHER to expose the 1–100 number to operators or only the band.

**Finding 4c — Compliance scoring hybrid**: enterprise compliance integrates numeric precision (for trend tracking and benchmarking) with qualitative judgment (for action triggers). The 1–100 is for the audit trail; the band drives action.

## Recommendations for Phase 2 design (#1748)

### R1: Adopt 1–100, bin into 5 ordinal bands

Replace the dormant-Epic single-cutoff proposal with percentile-derived 5-band system:

| Band | Letter | Percentile (after calibration) | Action |
|---|---|---|---|
| 5 | A | ≥80th percentile | None (default approve) |
| 4 | B | 60th–80th | Log Tier-1 observation event |
| 3 | C | 40th–60th | File Tier-2 follow-on (P3) |
| 2 | D | 20th–40th | File Tier-2 follow-on (P2) |
| 1 | F | <20th | File Tier-3 self-anneal (P1) + consultant escalation |

**Critical**: percentile boundaries derived from the calibration corpus, not chosen a priori. Initial corpus = retrospective scoring of last N closed PRs.

### R2: Pair score with confidence, not raw-score-only

Tier-3 escalation requires (band == F) AND (cross-family-reviewer agreement ≥ 0.85). Avoids single-reviewer false positives — a known 2026 failure mode.

Implementation hook: cross-family reviewer (Qwen et al.) should ALSO score the rubric, and the classifier compares. Disagreement ≥ 20% triggers calibration review, not goal-failure escalation.

### R3: Hard-fail only after calibration corpus exists

Until ≥50 manually human-scored closeouts exist, classifier output is advisory:

- Emit band + score in CONSULTANT_CLOSEOUT
- Log Tier-1 event regardless of band
- DO NOT auto-file Tier-3 tickets

Promotion to hard-fail mode gated on replay-eval against the calibration corpus (per Epic #1771 pattern; no calendar exposure).

### R4: Pair verifiable + judged, don't conflate

The existing `rubric-g1-g9-v2.json` is **verifiable** (deterministic evidence-command DSL). When Phase 3 adds LLM-as-judge scoring, it should be a separate field (`llm_judge_score`, `llm_judge_rubric_version`), not averaged into the deterministic mean. The classifier can compose them with weights, but the audit trail must preserve both.

### R5: Audit trail completeness

Extend `incidents.jsonl` event schema (and the rubric-score.js output) to include:

- `rubric_version` (already in `rubric-score.js` output)
- `policy_version_snapshot` (currently missing — the band thresholds + classifier code version)
- `reviewer_identity` (Team&Model triplet of the reviewer)
- `confidence` (0–1 reviewer confidence)
- `decision_lineage` (which evidence boxes failed, why)

This satisfies the 2026 Singapore framework and enterprise compliance practice.

### R6: Don't expose raw number to operators by default

UI surface in CONSULTANT_CLOSEOUT shows the **band** (`A | B | C | D | F`) prominently with the score as secondary. Avoids the over-precision pathology where operators argue about whether something is "really" 73 vs 74. The number lives in the JSON output for trend tracking; the band drives all visible action.

## Recommendation on dormant-Epic framing

**Adjust, don't adopt as-stated.** Specifically:

- ✅ **Keep**: 1–100 numeric scale, rubric-against-harness-goals, score-to-self-anneal mapping.
- 🔧 **Adjust**: single-cutoff "<70 = F" → percentile-derived 5-band system with calibration corpus.
- 🔧 **Adjust**: raw-score escalation → score+confidence+cross-reviewer-agreement escalation.
- ➕ **Add**: verifiable/judged separation; audit-trail provenance; calibration-gated hard-fail promotion.
- ❌ **Avoid**: Splitting into separate workflows. The hybrid (verifiable evidence-boxes + future LLM judge) belongs in ONE rubric framework with separate dimensions.

## Open questions for Phase 2 design (#1748)

1. **Calibration corpus seed**: which closed PRs to retrospectively score? Last 50? Last 100? Stratified by lane/area?
2. **Confidence source**: reviewer self-report? Inter-reviewer agreement? Both?
3. **G10 (Maintainability) inclusion**: extend rubric to v3 g1-g10 or defer? (Cross-references gap from #1746.)
4. **Replay-eval integration**: how does `soak-replay-runner.js` (Epic #1771) consume rubric scores? Per-PR replay or aggregate?
5. **Cross-family reviewer role**: does Qwen/cross-family reviewer score the rubric independently, or critique the primary reviewer's score?

## Citations (web sources, 2026)

- [Rubric-Based Evaluations & LLM-as-a-Judge — Methodologies, Biases, and Empirical Validation (Adnan Masood, Medium, April 2026)](https://medium.com/@adnanmasood/rubric-based-evals-llm-as-a-judge-methodologies-and-empirical-validation-in-domain-context-71936b989e80)
- [Keys to Successful LLM-as-a-Judge and HITL Workflows (Kili Technology, 2026)](https://kili-technology.com/blog/keys-to-successful-llm-as-a-judge-and-hitl-workflows)
- [What Is LLM-as-a-Judge Calibration? Power & Limits (Deepchecks, 2026)](https://deepchecks.com/llm-judge-calibration-automated-issues/)
- [Rubric Is All You Need: Improving LLM-Based Code Evaluation (arXiv 2503.23989, ACM CompEd 2025)](https://arxiv.org/html/2503.23989v1)
- [Standardizing LLM Evaluation with a Unified Rubric (newline, Dipen)](https://www.newline.co/@Dipen/standardizing-llm-evaluation-with-a-unified-rubric--b1aea7fb)
- [Governance of Agentic Artificial Intelligence Systems (Mayer Brown, February 2026)](https://www.mayerbrown.com/en/insights/publications/2026/02/governance-of-agentic-artificial-intelligence-systems)
- [Agentic AI in Compliance: Hype vs. Reality in 2026 (Compyl)](https://compyl.com/blog/agentic-ai-compliance-hype-vs-reality-2026/)
- [Runtime Security for AI Agents: An Identity Governance Perspective (Software Analyst Substack, 2026)](https://softwareanalyst.substack.com/p/runtime-security-for-ai-agents-an)
- [ISS Governance QualityScore (Baker Library, HBS)](https://www.library.hbs.edu/databases-cases-and-more/datasets/iss-governance-qualityscore)
- [The Pros and Cons of Including Ratings in Audit Reports (Internal Audit 360)](https://internalaudit360.com/to-rate-or-not-to-rate-that-is-the-question/)
- [Singapore Model AI Governance Framework for Agentic AI (January 22, 2026) — referenced via Mayer Brown above and AITUDE 2026 LLM evaluation guide](https://www.aitude.com/top-6-llm-evaluation-service-providers-in-2026/)

## ACs satisfied (this ticket)

- [x] Q1 (false precision avoidance): percentile-banding into 5 ordinal intervals.
- [x] Q2 (calibration/guardrail patterns): human-floor ≥10%, confidence-based escalation, dynamic thresholds.
- [x] Q3 (audit trail requirements): policy+version provenance, verifiable/judged separation, decision lineage.
- [x] Q4 (thresholds in adjacent systems): ISS QualityScore, internal audit ratings, compliance hybrids.
- [x] Recommendation rendered: **adjust** the dormant-Epic framing per R1–R6.
