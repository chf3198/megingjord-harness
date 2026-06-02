// Refs #2429 — extended blocking tests for doc-coverage and changelog-fragment
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkBlock, surfacesForLabels, loadMatrix } = require(
  '../scripts/global/megalint/doc-coverage.js');
const { validate: cfValidate } = require(
  '../scripts/global/megalint/changelog-fragment-presence.js');
const { run } = require('../scripts/global/megalint/index.js');

const matrix = loadMatrix();
const mkBlock = (entries) =>
  'doc-coverage:\n' + Object.entries(entries).map(([k, v]) => `  ${k}: ${v}`).join('\n') + '\n';

// checkBlock: all 9 area labels emit violation when block absent
for (const label of Object.keys(matrix)) {
  const req = surfacesForLabels([label], matrix).required;
  if (!req || req.length === 0) continue;
  test(`checkBlock: violation on absent block for ${label}`, () => {
    const v = checkBlock('', [label], matrix);
    assert.ok(v.some(x => x.rule === 'doc-coverage-missing'),
      `expected blocking violation for ${label}: ${JSON.stringify(v)}`);
  });
  test(`checkBlock: passes with complete block for ${label}`, () => {
    const entries = Object.fromEntries(req.map(s => [s, 'DONE — test']));
    const v = checkBlock(mkBlock(entries), [label], matrix);
    assert.equal(v.length, 0, `unexpected violations for ${label}: ${JSON.stringify(v)}`);
  });
}

// surfacesForLabels: multi-label union
test('surfacesForLabels: unions required from multiple labels', () => {
  const s = surfacesForLabels(['area:governance', 'area:hooks'], matrix);
  assert.ok(s.required.includes('.changes/unreleased/'));
  assert.ok(s.required.includes('docs/howto/hooks.md'));
});

test('checkBlock: bare N/A without reason is blocking', () => {
  const v = checkBlock('doc-coverage:\n  .changes/unreleased/: N/A\n', ['area:governance'], matrix);
  assert.ok(v.some(x => x.rule === 'doc-coverage-missing'));
});

// changelog-fragment-presence wired in megalint VALIDATORS
test('changelog-fragment-presence registered in megalint run()', () => {
  const result = run('changelog-fragment-presence', {
    labels: ['lane:code-change'],
    prBody: 'Refs #9999\n',
    prFiles: ['.changes/unreleased/9999.md'],
  });
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('changelog-fragment-presence blocking when fragment absent', () => {
  const result = run('changelog-fragment-presence', {
    labels: ['lane:code-change'],
    prBody: 'Refs #9998\n',
    prFiles: ['src/index.js'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.reason && result.reason.includes('missing-fragment'), result.reason);
});

// changelog-fragment standalone: skip-marker bypasses check
test('cfValidate: [skip-changelog] bypasses fragment requirement', () => {
  const r = cfValidate({
    labels: ['lane:code-change'], prBody: 'Refs #1\n[skip-changelog]', prFiles: [],
  });
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'skip-marker-present');
});
