// Unit tests for the replay-eval promotion gate + builder-mode flag (Epic #2037
// P1.5, Refs #2675). Covers rate computation, meetsGate boundary, mismatch listing,
// render-error tolerance, empty-corpus guard, the committed seed corpus, and the
// opt-in/rollback env flag semantics.
const { test, expect } = require('@playwright/test');
const {
  replayEval, meetsGate, renderCase, PROMOTION_THRESHOLD,
} = require('../scripts/global/baton-replay-eval');
const { isBuilderDefault, promotionState, DEFAULT_ENV } = require('../scripts/global/baton-builder-mode');
const seedCorpus = require('../tests/fixtures/baton-replay/corpus.json');

const TM = 'claude-code:opus@anthropic';
function cleanEntry() {
  const input = {
    artifact: 'ADMIN_HANDOFF', role: 'admin', teamModel: TM, ticket: 1,
    fields: { branch: 'b', commit: 'c', 'signer-independence-check': 'PASS', 'deploy-runtime-impact': 'none' },
  };
  return { name: 'clean', kind: 'comment', input, expected: renderCase({ kind: 'comment', input }) };
}

test('replayEval computes rate, matched count, and mismatch list', () => {
  const good = cleanEntry();
  const bad = { ...cleanEntry(), name: 'drifted', expected: 'NOT THE RENDER' };
  const result = replayEval([good, bad]);
  expect(result.total).toBe(2);
  expect(result.matched).toBe(1);
  expect(result.rate).toBe(0.5);
  expect(result.mismatches.map((m) => m.name)).toEqual(['drifted']);
});

test('meetsGate is true at and above the 0.85 threshold, false below', () => {
  expect(PROMOTION_THRESHOLD).toBe(0.85);
  expect(meetsGate(0.85)).toBe(true);
  expect(meetsGate(0.86)).toBe(true);
  expect(meetsGate(0.84)).toBe(false);
  expect(meetsGate(1)).toBe(true);
  expect(meetsGate('x')).toBe(false);
});

test('a render error counts as a mismatch, never aborts the eval', () => {
  const broken = { name: 'broken', kind: 'comment', input: { artifact: 'NOPE', role: 'manager', teamModel: TM, fields: {} }, expected: 'x' };
  const result = replayEval([cleanEntry(), broken]);
  expect(result.matched).toBe(1);
  expect(result.mismatches.map((m) => m.name)).toContain('broken');
});

test('empty or non-array corpus throws', () => {
  expect(() => replayEval([])).toThrow(/corpus is empty/);
  expect(() => replayEval(null)).toThrow(/corpus is empty/);
});

test('unknown render kind throws', () => {
  expect(() => renderCase({ kind: 'bogus', input: {} })).toThrow(/unknown replay kind/);
});

test('committed corpus meets the gate (real mined artifacts, promoted #2692)', () => {
  const result = replayEval(seedCorpus);
  expect(result.total).toBeGreaterThan(0);
  expect(meetsGate(result.rate)).toBe(true); // real mined corpus reproduces >= 0.85
});

test('builder mode is the DEFAULT post-promotion; env flag is the rollback switch', () => {
  expect(DEFAULT_ENV).toBe('MEGINGJORD_BATON_BUILDER_DEFAULT');
  expect(isBuilderDefault({})).toBe(true); // promoted (#2692): builder is the default
  expect(isBuilderDefault({ [DEFAULT_ENV]: '0' })).toBe(false); // explicit rollback
  expect(isBuilderDefault({ [DEFAULT_ENV]: 'false' })).toBe(false);
  expect(isBuilderDefault({ [DEFAULT_ENV]: 'off' })).toBe(false);
  expect(isBuilderDefault({ [DEFAULT_ENV]: '1' })).toBe(true);
  expect(promotionState({}).promoted).toBe(true);
});
