'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { readMinimumTier, assertTier } = require('../scripts/global/tier-assert');

test('readMinimumTier: unset → null (advisory)', () => {
  assert.strictEqual(readMinimumTier({}), null);
});
test('readMinimumTier: valid integer in range', () => {
  assert.strictEqual(readMinimumTier({ MEGINGJORD_MINIMUM_TIER: '3' }), 3);
  assert.strictEqual(readMinimumTier({ MEGINGJORD_MINIMUM_TIER: '0' }), 0);
});
test('readMinimumTier: out-of-range or junk → null', () => {
  assert.strictEqual(readMinimumTier({ MEGINGJORD_MINIMUM_TIER: '9' }), null);
  assert.strictEqual(readMinimumTier({ MEGINGJORD_MINIMUM_TIER: 'x' }), null);
  assert.strictEqual(readMinimumTier({ MEGINGJORD_MINIMUM_TIER: '2.5' }), null);
});

test('assertTier: unset → advisory ok', () => {
  const r = assertTier(4, { env: {} });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.action, 'advisory');
});
test('assertTier: required <= asserted → ok', () => {
  const r = assertTier(1, { env: { MEGINGJORD_MINIMUM_TIER: '3' } });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.action, 'ok');
});
test('assertTier: required > asserted → fail-closed fallback', () => {
  const r = assertTier(3, { env: { MEGINGJORD_MINIMUM_TIER: '1' }, feature: 'mailbox' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.action, 'fallback');
  assert.match(r.message, /requires tier 3/);
});
test('assertTier: invalid requiredTier throws', () => {
  assert.throws(() => assertTier(7, { env: {} }), RangeError);
  assert.throws(() => assertTier(-1, { env: {} }), RangeError);
});
