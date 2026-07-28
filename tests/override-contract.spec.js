'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const oc = require('../scripts/global/megalint/override-contract');

test('hard-floor control override is REJECTED (by id and by alias)', () => {
  assert.equal(oc.checkOverrides({ 'signer-independence': true }).ok, false);
  const r = oc.checkOverrides({ 'signer-fidelity': 'off' });
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].rule, 'hard-floor-override-rejected');
  assert.equal(r.violations[0].control, 'signer-independence');
  assert.equal(oc.checkOverrides({ merge_authority: 1 }).ok, false);
});

test('Tier-A / Tier-C overrides are ALLOWED (not hard-floor)', () => {
  assert.equal(oc.checkOverrides({
    doc_coverage_gate_advisory: true, hamr_disabled: true, test_floor_disabled: true,
  }).ok, true);
  assert.equal(oc.checkOverrides({}).ok, true);
});

test('fail-closed: unreadable hard-floor config rejects any override', () => {
  const r = oc.checkOverrides({ anything: 1 }, null);
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].rule, 'hard-floor-config-unavailable');
  // ...but no overrides + no floor is still ok (nothing to protect against)
  assert.equal(oc.checkOverrides({}, null).ok, true);
});

test('isHardFloor distinguishes hard-floor from Tier-A', () => {
  assert.equal(oc.isHardFloor('credential_prompt_guard'), true);
  assert.equal(oc.isHardFloor('secret-scan'), true);
  assert.equal(oc.isHardFloor('PHASE0_GATE_BYPASS'), false);
  assert.equal(oc.isHardFloor('skip_closeout_preflight'), false);
});

test('norm collapses punctuation/case consistently', () => {
  assert.equal(oc.norm('Signer_Independence'), 'signer-independence');
  assert.equal(oc.norm('  merge--authority  '), 'merge-authority');
});
