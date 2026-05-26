// Refs #2205 - tests for router enforcement gate
const test = require('node:test');
const assert = require('node:assert/strict');
const { enforceRouter, isFleetEligible, validateOverride, FLEET_ELIGIBLE_HINTS, OVERRIDE_TIERS } = require('../scripts/global/router-enforcement.js');

test('isFleetEligible: fleet-keyword task is eligible', () => {
  assert.equal(isFleetEligible({ description: 'dispatch to fleet model qwen2.5-coder:32b' }), true);
});

test('isFleetEligible: redteam artifact is eligible', () => {
  assert.equal(isFleetEligible({ artifactType: 'redteam-review' }), true);
});

test('isFleetEligible: lane:trivial is not eligible', () => {
  assert.equal(isFleetEligible({ lane: 'lane:trivial', description: 'fleet' }), false);
});

test('isFleetEligible: plain code task is not eligible', () => {
  assert.equal(isFleetEligible({ description: 'add unit test' }), false);
});

test('isFleetEligible: null returns false', () => {
  assert.equal(isFleetEligible(null), false);
});

test('validateOverride: well-formed override passes', () => {
  assert.equal(validateOverride({ tier: 'diagnostic', reason: 'health-check-probe' }).ok, true);
});

test('validateOverride: missing override fails', () => {
  assert.equal(validateOverride(null).ok, false);
});

test('validateOverride: unknown tier rejected', () => {
  const r = validateOverride({ tier: 'bogus', reason: 'whatever-long-enough' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /not-allowed/);
});

test('validateOverride: short reason rejected', () => {
  const r = validateOverride({ tier: 'diagnostic', reason: 'no' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /too-short/);
});

test('enforceRouter: non-fleet-eligible task passes', () => {
  const r = enforceRouter({ task: { description: 'add comment' } });
  assert.equal(r.ok, true);
});

test('enforceRouter: fleet-eligible + HAMR used = pass', () => {
  const r = enforceRouter({ task: { description: 'dispatch to fleet' }, usedHamr: true });
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'hamr-used');
});

test('enforceRouter: fleet-eligible + valid override = pass', () => {
  const r = enforceRouter({
    task: { description: 'fleet probe' },
    override: { tier: 'diagnostic', reason: 'health-probe-via-cli' },
  });
  assert.equal(r.ok, true);
  assert.match(r.reason, /override-approved/);
});

test('enforceRouter: fleet-eligible bypass = fail', () => {
  const r = enforceRouter({ task: { description: 'dispatch ollama fleet model' } });
  assert.equal(r.ok, false);
  assert.match(r.reason, /bypassed HAMR/);
});

test('FLEET_ELIGIBLE_HINTS exported', () => {
  assert.ok(FLEET_ELIGIBLE_HINTS.includes('fleet'));
  assert.ok(FLEET_ELIGIBLE_HINTS.includes('ollama'));
});

test('OVERRIDE_TIERS exported includes diagnostic', () => {
  assert.ok(OVERRIDE_TIERS.includes('diagnostic'));
});
