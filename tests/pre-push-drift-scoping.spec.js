// tests/pre-push-drift-scoping.spec.js — #3099. Scopes the pre-push epic-drift BLOCK
// to the pusher's own ticket + parent Epic; the rest of the board is advisory.
// Strategy: tdd-pyramid (pure scoping units) + stress (adversarial branches + large
// finding sets) — pre-push-gates is a side-effect-bearing gate per the matrix.
'use strict';

const { test, expect } = require('@playwright/test');
const drift = require('../scripts/global/lint-epic-drift');

// ── ticketFromBranch ──

test('ticketFromBranch parses governed branch prefixes, null otherwise', () => {
  expect(drift.ticketFromBranch('feat/3098-objective-test-floor')).toBe(3098);
  expect(drift.ticketFromBranch('fix/12-x')).toBe(12);
  expect(drift.ticketFromBranch('hotfix/7-y')).toBe(7);
  expect(drift.ticketFromBranch('chore/100-z')).toBe(100);
  expect(drift.ticketFromBranch('skill/55-s')).toBe(55);
  expect(drift.ticketFromBranch('main')).toBeNull();
  expect(drift.ticketFromBranch('sandbox/cursor')).toBeNull();
  expect(drift.ticketFromBranch('')).toBeNull();
});

// ── partitionFindings ──

const FINDINGS = [
  { epic: 1948, class: 'C', message: 'a' },
  { epic: 2248, class: 'C', message: 'b' },
  { epic: 1948, class: 'A', message: 'c' },
  { epic: 3008, class: 'C', message: 'd' },
];

test('partitionFindings blocks relevant-epic drift, advises the rest', () => {
  const { blocking, advisory } = drift.partitionFindings(FINDINGS, new Set([1948, 3098]));
  expect(blocking.map((f) => f.epic)).toEqual([1948, 1948]);
  expect(advisory.map((f) => f.epic)).toEqual([2248, 3008]);
});

test('partitionFindings fail-safe: null relevant set blocks everything', () => {
  const { blocking, advisory } = drift.partitionFindings(FINDINGS, null);
  expect(blocking).toHaveLength(4);
  expect(advisory).toHaveLength(0);
});

test('partitionFindings handles empty/undefined findings', () => {
  expect(drift.partitionFindings([], new Set([1])).blocking).toEqual([]);
  expect(drift.partitionFindings(undefined, new Set([1])).blocking).toEqual([]);
});

// ── resolveRelevantEpics (with injected gh) ──

test('resolveRelevantEpics returns {ticket, parentEpic} for a child branch', () => {
  const fakeGh = () => JSON.stringify({ data: { repository: { issue: { parent: { number: 1948 } } } } });
  expect([...drift.resolveRelevantEpics('feat/3098-x', 'o', 'r', fakeGh)].sort()).toEqual([1948, 3098]);
});

test('resolveRelevantEpics returns just the ticket when it has no parent', () => {
  const fakeGh = () => JSON.stringify({ data: { repository: { issue: { parent: null } } } });
  expect([...drift.resolveRelevantEpics('feat/2891-x', 'o', 'r', fakeGh)]).toEqual([2891]);
});

test('resolveRelevantEpics returns null for an unparseable branch (→ block-all)', () => {
  expect(drift.resolveRelevantEpics('main', 'o', 'r', () => '{}')).toBeNull();
});

test('resolveRelevantEpics survives a gh failure (scopes to the ticket only)', () => {
  const throwingGh = () => { throw new Error('gh down'); };
  expect([...drift.resolveRelevantEpics('feat/42-x', 'o', 'r', throwingGh)]).toEqual([42]);
});

// ── stress: adversarial branches (G6) + p99 over a large board (G7) ──

test('stress: adversarial branch strings never throw, never mis-scope', () => {
  const hostile = ['feat/$(rm -rf ~)-x', 'feat/-x', 'feat/999999999999999999-x',
    'feat//x', '../../feat/1-x', 'feat/1\n-x', 'FEAT/1-X', `feat/${'9'.repeat(500)}-x`];
  for (const branch of hostile) {
    expect(() => drift.ticketFromBranch(branch)).not.toThrow();
    expect(() => drift.partitionFindings(FINDINGS, drift.resolveRelevantEpics(branch, 'o', 'r', () => '{}'))).not.toThrow();
  }
});

test('stress: partitionFindings over a 5000-finding board stays under a p99 budget', () => {
  const big = Array.from({ length: 5000 }, (_, index) => ({ epic: index % 50, class: 'C', message: `m${index}` }));
  const relevant = new Set([7, 13, 42]);
  const samples = [];
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const start = process.hrtime.bigint();
    drift.partitionFindings(big, relevant);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p99, `p99 ${p99.toFixed(2)}ms exceeded 25ms`).toBeLessThan(25);
});
