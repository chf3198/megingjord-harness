'use strict';
// tests/parity-replay-eval.spec.js — eval-harness for #3454 (Epic #3411 T3.4)
// The fixture under tests/eval/parity-matrix-corpus.json IS the eval-harness evidence.
// node --test

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { scoreCorpus, detectDrift, PROMOTION_PRECISION } = require('../scripts/global/harness-parity-replay-eval-score');
const { auditRecord, isDisabled, AUDIT_SCHEMA } = require('../scripts/global/harness-parity-replay-eval-audit');
const { loadCorpus, runCli } = require('../scripts/global/harness-parity-replay-eval');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORPUS_PATH = path.join(__dirname, 'eval', 'parity-matrix-corpus.json');

// ---------------------------------------------------------------------------
// scoreCorpus: committed corpus returns numeric precision/recall + boolean promotionEligible
// ---------------------------------------------------------------------------
test('scoreCorpus over committed corpus returns valid precision and recall', () => {
  const corpus = loadCorpus(CORPUS_PATH);
  const result = scoreCorpus(corpus, REPO_ROOT);
  assert.ok(typeof result.precision === 'number', 'precision must be a number');
  assert.ok(typeof result.recall === 'number', 'recall must be a number');
  assert.ok(result.precision >= 0 && result.precision <= 1, `precision out of range: ${result.precision}`);
  assert.ok(result.recall >= 0 && result.recall <= 1, `recall out of range: ${result.recall}`);
  process.stdout.write(`\n[corpus] precision=${result.precision} recall=${result.recall} promotionEligible=${result.promotionEligible}\n`);
});

// ---------------------------------------------------------------------------
// scoreCorpus: legit-waiver-excluded samples excluded from denominator
// ---------------------------------------------------------------------------
test('scoreCorpus excludes legit-waiver-excluded samples from precision denominator', () => {
  const waiverSample = {
    id: 'ex-001', description: 'tested waiver — excluded',
    cell: { featureId: 'test-waiver', runtime: 'claude-code', declaredStatus: 'structural-NA',
      ssotFiles: ['scripts/global/detect-runtime.js'], hasSubstituteTest: true,
      substituteTest: 'tests/harness-parity-matrix.spec.js' },
    label: 'legit-waiver-excluded',
  };
  const genuineSample = {
    id: 'ex-002', description: 'genuine gap',
    cell: { featureId: 'missing-feat', runtime: 'claude-code', declaredStatus: 'full',
      ssotFiles: ['scripts/global/__nonexistent__.js'], hasSubstituteTest: false },
    label: 'genuine-lowering',
  };
  const result = scoreCorpus([waiverSample, genuineSample], REPO_ROOT);
  assert.strictEqual(result.excludedCount, 1, 'waiver sample must increment excludedCount');
  assert.ok(result.truePositives + result.falsePositives + result.falseNegatives === 1,
    'only the genuine-lowering sample should be scored');
});

// ---------------------------------------------------------------------------
// scoreCorpus: promotionEligible is exactly precision >= 0.85
// ---------------------------------------------------------------------------
test('promotionEligible equals (precision >= PROMOTION_PRECISION)', () => {
  const corpus = loadCorpus(CORPUS_PATH);
  const result = scoreCorpus(corpus, REPO_ROOT);
  assert.strictEqual(typeof result.promotionEligible, 'boolean', 'promotionEligible must be boolean');
  assert.strictEqual(result.promotionEligible, result.precision >= PROMOTION_PRECISION,
    `promotionEligible=${result.promotionEligible} but precision=${result.precision}`);
});

