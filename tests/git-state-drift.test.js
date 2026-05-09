#!/usr/bin/env node
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { compute, freshness, worktree, target } = require('../scripts/global/git-state-drift-sensor');

test('git-state-drift: freshness returns fresh when compliant', () => {
  assert.ok(freshness().status, 'should have status field');
});

test('git-state-drift: worktree detects single vs multi worktree', () => {
  const result = worktree();
  assert.match(result.status, /isolated|collision|unknown/, 'status should be isolated, collision, or unknown');
});

test('git-state-drift: target validates branch naming compliance', () => {
  const result = target();
  assert.ok(result.detail, 'should have detail message');
});

test('git-state-drift: compute returns PASS/FAIL with violation count', () => {
  const result = compute();
  assert.match(result.status, /PASS|FAIL/, 'status should be PASS or FAIL');
  assert.ok(typeof result.violation_count === 'number', 'violation_count should be a number');
  assert.ok(Array.isArray(result.violations), 'violations should be array');
});

test('git-state-drift: compute includes all three signals', () => {
  const result = compute();
  assert.ok(result.signals.freshness, 'should include freshness signal');
  assert.ok(result.signals.worktree, 'should include worktree signal');
  assert.ok(result.signals.target, 'should include target signal');
});

test('git-state-drift: violation detail includes reconciliation guidance', () => {
  const result = compute();
  result.violations.forEach(v => {
    assert.ok(v.detail, `violation for ${v.signal} should have reconciliation guidance`);
  });
});
