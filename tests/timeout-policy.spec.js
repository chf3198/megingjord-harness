// Refs #2201 - tests for adaptive timeout policy
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { getTimeout, loadPolicy, classFromModel, listClasses } = require('../scripts/global/timeout-policy.js');

const POLICY = loadPolicy();

test('loadPolicy: returns object with default_ms and classes', () => {
  assert.equal(typeof POLICY.default_ms, 'number');
  assert.ok(POLICY.classes && Object.keys(POLICY.classes).length > 0);
});

test('classFromModel: qwen2.5-coder:32b -> fleet-red-team-rate', () => {
  assert.equal(classFromModel('qwen2.5-coder:32b'), 'fleet-red-team-rate');
});

test('classFromModel: qwen2.5-coder:7b -> fleet-dispatch-basic', () => {
  assert.equal(classFromModel('qwen2.5-coder:7b'), 'fleet-dispatch-basic');
});

test('classFromModel: gemma3:1b -> ollama-chromebook-local', () => {
  assert.equal(classFromModel('gemma3:1b'), 'ollama-chromebook-local');
});

test('classFromModel: unknown model -> null', () => {
  assert.equal(classFromModel('unknown-model'), null);
});

test('classFromModel: undefined -> null', () => {
  assert.equal(classFromModel(undefined), null);
});

test('getTimeout: qwen2.5-coder:32b returns fleet-red-team-rate budget (1500s)', () => {
  const ms = getTimeout({ model: 'qwen2.5-coder:32b' });
  assert.equal(ms, 1500000);
});

test('getTimeout: hamr-cache-stat workload returns 30s', () => {
  const ms = getTimeout({ workloadClass: 'hamr-cache-stat' });
  assert.equal(ms, 30000);
});

test('getTimeout: unknown class falls back to default_ms', () => {
  const ms = getTimeout({ workloadClass: 'does-not-exist' });
  assert.equal(ms, POLICY.default_ms);
});

test('getTimeout: lane:trivial multiplier halves budget', () => {
  const ms = getTimeout({ model: 'qwen2.5-coder:32b', lane: 'lane:trivial' });
  assert.equal(ms, 750000);
});

test('getTimeout: lane:code-change preserves budget (multiplier 1.0)', () => {
  const ms = getTimeout({ model: 'qwen2.5-coder:32b', lane: 'lane:code-change' });
  assert.equal(ms, 1500000);
});

test('getTimeout: lane:config-only applies 0.75 multiplier', () => {
  const ms = getTimeout({ workloadClass: 'fleet-dispatch-basic', lane: 'lane:config-only' });
  assert.equal(ms, 225000);
});

test('listClasses: returns ≥5 class names', () => {
  const names = listClasses();
  assert.ok(names.length >= 5);
  assert.ok(names.includes('fleet-red-team-rate'));
  assert.ok(names.includes('hamr-cache-stat'));
});

test('REGRESSION: 600s hardcoded ceiling replaced by 1200s for qwen2.5-coder:32b', () => {
  // Phase-0 #2174 dog-food observed 907s p99 against 600s bound — this should now bound at 1200s.
  const ms = getTimeout({ model: 'qwen2.5-coder:32b' });
  assert.ok(ms >= 900000, `qwen2.5-coder:32b timeout=${ms}ms — must accommodate observed 907s p99`);
});
