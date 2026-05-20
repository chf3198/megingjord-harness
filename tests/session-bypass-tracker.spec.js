'use strict';
// Unit tests for session-bypass-tracker.js (AC4, #1715)
const test = require('node:test');
const assert = require('node:assert/strict');
const tracker = require('../scripts/global/session-bypass-tracker');

test('count increments on each bypass-env record call', () => {
  tracker.reset();
  assert.equal(tracker.getCount(), 0);
  tracker.record({ SKIP_CLOSEOUT_PREFLIGHT: '1' });
  assert.equal(tracker.getCount(), 1);
  tracker.record({ PUSH_GATES_BYPASS: '1' });
  assert.equal(tracker.getCount(), 2);
});

test('threshold-reached: warns when count reaches THRESHOLD', () => {
  tracker.reset();
  const msgs = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { msgs.push(s); return true; };
  tracker.record({ SKIP_CLOSEOUT_PREFLIGHT: '1' });
  const r2 = tracker.record({ PUSH_GATES_BYPASS: '1' });
  process.stderr.write = orig;
  assert.equal(r2.warned, true, 'warned should be true at threshold');
  assert.equal(r2.count, 2);
  assert.ok(msgs.some(m => m.includes('Tier-2 anneal triggered')), 'stderr should mention anneal');
});

test('threshold-not-reached: no warning on first use', () => {
  tracker.reset();
  const msgs = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { msgs.push(s); return true; };
  const r1 = tracker.record({ SKIP_CLOSEOUT_PREFLIGHT: '1' });
  process.stderr.write = orig;
  assert.equal(r1.warned, false, 'warned should be false below threshold');
  assert.equal(r1.count, 1);
  assert.equal(msgs.length, 0, 'no stderr output before threshold');
});
