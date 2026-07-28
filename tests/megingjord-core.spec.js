'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../packages/megingjord-core/src/index');

test('createCore exposes a versioned contract', () => {
  const api = core.createCore();
  assert.equal(api.version, core.CONTRACT_VERSION);
  assert.equal(typeof api.version, 'string');
});

test('goal-lens orders G1 above G3 above G10', () => {
  const { goalLens } = core.createCore();
  assert.equal(goalLens.order[0], 'G1');
  assert.ok(goalLens.rank('G1') < goalLens.rank('G3'));
  assert.ok(goalLens.compare('G3', 'G10') < 0);
  assert.throws(() => goalLens.rank('G99'), RangeError);
});

test('classifyCarveOut catches the four retained touchpoints', () => {
  const { classifyCarveOut } = core.createCore();
  assert.equal(classifyCarveOut('run vsce publish to the marketplace').class, 'irreversible');
  assert.equal(classifyCarveOut('this is a product go/no-go design direction').class, 'design');
  assert.equal(classifyCarveOut('does this look like what you expected?').class, 'uat');
  assert.equal(classifyCarveOut('disable the merge gate for this PR').class, 'security-weakening');
});

test('benign dev questions are NOT carve-outs (no over-escalation)', () => {
  const { isRetainedTouchpoint } = core.createCore();
  assert.equal(isRetainedTouchpoint('which file should I edit?'), false);
  assert.equal(isRetainedTouchpoint('rename the variable to userCount'), false);
});
