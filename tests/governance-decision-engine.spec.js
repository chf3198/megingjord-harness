'use strict';
// #2483 unit tests for the governance decision engine. Verifies deterministic per-transition
// x per-lane x per-runtime-profile gating, fail-closed behavior, and the Decision contract.
// Design semantics ratified by cross-model consensus (meta+mistral, 2026-07-13).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { evaluate, loadPolicy, isEnabled, POLICY_PATH } =
  require('../scripts/global/governance-decision-engine.js');
const { resolveCheckSet, applyProfile, defaultCheck } =
  require('../scripts/global/governance-decision-resolve.js');

const NOW = '2026-07-13T00:00:00.000Z';
const POLICY = loadPolicy();
const base = (over = {}) => ({ transition: 'manager_to_collaborator', lane: 'code-change',
  runtime_profile: 'ci', inputs: {}, ...over });
// all-pass inputs for the 'full' set
const FULL_PASS = { 'signer-fidelity': 'pass', 'test-evidence': 'pass', 'doc-coverage': 'pass',
  'merge-evidence': 'pass', 'lint-required': 'pass' };

test('AC1: loadPolicy loads shipped config, version pinned to 1', () => {
  assert.equal(POLICY.version, 1);
  assert.ok(POLICY.check_sets.full.includes('signer-fidelity'));
});

test('AC1: loadPolicy throws (fail-closed) on absent file', () => {
  assert.throws(() => loadPolicy(path.join(os.tmpdir(), 'no-such-policy-2483.json')), /unreadable/);
});

test('AC1: loadPolicy throws (fail-closed) on malformed JSON', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gde-')), 'p.json');
  fs.writeFileSync(f, '{ not json');
  assert.throws(() => loadPolicy(f), /unreadable/);
});

test('AC2: full set, all inputs pass => allow; audit_trace complete', () => {
  const d = evaluate(base({ inputs: FULL_PASS }), { policy: POLICY, now: NOW });
  assert.equal(d.decision, 'allow');
  assert.equal(d.audit_trace.resolved_check_set, 'full');
  assert.equal(d.audit_trace.timestamp, NOW);
  assert.equal(d.checks.length, 5);
});

test('Q1 fail-closed: a missing input => fail => block', () => {
  const inputs = { ...FULL_PASS }; delete inputs['merge-evidence'];
  const d = evaluate(base({ inputs }), { policy: POLICY, now: NOW });
  assert.equal(d.decision, 'block');
  assert.equal(d.checks.find((c) => c.id === 'merge-evidence').reason, 'missing-input');
});

test('lane override: docs-research resolves the docs check-set', () => {
  const d = evaluate(base({ lane: 'docs-research', inputs: { 'signer-fidelity': 'pass',
    'doc-coverage': 'pass', 'lint-md': 'pass' } }), { policy: POLICY, now: NOW });
  assert.equal(d.audit_trace.resolved_check_set, 'docs');
  assert.equal(d.decision, 'allow');
});

test('lane override: trivial resolves the trivial check-set', () => {
  const d = evaluate(base({ lane: 'trivial', inputs: { 'signer-fidelity': 'pass', 'lint-required': 'pass' } }),
    { policy: POLICY, now: NOW });
  assert.equal(d.audit_trace.resolved_check_set, 'trivial');
});

test('fail-closed: unknown transition => block with error', () => {
  const d = evaluate(base({ transition: 'bogus_transition' }), { policy: POLICY, now: NOW });
  assert.equal(d.decision, 'block');
  assert.equal(d.audit_trace.error, 'unknown-transition');
});

test('unknown lane falls back to default_check_set (full)', () => {
  const d = evaluate(base({ lane: 'made-up-lane', inputs: FULL_PASS }), { policy: POLICY, now: NOW });
  assert.equal(d.audit_trace.resolved_check_set, 'full');
});

test('runtime_profile ci: all_checks_blocking suppresses advisory downgrade', () => {
  const plan = applyProfile(['a', 'b', 'c'], { advisory_after: ['a'], all_checks_blocking: true });
  assert.ok(plan.every((s) => s.blocking));
});

