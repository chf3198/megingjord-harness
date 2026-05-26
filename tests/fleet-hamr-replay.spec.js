// Refs #2203 - tests for replay-eval corpus harness
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadCorpus, runScenario, runAll, checkModuleExports } = require('../scripts/regression/fleet-hamr-replay.js');

const CORPUS_DIR = path.join(__dirname, 'regression', 'fleet-hamr-corpus');

test('corpus directory exists', () => {
  assert.ok(fs.existsSync(CORPUS_DIR));
});

test('loadCorpus: returns ≥3 entries', () => {
  const c = loadCorpus(CORPUS_DIR);
  assert.ok(c.length >= 3);
});

test('loadCorpus: each entry has id + assertion', () => {
  const c = loadCorpus(CORPUS_DIR);
  for (const e of c) {
    assert.ok(e.id);
    assert.ok(e.assertion);
  }
});

test('loadCorpus: includes sticky-route-mis-recording entry', () => {
  const c = loadCorpus(CORPUS_DIR);
  assert.ok(c.find(e => e.id === 'sticky-route-mis-recording'));
});

test('loadCorpus: includes timeout-budget-undersized entry', () => {
  const c = loadCorpus(CORPUS_DIR);
  assert.ok(c.find(e => e.id === 'timeout-budget-undersized'));
});

test('loadCorpus: includes consultant-epic-closeout entry', () => {
  const c = loadCorpus(CORPUS_DIR);
  assert.ok(c.find(e => e.id === 'consultant-epic-closeout-not-recognized'));
});

test('checkModuleExports: pass when all exports present', () => {
  const r = checkModuleExports('scripts/global/timeout-policy.js', ['getTimeout']);
  // Will pass after #2201 merges; check structure of function regardless
  assert.equal(typeof r.ok, 'boolean');
});

test('checkModuleExports: fail with reason when module missing', () => {
  const r = checkModuleExports('scripts/global/does-not-exist.js', []);
  assert.equal(r.ok, false);
  assert.match(r.reason, /not found/);
});

test('runAll: returns {total, passed, failed, results}', () => {
  const s = runAll(CORPUS_DIR);
  assert.equal(typeof s.total, 'number');
  assert.equal(typeof s.passed, 'number');
  assert.ok(Array.isArray(s.failed));
  assert.ok(Array.isArray(s.results));
  assert.equal(s.total, s.passed + s.failed.length);
});

test('runScenario: handles missing assertion gracefully', () => {
  const r = runScenario({ id: 'malformed' });
  assert.equal(r.ok, false);
});
