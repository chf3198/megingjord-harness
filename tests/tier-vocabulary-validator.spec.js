'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const tv = require(path.resolve(__dirname, '..', 'scripts', 'global', 'tier-vocabulary-validator.js'));

const REPO = path.resolve(__dirname, '..');
const POLICY = tv.loadPolicy(REPO);

test('the canonical policy yields a non-empty legal tier set incl diagnostic', () => {
  const legal = tv.legalTiers(POLICY);
  assert.ok(legal.has('fleet'));
  assert.ok(legal.has('diagnostic'));
});

test('a legal fleet tier passes', () => {
  assert.strictEqual(tv.validateTier('ollama', 'fleet', POLICY).ok, true);
  assert.strictEqual(tv.validateTier('ollama', 'diagnostic', POLICY).ok, true);
});

test('an illegal fleet tier is rejected (P1-7 mis-label)', () => {
  const r = tv.validateTier('ollama', 'fleet-local', POLICY);
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some((v) => v.rule === 'fleet-tier-not-in-vocabulary'));
});

test('a non-fleet provider is not gated by this validator', () => {
  assert.strictEqual(tv.validateTier('anthropic', 'whatever', POLICY).ok, true);
});

test('null/absent tier is allowed (not all calls specify a tier)', () => {
  assert.strictEqual(tv.validateTier('ollama', null, POLICY).ok, true);
});

test('scanSource flags a wrapProviderCall with an illegal fleet tier', () => {
  const src = "const r = await wrapProviderCall('ollama', cb, { tier: 'fleet-local' });";
  const v = tv.scanSource(src, POLICY);
  assert.ok(v.some((x) => x.rule === 'fleet-tier-not-in-vocabulary'));
});

test('scanSource passes a wrapProviderCall with a legal fleet tier', () => {
  const src = "await wrapProviderCall('ollama', cb, { tier: 'fleet' });";
  assert.deepStrictEqual(tv.scanSource(src, POLICY), []);
});