test('Q3 advisory_after: local downgrades checks AFTER doc-coverage to advisory', () => {
  // fail a check that comes after doc-coverage (merge-evidence) => advisory, not block
  const inputs = { ...FULL_PASS, 'merge-evidence': 'fail' };
  const d = evaluate(base({ runtime_profile: 'local', inputs }), { policy: POLICY, now: NOW });
  const me = d.checks.find((c) => c.id === 'merge-evidence');
  assert.equal(me.blocking, false);
  assert.equal(d.decision, 'advisory');
  // doc-coverage itself stays blocking
  assert.equal(d.checks.find((c) => c.id === 'doc-coverage').blocking, true);
});

test('Q3 advisory_after: a BEFORE-boundary failure still blocks under local', () => {
  const inputs = { ...FULL_PASS, 'signer-fidelity': 'fail' };
  const d = evaluate(base({ runtime_profile: 'local', inputs }), { policy: POLICY, now: NOW });
  assert.equal(d.decision, 'block');
});

test('runtime_profile offline: merge-evidence is skipped, not failed', () => {
  const inputs = { ...FULL_PASS }; delete inputs['merge-evidence'];
  const d = evaluate(base({ runtime_profile: 'offline', inputs }), { policy: POLICY, now: NOW });
  const me = d.checks.find((c) => c.id === 'merge-evidence');
  assert.equal(me.status, 'skip');
  assert.equal(d.decision, 'allow');
  assert.ok(d.degradations.some((x) => x.reason === 'skip:merge-evidence'));
});

test('registry override: a custom check fn is used instead of the default resolver', () => {
  let called = false;
  const checks = { 'signer-fidelity': () => { called = true; return { status: 'pass' }; } };
  const d = evaluate(base({ inputs: FULL_PASS }), { policy: POLICY, now: NOW, checks });
  assert.ok(called);
  assert.equal(d.decision, 'allow');
});

test('audit clarity: advisory degradation recorded only for a FAILING downgraded check', () => {
  // passing advisory check => no advisory degradation entry
  const pass = evaluate(base({ runtime_profile: 'local', inputs: FULL_PASS }), { policy: POLICY, now: NOW });
  assert.ok(!pass.degradations.some((x) => String(x.reason).startsWith('advisory:')));
  // failing advisory check => exactly one advisory degradation entry
  const fail = evaluate(base({ runtime_profile: 'local', inputs: { ...FULL_PASS, 'merge-evidence': 'fail' } }),
    { policy: POLICY, now: NOW });
  assert.ok(fail.degradations.some((x) => x.reason === 'advisory:merge-evidence'));
});

test('Q2 aggregation: a blocking fail dominates a concurrent advisory fail', () => {
  const inputs = { ...FULL_PASS, 'signer-fidelity': 'fail', 'merge-evidence': 'fail' };
  const d = evaluate(base({ runtime_profile: 'local', inputs }), { policy: POLICY, now: NOW });
  assert.equal(d.decision, 'block'); // signer-fidelity (blocking) fails
});

test('signer-fidelity is universal across every lane check-set', () => {
  for (const name of Object.keys(POLICY.check_sets)) {
    assert.ok(POLICY.check_sets[name].includes('signer-fidelity'), `${name} missing signer-fidelity`);
  }
});

test('isEnabled reads MEGINGJORD_DECISION_ENGINE (off by default)', () => {
  assert.equal(isEnabled({}), false);
  assert.equal(isEnabled({ MEGINGJORD_DECISION_ENGINE: '1' }), true);
});

test('defaultCheck accepts boolean / status-string / object forms', () => {
  assert.equal(defaultCheck({ inputs: { x: true } }, 'x').status, 'pass');
  assert.equal(defaultCheck({ inputs: { x: false } }, 'x').status, 'fail');
  assert.equal(defaultCheck({ inputs: { x: 'skip' } }, 'x').status, 'skip');
  assert.equal(defaultCheck({ inputs: { x: { status: 'pass', reason: 'r' } } }, 'x').reason, 'r');
  assert.equal(defaultCheck({ inputs: {} }, 'x').status, 'fail');
});

test('resolveCheckSet reports unknown-check-set when name is dangling', () => {
  const bad = { transitions: { t: { default_check_set: 'ghost' } }, check_sets: {}, runtime_profiles: {} };
  assert.equal(resolveCheckSet(bad, 't', 'code-change').error, 'unknown-check-set');
});
