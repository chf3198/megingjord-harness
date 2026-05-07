// Wiki retrieval tests (#868 + #869).
const { test, expect } = require('@playwright/test');
const path = require('path');
const R = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'retrieval.js'));

test('tokenize splits on non-alphanumeric and lowercases', () => {
  expect(R.tokenize('Hello, World!')).toEqual(['hello', 'world']);
  expect(R.tokenize('HAMR_test')).toEqual(['hamr', 'test']);
});

test('tokenize drops single-char tokens', () => {
  expect(R.tokenize('a is the best')).toEqual(['is', 'the', 'best']);
});

test('chunkPage returns chunks with parent ranges', () => {
  const text = 'First sentence here. Second one!\n\nThird in another paragraph.';
  const chunks = R.chunkPage(text);
  expect(chunks.length).toBeGreaterThanOrEqual(2);
  for (const c of chunks) {
    expect(typeof c.chunk).toBe('string');
    expect(typeof c.parentStart).toBe('number');
    expect(typeof c.parentEnd).toBe('number');
    expect(c.parentEnd).toBeGreaterThanOrEqual(c.parentStart);
  }
});

test('chunkPage skips short fragments', () => {
  const chunks = R.chunkPage('a. b.');
  expect(chunks.length).toBe(0);
});

test('bm25Score returns 0 when no query token in doc', () => {
  const score = R.bm25Score(['xenomorph'], 'hello world', 2);
  expect(score).toBe(0);
});

test('bm25Score scores higher with more query token hits', () => {
  const more = R.bm25Score(['cache'], 'cache cache cache', 3);
  const less = R.bm25Score(['cache'], 'cache hello world', 3);
  expect(more).toBeGreaterThan(less);
});

test('denseScore symmetric and bounded', () => {
  expect(R.denseScore(['cache'], 'cache')).toBeGreaterThan(0);
  expect(R.denseScore([], 'cache')).toBe(0);
  expect(R.denseScore(['cache'], '')).toBe(0);
});

test('rrf prefers documents that rank highly in multiple lists', () => {
  const scores = R.rrf([['a', 'b', 'c'], ['a', 'c', 'b']]);
  expect(scores.a).toBeGreaterThan(scores.b);
  expect(scores.a).toBeGreaterThan(scores.c);
});

test('RRF_K + TOP_N + PARENT_CONTEXT_LINES are documented constants', () => {
  expect(R.RRF_K).toBe(60);
  expect(R.TOP_N).toBe(5);
  expect(R.PARENT_CONTEXT_LINES).toBe(8);
});
