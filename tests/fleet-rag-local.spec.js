// Refs #2856 P1-0 child of #2802 — local embeddings / RAG retrieval. Network-free + no local model:
// the embedder and the wiki-search fallback are injected.
const { test, expect } = require('@playwright/test');
const {
  localRetrieve, cosineSimilarity, SCHEMA,
} = require('../scripts/global/fleet-rag-local.js');
const { LOCAL_EMBED_HOST } = require('../scripts/global/fleet-rag-embedder.js');

// Deterministic fake embedder: keyword → vector. Returns null for unknown text.
const VECS = { query: [1, 0, 0], near: [0.9, 0.1, 0], far: [0, 0, 1] };
const fakeEmbed = async (text) => VECS[text] || null;

test('#2856 AC1 ranks the corpus by cosine similarity to the query (local embeddings)', async () => {
  const out = await localRetrieve({ query: 'query', corpus: ['far', 'near'], topK: 2, embed: fakeEmbed });
  expect(out.source).toBe('local-embeddings');
  expect(out.embedded).toBe(true);
  expect(out.hits.map((hit) => hit.doc)).toEqual(['near', 'far']); // near ranks above far
  expect(out.hits[0].score).toBeGreaterThan(out.hits[1].score);
});

test('#2856 AC1 the default embedder targets loopback only (zero external egress)', () => {
  expect(LOCAL_EMBED_HOST).toBe('127.0.0.1');
});

test('#2856 AC2 falls back to wiki-search when no local embedder is present', async () => {
  const out = await localRetrieve({
    query: 'q', corpus: ['near'], embed: async () => null, fallback: async () => ['wiki-A', 'wiki-B'],
  });
  expect(out.source).toBe('wiki-fallback');
  expect(out.embedded).toBe(false);
  expect(out.hits).toEqual([{ doc: 'wiki-A', score: null }, { doc: 'wiki-B', score: null }]);
});

test('#2856 AC2 a throwing embedder still degrades to fallback (never propagates)', async () => {
  const out = await localRetrieve({
    query: 'q', embed: async () => { throw new Error('model down'); }, fallback: async () => ['safe'],
  });
  expect(out.source).toBe('wiki-fallback');
  expect(out.hits).toEqual([{ doc: 'safe', score: null }]);
});

test('#2856 AC3 result is manifest-compatible (schema + uniform {doc,score} hits)', async () => {
  const out = await localRetrieve({ query: 'query', corpus: ['near'], embed: fakeEmbed });
  expect(out.schema).toBe(SCHEMA);
  expect(out.schema).toBe('fleet-rag/v1');
  expect(out.hits[0]).toHaveProperty('doc');
  expect(out.hits[0]).toHaveProperty('score');
});

test('#2856 a pre-embedded corpus doc uses its vector without re-embedding', async () => {
  let embedCalls = 0;
  const embed = async (text) => { embedCalls += 1; return VECS[text] || [1, 0, 0]; };
  const out = await localRetrieve({
    query: 'query', corpus: [{ text: 'cached', vector: [0.8, 0.2, 0] }], embed,
  });
  expect(out.hits[0].doc.text).toBe('cached');
  expect(embedCalls).toBe(1); // only the query was embedded; the doc used its pre-embedded vector
});

test('#2856 a falsy-but-present doc.text (0) is embedded (as "0"), not coerced to empty', async () => {
  // if text were coerced to '', embed('') would score low; text is stringified for embedding → "0".
  const embed = async (text) => (text === 'query' ? [1, 0] : (text === '0' ? [1, 0] : [0, 1]));
  const out = await localRetrieve({ query: 'query', corpus: [{ text: 0 }], embed });
  expect(out.hits[0].score).toBeCloseTo(1, 6); // embedded as "0" (high score), not '' (low score)
});

test('#2856 topK bounds the returned hits', async () => {
  const embed = async (text) => (text === 'query' ? [1, 0] : [Math.random(), Math.random()]);
  const out = await localRetrieve({ query: 'query', corpus: ['a', 'b', 'c', 'd'], topK: 2, embed });
  expect(out.hits.length).toBe(2);
});

test('#2856 cosineSimilarity: identical=1, orthogonal=0, mismatched/zero=0', () => {
  expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0); // length mismatch
  expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);    // zero vector
});
