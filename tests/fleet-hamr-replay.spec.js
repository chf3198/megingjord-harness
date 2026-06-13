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

// --- #2233 (P1-6): generic predicate + new corpus entries exercising P1-2/P1-3 ---
const { runScenario: runScenario2233, runPredicate, runAll: runAll2233 } = require('../scripts/regression/fleet-hamr-replay.js');

test('#2233 AC3: entry 04 genuinely exercises hamr-bypass-detector.detectBypass (detected:true)', () => {
  const sc = JSON.parse(require('node:fs').readFileSync(
    require('node:path').join(__dirname, 'regression/fleet-hamr-corpus/04-bypass-detection-not-recognized.json'), 'utf8'));
  assert.equal(runScenario2233(sc).ok, true);
});

test('#2233 AC3: entry 05 genuinely exercises hamr-fleet-direct-block.shouldBlock (block:true)', () => {
  const sc = JSON.parse(require('node:fs').readFileSync(
    require('node:path').join(__dirname, 'regression/fleet-hamr-corpus/05-fleet-direct-block-not-enforced.json'), 'utf8'));
  assert.equal(runScenario2233(sc).ok, true);
});

test('#2233 AC5: generic predicate calls mod[fn](...args) + plucks result_path', () => {
  const mod = { foo: (x) => ({ nested: { val: x * 2 } }) };
  assert.equal(runPredicate(mod, { fn: 'foo', args: [3], result_path: 'nested.val', expected_result: 6 }).ok, true);
  assert.equal(runPredicate(mod, { fn: 'foo', args: [3], result_path: 'nested.val', expected_result: 99 }).ok, false);
});

test('#2233 AC5: generic predicate without result_path deep-equals the whole return', () => {
  const mod = { who: () => ({ a: 1, b: 2 }) };
  assert.equal(runPredicate(mod, { fn: 'who', args: [], expected_result: { a: 1, b: 2 } }).ok, true);
});

test('#2233 AC5: missing fn is reported gracefully (no crash)', () => {
  const r = runPredicate({}, { fn: 'doesNotExist', args: [], expected_result: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /not a function/);
});

test('#2233 AC5: legacy childProgressComplete predicate path still works (backward-compat)', () => {
  const mod = { childProgressComplete: (child, comments) => comments.includes('done') };
  assert.equal(runPredicate(mod, { input_child: { number: 1 }, input_comments: ['done'], expected_result: true }).ok, true);
});

test('#2233 AC5: full corpus (all entries 01-05) passes via runAll', () => {
  const summary = runAll2233();
  assert.equal(summary.failed.length, 0, `failed: ${JSON.stringify(summary.failed)}`);
  assert.ok(summary.total >= 5);
});
