'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const parity = require('../scripts/global/governance-rule-parity');

test('rule parity reports the known drift classes', () => {
  const report = parity.run({ write: false });
  const ids = report.findings.map(f => f.id).sort();
  assert.deepEqual(ids, ['lane-enum-drift', 'merge-evidence-linkage-drift']);
  assert.equal(report.status, 'drift-detected');
  assert.equal(report.blocked, false);
});

test('rule parity finds a blocking introduced conflict in pr mode', () => {
  const report = parity.run({ write: false, mode: 'pr', introducedFindings: ['lane-enum-drift'] });
  const conflict = report.findings.find(f => f.id === 'lane-enum-drift');
  assert.equal(conflict.severity, 'hard');
  assert.equal(report.blocked, true);
});

test('rule parity findings carry evidence and carve-out tagging', () => {
  const report = parity.run({ write: false });
  const merge = report.findings.find(f => f.id === 'merge-evidence-linkage-drift');
  assert.equal(merge.severity, 'advisory');
  assert.equal(merge.carvedOut, true);
  assert.ok(Array.isArray(merge.evidence));
  assert.ok(merge.recommendation.length > 0);
});

test('nightly parity dedupes open drift issues', () => {
  const report = parity.run({ write: false, openDriftIssues: ['lane-enum-drift'] });
  assert.equal(report.duplicateOpenIssues.some(f => f.id === 'lane-enum-drift'), true);
  assert.equal(report.newFindings.some(f => f.id === 'lane-enum-drift'), false);
});

test('dedupeFindings keeps a single record per id', () => {
  const duped = parity.dedupeFindings([{ id: 'x' }, { id: 'x' }, { id: 'y' }]);
  assert.deepEqual(duped.map(f => f.id), ['x', 'y']);
});
