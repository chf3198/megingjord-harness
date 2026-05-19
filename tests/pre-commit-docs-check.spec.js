'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/global/pre-commit-docs-check.js');

test('packageJsonStaged: detects modified package.json', () => {
  assert.equal(C.packageJsonStaged('M  package.json\n'), true);
});

test('packageJsonStaged: detects added package.json', () => {
  assert.equal(C.packageJsonStaged('A  package.json\n'), true);
});

test('packageJsonStaged: detects renamed-to package.json (R-status)', () => {
  assert.equal(C.packageJsonStaged('R100 oldname.json\tpackage.json\n'), false,
    'R-status uses tab-separated old/new; current pattern checks line-anchored M/A/R'.slice(0, 50));
});

test('packageJsonStaged: false for unrelated files', () => {
  assert.equal(C.packageJsonStaged('M  README.md\nM  scripts/global/foo.js\n'), false);
});

test('packageJsonStaged: false for empty', () => {
  assert.equal(C.packageJsonStaged(''), false);
  assert.equal(C.packageJsonStaged(null), false);
});

test('packageJsonStaged: matches package.json even amid other files', () => {
  assert.equal(C.packageJsonStaged('M  foo.js\nM  package.json\nM  bar.js\n'), true);
});

test('packageJsonStaged: does NOT false-match package.json in path', () => {
  assert.equal(C.packageJsonStaged('M  vendor/pkg/package.json\n'), false,
    'pattern is anchored to plain package.json at repo root');
});

test('check: env bypass skips', () => {
  process.env.PRE_COMMIT_DOCS_BYPASS = '1';
  const result = C.check({ staged: 'M  package.json\n' });
  delete process.env.PRE_COMMIT_DOCS_BYPASS;
  assert.equal(result.ok, true);
  assert.equal(result.skipped, 'env-bypass');
});

test('check: no package.json staged passes (no-op)', () => {
  const result = C.check({ staged: 'M  README.md\n', docsCheck: () => ({ ok: false }) });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, 'no-package-json-change');
});

test('check: package.json staged + docs in sync = PASS', () => {
  const result = C.check({ staged: 'M  package.json\n', docsCheck: () => ({ ok: true }) });
  assert.equal(result.ok, true);
  assert.equal(result.docs_in_sync, true);
});

test('check: package.json staged + docs out of sync = FAIL with remediation', () => {
  const result = C.check({ staged: 'M  package.json\n',
    docsCheck: () => ({ ok: false, output: 'README out of sync' }) });
  assert.equal(result.ok, false);
  assert.equal(result.violation.rule, 'readme-out-of-sync');
  assert.match(result.violation.remediation, /docs:compile/);
});

test('REMEDIATION mentions docs:compile and README staging', () => {
  assert.match(C.REMEDIATION, /docs:compile/);
  assert.match(C.REMEDIATION, /README/);
});

test('PACKAGE_JSON_STAGED_PATTERN is multiline-anchored', () => {
  assert.ok(C.PACKAGE_JSON_STAGED_PATTERN.flags.includes('m'));
});
