'use strict';
// tdd-pyramid unit spec for the C5 honest-degradation wrapper (Epic #3807 / #3813).
const { test, expect } = require('@playwright/test');
const {
  classifyLivenessError, honestSignal, isCannotVerify, guardExternalGate, degradeDefault,
} = require('../scripts/global/honest-degradation.js');

test('classifyLivenessError flags reachability errors, not correctness errors', () => {
  expect(classifyLivenessError({ code: 'ECONNREFUSED' })).toBe(true);
  expect(classifyLivenessError(new Error('fetch failed'))).toBe(true);
  expect(classifyLivenessError(new Error('request timed out'))).toBe(true);
  expect(classifyLivenessError(new Error('assertion failed: score < 7'))).toBe(false);
  expect(classifyLivenessError(null)).toBe(false);
});

test('unreachable probe degrades to cannot-verify with an operator-visible signal, never throws', async () => {
  const result = await guardExternalGate({ name: 'panel', probe: async () => false, evaluate: async () => ({ pass: true }) });
  expect(result.status).toBe('cannot-verify');
  expect(result.reachable).toBe(false);
  expect(isCannotVerify(result)).toBe(true);
  expect(result.signal).toContain('cannot-verify');
  expect(result.signal).toContain('NOT a failure');
});

test('a liveness error thrown by the probe degrades honestly, not a hard block', async () => {
  const result = await guardExternalGate({
    name: 'gh', probe: async () => { const e = new Error('gh-fetch-failed'); throw e; }, evaluate: async () => ({ pass: false }),
  });
  expect(result.status).toBe('cannot-verify');
});

test('reachable dependency runs the real pass/fail check', async () => {
  const passed = await guardExternalGate({ name: 'g', probe: async () => true, evaluate: async () => ({ pass: true }) });
  expect(passed.status).toBe('pass');
  const failed = await guardExternalGate({ name: 'g', probe: async () => true, evaluate: async () => ({ pass: false }) });
  expect(failed.status).toBe('fail');
});

test('a genuine (non-liveness) evaluate error surfaces — never masqueraded as a degrade', async () => {
  let threw = false;
  try {
    await guardExternalGate({ name: 'g', probe: async () => true, evaluate: async () => { throw new Error('null pointer in verdict builder'); } });
  } catch (err) { threw = true; expect(err.message).toContain('null pointer'); }
  expect(threw).toBe(true);
});

test('degradeDefault only claims the preferred path when availability is asserted', () => {
  expect(degradeDefault('mcp', { asserted: true, disabled: false, fallback: 'gh-cli' })).toBe('mcp');
  expect(degradeDefault('mcp', { asserted: false, disabled: false, fallback: 'gh-cli' })).toBe('gh-cli');
  expect(degradeDefault('mcp', { asserted: true, disabled: true, fallback: 'gh-cli' })).toBe('gh-cli');
});

test('honestSignal is non-silent and names the gate', () => {
  expect(honestSignal('receipt-gate', 'panel offline')).toContain('receipt-gate');
});
