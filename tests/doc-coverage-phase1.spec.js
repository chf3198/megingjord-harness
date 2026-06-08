// Refs #2719 — Phase-1 doc-coverage tests C1-C4
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, loadMatrix, checkBlock, surfacesForLabels } = require(
  '../scripts/global/megalint/doc-coverage.js');
const { loadNaReasons } = require('../scripts/global/megalint/doc-coverage-helpers.js');

// C1: hard block (advisory removed)
test('C1: blocks on missing doc-coverage block', () => {
  const r = validate({ labels: ['area:governance'], body: '', comments: [] });
  assert.equal(r.ok, false, 'should block');
});
test('C1: DOC_COVERAGE_GATE_ADVISORY has no effect', () => {
  const orig = process.env.DOC_COVERAGE_GATE_ADVISORY;
  process.env.DOC_COVERAGE_GATE_ADVISORY = '1';
  const r = validate({ labels: ['area:governance'], body: '', comments: [] });
  process.env.DOC_COVERAGE_GATE_ADVISORY = orig;
  assert.equal(r.ok, false, 'advisory mode must no longer bypass');
});

// C2: split matrix + 4 new area labels
test('C2: loads 13+ area labels from split matrix', () => {
  const m = loadMatrix();
  assert.ok(Object.keys(m).length >= 13, Object.keys(m).join(', '));
});
test('C2: 4 new area labels present', () => {
  const m = loadMatrix();
  for (const a of ['area:tests', 'area:config', 'area:ci', 'area:research'])
    assert.ok(m[a], `missing: ${a}`);
});
test('C2: area:agents uses doc path', () => {
  const m = loadMatrix();
  const req = m['area:agents'] && m['area:agents'].required || [];
  assert.ok(req.some(s => s.includes('docs/') || s.endsWith('.md')),
    `got: ${req}`);
});

// C3: N/A reason enum
test('C3: 9 canonical N/A reasons loadable', () => {
  const r = loadNaReasons();
  assert.ok(r && r.length >= 9, `got ${r && r.length}`);
  assert.ok(r.includes('out-of-scope') && r.includes('test-only-change'));
});
test('C3: invalid N/A reason triggers doc-coverage-invalid-na', () => {
  const m = loadMatrix();
  const body = 'doc-coverage:\n  .changes/unreleased/: N/A — made-up-reason\n';
  const v = checkBlock(body, ['area:governance'], m);
  assert.ok(v.some(x => x.rule === 'doc-coverage-invalid-na'), JSON.stringify(v));
});
test('C3: valid N/A reason passes', () => {
  const m = loadMatrix();
  const req = surfacesForLabels(['area:governance'], m).required;
  const entries = req.map(s => `  ${s}: N/A — out-of-scope`).join('\n');
  assert.equal(checkBlock('doc-coverage:\n' + entries + '\n', ['area:governance'], m).length, 0);
});

// C4: change_type dimension
test('C4: feature-add requires README.md', () => {
  const m = loadMatrix();
  const { required } = surfacesForLabels(['area:dashboard'], m, 'feature-add');
  assert.ok(required.includes('README.md'), `required: ${required}`);
});
test('C4: test-only demotes README.md', () => {
  const m = loadMatrix();
  const base = surfacesForLabels(['area:scripts'], m).required;
  const testOnly = surfacesForLabels(['area:scripts'], m, 'test-only').required;
  if (base.includes('README.md')) assert.ok(!testOnly.includes('README.md'));
});
