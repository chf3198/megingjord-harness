'use strict';
// #3765 (Epic #3719 capstone): sustained-proof loop. tdd-pyramid.
// Unit: checkSustained — sustained iff the last N cycles all clear coverage>=0.95 & staleness<=0.10.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkSustained } = require('../scripts/wiki/sustained-proof.js');

const good = { coverage_ratio: 1, stale_ratio: 0 };
const bad = { coverage_ratio: 0.5, stale_ratio: 1 };

test('fewer than N cycles → not yet sustained (accruing)', () => {
  const r = checkSustained([good, good, good], { n: 5 });
  assert.equal(r.sustained, false);
  assert.equal(r.recorded, 3);
  assert.equal(r.trailingPassing, 3);
});

test('last N cycles all hold → sustained', () => {
  const r = checkSustained([good, good, good, good, good], { n: 5 });
  assert.equal(r.sustained, true);
});

test('a failing cycle within the window → not sustained', () => {
  const r = checkSustained([good, good, bad, good, good], { n: 5 });
  assert.equal(r.sustained, false);
  assert.equal(r.anyFailingInWindow, true);
});

test('a failing cycle resets the trailing streak', () => {
  const r = checkSustained([good, good, bad, good, good], { n: 5 });
  assert.equal(r.trailingPassing, 2);
});

test('boundary: coverage exactly 0.95 & staleness exactly 0.10 pass', () => {
  const edge = { coverage_ratio: 0.95, stale_ratio: 0.10 };
  const r = checkSustained([edge, edge, edge, edge, edge], { n: 5 });
  assert.equal(r.sustained, true);
});

test('more than N recorded → only the trailing N window is judged', () => {
  const r = checkSustained([bad, bad, good, good, good, good, good], { n: 5 });
  assert.equal(r.sustained, true, 'old failures outside the trailing-N window do not count');
});
