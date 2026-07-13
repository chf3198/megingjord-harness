'use strict';
// #3762 (Epic #3719): optional local/free embedding acceleration — flag-gated, graceful lexical
// fallback, replay-eval-gated promotion. tdd-pyramid. No live embedder (stubbed → air-gapped/CI-safe).
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const er = require('../scripts/wiki/embedding-retrieval.js');

const PAGES = [
  { slug: 'cache-adapters', path: path.join(__dirname, '..', 'scripts/wiki/eval-ground-truth.json') },
  { slug: 'retrieval', path: path.join(__dirname, '..', 'scripts/wiki/retrieval.js') },
];

test('cosineSim: identical=1, orthogonal=0, length-mismatch=0', () => {
  assert.equal(er.cosineSim([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(er.cosineSim([1, 0], [0, 1]), 0);
  assert.equal(er.cosineSim([1, 0], [1, 0, 0]), 0);
  assert.equal(er.cosineSim([], []), 0);
});

test('embeddingsEnabled reflects the WIKI_EMBEDDINGS_ENABLED flag', () => {
  const prev = process.env.WIKI_EMBEDDINGS_ENABLED;
  process.env.WIKI_EMBEDDINGS_ENABLED = '1';
  assert.equal(er.embeddingsEnabled(), true);
  delete process.env.WIKI_EMBEDDINGS_ENABLED;
  assert.equal(er.embeddingsEnabled(), false);
  if (prev !== undefined) process.env.WIKI_EMBEDDINGS_ENABLED = prev;
});

test('AC1: flag OFF → lexical is the default path (mode flag-off)', async () => {
  delete process.env.WIKI_EMBEDDINGS_ENABLED;
  const r = await er.embeddingSearch('cache adapters', PAGES, {});
  assert.equal(r.mode, 'flag-off');
  assert.deepEqual(r.results, er.lexical('cache adapters', PAGES).slice(0, er.DEFAULT_TOP_N));
});

test('AC3: embedder absent (null) → graceful lexical fallback, results == lexical', async () => {
  const r = await er.embeddingSearch('cache adapters', PAGES, { force: true, embedder: async () => null });
  assert.equal(r.mode, 'lexical-fallback');
  assert.deepEqual(r.results, er.lexical('cache adapters', PAGES).slice(0, er.DEFAULT_TOP_N));
});

test('embedder present → embedding mode, ranked by cosine to the query vector', async () => {
  // stub: pages/queries containing "cache" embed near [1,0,0]; others near [0,1,0].
  const embedder = async (t) => (String(t).includes('cache') ? [1, 0, 0] : [0, 1, 0]);
  const r = await er.embeddingSearch('cache', PAGES, { force: true, embedder });
  assert.equal(r.mode, 'embedding');
  assert.equal(r.results[0], 'cache-adapters'); // the cache-named page ranks first
});

test('runRetrievalEval computes mean precision/recall over a slug-returning searcher', async () => {
  const queries = [{ q: 'x', expected: ['a', 'b'] }, { q: 'y', expected: ['c'] }];
  const perfect = async (query) => (query === 'x' ? ['a', 'b'] : ['c']);
  const evalR = await er.runRetrievalEval(perfect, queries);
  assert.equal(evalR.queries, 2);
  assert.equal(evalR.mean_precision, 1);
  assert.equal(evalR.mean_recall, 1);
});

test('AC2: promotionEligibility is replay-eval-gated (embedding must beat lexical + clear floor)', () => {
  const win = er.promotionEligibility({ mean_precision: 0.8 }, { mean_precision: 0.6 }, 0.4);
  assert.equal(win.promotionEligible, true);
  const lose = er.promotionEligibility({ mean_precision: 0.5 }, { mean_precision: 0.6 }, 0.4);
  assert.equal(lose.promotionEligible, false, 'no promotion when embedding does not beat lexical');
  const belowFloor = er.promotionEligibility({ mean_precision: 0.3 }, { mean_precision: 0.2 }, 0.4);
  assert.equal(belowFloor.promotionEligible, false, 'no promotion below the quality floor');
  assert.match(win.disposition, /promotion deferred/);
});
