'use strict';
// tests/parity-lowering-guard.spec.js — tdd-pyramid spec for parity-lowering-guard.
// Epic #3411 T3.2 (#3452). test_strategy: tdd-pyramid+stress-test
// AC-3 regression anchor: deliberate parity-reducing change is blocked.

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const {
  parityScore,
  detectRegressions,
  runGuard,
  verdictRank,
  VERDICT_RANK,
} = require('../scripts/global/megalint/parity-lowering-guard.js');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function makeCells(pairs) {
  // pairs: [{ featureId, runtime, verdict, declared, substituteTest }]
  return pairs.map(({ featureId, runtime, verdict, declared, substituteTest }) => ({
    featureId,
    runtime,
    verdict: verdict || 'ok',
    declared: declared || 'full',
    substituteTest: substituteTest || null,
  }));
}

function makeMatrix(pairs) {
  return { cells: makeCells(pairs), failures: [], summary: { totalCells: pairs.length } };
}

function makeMap(entries) {
  // entries: { "featureId::runtime": rank }
  return new Map(Object.entries(entries));
}

// ---------------------------------------------------------------------------
// parityScore: verdict rank ordering
// ---------------------------------------------------------------------------

test('parityScore: ok verdict maps to highest rank', () => {
  const matrix = makeMatrix([{ featureId: 'feat-a', runtime: 'claude-code', verdict: 'ok' }]);
  const score = parityScore(matrix);
  assert.equal(score.get('feat-a::claude-code'), VERDICT_RANK['ok']);
});

test('parityScore: declared-full-but-missing maps to lowest rank (0)', () => {
  const matrix = makeMatrix([
    { featureId: 'feat-b', runtime: 'copilot', verdict: 'declared-full-but-missing' },
  ]);
  const score = parityScore(matrix);
  assert.equal(score.get('feat-b::copilot'), 0);
});

test('parityScore: rank order is ok > ok-na > make-reachable-required > na-without-substitute > declared-full-but-missing', () => {
  const verdicts = ['ok', 'ok-na', 'make-reachable-required', 'na-without-substitute', 'declared-full-but-missing'];
  const ranks = verdicts.map(verdict => verdictRank(verdict));
  for (let rankIdx = 0; rankIdx < ranks.length - 1; rankIdx++) {
    assert.ok(ranks[rankIdx] > ranks[rankIdx + 1],
      `Expected rank[${rankIdx}]=${ranks[rankIdx]} > rank[${rankIdx + 1}]=${ranks[rankIdx + 1]}`);
  }
});

test('parityScore: returns empty map for null input', () => {
  const score = parityScore(null);
  assert.equal(score.size, 0);
});

test('parityScore: returns empty map for missing cells field', () => {
  const score = parityScore({ summary: {} });
  assert.equal(score.size, 0);
});

test('parityScore: multiple cells each get their own key', () => {
  const matrix = makeMatrix([
    { featureId: 'feat-a', runtime: 'claude-code', verdict: 'ok' },
    { featureId: 'feat-a', runtime: 'copilot', verdict: 'ok-na' },
    { featureId: 'feat-b', runtime: 'claude-code', verdict: 'declared-full-but-missing' },
  ]);
  const score = parityScore(matrix);
  assert.equal(score.size, 3);
  assert.equal(score.get('feat-a::claude-code'), VERDICT_RANK['ok']);
  assert.equal(score.get('feat-a::copilot'), VERDICT_RANK['ok-na']);
  assert.equal(score.get('feat-b::claude-code'), 0);
});

// ---------------------------------------------------------------------------
// detectRegressions: core logic
// ---------------------------------------------------------------------------

test('detectRegressions: full->absent flip is a regression', () => {
  const baseMap = makeMap({ 'feat-x::codex': VERDICT_RANK['ok'] });
  const headMap = makeMap({ 'feat-x::codex': 0 }); // declared-full-but-missing
  const regs = detectRegressions(baseMap, headMap, []);
  assert.equal(regs.length, 1);
  assert.equal(regs[0].key, 'feat-x::codex');
  assert.equal(regs[0].baseRank, VERDICT_RANK['ok']);
  assert.equal(regs[0].headRank, 0);
});

test('detectRegressions: absent->full improvement is NOT a regression', () => {
  const baseMap = makeMap({ 'feat-y::cursor': 0 });
  const headMap = makeMap({ 'feat-y::cursor': VERDICT_RANK['ok'] });
  const regs = detectRegressions(baseMap, headMap, []);
  assert.equal(regs.length, 0);
});

