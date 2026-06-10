// Stress tests for #2856 local RAG — adversarial vector/corpus corpus (G6) + a p99 budget on the cosine
// ranking (G7). Network-free + no local model (embedder/fallback injected).
const { test, expect } = require('@playwright/test');
const http = require('node:http');
const { localRetrieve, cosineSimilarity } = require('../scripts/global/fleet-rag-local.js');
const { asVector, defaultEmbedder } = require('../scripts/global/fleet-rag-embedder.js');

test('#2856 asVector accepts only a non-empty array of finite numbers', () => {
  expect(asVector([1, 2, 3])).toEqual([1, 2, 3]);
  expect(asVector(['a', 'b'])).toBe(null);     // non-numeric elements
  expect(asVector([1, NaN])).toBe(null);       // NaN element
  expect(asVector([1, Infinity])).toBe(null);  // non-finite element
  expect(asVector([])).toBe(null);             // empty
  expect(asVector('vector')).toBe(null);       // not an array
});

// Real loopback stub model: exercises the response-size cap (HIGH) + numeric-element validation end-to-end.
async function withStubModel(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const prev = process.env.MEGINGJORD_EMBED_PORT;
  process.env.MEGINGJORD_EMBED_PORT = String(server.address().port);
  try { await run(); } finally {
    if (prev === undefined) delete process.env.MEGINGJORD_EMBED_PORT; else process.env.MEGINGJORD_EMBED_PORT = prev;
    await new Promise((resolve) => server.close(resolve));
  }
}

test('#2856 REAL embedder: caps an oversize response and rejects a non-numeric embedding', async () => {
  await withStubModel((req, res) => { res.writeHead(200); res.end(JSON.stringify({ embedding: ['x', 'y'] })); },
    async () => { expect(await defaultEmbedder('hi')).toBe(null); }); // non-numeric → null
  await withStubModel((req, res) => { res.writeHead(200); res.end(JSON.stringify({ embedding: [0.1, 0.2, 0.3] })); },
    async () => { expect(await defaultEmbedder('hi')).toEqual([0.1, 0.2, 0.3]); }); // valid → vector
  await withStubModel((req, res) => { res.writeHead(200); res.write('['); for (let n = 0; n < 600; n += 1) res.write('0123456789'.repeat(1000)); res.end(']'); },
    async () => { expect(await defaultEmbedder('hi')).toBe(null); }); // >4MB body → capped → null (no OOM)
});

test('#2856 CHAOS: cosineSimilarity never returns NaN/Infinity on adversarial vectors', () => {
  const nasties = [
    [NaN, 1], [Infinity, 0], [1, undefined], [], [0, 0], [1e308, 1e308], [-1, -1],
  ];
  for (const left of nasties) {
    for (const right of nasties) {
      const score = cosineSimilarity(left, right);
      expect(Number.isFinite(score)).toBe(true); // always a finite number, never NaN/Infinity
    }
  }
});

test('#2856 CHAOS: an embedder returning garbage degrades safely (fallback or skip, never throw)', async () => {
  const garbageEmbed = async () => ({ not: 'a vector' }); // not an array → treated as null
  const out = await localRetrieve({ query: 'q', corpus: ['a', 'b'], embed: garbageEmbed,
    fallback: async () => ['fb'] });
  expect(out.source).toBe('wiki-fallback'); // query embed failed → fell back, no throw
  expect(out.hits).toEqual([{ doc: 'fb', score: null }]);
});

test('#2856 CHAOS: docs that fail to embed are skipped, not crashed on', async () => {
  // query embeds fine; some corpus docs embed to null → silently dropped from results.
  const embed = async (text) => (text === 'query' ? [1, 0] : (text === 'good' ? [1, 0] : null));
  const out = await localRetrieve({ query: 'query', corpus: ['good', 'bad1', 'bad2'], embed });
  expect(out.source).toBe('local-embeddings');
  expect(out.hits.map((hit) => hit.doc)).toEqual(['good']); // only the embeddable doc survived
});

