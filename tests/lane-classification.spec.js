'use strict';
// tests/lane-classification.spec.js — AC #2906: lane:trivial diff-size gate.
// Hardened per cross-family review: fail-closed on null/NaN/Infinity/negative.
// Refs #2906 (Gap G-03 / OWASP ASI09).

const test = require('node:test');
const assert = require('node:assert');
const {
  checkLaneTrivialDiffSize,
  validate,
  TRIVIAL_DIFF_THRESHOLD,
} = require('../scripts/global/megalint/manager-handoff.js');

// Minimal valid MANAGER_HANDOFF body used across tests.
const BASE_HANDOFF = `## MANAGER_HANDOFF
scope: trivial typo fix
lane: lane:trivial
test_strategy: none
acceptance: fix typo
gates: lint
related_tickets: #1
overlap_decision: none
Signed-by: Orla Mason
Team&Model: claude-code:sonnet-4-6@anthropic
Role: manager`;

const CODE_HANDOFF = BASE_HANDOFF.replace('lane: lane:trivial', 'lane: lane:code-change');

// ── TRIVIAL_DIFF_THRESHOLD constant ──────────────────────────────────────────

test('TRIVIAL_DIFF_THRESHOLD is a positive integer', () => {
  assert.strictEqual(Number.isFinite(TRIVIAL_DIFF_THRESHOLD), true);
  assert.ok(TRIVIAL_DIFF_THRESHOLD > 0);
});

// ── Gate is inactive for non-trivial lanes ────────────────────────────────────

test('no violation when lane is not trivial (large diff OK)', () => {
  assert.deepStrictEqual(checkLaneTrivialDiffSize(CODE_HANDOFF, 999, 50), []);
});

test('no violation when lane is not trivial and diffLines is null', () => {
  assert.deepStrictEqual(checkLaneTrivialDiffSize(CODE_HANDOFF, null, 50), []);
});

// ── FAIL-CLOSED: missing/invalid diffLines on lane:trivial is a violation ────
// MUTATION-ANCHOR tests: if the fail-closed guard is removed, these MUST fail
// (they assert a violation where the pre-fix fail-open code returned []).

for (const [label, value] of [
  ['null', null], ['undefined', undefined], ['NaN', NaN],
  ['Infinity', Infinity], ['negative', -1],
]) {
  test(`[mutation-anchor] ${label} diffLines on lane:trivial emits lane:trivial-diff-missing`, () => {
    const result = checkLaneTrivialDiffSize(BASE_HANDOFF, value, 50);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].rule, 'lane:trivial-diff-missing');
    assert.strictEqual(result[0].severity, 'hard');
  });
}

test('lane:trivial-diff-missing detail includes the invalid value for diagnostics', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, null, 50);
  assert.match(result[0].detail, /null/);
});

// ── Valid diffLines on lane:trivial: within-threshold and over-threshold ──────

test('no violation when diffLines equals threshold exactly', () => {
  assert.deepStrictEqual(checkLaneTrivialDiffSize(BASE_HANDOFF, 50, 50), []);
});

test('no violation when diffLines is below threshold', () => {
  assert.deepStrictEqual(checkLaneTrivialDiffSize(BASE_HANDOFF, 10, 50), []);
});

test('no violation when diffLines is 0 (empty diff counts as trivial)', () => {
  assert.deepStrictEqual(checkLaneTrivialDiffSize(BASE_HANDOFF, 0, 50), []);
});

test('emits lane:trivial-diff-too-large when diff exceeds threshold', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, 51, 50);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].rule, 'lane:trivial-diff-too-large');
  assert.strictEqual(result[0].severity, 'hard');
});

test('violation detail contains actual and threshold line counts', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, 120, 50);
  assert.match(result[0].detail, /120/);
  assert.match(result[0].detail, /50/);
});

test('uses explicit threshold arg (env-configurable threshold)', () => {
  const smallThreshold = 5;
  assert.deepStrictEqual(checkLaneTrivialDiffSize(BASE_HANDOFF, 4, smallThreshold), []);
  const over = checkLaneTrivialDiffSize(BASE_HANDOFF, 6, smallThreshold);
  assert.strictEqual(over[0].rule, 'lane:trivial-diff-too-large');
});

// ── validate() integration tests ─────────────────────────────────────────────

test('validate passes for lane:trivial with small explicit diff', () => {
  const result = validate({ comments: [{ body: BASE_HANDOFF }], diffLines: 10 });
  const hits = result.violations.filter((v) => v.rule === 'lane:trivial-diff-too-large');
  assert.strictEqual(hits.length, 0);
});

test('validate blocks for lane:trivial with oversized diff', () => {
  const result = validate({ comments: [{ body: BASE_HANDOFF }], diffLines: 200 });
  const hits = result.violations.filter((v) => v.rule === 'lane:trivial-diff-too-large');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(result.ok, false);
});

test('[mutation-anchor] validate blocks when diffLines absent from input (fail-closed)', () => {
  const result = validate({ comments: [{ body: BASE_HANDOFF }] });
  const hits = result.violations.filter((v) => v.rule === 'lane:trivial-diff-missing');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(result.ok, false);
});

test('validate does not emit trivial-diff violation for lane:code-change', () => {
  const result = validate({ comments: [{ body: CODE_HANDOFF }], diffLines: 500 });
  const hits = result.violations.filter(
    (v) => v.rule === 'lane:trivial-diff-too-large' || v.rule === 'lane:trivial-diff-missing',
  );
  assert.strictEqual(hits.length, 0);
});

test('[mutation-anchor] bypass attempt via NaN diffLines is blocked by validate()', () => {
  const result = validate({ comments: [{ body: BASE_HANDOFF }], diffLines: NaN });
  const hits = result.violations.filter((v) => v.rule === 'lane:trivial-diff-missing');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(result.ok, false);
});
