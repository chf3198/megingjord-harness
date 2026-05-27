'use strict';
// #2305 — test-strategy-enum: canonical 11 values, composability, manager-handoff advisory.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');

const ENUM = require(path.resolve(__dirname, '../scripts/global/test-strategy-enum'));
const { validate } = require(path.resolve(__dirname, '../scripts/global/megalint/manager-handoff'));
const PR_TEMPLATE = path.resolve(__dirname, '../.github/PULL_REQUEST_TEMPLATE.md');

const CANONICAL_11 = [
  'tdd-pyramid', 'tdd-trophy', 'contract-test', 'golden-file', 'eval-harness',
  'visual-regression', 'drift-lint', 'peer-review', 'manual-verify', 'stress-test', 'none',
];

test('#2305 ALLOWED_STRATEGIES is exactly the canonical 11 values', () => {
  expect(ENUM.ALLOWED_STRATEGIES).toHaveLength(CANONICAL_11.length);
  for (const s of CANONICAL_11) expect(ENUM.ALLOWED_STRATEGIES, `missing '${s}'`).toContain(s);
});

test('#2305 isValidStrategy accepts all 11 canonical values', () => {
  for (const s of CANONICAL_11) expect(ENUM.isValidStrategy(s), `reject '${s}'`).toBe(true);
});

test('#2305 isValidStrategy accepts valid +-composed strategies', () => {
  const primaryStrategies = CANONICAL_11.filter(s => s !== 'none' && s !== 'stress-test');
  for (const p of primaryStrategies) {
    expect(ENUM.isValidStrategy(`${p}+stress-test`), `reject '${p}+stress-test'`).toBe(true);
  }
});

test('#2305 isValidStrategy rejects unknown and malformed values', () => {
  const invalid = [
    'unknown-strategy',
    'tdd-pyramid+tdd-trophy',       // second part must be stress-test
    'stress-test+tdd-pyramid',      // stress-test may only be SECOND part
    'tdd-pyramid+stress-test+none', // three-part not allowed
    '', null, undefined,
  ];
  for (const s of invalid) expect(ENUM.isValidStrategy(s), `accept '${String(s)}'`).toBe(false);
});

function makeHandoff(strategy) {
  return [
    'MANAGER_HANDOFF', 'scope: s', 'lane: lane:code-change',
    `test_strategy: ${strategy}`, 'acceptance: AC1', 'gates: lint',
    'Signed-by: Orla Mason', 'Team&Model: claude-code:opus@local', 'Role: manager',
  ].join('\n');
}

test('#2305 manager-handoff emits advisory for unknown test_strategy', () => {
  const result = validate({ comments: [{ body: makeHandoff('not-a-real-strategy') }] });
  const adv = result.violations.find(v => v.rule === 'lane:unknown-test-strategy');
  expect(adv, 'should emit lane:unknown-test-strategy advisory').toBeTruthy();
  expect(adv.severity).toBe('advisory');
});

test('#2305 manager-handoff no advisory for valid composed strategy', () => {
  const result = validate({ comments: [{ body: makeHandoff('tdd-pyramid+stress-test') }] });
  const adv = result.violations.find(v => v.rule === 'lane:unknown-test-strategy');
  expect(adv, 'should NOT emit advisory for valid composed strategy').toBeUndefined();
});

test('#2305 PR template Strategy line contains stress-test', () => {
  const text = fs.readFileSync(PR_TEMPLATE, 'utf8');
  const line = text.match(/- Strategy:.*\n/);
  expect(line, 'PR template must have a Strategy: line').not.toBeNull();
  expect(line[0]).toContain('stress-test');
});

test('#2305 PR template enum matches all ALLOWED_STRATEGIES values', () => {
  const text = fs.readFileSync(PR_TEMPLATE, 'utf8');
  for (const s of ENUM.ALLOWED_STRATEGIES) expect(text, `PR template missing '${s}'`).toContain(s);
});
