'use strict';
// tests/lane-classification.spec.js — AC #2906: lane:trivial diff-size gate.
// Refs #2906 (Gap G-03 / OWASP ASI09).

const { test, expect } = require('@playwright/test');
const {
  checkLaneTrivialDiffSize,
  validate,
  findManagerHandoff,
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

// ── checkLaneTrivialDiffSize unit tests ──────────────────────────────────────

test('TRIVIAL_DIFF_THRESHOLD is a positive integer', () => {
  expect(Number.isFinite(TRIVIAL_DIFF_THRESHOLD)).toBe(true);
  expect(TRIVIAL_DIFF_THRESHOLD).toBeGreaterThan(0);
});

test('no violation when lane is not trivial', () => {
  const result = checkLaneTrivialDiffSize(CODE_HANDOFF, 999, 50);
  expect(result).toEqual([]);
});

test('no violation when diffLines is null (caller did not supply diff)', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, null, 50);
  expect(result).toEqual([]);
});

test('no violation when diffLines is undefined', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, undefined, 50);
  expect(result).toEqual([]);
});

test('no violation when diffLines equals threshold exactly', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, 50, 50);
  expect(result).toEqual([]);
});

test('no violation when diffLines is below threshold', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, 10, 50);
  expect(result).toEqual([]);
});

test('emits lane:trivial-diff-too-large when diff exceeds threshold', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, 51, 50);
  expect(result).toHaveLength(1);
  expect(result[0].rule).toBe('lane:trivial-diff-too-large');
  expect(result[0].severity).toBe('hard');
});

test('violation detail contains actual and threshold line counts', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, 120, 50);
  expect(result[0].detail).toMatch(/120/);
  expect(result[0].detail).toMatch(/50/);
});

test('uses env-configurable threshold when provided', () => {
  // Direct call with explicit threshold arg overrides module-level constant.
  const smallThreshold = 5;
  const under = checkLaneTrivialDiffSize(BASE_HANDOFF, 4, smallThreshold);
  const over = checkLaneTrivialDiffSize(BASE_HANDOFF, 6, smallThreshold);
  expect(under).toEqual([]);
  expect(over[0].rule).toBe('lane:trivial-diff-too-large');
});

test('non-finite diffLines value is ignored gracefully', () => {
  expect(checkLaneTrivialDiffSize(BASE_HANDOFF, NaN, 50)).toEqual([]);
  expect(checkLaneTrivialDiffSize(BASE_HANDOFF, Infinity, 50)).toEqual([]);
});

// ── validate() integration tests ─────────────────────────────────────────────

test('validate passes for lane:trivial with small diff', () => {
  const input = {
    comments: [{ body: BASE_HANDOFF }],
    diffLines: 10,
  };
  const result = validate(input);
  const trivialViolations = result.violations.filter(
    (violation) => violation.rule === 'lane:trivial-diff-too-large',
  );
  expect(trivialViolations).toHaveLength(0);
});

test('validate blocks for lane:trivial with oversized diff', () => {
  const input = {
    comments: [{ body: BASE_HANDOFF }],
    diffLines: 200,
  };
  const result = validate(input);
  const trivialViolations = result.violations.filter(
    (violation) => violation.rule === 'lane:trivial-diff-too-large',
  );
  expect(trivialViolations).toHaveLength(1);
  expect(result.ok).toBe(false);
});

test('validate skips diff check when diffLines absent from input', () => {
  const input = { comments: [{ body: BASE_HANDOFF }] };
  const result = validate(input);
  const trivialViolations = result.violations.filter(
    (violation) => violation.rule === 'lane:trivial-diff-too-large',
  );
  expect(trivialViolations).toHaveLength(0);
});

test('validate does not emit trivial-diff violation for lane:code-change', () => {
  const input = {
    comments: [{ body: CODE_HANDOFF }],
    diffLines: 500,
  };
  const result = validate(input);
  const trivialViolations = result.violations.filter(
    (violation) => violation.rule === 'lane:trivial-diff-too-large',
  );
  expect(trivialViolations).toHaveLength(0);
});
