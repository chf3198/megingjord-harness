'use strict';
// tdd-pyramid unit suite for the #3766 stuck-state hook bridge — the live-hook consumer of the
// shipped #3748 detector + #3059 adjudication-guardrail. Asserts advisory routing, carve-out
// escalation, and fail-safe behavior (never throws, never a client prompt).
const test = require('node:test');
const assert = require('node:assert');
const B = require('../scripts/global/stuck-state-hook-bridge');

test('classifyStuck: no signals -> not detected (advisory)', () => {
  const r = B.classifyStuck({});
  assert.equal(r.detected, false);
  assert.equal(r.advisory, true);
});

test('classifyStuck: loop-fingerprint -> detected, route=adjudicate (autonomous)', () => {
  const inv = [{ tool: 'Bash', command: 'npm test' }, { tool: 'Bash', command: 'npm test' }, { tool: 'Bash', command: 'npm test' }];
  const r = B.classifyStuck({ invocations: inv });
  assert.equal(r.detected, true);
  assert.ok(r.triggers.includes('loop-fingerprint'));
  assert.equal(r.route, 'adjudicate');
});

test('classifyStuck: ambiguous-gate explicit -> route=adjudicate (no client prompt)', () => {
  const r = B.classifyStuck({ explicit: 'ambiguous-gate' });
  assert.equal(r.detected, true);
  assert.equal(r.route, 'adjudicate');
});

test('classifyStuck: irreversible/high-destructive gate -> route=human-carveout (escalates)', () => {
  const r = B.classifyStuck({ iterationCount: 25, reversibility: 'irreversible', blastRadius: 'high-destructive' });
  assert.equal(r.detected, true);
  assert.equal(r.route, 'human-carveout');
  assert.equal(r.tier, 'irreversible');
});

test('classifyStuck: never throws on adversarial input', () => {
  for (const bad of [null, undefined, 42, 'x', { invocations: 'nope' }, { sampledResolutions: 5 }]) {
    assert.doesNotThrow(() => B.classifyStuck(bad));
  }
});

test('routeStuck: reaches adjudication-guardrail.decide() for a detected stuck-state', async () => {
  let called = false;
  const fakeDecide = async (decision) => { called = true; return { route: 'adjudicate', chosen: 1, question: decision.question }; };
  const inv = [{ tool: 'Bash', command: 'npm test' }, { tool: 'Bash', command: 'npm test' }, { tool: 'Bash', command: 'npm test' }];
  const r = await B.routeStuck({ invocations: inv }, { decide: fakeDecide });
  assert.equal(called, true, 'decide() must be invoked on a detected stuck-state');
  assert.equal(r.detected, true);
  assert.equal(r.decision.route, 'adjudicate');
});

test('routeStuck: a throwing decide() degrades to fail-safe self-resolve (never a client prompt)', async () => {
  const boom = async () => { throw new Error('panel down'); };
  const r = await B.routeStuck({ explicit: 'novel-failure' }, { decide: boom });
  assert.equal(r.detected, true);
  assert.equal(r.decision.route, 'self-resolve');
  assert.equal(r.decision.degraded, true);
});
