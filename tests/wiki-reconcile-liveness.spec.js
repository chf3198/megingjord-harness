'use strict';
// #3759 (Epic #3719): wiki reconcile liveness SLO. tdd-pyramid.
// Unit: checkLiveness (fresh / stale / no-success / ignores-non-success). Golden: the monitor is scheduled
// and hard-fails (not advisory), and the durable failure-alert is generalized to work-log-mirror.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { checkLiveness } = require('../scripts/wiki/reconcile-liveness.js');

const NOW = Date.parse('2026-07-13T12:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3600 * 1000).toISOString();

test('live: a successful run within 24h → ok', () => {
  const r = checkLiveness([{ conclusion: 'success', createdAt: hoursAgo(3) }], NOW);
  assert.equal(r.ok, true);
  assert.equal(r.stale, false);
  assert.ok(r.ageHours >= 2.9 && r.ageHours <= 3.1);
});

test('stale: newest success older than 24h → breach', () => {
  const r = checkLiveness([
    { conclusion: 'failure', createdAt: hoursAgo(2) },
    { conclusion: 'success', createdAt: hoursAgo(30) },
  ], NOW);
  assert.equal(r.ok, false);
  assert.equal(r.stale, true);
  assert.equal(r.reason, 'stale');
});

test('no-success: only failures → breach (no-successful-run)', () => {
  const r = checkLiveness([{ conclusion: 'failure', createdAt: hoursAgo(1) }], NOW);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-successful-run');
});

test('empty run history → breach', () => {
  assert.equal(checkLiveness([], NOW).ok, false);
});

test('uses the most-recent success (recent success wins over older failure)', () => {
  const r = checkLiveness([
    { conclusion: 'success', createdAt: hoursAgo(1) },
    { conclusion: 'failure', createdAt: hoursAgo(0.5) },
  ], NOW);
  assert.equal(r.ok, true);
});

test('GOLDEN: liveness monitor is scheduled + hard-fails (not advisory)', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/wiki-reconcile-liveness.yml'), 'utf8');
  assert.match(yml, /schedule:/, 'must be scheduled');
  assert.match(yml, /reconcile-liveness\.js/, 'runs the checker');
  assert.ok(!/continue-on-error:\s*true/.test(yml), 'must hard-fail, not advisory');
  assert.match(yml, /issues:\s*write/, 'needs issues:write for the durable alert');
});

test('GOLDEN: durable failure-alert generalized to work-log-mirror', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/wiki-work-log-mirror.yml'), 'utf8');
  assert.match(yml, /if:\s*\$\{\{\s*failure\(\)\s*\}\}/, 'must have if: failure() alert step');
  assert.match(yml, /gh issue create/, 'files a durable issue');
  assert.match(yml, /issues:\s*write/, 'needs issues:write');
});
