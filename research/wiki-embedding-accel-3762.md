# Optional local/free embedding acceleration for wiki retrieval (#3762)

Epic #3719 P1-d. Adds an **optional** embedding-ranked retrieval path over the mandatory lexical floor,
behind a flag, degrading gracefully to lexical when the embedder is absent, with promotion gated on a
precision/recall replay-eval — never a calendar.

## What ships (`scripts/wiki/embedding-retrieval.js`)

- `embeddingSearch(query, pages, {embedder})` — when `WIKI_EMBEDDINGS_ENABLED=1` **and** the local
  embedder returns a vector, ranks candidate pages by cosine similarity (`mode: 'embedding'`). When the
  flag is off (`mode: 'flag-off'`) or the embedder is unreachable / returns null (`mode:
  'lexical-fallback'`), it returns the shipped lexical `hybridSearch` results. The embedder is the
  existing `fleet-rag-embedder#defaultEmbedder` — a **local, loopback-only Ollama** call
  (`nomic-embed-text`), zero-cost and air-gappable; no hosted or paid vector DB (G3/G5).
- `promotionEligibility(evalEmbedding, evalLexical, floor)` — the promotion gate: embedding retrieval is
  eligible to become the default **only** when its mean precision **beats the lexical baseline AND clears
  the corpus quality floor** (`eval-ground-truth.json`, 0.4). This is a replay-eval gate over the #3760
  labeled corpus (via the shipped `eval-harness` precision@k / recall@k), **not** a calendar threshold
  (#1617 / #1771). `runRetrievalEval(searchFn, queries)` scores any slug-returning searcher.

## Disposition (honest per #1617)

The flag ships **OFF by default** — the lexical floor remains the default and the only air-gapped path.
Promotion to default is **deferred**: it requires an environment with the local embedder present to run
the replay-eval and clear the floor. CI and air-gapped operators never load the embedder, so they get the
lexical floor unchanged. This is the "ship advisory; promotion deferred" pattern — the acceleration is
available to opt into, and its promotion is eligibility-gated on measured precision, never asserted.

## Graceful degradation (AC3)

Verified by test: a null-returning embedder (the embedder-absent case) yields `mode:
'lexical-fallback'` with results **identical** to `hybridSearch` — coordination never breaks when the
Tier-3 fleet embedder is down (G6). "Absent" (never present, air-gapped) and "unreachable" (normally
present, currently down) take the same fallback path.

## Tests

`tests/wiki-embedding-retrieval.spec.js` (tdd-pyramid, 7/7): cosineSim, the flag gate, flag-off →
lexical, null-embedder → lexical-fallback (AC3), stub-embedder → cosine-ranked embedding mode,
`runRetrievalEval` precision/recall, and `promotionEligibility` (beats-lexical + above-floor, both
failure cases, deferred disposition) (AC2). All stubbed — no live embedder, so the suite is
air-gapped/CI-safe.

## Scope

Consumes #3760 (labeled corpus + eval-harness) + #3761 (retrieval-in-baton). Additive; flag-off is a
no-op. Does NOT touch reconcile/branch-protection (#3729/#3723).
