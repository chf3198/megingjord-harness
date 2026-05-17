'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { evaluate, capForLane, DEFAULT_CAPS_USD } = require('../scripts/global/provider-price-cap-gate.js');

test('free + fleet lanes always allow (no cap)', () => {
  const r1 = evaluate({ lane: 'free', estimatedCostUsd: 999 });
  const r2 = evaluate({ lane: 'fleet', estimatedCostUsd: 999 });
  assert.equal(r1.allow, true);
  assert.equal(r2.allow, true);
  assert.equal(r1.over_cap, false);
});

test('haiku allowed under cap', () => {
  const r = evaluate({ lane: 'haiku', estimatedCostUsd: 0.01 });
  assert.equal(r.allow, true);
  assert.equal(r.over_cap, false);
  assert.equal(r.escalation_reason, null);
});

test('premium blocked when over cap, no override', () => {
  const r = evaluate({ lane: 'premium', estimatedCostUsd: 0.30 });
  assert.equal(r.allow, false);
  assert.equal(r.over_cap, true);
  assert.equal(r.override_used, false);
  assert.equal(r.escalation_reason, 'price-cap');
});

test('premium allowed when over cap WITH explicit override', () => {
  const r = evaluate({ lane: 'premium', estimatedCostUsd: 0.30, override: true });
  assert.equal(r.allow, true);
  assert.equal(r.over_cap, true);
  assert.equal(r.override_used, true);
  assert.equal(r.escalation_reason, 'price-cap-override');
});

test('haiku blocked at boundary above cap', () => {
  const cap = DEFAULT_CAPS_USD.haiku;
  const just_over = cap + 0.001;
  const r = evaluate({ lane: 'haiku', estimatedCostUsd: just_over });
  assert.equal(r.allow, false);
  assert.equal(r.escalation_reason, 'price-cap');
});

test('cost exactly equal to cap is allowed (≤ semantics)', () => {
  const cap = DEFAULT_CAPS_USD.premium;
  const r = evaluate({ lane: 'premium', estimatedCostUsd: cap });
  assert.equal(r.allow, true);
  assert.equal(r.over_cap, false);
});

test('capForLane returns Infinity for free/fleet', () => {
  assert.equal(capForLane('free'), Infinity);
  assert.equal(capForLane('fleet'), Infinity);
});

test('unknown lane falls back to premium cap', () => {
  const cap = capForLane('mystery-lane');
  assert.equal(cap, DEFAULT_CAPS_USD.premium);
});

test('output shape includes policy_version + escalation_reason fields per #1797 taxonomy', () => {
  const r = evaluate({ lane: 'premium', estimatedCostUsd: 0.30 });
  assert.equal(typeof r.policy_version, 'string');
  assert.ok(['price-cap', 'price-cap-override', null].includes(r.escalation_reason));
  assert.equal(typeof r.cap_usd, 'number');
});

test('decision is deterministic / pure (no side effects in evaluate)', () => {
  const a = evaluate({ lane: 'haiku', estimatedCostUsd: 0.01 });
  const b = evaluate({ lane: 'haiku', estimatedCostUsd: 0.01 });
  assert.deepEqual(a, b);
});