test('detectRegressions: no change produces no regressions', () => {
  const baseMap = makeMap({ 'feat-z::antigravity': VERDICT_RANK['ok-na'] });
  const headMap = makeMap({ 'feat-z::antigravity': VERDICT_RANK['ok-na'] });
  const regs = detectRegressions(baseMap, headMap, []);
  assert.equal(regs.length, 0);
});

test('detectRegressions: waived cell WITH valid substituteTest is NOT a regression', () => {
  const baseMap = makeMap({ 'feat-w::copilot': VERDICT_RANK['ok'] });
  const headMap = makeMap({ 'feat-w::copilot': VERDICT_RANK['ok-na'] }); // lower
  const headCells = [{
    featureId: 'feat-w',
    runtime: 'copilot',
    verdict: 'ok-na',
    declared: 'waived',
    substituteTest: 'tests/parity-copilot-sub.spec.js',
  }];
  const regs = detectRegressions(baseMap, headMap, headCells);
  assert.equal(regs.length, 0, 'valid waiver with substituteTest should not be a regression');
});

test('detectRegressions: waiver WITHOUT substituteTest IS flagged as regression', () => {
  const baseMap = makeMap({ 'feat-v::codex': VERDICT_RANK['ok'] });
  const headMap = makeMap({ 'feat-v::codex': VERDICT_RANK['na-without-substitute'] });
  const headCells = [{
    featureId: 'feat-v',
    runtime: 'codex',
    verdict: 'na-without-substitute',
    declared: 'waived',
    substituteTest: '', // empty — no valid substitute
  }];
  const regs = detectRegressions(baseMap, headMap, headCells);
  assert.equal(regs.length, 1, 'waiver without substituteTest must be flagged');
});

test('detectRegressions: key missing from headMap is treated as rank 0 (regression)', () => {
  const baseMap = makeMap({ 'feat-dropped::claude-code': VERDICT_RANK['ok'] });
  const headMap = new Map(); // key dropped entirely
  const regs = detectRegressions(baseMap, headMap, []);
  assert.equal(regs.length, 1);
  assert.equal(regs[0].headRank, 0);
});

// ---------------------------------------------------------------------------
// AC-3: REGRESSION ANCHOR — synthetic lowered head map blocks the guard
// ---------------------------------------------------------------------------

test('AC-3 REGRESSION ANCHOR: synthetic full->absent flip is detected and blocks (strict)', () => {
  // Construct a base map with a cell at rank ok=4
  const baseMap = makeMap({ 'synthetic-feat::claude-code': VERDICT_RANK['ok'] });
  // HEAD drops it to rank 0 (declared-full-but-missing)
  const headMap = makeMap({ 'synthetic-feat::claude-code': 0 });
  const regressions = detectRegressions(baseMap, headMap, []);
  assert.equal(regressions.length, 1, 'guard must detect the deliberate parity reduction');
  assert.equal(regressions[0].key, 'synthetic-feat::claude-code');
  assert.equal(regressions[0].reason, 'parity-score-decreased');
});

// ---------------------------------------------------------------------------
// runGuard: live repo — HEAD vs committed baseline produces zero unwaived regressions
// ---------------------------------------------------------------------------

test('runGuard: current repo HEAD vs committed baseline has zero regressions', () => {
  const result = runGuard({ strict: false, repoRoot: REPO_ROOT });
  // May fall back to G6 fallback if no baseline; either way must not throw
  assert.ok(typeof result === 'object', 'runGuard must return an object');
  assert.ok(Array.isArray(result.regressions), 'result.regressions must be an array');
  if (!result.fallback) {
    assert.equal(result.regressions.length, 0,
      `Expected 0 unwaived regressions vs baseline, got: ${JSON.stringify(result.regressions)}`);
  }
});

test('runGuard: --strict with zero regressions does not exit non-zero', () => {
  // We cannot test process.exit directly here; verify it returns without throwing.
  assert.doesNotThrow(() => {
    runGuard({ strict: true, repoRoot: REPO_ROOT });
  });
});

test('runGuard: missing repoRoot falls back gracefully (G6)', () => {
  const result = runGuard({ strict: false, repoRoot: '/nonexistent-path-xyz' });
  assert.ok(typeof result === 'object');
  // Either fallback or zero regressions — never throws
  assert.ok(result.fallback === true || Array.isArray(result.regressions));
});