// ---------------------------------------------------------------------------
// scoreCorpus: a synthetic corpus with a false positive lowers precision
// ---------------------------------------------------------------------------
test('a false-positive sample lowers precision below a clean corpus', () => {
  const genuineSample = {
    id: 'fp-001',
    cell: { featureId: 'real-gap', runtime: 'claude-code', declaredStatus: 'full',
      ssotFiles: ['scripts/global/__nonexistent_fp__.js'], hasSubstituteTest: false },
    label: 'genuine-lowering',
  };
  const falsePositiveSample = {
    id: 'fp-002',
    cell: { featureId: 'ok-feat', runtime: 'claude-code', declaredStatus: 'full',
      ssotFiles: ['scripts/global/__nonexistent_fp2__.js'], hasSubstituteTest: false },
    label: 'legit-NA',
  };
  const cleanResult = scoreCorpus([genuineSample], REPO_ROOT);
  const noisyResult = scoreCorpus([genuineSample, falsePositiveSample], REPO_ROOT);
  assert.ok(noisyResult.precision <= cleanResult.precision,
    `Noisy precision ${noisyResult.precision} should be <= clean ${cleanResult.precision}`);
  assert.strictEqual(noisyResult.falsePositives, 1, 'false positive must be counted');
});

// ---------------------------------------------------------------------------
// detectDrift: returns a rate between 0 and 1
// ---------------------------------------------------------------------------
test('detectDrift returns a driftRate between 0 and 1', () => {
  const samples = [
    { id: 'd-001', cell: { featureId: 'drift-feat', runtime: 'claude-code', declaredStatus: 'full',
        ssotFiles: ['scripts/global/__nonexistent_drift__.js'], hasSubstituteTest: false } },
    { id: 'd-002', cell: { featureId: 'ok-drift', runtime: 'claude-code', declaredStatus: 'full',
        ssotFiles: ['scripts/global/detect-runtime.js'], hasSubstituteTest: false } },
  ];
  const result = detectDrift(samples, REPO_ROOT);
  assert.ok(typeof result.driftRate === 'number', 'driftRate must be a number');
  assert.ok(result.driftRate >= 0 && result.driftRate <= 1, `driftRate out of range: ${result.driftRate}`);
  assert.ok(typeof result.total === 'number', 'total must be a number');
  assert.ok(Array.isArray(result.items), 'items must be an array');
});

// ---------------------------------------------------------------------------
// auditRecord: emits parity-replay-audit-v1 schema with all required fields
// ---------------------------------------------------------------------------
test('auditRecord emits parity-replay-audit-v1 schema', () => {
  const corpus = loadCorpus(CORPUS_PATH);
  const scoreResult = scoreCorpus(corpus, REPO_ROOT);
  const record = auditRecord(scoreResult, { ts: '2026-07-01T00:00:00.000Z', ticket: 3454 });
  assert.strictEqual(record.schema, AUDIT_SCHEMA, `Expected schema ${AUDIT_SCHEMA}`);
  assert.strictEqual(record.schema, 'parity-replay-audit-v1');
  assert.strictEqual(record.ts, '2026-07-01T00:00:00.000Z');
  assert.strictEqual(record.ticket, 3454);
  assert.ok(typeof record.precision === 'number', 'precision required in audit record');
  assert.ok(typeof record.recall === 'number', 'recall required in audit record');
  assert.ok(typeof record.promotionEligible === 'boolean', 'promotionEligible required in audit record');
  assert.ok('excludedCount' in record, 'excludedCount required in audit record');
});

// ---------------------------------------------------------------------------
// PARITY_REPLAY_DISABLED=1 no-ops the CLI
// ---------------------------------------------------------------------------
test('PARITY_REPLAY_DISABLED=1 makes runCli a no-op', () => {
  const fakeEnv = { PARITY_REPLAY_DISABLED: '1' };
  const exitCode = runCli([], fakeEnv);
  assert.strictEqual(exitCode, 0, 'runCli must exit 0 when disabled');
  assert.strictEqual(isDisabled(fakeEnv), true, 'isDisabled must return true when flag set');
  assert.strictEqual(isDisabled({}), false, 'isDisabled must return false without flag');
});
