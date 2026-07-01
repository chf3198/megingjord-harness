'use strict';
// harness-add-runtime-golden.spec.js — T2.1 acceptance proof (golden re-scaffold test).
// For each of the 5 committed runtimes, re-runs buildPlan and asserts:
//   (1) ALL actions are already-present (scaffold reproduces committed wiring — no-op proof).
//   (2) planContentHash is stable across two back-to-back buildPlan calls (determinism proof).
//   (3) planContentHash matches the committed fixture (regression guard).
// If any runtime shows a pending action, the test FAILS with the diverged surface name.
// This is the intended regression signal: a wiring gap between descriptor and committed surfaces.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildPlan } = require('../scripts/global/harness-add-runtime');
const { planContentHash } = require('./helpers/golden-normalize');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'harness-rescaffold-golden.json');

const COMMITTED_RUNTIMES = ['antigravity', 'claude-code', 'codex', 'copilot', 'cursor'];

function loadFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) return null;
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function pendingSurfaces(plan) {
  return plan.filter(action => action.op !== 'already-present').map(action => action.surface);
}

function assertAllAlreadyPresent(runtimeId, plan) {
  const pending = pendingSurfaces(plan);
  assert.deepEqual(
    pending,
    [],
    `Runtime "${runtimeId}": expected all 11 surfaces already-present but found pending: [${pending.join(', ')}]. ` +
    'This means the committed wiring diverges from what the scaffold generator expects. ' +
    'Fix: wire the missing surfaces into the registry files or update the descriptor.'
  );
}

function assertDeterministic(runtimeId, plan1, plan2) {
  const hash1 = planContentHash(plan1);
  const hash2 = planContentHash(plan2);
  assert.equal(
    hash1,
    hash2,
    `Runtime "${runtimeId}": planContentHash is not stable across two buildPlan calls (non-determinism detected). ` +
    `First hash: ${hash1}, second hash: ${hash2}`
  );
}

function assertMatchesFixture(runtimeId, plan, fixture) {
  if (!fixture) return; // fixture not yet generated — skip comparison
  const expected = fixture[runtimeId];
  if (!expected) {
    assert.fail(
      `Runtime "${runtimeId}": not found in golden fixture at ${FIXTURE_PATH}. ` +
      'Regenerate with: node tests/harness-add-runtime-golden.spec.js --update-fixture'
    );
  }
  const actual = planContentHash(plan);
  assert.equal(
    actual,
    expected.planContentHash,
    `Runtime "${runtimeId}": planContentHash diverges from golden fixture. ` +
    `Expected: ${expected.planContentHash}, got: ${actual}. ` +
    'This indicates a scaffold generator change that altered the plan output. ' +
    'If intentional, regenerate the fixture.'
  );
}

// ── fixture generation (run with --update-fixture to regenerate) ──────────────
if (process.argv.includes('--update-fixture')) {
  const generated = {};
  for (const runtimeId of COMMITTED_RUNTIMES) {
    const plan = buildPlan(runtimeId, { repoRoot: REPO_ROOT });
    generated[runtimeId] = {
      planContentHash: planContentHash(plan),
      pendingSurfaces: pendingSurfaces(plan),
      actionCount: plan.length,
    };
  }
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(generated, null, 2) + '\n', 'utf8');
  console.log('Golden fixture written to', FIXTURE_PATH);
  process.exit(0);
}

// ── main test suite ───────────────────────────────────────────────────────────
const fixture = loadFixture();

describe('harness-add-runtime golden re-scaffold (T2.1 acceptance proof)', () => {
  for (const runtimeId of COMMITTED_RUNTIMES) {
    describe(`runtime: ${runtimeId}`, () => {
      test('all scaffold actions are already-present (no-op proof)', () => {
        const plan = buildPlan(runtimeId, { repoRoot: REPO_ROOT });
        assert.ok(Array.isArray(plan) && plan.length > 0, `plan for "${runtimeId}" must be non-empty`);
        assertAllAlreadyPresent(runtimeId, plan);
      });

      test('planContentHash is stable across two buildPlan calls (determinism proof)', () => {
        const plan1 = buildPlan(runtimeId, { repoRoot: REPO_ROOT });
        const plan2 = buildPlan(runtimeId, { repoRoot: REPO_ROOT });
        assertDeterministic(runtimeId, plan1, plan2);
      });

      test('planContentHash matches committed golden fixture (regression guard)', () => {
        const plan = buildPlan(runtimeId, { repoRoot: REPO_ROOT });
        assertMatchesFixture(runtimeId, plan, fixture);
      });
    });
  }
});
