# Wiki retrieval wired into the Consultant pre-critique — measured token-cost reduction (#3761)

Epic #3719 P1-c. Completes the retrieval **adoption** half that the #3760 baseline deferred here
(the #3157 RAG token-reduction cross-ref): the shipped lexical retrieval floor is now invoked in a
real baton step, and the token-cost win is measured, not asserted.

## What was wired

`scripts/global/multi-model-critique.js` is the Consultant cross-family pre-critique (it runs an
artifact through N fleet models for independent critique). Its `buildPrompt` now accepts an optional
**grounding** block, and `critique(artifact, opts)` grounds the critique by default on the top-N
relevant wiki pages via the new `scripts/wiki/retrieval-baton.js#groundArtifact` — the
**agent-plaintext consumption path** (`retrieval-router.route` over the FRESH wiki-mirror, #3779).
Grounding is backward-compatible (`ground:false` opts out) and degrades to an ungrounded critique on
any retrieval failure (G6).

## The measurement (G3)

Without retrieval, grounding a critic on the harness's wiki knowledge means loading the whole relevant
store into context. With retrieval you load only the top-N relevant pages. `groundArtifact` records:

```
reduction_ratio = (baseline_tokens − retrieval_tokens) / baseline_tokens
  baseline_tokens  = tokens to load EVERY candidate page for the query class (no-retrieval naive path)
  retrieval_tokens = tokens of the top-N retrieved excerpts only
```

Measured on the **live wiki** (query class `synthesis` → wisdom-global/project), top-N = 5:

| metric | value |
|---|---|
| candidate pages (whole store) | 170 |
| retrieved pages (top-N) | 5 |
| baseline_tokens | 111,180 |
| retrieval_tokens | 1,005 |
| **reduction_ratio** | **0.991 (99.1%)** |

Deterministic fixture (`tests/fixtures/wiki-3761`, 4 pages, top-N 2): reduction 0.485 — the ratio holds
at small scale, confirming the math is not an artifact of corpus size. Each grounded critique appends a
schema-v3 G3 signal (`event: retrieval-token-cost`) to `dashboard/events.jsonl` via `recordReduction`
(best-effort; never throws). The estimator is the harness's documented ~4-chars/token convention; the
reduction **ratio** is estimator-invariant (same estimator both sides), which is the AC-required signal.

## Scope / cross-references

- Cross-refs **#2093** (wiki-adoption Epic) — lands its retrieval-in-baton sub-intent; **#2093 is NOT
  closed** by this ticket.
- Consumes #3779 (fresh wiki-mirror read-path) + #3760 (retrieval baseline). Does NOT touch
  reconcile/branch-protection (#3729/#3723); additive only.

## Tests

`tests/wiki-retrieval-baton.spec.js` (tdd-pyramid, 8/8): estimateTokens, deriveQuery, groundArtifact
reduction math, ratio formula, top-N monotonicity, buildPrompt injection/omission, critique() grounding
integration (models stubbed — no network), and the `ground:false` backward-compat opt-out.
