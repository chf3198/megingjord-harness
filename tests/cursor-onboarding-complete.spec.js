'use strict';
// cursor-onboarding-complete.spec.js — T2.4 (#3447) regression anchor.
// Asserts that the cursor scaffold dry-run produces ZERO pending actions across
// all onboarding surfaces. A pending action means a #3086 gap has re-opened.
// The generated diff being empty IS the completeness proof — nothing left to apply.
//
// Golden fixture: tests/fixtures/cursor-onboarding-golden.json
// Regenerate:     node tests/cursor-onboarding-complete.spec.js --update-fixture

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildPlan } = require('../scripts/global/harness-add-runtime');
const { planContentHash } = require('./helpers/golden-normalize');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'cursor-onboarding-golden.json');
const RUNTIME_ID = 'cursor';

function loadGoldenFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`Missing golden fixture: ${FIXTURE_PATH}. Run with --update-fixture to generate.`);
  }
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function collectPendingActions(plan) {
  return plan.filter(action => action.op !== 'already-present');
}

function collectSurfaceNames(plan) {
  return plan.map(action => action.surface);
}

// ── fixture generation (node tests/cursor-onboarding-complete.spec.js --update-fixture) ──
if (process.argv.includes('--update-fixture')) {
  const plan = buildPlan(RUNTIME_ID, { repoRoot: REPO_ROOT });
  const pendingActions = collectPendingActions(plan);
  const fixture = {
    runtimeId: RUNTIME_ID,
    description: 'Golden snapshot of the cursor scaffold dry-run (T2.4 / #3447). ' +
      'All surfaces must be already-present — zero pending actions is the completeness proof. ' +
      'Regenerate with: npm run fixtures:regen:cursor --confirm',
      // Note: actionCount updated 11→17 in #3537 (6 new surfaces added: lefthook, governance-profiles,
      // instruction-set, auth-profile, goal-tier, config-dir).
    pendingCount: pendingActions.length,
    actionCount: plan.length,
    surfaces: plan.map(action => ({ surface: action.surface, op: action.op, detail: action.detail })),
  };
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  console.log(`Golden fixture written to ${FIXTURE_PATH}`);
  process.exit(0);
}

// ── main regression anchor ────────────────────────────────────────────────────
const goldenFixture = loadGoldenFixture();

describe('cursor onboarding completeness (T2.4 / #3447)', () => {
  describe('zero-pending proof — scaffold dry-run must emit no actions', () => {
    test('dry-run produces exactly 0 pending actions (cursor is fully onboarded)', () => {
      const plan = buildPlan(RUNTIME_ID, { repoRoot: REPO_ROOT });
      const pendingActions = collectPendingActions(plan);
      const pendingSurfaceNames = pendingActions.map(action => action.surface);
      assert.deepEqual(
        pendingSurfaceNames,
        [],
        `Cursor onboarding gap detected — scaffold reports pending actions on: [${pendingSurfaceNames.join(', ')}]. ` +
        'A #3086 gap has re-opened. Wire the missing surfaces or re-run the scaffold with --apply.'
      );
    });

    test('all expected surfaces are covered (actionCount matches golden fixture)', () => {
      const plan = buildPlan(RUNTIME_ID, { repoRoot: REPO_ROOT });
      assert.equal(
        plan.length,
        goldenFixture.actionCount,
        `Expected ${goldenFixture.actionCount} scaffold surfaces but got ${plan.length}. ` +
        'A surface was added or removed — regenerate the fixture if intentional.'
      );
    });

    test('surface set matches committed golden fixture', () => {
      const plan = buildPlan(RUNTIME_ID, { repoRoot: REPO_ROOT });
      const actualSurfaces = collectSurfaceNames(plan);
      const expectedSurfaces = goldenFixture.surfaces.map(entry => entry.surface);
      assert.deepEqual(
        actualSurfaces,
        expectedSurfaces,
        'Surface names or order diverged from the golden fixture. ' +
        'If a new surface was added intentionally, regenerate with --update-fixture.'
      );
    });
  });

  describe('planContentHash regression guard — detects wiring drift', () => {
    test('planContentHash matches harness-rescaffold-golden.json cursor entry', () => {
      const rescaffoldFixturePath = path.join(__dirname, 'fixtures', 'harness-rescaffold-golden.json');
      if (!fs.existsSync(rescaffoldFixturePath)) return; // skip if T2.1 fixture absent
      const rescaffoldFixture = JSON.parse(fs.readFileSync(rescaffoldFixturePath, 'utf8'));
      const cursorEntry = rescaffoldFixture[RUNTIME_ID];
      if (!cursorEntry) return; // skip if cursor not yet in fixture
      const plan = buildPlan(RUNTIME_ID, { repoRoot: REPO_ROOT });
      const actualHash = planContentHash(plan);
      assert.equal(
        actualHash,
        cursorEntry.planContentHash,
        `planContentHash for cursor diverged from harness-rescaffold-golden.json. ` +
        `Expected: ${cursorEntry.planContentHash}, got: ${actualHash}. ` +
        'A scaffold generator or registry change altered the cursor plan. ' +
        'If intentional, regenerate both fixtures.'
      );
    });

    test('planContentHash is stable across two consecutive buildPlan calls', () => {
      const plan1 = buildPlan(RUNTIME_ID, { repoRoot: REPO_ROOT });
      const plan2 = buildPlan(RUNTIME_ID, { repoRoot: REPO_ROOT });
      const hash1 = planContentHash(plan1);
      const hash2 = planContentHash(plan2);
      assert.equal(
        hash1,
        hash2,
        `planContentHash is non-deterministic for cursor. First: ${hash1}, second: ${hash2}.`
      );
    });
  });
});
