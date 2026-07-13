// tdd-pyramid unit suite for the web-research grounding producer (#3747, R1 of #3059).
const test = require('node:test');
const assert = require('node:assert');
const G = require('../scripts/global/adjudication-grounding');
const guardrail = require('../scripts/global/adjudication-guardrail');

// Fake fetch returning a Tavily-shaped /search body.
function fakeFetch(results) {
  return async () => ({ ok: true, status: 200, json: async () => ({ results }) });
}
const OK = [
  { title: 'CSA Autonomy Levels', url: 'https://cloudsecurityalliance.org/x', content: 'Gate escalation on reversibility and blast-radius, not self-reported confidence, per the five autonomy dimensions.' },
  { title: 'Agentic RAG', url: 'https://arxiv.org/abs/2501.1', content: 'Wrap retrieval in a reasoning loop with a sufficiency check; naive RAG fails about forty percent of the time.' },
];

test('AC1 produceGrounding returns cited grounding from a live (mock) fetch', async () => {
  const g = await G.produceGrounding('novel governance decision', { apiKey: 'k', fetchImpl: fakeFetch(OK) });
  assert.ok(g && typeof g.grounding === 'string');
  assert.match(g.grounding, /https:\/\/cloudsecurityalliance\.org\/x/); // every source cited by URL
  assert.deepEqual(g.sources, ['https://cloudsecurityalliance.org/x', 'https://arxiv.org/abs/2501.1']);
});

test('AC2 sufficiency: empty results returns null (never fabricated grounding)', async () => {
  const g = await G.produceGrounding('q', { apiKey: 'k', fetchImpl: fakeFetch([]) });
  assert.equal(g, null);
});

test('AC2 sufficiency: uncited result (no URL) does not clear', async () => {
  const g = await G.produceGrounding('q', { apiKey: 'k', fetchImpl: fakeFetch([{ title: 't', content: 'x'.repeat(80) }]) });
  assert.equal(g, null);
});

test('AC2 sufficiency: trivial/empty content is not a citation', async () => {
  const g = await G.produceGrounding('q', { apiKey: 'k', fetchImpl: fakeFetch([{ url: 'https://a.co', content: 'short' }]) });
  assert.equal(g, null);
});

test('AC4 fail-safe: no api key returns null, never throws', async () => {
  // Deterministically remove the key (env may be hydrated from .env in a combined run / CI secret).
  const saved = process.env.TAVILY_API_KEY; const savedNo = process.env.MEGINGJORD_NO_DOTENV;
  delete process.env.TAVILY_API_KEY; process.env.MEGINGJORD_NO_DOTENV = '1';
  try {
    const g = await G.produceGrounding('q', { apiKey: '', fetchImpl: fakeFetch(OK) });
    assert.equal(g, null);
  } finally {
    if (saved === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = saved;
    if (savedNo === undefined) delete process.env.MEGINGJORD_NO_DOTENV; else process.env.MEGINGJORD_NO_DOTENV = savedNo;
  }
});

test('AC4 fail-safe: fetch throwing (outage) returns null, never throws', async () => {
  const g = await G.produceGrounding('q', { apiKey: 'k', fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  assert.equal(g, null);
});

test('AC4 fail-safe: HTTP error status returns null', async () => {
  const g = await G.produceGrounding('q', { apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.equal(g, null);
});

test('citable() gate: requires http(s) URL and non-trivial content', () => {
  assert.equal(G.citable({ url: 'https://a.co', content: 'x'.repeat(50) }), true);
  assert.equal(G.citable({ url: 'ftp://a', content: 'x'.repeat(50) }), false);
  assert.equal(G.citable({ url: 'https://a.co', content: 'tiny' }), false);
  assert.equal(G.citable(null), false);
});

test('renderGrounding formats one URL-bearing line per source; null below floor', () => {
  assert.equal(G.renderGrounding([]), null);
  const r = G.renderGrounding(OK);
  assert.equal(r.grounding.split('\n').length, 3); // header + 2 sources
  assert.match(r.grounding, /prefer these over stale/i);
});

test('buildQuery normalizes whitespace and bounds length', () => {
  assert.equal(G.buildQuery('  a\n\n b  '), 'a b');
  assert.equal(G.buildQuery('x'.repeat(500)).length, 380);
  assert.equal(G.buildQuery(''), '');
});

// AC3 — adjudicate() auto-injects produced grounding into the panel prompt.
test('AC3 resolveGrounding: not novel/highStakes => null', async () => {
  assert.equal(await guardrail.resolveGrounding('q', {}), null);
});
test('AC3 resolveGrounding: caller groundingContext wins', async () => {
  assert.equal(await guardrail.resolveGrounding('q', { novel: true, groundingContext: 'CALLER' }), 'CALLER');
});
test('AC3 resolveGrounding: novel auto-produces via injected producer', async () => {
  const g = await guardrail.resolveGrounding('q', { novel: true, produceGrounding: async () => ({ grounding: 'PRODUCED' }) });
  assert.equal(g, 'PRODUCED');
});
test('AC4 resolveGrounding: producer throwing degrades to null (consensus-without-grounding)', async () => {
  const g = await guardrail.resolveGrounding('q', { highStakes: true, produceGrounding: async () => { throw new Error('boom'); } });
  assert.equal(g, null);
});
test('AC3 adjudicate injects grounding into the panel prompt', async () => {
  let seen = '';
  const capture = async (prompt) => { seen = prompt; return { ok: true, text: 'SCORE 1: 90 MINGOAL 8 :: r\nSCORE 2: 50 MINGOAL 5 :: r\nPICK 1' }; };
  await guardrail.adjudicate('novel Q', ['A', 'B'], {
    novel: true, diversityFloor: 1, produceGrounding: async () => ({ grounding: 'INJECTED-GROUNDING-XYZ' }),
    dispatchFleet: capture, dispatchProvider: async (_n, prompt) => capture(prompt),
  });
  assert.match(seen, /INJECTED-GROUNDING-XYZ/);
});
