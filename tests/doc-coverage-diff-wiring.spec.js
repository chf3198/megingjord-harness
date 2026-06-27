'use strict';
// Refs #3122 — proves the gate wiring: AC1 the diff-membership violation is BLOCKING
// (severity error) once the replay-eval gate promotes it, and AC2 the now-wired
// structuralCheck advisory fires through the doc-coverage caller (checkBlock).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const docCoverage = require('../scripts/global/megalint/doc-coverage');
const reval = require('../scripts/global/megalint/doc-coverage-diff-replay-eval');

test('AC1: diff-membership violation is blocking (error) once promoted', () => {
  reval._resetCache(); // default committed corpus is promotion-eligible
  const violations = docCoverage.diffVerifyViolations(
    { 'docs/x.md': 'UPDATED — note' }, ['docs/x.md'], ['scripts/other.js'], os.tmpdir());
  const diff = violations.find((v) => v.rule === 'doc-coverage-updated-not-in-diff');
  assert.ok(diff, 'a diff-membership violation should be emitted for the absent surface');
  assert.strictEqual(diff.severity, 'error', 'promoted check must block');
});

test('AC1 rollback: env kill-switch keeps the diff violation advisory', () => {
  reval._resetCache();
  process.env[reval.DISABLE_ENV] = '1';
  try {
    const violations = docCoverage.diffVerifyViolations(
      { 'docs/x.md': 'UPDATED — note' }, ['docs/x.md'], ['scripts/other.js'], os.tmpdir());
    const diff = violations.find((v) => v.rule === 'doc-coverage-updated-not-in-diff');
    assert.strictEqual(diff.severity, 'advisory');
  } finally { delete process.env[reval.DISABLE_ENV]; reval._resetCache(); }
});

test('AC2: structuralCheck is invoked through checkBlock and flags a stub surface (advisory)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-'));
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'stub.md'), 'tiny'); // <300 bytes, no headers
  const matrix = { 'area:governance': { required: ['docs/stub.md'], suggested: [] } };
  const body = 'doc-coverage:\n  docs/stub.md: UPDATED — wired\n';
  const violations = docCoverage.checkBlock(
    body, ['area:governance'], matrix, null, ['docs/stub.md'], dir);
  const sub = violations.find((v) => v.rule === 'doc-coverage-surface-substandard');
  assert.ok(sub, 'structuralCheck advisory should fire for the stub surface');
  assert.strictEqual(sub.severity, 'advisory');
  assert.match(sub.detail, /too-short|no-section-headers/);
});

test('AC2: a healthy declared surface produces no structural advisory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-'));
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'good.md'),
    '# Heading\n\n' + 'x'.repeat(400) + '\n');
  const advisories = docCoverage.structuralAdvisories(['docs/good.md'], dir);
  assert.strictEqual(advisories.length, 0);
});

test('AC2: directory surfaces are skipped by the structural advisory (no false positive)', () => {
  const advisories = docCoverage.structuralAdvisories(['docs/howto/'], os.tmpdir());
  assert.strictEqual(advisories.length, 0);
});
