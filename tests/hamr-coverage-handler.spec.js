'use strict';
// #1159: unit tests for the HAMR cost-coverage aggregator + panel render (browser-free backstop).
// Goal coverage: G3 governor (AC2), G6 graceful-degrade (AC6), G4 secret-safe (AC5).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { computeHamrCoverage, readCacheStats, PREMIUM_GOVERNOR_THRESHOLD } =
  require('../dashboard/api/hamr-coverage-handlers.js');
const { renderHamrPanel } = require('../dashboard/js/hamr-panel.js');

const NOW = 1_780_000_000_000;
const rec = (over) => ({ ts: NOW, provider: 'gemini', tier: 'free-cloud', cache_eligible: true,
  cache_read_tokens: 0, ...over });

test('shapes provider + tier mix and hit-rate from records', () => {
  const out = computeHamrCoverage([rec({ cache_read_tokens: 5 }), rec({ provider: 'groq' })], NOW);
  assert.equal(out.total_calls_7d, 2);
  assert.equal(out.coverage_rate, 0.5); // 1 of 2 eligible had a cache read
  assert.deepEqual(out.providers.map((p) => p.name).sort(), ['gemini', 'groq']);
});

test('AC2 governor: premium-share over threshold trips breached=true', () => {
  const recs = [rec({ tier: 'premium' }), rec({ tier: 'haiku' }), rec({ tier: 'fleet' })];
  const out = computeHamrCoverage(recs, NOW);
  assert.ok(out.premium_share_7d > PREMIUM_GOVERNOR_THRESHOLD);
  assert.equal(out.governor.breached, true);
});

test('AC2 governor: all free/fleet lane stays within budget (breached=false)', () => {
  const recs = [rec({ cache_read_tokens: 9 }), rec({ tier: 'fleet', cache_read_tokens: 9 })];
  const out = computeHamrCoverage(recs, NOW);
  assert.equal(out.governor.breached, false);
});

test('AC6 graceful: empty / null / non-array input never throws', () => {
  for (const input of [[], null, undefined]) {
    const out = computeHamrCoverage(input, NOW);
    assert.equal(out.total_calls_7d, 0);
    assert.equal(out.governor.breached, false);
  }
});

test('AC6 graceful: records older than 7d are excluded', () => {
  const out = computeHamrCoverage([rec({ ts: NOW - 8 * 86400000 })], NOW);
  assert.equal(out.total_calls_7d, 0);
});

test('readCacheStats on a missing file returns [] (no throw)', () => {
  assert.deepEqual(readCacheStats('/no/such/hamr/cache-stats.jsonl'), []);
});

test('AC5 secret-safe: payload exposes only names/counts/rates — no token/value fields', () => {
  const out = computeHamrCoverage([rec({ input_tokens: 9999, output_tokens: 42 })], NOW);
  const json = JSON.stringify(out);
  assert.ok(!json.includes('input_tokens') && !json.includes('output_tokens'));
  assert.ok(!json.includes('9999'));
});

test('renderHamrPanel: empty payload degrades to a labeled empty state (no throw)', () => {
  assert.match(renderHamrPanel(null), /No HAMR coverage/);
});

test('renderHamrPanel: breached governor renders the warning badge + shape marker', () => {
  const html = renderHamrPanel(computeHamrCoverage([rec({ tier: 'premium' })], NOW));
  assert.match(html, /hamr-panel-warn/);
  assert.match(html, /over budget/);
});
