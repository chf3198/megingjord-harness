---
title: AC-R4 termination cap calibration for cross-team R&D synthesis runs
date: 2026-05-29
lane: docs-research
source_tickets: [1112, 2396, 2397]
seed_attribution: qwen2.5-coder:7b draft via 36gbwinresource; refined by Orla Harper
signers:
  manager: Orla Mason (claude-code:opus-4-7@local)
  collaborator: Orla Harper (claude-code:opus-4-7@local)
  consultant: Orla Vale (claude-code:opus-4-7@local)
---

# Phase-0 AC-R4 — Termination cap calibration

Companion to umbrella synthesis #2397. Focused on the termination-cap question that #2397 §5.2 deferred.

## 1. Empirical baseline

Single data point: synthesis-1105 closed in **6.5 hours** vs the **72h hard cap** (8.6% utilization). #1105 was a 3-team, 11-decision synthesis with 7 distinct failure modes that drove the v1→v2 protocol revision; despite the failure modes, the synthesis itself converged in well under the cap.

Inference: either (a) #1105 was unusually efficient OR (b) the 72h cap was conservatively over-budgeted. Without more runs, both hypotheses are equally likely. The right termination strategy must work for both scenarios.

Industry priors:
- AutoGen v0.4 termination strings: per-message text triggers (e.g., "TERMINATE") stop the conversation when emitted by any agent
- Kolmogorov-Smirnov adaptive stability detection (NeurIPS 2025): hypothesis-test whether decision distribution has stabilized over N rounds; terminate when p < 0.05 across consecutive rounds
- S²-MAD redundancy filtering (NAACL 2025): drop redundant rounds when added signal < threshold

## 2. Three termination strategies

| Strategy | Description | Risk profile |
|---|---|---|
| **Fixed-cap (status quo)** | Hard wall-clock cap; abort + emit partial result at cap | Over-cap risks zombie runs (G3 fail); under-cap risks premature termination (G2 fail) |
| **Adaptive-only** | K-S stability detection; terminate when decision distribution stable across N=3 consecutive rounds | Sensitive to early false-stability (G2 risk); no upper bound on run-time |
| **Hybrid** | K-S adaptive primary with hard ceiling secondary (e.g., 24h); whichever triggers first | Bounded above by ceiling; bounded below by stability evidence |

## 3. Cost-of-error analysis per goal lens

| Error mode | Cost dimension | Severity |
|---|---|---|
| Premature termination (synthesis abandoned before consensus) | G2 Quality (decision quality degraded; rework needed) | HIGH — Epic re-do is expensive |
| Over-run (synthesis runs past usefulness) | G3 Zero Cost (token spend) + G7 Throughput (operator waits) | MEDIUM — bounded by ceiling |
| Zombie run (orphaned synthesis blocks resource) | G6 Resilience (broker lease blocked) | MEDIUM — reaper cleans after 24h per #1589 |
| False stability (K-S says stable but more rounds would change result) | G2 Quality (decision drift after closeout) | LOW — drift signals would re-open via the existing reopen-on-drift workflow |

**Goal-lens verdict**: G2 (premature termination cost) wins over G3 (over-run cost). The strategy should be more permissive on duration than restrictive.

## 4. Recommendation: Hybrid with K-S adaptive + 24h hard ceiling

`min(adaptive_termination_signal, 24h_hard_ceiling)` where adaptive_termination_signal = K-S p < 0.05 across N=3 consecutive wave rounds. The 24h ceiling is 1/3 of the original 72h (which #1105's 6.5h shows was way over-budgeted) but still 4x #1105's empirical run-time (provides 4x headroom for harder Epics).

Parameter calibration: N=3 is the literature-standard for K-S; ceiling=24h is chosen as the longest reasonable single-operator session.

## 5. Tier-1 implementation

- Phase-1 AC4 (#2405 snapshot job): GitHub Actions schedule reads wave summaries; runs K-S test against decision distribution; emits TERMINATE marker comment when stable
- Phase-1 AC8 (#2407 validation): synthesis-init.js accepts `--ceiling-hours` arg with default 24
- Stability state stored at `planning/stability.json` (per-run; gitignored after close)

No Tier-2 dependency. K-S test is pure-Python via `scripy.stats` or rolled by hand (10-line implementation).

## 6. Open questions for Phase-1

- How to detect false-stability when decision distribution converges quickly because of small-sample size? (N=3 may be too aggressive at <6 decisions)
- Should ceiling be a function of Epic complexity (children-count × AC-count) or fixed?
- Operator-override: should `--no-adaptive` flag exist for runs where the operator wants guaranteed full-cap (e.g., research-novelty Epics where stability is suspicious)?

Refs Epic #1112 · Refs #2397 umbrella synthesis · Refs #2400 tier-graceful pattern · Refs #1589 broker reaper
