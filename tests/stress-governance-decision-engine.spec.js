'use strict';
// #2483 stress tests for the governance decision engine — adversarial/malformed `context`
// corpus (G6 resilience: engine is a parser over externally-sourced ticket fields) + a p99
// latency budget (G7). The engine is pure; it must never throw on a bad context (only a
// malformed POLICY throws, exercised in the unit spec), and it must fail closed on garbage.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { evaluate, loadPolicy } = require('../scripts/global/governance-decision-engine.js');

const POLICY = loadPolicy();
const DECISIONS = new Set(['allow', 'block', 'advisory']);

// Fault-injection corpus: each entry must yield a well-formed Decision, never a throw.
const CORPUS = [
  null,
  undefined,
  {},
  { transition: 'manager_to_collaborator' },
  { transition: 'manager_to_collaborator', lane: 'code-change', runtime_profile: 'ci' },
  { transition: 42, lane: {}, runtime_profile: [], inputs: 7 },
  { transition: 'manager_to_collaborator', lane: 'code-change', inputs: null },
  { transition: 'x'.repeat(5000), lane: 'y'.repeat(5000), runtime_profile: 'ci', inputs: {} },
  { transition: 'consultant_to_done', lane: 'no-code-remediation', runtime_profile: 'offline', inputs: {} },
  { transition: 'manager_to_collaborator', lane: 'code-change', runtime_profile: 'ci',
    inputs: { 'signer-fidelity': { status: 'nonsense' }, 'test-evidence': [] } },
  // prototype-pollution-shaped keys must not corrupt evaluation
  { transition: 'manager_to_collaborator', lane: 'code-change', runtime_profile: 'ci',
    inputs: JSON.parse('{"__proto__":{"polluted":true},"signer-fidelity":"pass"}') },
];

test('G6: adversarial contexts never throw and always return a valid Decision', () => {
  for (const ctx of CORPUS) {
    const d = evaluate(ctx, { policy: POLICY, now: '2026-07-13T00:00:00.000Z' });
    assert.ok(DECISIONS.has(d.decision), `bad decision for ${JSON.stringify(ctx)}`);
    assert.ok(Array.isArray(d.checks));
    assert.ok(d.audit_trace && typeof d.audit_trace.timestamp === 'string');
  }
  assert.equal({}.polluted, undefined, 'prototype must not be polluted');
});

test('G6 fail-closed: garbage / empty inputs never yield allow on a real check-set', () => {
  const d = evaluate({ transition: 'manager_to_collaborator', lane: 'code-change',
    runtime_profile: 'ci', inputs: {} }, { policy: POLICY, now: 'x' });
  assert.equal(d.decision, 'block'); // every check missing => fail-closed
});

test('G7: p99 latency budget < 2ms/eval over 5000 iterations (pure, no IO)', () => {
  const ctx = { transition: 'admin_to_consultant', lane: 'code-change', runtime_profile: 'ci',
    inputs: { 'signer-fidelity': 'pass', 'test-evidence': 'pass', 'doc-coverage': 'pass',
      'merge-evidence': 'pass', 'lint-required': 'pass' } };
  const N = 5000;
  const samples = new Array(N);
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint();
    evaluate(ctx, { policy: POLICY, now: 'x' });
    samples[i] = Number(process.hrtime.bigint() - t0) / 1e6; // ms
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(N * 0.99)];
  assert.ok(p99 < 2, `p99 ${p99.toFixed(4)}ms exceeded 2ms budget`);
});
