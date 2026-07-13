---
title: "Wiki retrieval re-baseline — true lexical BM25+RRF floor (#3760)"
ticket: 3760
epic: 3719
type: wisdom-project
content_trust_score: 1.0
created: "2026-07-12"
updated: "2026-07-12"
status: measured
---

# Wiki retrieval re-baseline (Epic #3719 P1-b, design-of-record §4/R4)

The Epic body and prior lineage cite a **"0.12 precision FAIL"** retrieval baseline. That number is **not
persisted anywhere** in the tree (design-of-record §4 correction). This document records the **measured**
true baseline of the shipped lexical retrieval floor (`scripts/wiki/retrieval.js`: BM25 + token-overlap
"dense" + RRF fusion + meta-boost), computed by the shipped `scripts/wiki/eval-harness.js` (precision@5,
recall@5, `quality_floor = 0.40`) over the committed labeled corpus `scripts/wiki/eval-ground-truth.json`.

## Corpus (committed, A/B/C-labeled)

`scripts/wiki/eval-ground-truth.json` — 13 labeled queries, each `{q, expected[], wiki}` where
`wiki ∈ {A=code, B=work-log, C=wisdom}`. Expected slugs were verified to exist in the retrieval index
(frozen-mirror tickets excluded). Re-run: `node scripts/wiki/eval-harness.js`.

## Measured baseline (NOT the mythical 0.12)

| Slice | n | precision@5 | recall@5 |
|---|---|---|---|
| **Overall** | 13 | **0.262** | **0.551** |
| Wiki C (wisdom) | 9 | 0.311 | 0.519 |
| Wiki B (work-log) | 3 | 0.200 | 0.833 |
| Wiki A (code) | 1 | 0.000 | 0.000 |

The prior wisdom-only 8-query corpus measured **0.35 / 0.584** — the honest floor is ~0.26–0.35 precision@5,
**well above the invented 0.12** and **below the 0.40 quality floor** (retrieval genuinely needs improvement,
but from the real number, not a myth).

## Two structural gaps the re-baseline surfaced

1. **Wiki A (code) is not in the retrieval index.** `retrieval.js` indexes only `wisdom` + `work-log`
   (ticket/pr) page types — the code wiki (479 symbols + 45 concepts) is unreachable via `hybridSearch`, so
   code-retrieval precision is **0 by construction**. This is the adoption gap #2093/#3761 must close (index
   the code wiki) before code retrieval can be baselined meaningfully.
2. **Wiki B (work-log) is freeze-limited.** The retrieval index is stale at ticket **~3029** (mirrors frozen
   `2026-06-17` by the reconcile rot). Recent tickets (3030+) are unretrievable. Wiki B recall (0.833 on
   pre-freeze labels) is otherwise healthy; the freeze — not the ranker — is the coverage limiter. Depends on
   the reconcile-green fix **#3723/#3729**; the corpus is re-runnable once the mirror index thaws.

## #3157 disposition

#3157 (RAG token-reduction benchmark) is **folded as a cross-ref**: the token-cost half of the retrieval
suite lands with the retrieval-in-baton wiring (#3761), which is where a measured token-cost delta is
observable. This doc owns the precision/recall half.

## Method / gates

`test_strategy: eval-harness` (reuses the shipped harness; no parallel eval — the AC-required #3730 harness
is not built). Cross-family review + independence via the committed consensus ledger.
