// Refs #2178 - tests for fleet-local tier + ollama pinning
const test = require('node:test');
const assert = require('node:assert/strict');
const { pickStickyProvider, TIER_PROVIDER_MAP } = require('../scripts/global/sticky-route.js');

test('fleet-local tier registered', () => {
  assert.ok(TIER_PROVIDER_MAP['fleet-local']);
  assert.deepEqual(TIER_PROVIDER_MAP['fleet-local'], ['ollama']);
});

test('fleet-local returns ollama provider', () => {
  const r = pickStickyProvider('fleet-local');
  assert.equal(r.provider, 'ollama');
  assert.match(r.reason, /ollama_for_tier_fleet-local/);
});

test('fleet-local with previousProvider=ollama stays sticky', () => {
  const r = pickStickyProvider('fleet-local', { previousProvider: 'ollama' });
  assert.equal(r.provider, 'ollama');
  assert.equal(r.sticky, true);
});

test('fleet-local with unhealthy ollama returns null', () => {
  const r = pickStickyProvider('fleet-local', {
    substrateHealth: { providers: { ollama: { available: false } } },
  });
  assert.equal(r.provider, null);
});

test('fleet tier still picks first-of [groq, cerebras, ...] (unchanged)', () => {
  const r = pickStickyProvider('fleet');
  assert.equal(r.provider, 'groq');
});

test('free tier still ollama-first (unchanged)', () => {
  const r = pickStickyProvider('free');
  assert.equal(r.provider, 'ollama');
});