test('#2856 CHAOS: a fallback returning nullish or a truthy non-array yields [] hits, never throws', async () => {
  for (const bad of [null, undefined, 123, { not: 'array' }, 'string', true]) {
    const out = await localRetrieve({ query: 'q', embed: async () => null, fallback: async () => bad });
    expect(out.source).toBe('wiki-fallback');
    expect(out.hits).toEqual([]); // never throws on a non-array fallback result
  }
});

test('#2856 a text corpus spanning multiple concurrency windows embeds + ranks all docs', async () => {
  // 20 docs > EMBED_CONCURRENCY(8) → exercises chunked bounded-parallel embedding; all must be considered.
  let embedCalls = 0;
  const embed = async (text) => { embedCalls += 1; return text === 'query' ? [1, 0] : [Number(text) / 20, 1]; };
  const corpus = Array.from({ length: 20 }, (_unused, idx) => String(idx));
  const out = await localRetrieve({ query: 'query', corpus, topK: 5, embed });
  expect(embedCalls).toBe(21); // query + 20 docs, none skipped across windows
  expect(out.hits.length).toBe(5);
});

test('#2856 CHAOS: an oversize query/doc text is clamped before embedding (no OOM)', async () => {
  const huge = 'q'.repeat(2 * 1024 * 1024); // 2MB string
  let longest = 0;
  const embed = async (text) => { longest = Math.max(longest, text.length); return [1, 0]; };
  await localRetrieve({ query: huge, corpus: [{ text: huge }, huge], embed });
  expect(longest).toBeLessThanOrEqual(256 * 1024); // every embedded text was clamped to MAX_TEXT_CHARS
});

test('#2856 CHAOS: a throwing fallback still resolves with [] (never hard-fails)', async () => {
  const out = await localRetrieve({
    query: 'q', embed: async () => null, fallback: async () => { throw new Error('wiki down'); },
  });
  expect(out.source).toBe('wiki-fallback');
  expect(out.hits).toEqual([]); // contract: resolves, never rejects
});

test('#2856 CHAOS: a malformed pre-embedded vector is rejected, falling back to text embedding', async () => {
  // doc.vector has a NaN → must NOT be used as-is; doc embeds its text instead (consistent validation).
  const embed = async (text) => (text === 'query' ? [1, 0] : (text === 'good-text' ? [1, 0] : null));
  const out = await localRetrieve({
    query: 'query', corpus: [{ text: 'good-text', vector: [NaN, 1] }], embed,
  });
  expect(out.hits.length).toBe(1);
  expect(out.hits[0].score).toBeCloseTo(1, 6); // ranked via the text embedding, not the NaN vector
});

test('#2856 CHAOS: a huge corpus is bounded (MAX_CORPUS) and flagged — no OOM', async () => {
  const corpus = Array.from({ length: 12000 }, (_unused, idx) => ({ vector: [idx % 7, 1] }));
  const out = await localRetrieve({ query: 'q', corpus, topK: 3, embed: async () => [1, 0] });
  expect(out.source).toBe('local-embeddings');
  expect(out.corpusTruncated).toBe(true);
  expect(out.hits.length).toBe(3); // top-K only, not 12000
});

test('#2856 PERF: cosineSimilarity p99 < 1ms on 768-dim vectors', () => {
  const dim = 768; // nomic-embed-text dimensionality
  const vecA = Array.from({ length: dim }, (_unused, idx) => Math.sin(idx));
  const vecB = Array.from({ length: dim }, (_unused, idx) => Math.cos(idx));
  const samples = [];
  for (let iter = 0; iter < 3000; iter += 1) {
    const start = process.hrtime.bigint();
    cosineSimilarity(vecA, vecB);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  expect(samples[Math.floor(samples.length * 0.99)]).toBeLessThan(1);
});
