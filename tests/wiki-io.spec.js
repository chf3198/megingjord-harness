const { test, expect } = require('@playwright/test');
const path = require('path');
const W = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'wiki-io.js'));

test('parseFrontmatter preserves colon values via gray-matter', () => {
  const doc = [
    '---',
    'title: "Routing: Anthropic Batch"',
    'type: source',
    'created: 2026-05-16',
    'status: draft',
    '---',
    '',
    'body here',
  ].join('\n');
  const { frontmatter, body } = W.parseFrontmatter(doc);
  expect(frontmatter.title).toBe('Routing: Anthropic Batch');
  expect(frontmatter.type).toBe('source');
  expect(body.trim()).toBe('body here');
});

test('appendLog rejects far future dates', () => {
  expect(() => W.appendLog('2099-01-01', 'test', 'future guard')).toThrow(/Refusing future wiki log date/);
});

test('appendLog rejects dates 2 days in the future (boundary precision per #1681)', () => {
  const twoDaysAhead = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  expect(() => W.appendLog(twoDaysAhead, 'test', 'two-day boundary')).toThrow(/Refusing future wiki log date/);
});

test('appendLog rejects malformed date strings (Invalid wiki log date)', () => {
  expect(() => W.appendLog('not-a-date', 'test', 'invalid input')).toThrow(/Invalid wiki log date/);
});

test('appendLog date tolerance constant remains 1 day', () => {
  expect(W.DATE_TOLERANCE_DAYS).toBe(1);
});
