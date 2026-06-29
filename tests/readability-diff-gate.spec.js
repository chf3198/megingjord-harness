'use strict';

// tdd-pyramid unit tests for the diff-aware readability gate (#1434).
// Covers: net-new detection, baseline-drift ignored, new-file handling,
// path filtering, and base-ref resolution / missing-base fallback.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const {
  checkContent,
  isScannedJs,
  sumNetNew,
  resolveBaseRef,
  verifyRef,
} = require('../scripts/global/lint-readability-core');

const CLI = path.resolve(__dirname, '..', 'scripts', 'lint-readability.js');

test('checkContent flags single-letter vars, magic numbers, and long functions', () => {
  const single = checkContent('const x = 1;\n', 'scripts/sample.js');
  assert.equal(single.some(w => w.rule === 'naming'), true);

  const magic = checkContent('const total = items + 256;\n', 'scripts/sample.js');
  assert.equal(magic.some(w => w.rule === 'magic-number'), true);

  const clean = checkContent('const itemCount = items + 100;\n', 'scripts/sample.js');
  assert.equal(clean.length, 0, 'descriptive name + allowed number is clean');
});

test('isScannedJs includes scripts/ and dashboard/js, excludes specs and other paths', () => {
  assert.equal(isScannedJs('scripts/global/foo.js'), true);
  assert.equal(isScannedJs('dashboard/js/app.js'), true);
  assert.equal(isScannedJs('tests/foo.spec.js'), false);
  assert.equal(isScannedJs('scripts/global/lint-readability-core.js'), false, 'self-excluded');
  assert.equal(isScannedJs('docs/foo.js'), false);
  assert.equal(isScannedJs('scripts/foo.md'), false);
});

test('sumNetNew counts only positive per-file deltas (new regressions)', () => {
  const result = sumNetNew([{ file: 'scripts/a.js', current: 5, base: 3 }]);
  assert.equal(result.netNew, 2);
  assert.equal(result.regressions.length, 1);
  assert.equal(result.regressions[0].delta, 2);
});

test('sumNetNew ignores pre-existing baseline drift (delta <= 0)', () => {
  // file is unchanged in warning count, or improved — must NOT fail the gate
  const unchanged = sumNetNew([{ file: 'scripts/a.js', current: 9, base: 9 }]);
  assert.equal(unchanged.netNew, 0);
  const improved = sumNetNew([{ file: 'scripts/a.js', current: 4, base: 7 }]);
  assert.equal(improved.netNew, 0);
  assert.equal(improved.regressions.length, 0);
});

test('sumNetNew treats a new file (base 0) as fully net-new', () => {
  const result = sumNetNew([{ file: 'scripts/new.js', current: 3, base: 0 }]);
  assert.equal(result.netNew, 3);
});

test('sumNetNew does not let an improvement mask a regression elsewhere', () => {
  const result = sumNetNew([
    { file: 'scripts/improved.js', current: 1, base: 5 },
    { file: 'scripts/regressed.js', current: 4, base: 2 },
  ]);
  assert.equal(result.netNew, 2, 'only the +2 regression counts; -4 improvement does not offset');
});

test('resolveBaseRef returns null for an unverifiable base (missing-base fallback)', () => {
  assert.equal(verifyRef('definitely-not-a-real-ref-1434'), false);
  assert.equal(resolveBaseRef('definitely-not-a-real-ref-1434'), null);
});

test('resolveBaseRef resolves a real ref (HEAD always exists in a checkout)', () => {
  assert.equal(resolveBaseRef('HEAD'), 'HEAD');
});

test('CLI --changed-only --json emits a parseable changed-only report', () => {
  const out = execFileSync('node', [CLI, '--changed-only=HEAD', '--json'], { encoding: 'utf8' });
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.mode, 'changed-only');
  assert.equal(typeof parsed.netNew, 'number');
});

test('CLI falls back to absolute mode when the base ref is unavailable', () => {
  const out = execFileSync('node',
    [CLI, '--changed-only=no-such-ref-xyz', '--max-warnings=100000', '--json'],
    { encoding: 'utf8' });
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.mode, 'absolute', 'unavailable base degrades to the absolute gate');
});
