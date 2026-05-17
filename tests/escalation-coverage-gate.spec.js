'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  run, computeCoverage, isEscalation, ESCALATION_OUTCOMES, COVERAGE_TARGET,
} = require('../scripts/global/escalation-coverage-gate.js');

test('isEscalation recognizes fail, escalated, fallback outcomes', () => {
  assert.equal(isEscalation({ outcome: 'fail' }), true);
  assert.equal(isEscalation({ outcome: 'escalated' }), true);
  assert.equal(isEscalation({ outcome: 'fallback' }), true);
  assert.equal(isEscalation({ outcome: 'FAIL' }), true); // case-insensitive
  assert.equal(isEscalation({ outcome: 'ok' }), false);
  assert.equal(isEscalation({}), false);
});

test('computeCoverage returns null when no escalation events', () => {
  const r = computeCoverage([{ outcome: 'ok' }, { outcome: 'ok' }]);
  assert.equal(r.total, 0);
  assert.equal(r.coverage, null);
  assert.deepEqual(r.topReasons, []);
});

test('computeCoverage returns 100% when all escalations carry reasons', () => {
  const events = [
    { outcome: 'fail', escalation_reason: 'fleet-unavailable' },
    { outcome: 'fail', escalation_reason: 'rate-limit' },
    { outcome: 'ok' },
  ];
  const r = computeCoverage(events);
  assert.equal(r.total, 2);
  assert.equal(r.withReason, 2);
  assert.equal(r.coverage, 100);
});

test('computeCoverage returns 0% when no escalations have reasons', () => {
  const events = [
    { outcome: 'fail' },
    { outcome: 'fail', escalation_reason: '' }, // empty string counts as no-reason
    { outcome: 'fail', escalation_reason: null },
  ];
  const r = computeCoverage(events);
  assert.equal(r.total, 3);
  assert.equal(r.withReason, 0);
  assert.equal(r.coverage, 0);
});

test('computeCoverage produces top reasons sorted by count', () => {
  const events = [
    { outcome: 'fail', escalation_reason: 'fleet-unavailable' },
    { outcome: 'fail', escalation_reason: 'fleet-unavailable' },
    { outcome: 'fail', escalation_reason: 'fleet-unavailable' },
    { outcome: 'fail', escalation_reason: 'rate-limit' },
    { outcome: 'fail', escalation_reason: 'rate-limit' },
    { outcome: 'fail', escalation_reason: 'budget-cap' },
  ];
  const r = computeCoverage(events);
  assert.equal(r.coverage, 100);
  assert.equal(r.topReasons[0].reason, 'fleet-unavailable');
  assert.equal(r.topReasons[0].count, 3);
  assert.equal(r.topReasons[1].reason, 'rate-limit');
  assert.equal(r.topReasons[2].reason, 'budget-cap');
});

test('run passes ok=true when no escalation events present', () => {
  const r = run({ events: [{ outcome: 'ok' }] });
  assert.equal(r.ok, true);
  assert.equal(r.total, 0);
});

test('run fails when coverage below target', () => {
  const events = [
    { outcome: 'fail' },
    { outcome: 'fail' },
    { outcome: 'fail' },
    { outcome: 'fail', escalation_reason: 'fleet-unavailable' },
  ];
  const r = run({ events, target: 95 });
  assert.equal(r.ok, false);
  assert.equal(r.coverage, 25);
});

test('run passes when coverage meets target', () => {
  const events = Array.from({ length: 20 }, (_, i) => ({
    outcome: 'fail', escalation_reason: i < 19 ? 'fleet-unavailable' : null,
  }));
  const r = run({ events, target: 95 });
  assert.equal(r.ok, true);
  assert.equal(r.coverage, 95);
});

test('default target is 95', () => {
  assert.equal(COVERAGE_TARGET, 95);
});

test('ESCALATION_OUTCOMES is a Set with three entries', () => {
  assert.equal(ESCALATION_OUTCOMES.size, 3);
  assert.ok(ESCALATION_OUTCOMES.has('fail'));
});
