'use strict';
// harness-add-runtime.spec.js — tdd-pyramid unit tests for the scaffold generator.
// Covers: buildPlan for existing runtime (all already-present), new runtime (insert actions),
// planHash stability and sensitivity, dry-run writes nothing, rollback on failure.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { buildPlan, planHash } = require('../scripts/global/harness-add-runtime');
const { applyPlan } = require('../scripts/global/harness-add-runtime-apply');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'));
}

function setupMinimalRepo(tempRoot, runtimeId) {
  fs.mkdirSync(path.join(tempRoot, 'inventory', 'runtimes'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'scripts', 'global'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'scripts', 'xteam-mcp'), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, 'inventory', 'github-actor-team-map.json'),
    JSON.stringify({ actors: { 'cursor-agent': 'cursor' } }, null, 2)
  );
  fs.writeFileSync(
    path.join(tempRoot, 'scripts', 'global', 'routing-provider-adapters.json'),
    JSON.stringify({ runtimeKinds: ['cursor'] }, null, 2)
  );
  fs.writeFileSync(
    path.join(tempRoot, 'scripts', 'xteam-mcp', 'leader-election.js'),
    `'use strict';\nconst VALID_TEAMS = ['cursor'];\nmodule.exports = { VALID_TEAMS };\n`
  );
  fs.writeFileSync(
    path.join(tempRoot, 'scripts', 'global', 'detect-runtime.js'),
    `'use strict';\nconst KNOWN = ['cursor'];\nconst PRIMARY = [];\nmodule.exports = { KNOWN };\n`
  );
  fs.writeFileSync(
    path.join(tempRoot, 'inventory', 'team-model-signatures.json'),
    JSON.stringify({
      teamModelSpec: { teamValues: ['cursor'] },
      substrateTeamMap: { 'cursor-ide': 'cursor' },
      autoModeCoverage: { cursor: [] },
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(tempRoot, 'inventory', 'harness-self-test-registry.json'),
    JSON.stringify({ adapter_exemptions: { cursor: { exempt_checks: [], rationale: 'cursor' } } }, null, 2)
  );
  fs.writeFileSync(
    path.join(tempRoot, 'inventory', 'orchestrator-governance-parity.json'),
    JSON.stringify({ runtimes: ['cursor'], stateStoreParity: { runtimes: { cursor: { status: 'not-deployed' } } } }, null, 2)
  );
  fs.writeFileSync(
    path.join(tempRoot, 'scripts', 'deploy.sh'),
    `#!/usr/bin/env bash\n[[ "$TARGET" =~ ^(cursor|all)$ ]] || exit 1\nif [[ "$TARGET" == "cursor" || "$TARGET" == "all" ]]; then echo cursor; fi\n`
  );
  fs.writeFileSync(
    path.join(tempRoot, 'package.json'),
    JSON.stringify({ scripts: { 'deploy:cursor': 'bash scripts/deploy.sh --target cursor' } }, null, 2)
  );

  if (runtimeId) {
    fs.writeFileSync(
      path.join(tempRoot, 'inventory', 'runtimes', `${runtimeId}.json`),
      JSON.stringify({ runtime: runtimeId }, null, 2)
    );
  }
}

describe('buildPlan — existing runtime (cursor) on real repo', () => {
  test('all actions for cursor are already-present', () => {
    const plan = buildPlan('cursor', { repoRoot: REPO_ROOT });
    assert.ok(Array.isArray(plan), 'plan must be an array');
    assert.ok(plan.length > 0, 'plan must have at least one action');
    const nonPresent = plan.filter(action => action.op !== 'already-present');
    assert.deepEqual(
      nonPresent,
      [],
      `Expected all cursor actions already-present but got: ${nonPresent.map(a => a.surface).join(', ')}`
    );
  });

  test('plan has one entry per surface', () => {
    const plan = buildPlan('cursor', { repoRoot: REPO_ROOT });
    const surfaces = plan.map(action => action.surface);
    const unique = new Set(surfaces);
    assert.equal(unique.size, surfaces.length, 'each surface should appear exactly once');
  });
});

describe('buildPlan — new hypothetical runtime on minimal temp repo', () => {
  test('new runtime produces insert/create actions for all surfaces', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepo(tempRoot, null);
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const insertActions = plan.filter(action => action.op !== 'already-present');
      assert.ok(insertActions.length > 0, 'new runtime should have pending actions');
      const surfaces = insertActions.map(action => action.surface);
      assert.ok(surfaces.includes('runtime-descriptor'), 'should include runtime-descriptor');
      assert.ok(surfaces.includes('github-actor-team-map'), 'should include github-actor-team-map');
      assert.ok(surfaces.includes('routing-provider-adapters'), 'should include routing-provider-adapters');
      assert.ok(surfaces.includes('leader-election'), 'should include leader-election');
      assert.ok(surfaces.includes('detect-runtime'), 'should include detect-runtime');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('planHash', () => {
  test('is stable across two identical buildPlan calls', () => {
    const plan1 = buildPlan('cursor', { repoRoot: REPO_ROOT });
    const plan2 = buildPlan('cursor', { repoRoot: REPO_ROOT });
    assert.equal(planHash(plan1), planHash(plan2), 'identical plan must produce identical hash');
  });

  test('changes when runtime id changes', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepo(tempRoot, null);
      const planAlpha = buildPlan('alpha-rt', { repoRoot: tempRoot });
      const planBeta = buildPlan('beta-rt', { repoRoot: tempRoot });
      assert.notEqual(planHash(planAlpha), planHash(planBeta), 'different runtime ids must produce different hashes');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('applyPlan dry-run', () => {
  test('writes nothing to disk', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepo(tempRoot, null);
      const plan = buildPlan('dryrt', { repoRoot: tempRoot });
      const before = fs.readdirSync(path.join(tempRoot, 'inventory', 'runtimes'));
      applyPlan(plan, { repoRoot: tempRoot, dryRun: true });
      const after = fs.readdirSync(path.join(tempRoot, 'inventory', 'runtimes'));
      assert.deepEqual(before, after, 'dry-run must not create any files');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('returns diffSummary string in dry-run result', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepo(tempRoot, null);
      const plan = buildPlan('dryrt', { repoRoot: tempRoot });
      const result = applyPlan(plan, { repoRoot: tempRoot, dryRun: true });
      assert.ok(typeof result.diffSummary === 'string', 'diffSummary must be a string');
      assert.ok(result.diffSummary.length > 0, 'diffSummary must be non-empty');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('applyPlan rollback', () => {
  test('restores all prior file content when a mid-plan action fails', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepo(tempRoot, null);
      const plan = buildPlan('rollrt', { repoRoot: tempRoot });

      const actionsToApply = plan.filter(action => action.op !== 'already-present');
      assert.ok(actionsToApply.length >= 2, 'need at least 2 pending actions to test rollback');

      const firstRealAction = actionsToApply[0];
      const failingPlan = [
        firstRealAction,
        {
          surface: 'injected-failure',
          file: path.join(tempRoot, 'nonexistent-dir', 'fail.json'),
          op: 'insert-registry-member',
          detail: 'deliberately fails',
        },
      ];

      const priorDescriptorDir = fs.readdirSync(path.join(tempRoot, 'inventory', 'runtimes'));

      let didThrow = false;
      try {
        applyPlan(failingPlan, { repoRoot: tempRoot, dryRun: false });
      } catch (_err) {
        didThrow = true;
      }

      assert.ok(didThrow, 'applyPlan must throw when an action fails');

      const afterDescriptorDir = fs.readdirSync(path.join(tempRoot, 'inventory', 'runtimes'));
      assert.deepEqual(priorDescriptorDir, afterDescriptorDir, 'rollback must restore original file state');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('unknown / graceful handling', () => {
  test('buildPlan for unknown runtime does not throw', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepo(tempRoot, null);
      assert.doesNotThrow(() => buildPlan('brand-new-rt', { repoRoot: tempRoot }));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
