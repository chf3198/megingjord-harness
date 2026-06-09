// Refs #2802 P1-0 slice 2 — context-preamble renderer (D12/D15). Pure-function tests.
const { test, expect } = require('@playwright/test');
const {
  renderContextPreamble, renderTicket, renderRepoMap, renderWiki,
} = require('../scripts/global/fleet-context-render.js');

const BUNDLE = {
  ticket: { number: 2802, title: 'access layer', body: 'build it', comments: ['c1', 'c2'], available: true },
  repoMap: [{ path: 'a.js', symbols: ['function foo', 'class Bar'], available: true }],
  wiki: ['wiki-hit-1'],
};

test('#2802 renderTicket includes number, title, body, recent comments', () => {
  const out = renderTicket(BUNDLE.ticket);
  expect(out).toContain('TICKET #2802: access layer');
  expect(out).toContain('build it');
  expect(out).toContain('c2');
});

test('#2802 renderTicket on unavailable ticket returns empty', () => {
  expect(renderTicket({ available: false })).toBe('');
  expect(renderTicket(null)).toBe('');
});

test('#2802 renderRepoMap lists path + symbols, skips unavailable/empty', () => {
  expect(renderRepoMap(BUNDLE.repoMap)).toContain('# a.js');
  expect(renderRepoMap(BUNDLE.repoMap)).toContain('class Bar');
  expect(renderRepoMap([{ path: 'x', available: false }])).toBe('');
});

test('#2802 renderContextPreamble assembles all sections in priority order', () => {
  const { preamble, included, truncated } = renderContextPreamble(BUNDLE);
  expect(included).toEqual(['ticket', 'repoMap', 'wiki']);
  expect(truncated).toBe(false);
  expect(preamble.indexOf('TICKET')).toBeLessThan(preamble.indexOf('a.js')); // ticket before repo-map
  expect(preamble.indexOf('a.js')).toBeLessThan(preamble.indexOf('WIKI')); // repo-map before wiki
});

test('#2802 renderContextPreamble respects maxChars budget + flags truncation', () => {
  const { preamble, truncated } = renderContextPreamble(BUNDLE, { maxChars: 40 });
  expect(preamble.length).toBeLessThanOrEqual(60); // budget + clip marker
  expect(truncated).toBe(true);
});

test('#2802 renderContextPreamble drops lowest-priority sections first under tight budget', () => {
  // budget fits ticket only → wiki/repoMap dropped
  const { included } = renderContextPreamble(BUNDLE, { maxChars: 50 });
  expect(included).toContain('ticket');
  expect(included).not.toContain('wiki');
});

test('#2802 renderContextPreamble on empty bundle is safe', () => {
  expect(renderContextPreamble({})).toEqual({ preamble: '', included: [], truncated: false });
});
