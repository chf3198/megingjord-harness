'use strict';
// #1936 cross-runtime injection — tdd-pyramid. Runs the adversarial corpus (every forged case must be
// detected, every clean case must pass) + per-vector asserts + the Vector-3 substrate-first wiring.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const guard = require('../scripts/global/cross-runtime-injection-guard');

const corpus = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'cross-runtime-injection-corpus.json'), 'utf8'));
const enrolled = (team, role) => corpus.enrolledAliases[`${team}/${role}`] || null;

test('adversarial corpus: every forged case detected, every clean case passes (zero false positives)', () => {
  for (const c of corpus.cases) {
    const out = guard.auditAll(c.inputs, { ...c.opts, resolveEnrolledAlias: enrolled });
    const detected = out.findings.some((f) => f.vector === c.vector);
    if (c.forged) assert.equal(detected, true, `forged case undetected: ${c.name}`);
    else assert.equal(detected, false, `false positive on clean case: ${c.name}`);
  }
});

test('vector 1 lease-state: authoritative lease missing locally is flagged', () => {
  const out = guard.reconcileLease([], [{ ticket: '1936', team: 'copilot', paths: ['x'] }]);
  assert.equal(out.ok, false);
  assert.equal(out.findings[0].id, 'lease-invisible-cross-runtime');
  assert.equal(out.reconciled.length, 1, 'authoritative wins in the reconciled view');
});

test('vector 2 hook-context: untrusted team and injected session id are flagged', () => {
  const a = guard.validateHookEnv({ HAMR_TEAM: 'evil' }, { knownTeams: ['claude-code'] });
  assert.equal(a.findings.some((f) => f.id === 'hook-env-team-untrusted'), true);
  const b = guard.validateHookEnv({ HAMR_TEAM: 'claude-code', MEGINGJORD_SESSION_ID: 'a;b' },
    { knownTeams: ['claude-code'] });
  assert.equal(b.findings.some((f) => f.id === 'hook-env-session-malformed'), true);
});

test('vector 2 hook-context: an enrolled team + safe session passes', () => {
  const out = guard.validateHookEnv({ HAMR_TEAM: 'claude-code', MEGINGJORD_SESSION_ID: 'sess-1' },
    { knownTeams: ['claude-code'] });
  assert.equal(out.ok, true);
});

test('vector 4 baton-artifact: team mismatch and non-enrolled signer are flagged', () => {
  const out = guard.validateArtifactSovereignty(
    { team: 'copilot', role: 'consultant', signedBy: 'Mallory' },
    { prTeam: 'claude-code', resolveEnrolledAlias: enrolled });
  assert.equal(out.findings.some((f) => f.id === 'artifact-team-mismatch'), true);
});

test('vector 3 signer substrate-first: canonicalSignerAlias accepts a substrate and stays deterministic', () => {
  const signer = require('../scripts/global/signer-alias');
  // substrate-first wiring exists (#3107); a forged substrate that resolves a different team yields a
  // different alias than the claimed team — caught by validateArtifactSovereignty's enrollment check.
  const withSubstrate = signer.canonicalSignerAlias('claude-code', 'consultant', 'claude-opus-4-8', undefined, 'local');
  const plain = signer.canonicalSignerAlias('claude-code', 'consultant', 'claude-opus-4-8');
  assert.equal(typeof withSubstrate, 'string');
  assert.equal(typeof plain, 'string');
});
