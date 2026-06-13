'use strict';
// tests/lane-classification.spec.js — AC #2906: lane:trivial diff-size gate.
// Hardened per cross-family review: fail-closed on null/NaN/Infinity/negative.
// Refs #2906 (Gap G-03 / OWASP ASI09).

const { test, expect } = require('@playwright/test');
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
  expect(Number.isFinite(TRIVIAL_DIFF_THRESHOLD)).toBe(true);
  expect(TRIVIAL_DIFF_THRESHOLD).toBeGreaterThan(0);
});

// ── Gate is inactive for non-trivial lanes ────────────────────────────────────

test('no violation when lane is not trivial (large diff OK)', () => {
  const result = checkLaneTrivialDiffSize(CODE_HANDOFF, 999, 50);
  expect(result).toEqual([]);
});

test('no violation when lane is not trivial and diffLines is null', () => {
  const result = checkLaneTrivialDiffSize(CODE_HANDOFF, null, 50);
  expect(result).toEqual([]);
});

// ── FAIL-CLOSED: missing/invalid diffLines on lane:trivial is a violation ────
// These are the MUTATION-ANCHOR tests: if the fail-closed guard is removed,
// these tests MUST fail (they assert violations where old code returned []).

test('[mutation-anchor] null diffLines on lane:trivial emits lane:trivial-diff-missing', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, null, 50);
  expect(result).toHaveLength(1);
  expect(result[0].rule).toBe('lane:trivial-diff-missing');
  expect(result[0].severity).toBe('hard');
});

test('[mutation-anchor] undefined diffLines on lane:trivial emits lane:trivial-diff-missing', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, undefined, 50);
  expect(result).toHaveLength(1);
  expect(result[0].rule).toBe('lane:trivial-diff-missing');
  expect(result[0].severity).toBe('hard');
});

test('[mutation-anchor] NaN diffLines on lane:trivial emits lane:trivial-diff-missing', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, NaN, 50);
  expect(result).toHaveLength(1);
  expect(result[0].rule).toBe('lane:trivial-diff-missing');
  expect(result[0].severity).toBe('hard');
});

test('[mutation-anchor] Infinity diffLines on lane:trivial emits lane:trivial-diff-missing', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, Infinity, 50);
  expect(result).toHaveLength(1);
  expect(result[0].rule).toBe('lane:trivial-diff-missing');
  expect(result[0].severity).toBe('hard');
});

test('[mutation-anchor] negative diffLines on lane:trivial emits lane:trivial-diff-missing', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, -1, 50);
  expect(result).toHaveLength(1);
  expect(result[0].rule).toBe('lane:trivial-diff-missing');
  expect(result[0].severity).toBe('hard');
});

test('lane:trivial-diff-missing detail includes the invalid value for diagnostics', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, null, 50);
  expect(result[0].detail).toMatch(/null/);
});

// ── Valid diffLines on lane:trivial: within-threshold and over-threshold ──────

test('no violation when diffLines equals threshold exactly', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, 50, 50);
  expect(result).toEqual([]);
});

test('no violation when diffLines is below threshold', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, 10, 50);
  expect(result).toEqual([]);
});

test('no violation when diffLines is 0 (empty diff counts as trivial)', () => {
  const result = checkLaneTrivialDiffSize(BASE_HANDOFF, 0, 50);
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

test('uses explicit threshold arg (env-configurable threshold)', () => {
  const smallThreshold = 5;
  const under = checkLaneTrivialDiffSize(BASE_HANDOFF, 4, smallThreshold);
  const over = checkLaneTrivialDiffSize(BASE_HANDOFF, 6, smallThreshold);
  expect(under).toEqual([]);
  expect(over[0].rule).toBe('lane:trivial-diff-too-large');
});

// ── validate() integration tests ─────────────────────────────────────────────

test('validate passes for lane:trivial with small explicit diff', () => {
  const input = {
    comments: [{ body: BASE_HANDOFF }],
    diffLines: 10,
  };
  const result = validate(input);
  const trivialViolations = result.violations.filter(
    (v) => v.rule === 'lane:trivial-diff-too-large',
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
    (v) => v.rule === 'lane:trivial-diff-too-large',
  );
  expect(trivialViolations).toHaveLength(1);
  expect(result.ok).toBe(false);
});

test('[mutation-anchor] validate blocks when diffLines absent from input (fail-closed)', () => {
  // Absence of diffLines on lane:trivial is a gate violation, not a pass.
  const input = { comments: [{ body: BASE_HANDOFF }] };
  const result = validate(input);
  const missingViolations = result.violations.filter(
    (v) => v.rule === 'lane:trivial-diff-missing',
  );
  expect(missingViolations).toHaveLength(1);
  expect(result.ok).toBe(false);
});

test('validate does not emit trivial-diff violation for lane:code-change', () => {
  const input = {
    comments: [{ body: CODE_HANDOFF }],
    diffLines: 500,
  };
  const result = validate(input);
  const trivialViolations = result.violations.filter(
    (v) => v.rule === 'lane:trivial-diff-too-large' ||
            v.rule === 'lane:trivial-diff-missing',
  );
  expect(trivialViolations).toHaveLength(0);
});

test('[mutation-anchor] bypass attempt via NaN diffLines is blocked by validate()', () => {
  const input = {
    comments: [{ body: BASE_HANDOFF }],
    diffLines: NaN,
  };
  const result = validate(input);
  const missingViolations = result.violations.filter(
    (v) => v.rule === 'lane:trivial-diff-missing',
  );
  expect(missingViolations).toHaveLength(1);
  expect(result.ok).toBe(false);
});
