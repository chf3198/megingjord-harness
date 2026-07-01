'use strict';
// harness-add-runtime-surfaces15-20.spec.js — T2.7 (#3450) unit tests for the six new
// onboarding surfaces (15-20): lefthook, governance-profiles, instruction-set, auth-profile,
// goal-tier, config-dir. Covers:
//   (a) all six appear in a new-runtime plan with pending actions
//   (b) all six show already-present for cursor (committed runtime, real repo)
//   (c) golden assertion: cursor plan still has 17 surfaces, all already-present

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { buildPlan } = require('../scripts/global/harness-add-runtime');
const {
  SURFACE_LEFTHOOK,
  SURFACE_GOVERNANCE_PROFILES,
  SURFACE_INSTRUCTION_SET,
  SURFACE_AUTH_PROFILE,
  SURFACE_GOAL_TIER,
  SURFACE_CONFIG_DIR,
} = require('../scripts/global/harness-add-runtime-surfaces');

const NEW_SURFACES = [
  SURFACE_LEFTHOOK,
  SURFACE_GOVERNANCE_PROFILES,
  SURFACE_INSTRUCTION_SET,
  SURFACE_AUTH_PROFILE,
  SURFACE_GOAL_TIER,
  SURFACE_CONFIG_DIR,
];

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harness-surf15-'));
}

function setupMinimalRepoForNewSurfaces(tempRoot) {
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
    JSON.stringify({
      runtimes: ['cursor'],
      stateStoreParity: { runtimes: { cursor: { status: 'not-deployed' } } },
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(tempRoot, 'scripts', 'deploy.sh'),
    `#!/usr/bin/env bash\n[[ "$TARGET" =~ ^(cursor|all)$ ]] || exit 1\n` +
    `if [[ "$TARGET" == "cursor" || "$TARGET" == "all" ]]; then echo cursor; fi\n`
  );
  fs.writeFileSync(
    path.join(tempRoot, 'package.json'),
    JSON.stringify({
      scripts: {
        'deploy:cursor': 'bash scripts/deploy.sh --target cursor',
        'harness:add-runtime': 'node scripts/global/harness-add-runtime.js',
      },
    }, null, 2)
  );
  // Intentionally NO lefthook.yml, governance-profiles.json, authorization-profiles.json,
  // model-routing-policy.json — so those four shared surfaces show pending for testrt.
  // Intentionally NO inventory/runtimes/testrt.json — so instruction-set and config-dir pending.
}

describe('T2.7 — new surfaces appear in new-runtime plan (minimal repo, no shared files)', () => {
  test('all six new surfaces are present in the plan', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const surfaceNames = plan.map(action => action.surface);
      for (const surfaceName of NEW_SURFACES) {
        assert.ok(
          surfaceNames.includes(surfaceName),
          `Expected surface "${surfaceName}" in plan but it was missing`
        );
      }
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('lefthook surface is pending when lefthook.yml is absent', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const lefthookAction = plan.find(action => action.surface === SURFACE_LEFTHOOK);
      assert.ok(lefthookAction, 'lefthook surface must be in plan');
      assert.equal(lefthookAction.op, 'create-file', 'lefthook must be pending when lefthook.yml absent');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('governance-profiles surface is pending when hooks/governance-profiles.json absent', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const govAction = plan.find(action => action.surface === SURFACE_GOVERNANCE_PROFILES);
      assert.ok(govAction, 'governance-profiles surface must be in plan');
      assert.equal(govAction.op, 'create-file', 'governance-profiles must be pending when file absent');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('instruction-set surface is pending when runtime descriptor absent', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const instrAction = plan.find(action => action.surface === SURFACE_INSTRUCTION_SET);
      assert.ok(instrAction, 'instruction-set surface must be in plan');
      assert.equal(instrAction.op, 'create-file', 'instruction-set must be pending when descriptor absent');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('auth-profile surface is pending when config/authorization-profiles.json absent', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const authAction = plan.find(action => action.surface === SURFACE_AUTH_PROFILE);
      assert.ok(authAction, 'auth-profile surface must be in plan');
      assert.equal(authAction.op, 'create-file', 'auth-profile must be pending when file absent');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('goal-tier surface is pending when model-routing-policy.json absent', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const goalAction = plan.find(action => action.surface === SURFACE_GOAL_TIER);
      assert.ok(goalAction, 'goal-tier surface must be in plan');
      assert.equal(goalAction.op, 'insert-registry-member', 'goal-tier must be pending when file absent');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('config-dir surface is pending when runtime descriptor absent', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const configAction = plan.find(action => action.surface === SURFACE_CONFIG_DIR);
      assert.ok(configAction, 'config-dir surface must be in plan');
      assert.equal(configAction.op, 'create-file', 'config-dir must be pending when descriptor absent');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('plan has exactly one entry per surface (no duplicates in new surfaces)', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const surfaceNames = plan.map(action => action.surface);
      const uniqueSurfaces = new Set(surfaceNames);
      assert.equal(
        uniqueSurfaces.size,
        surfaceNames.length,
        `Duplicate surfaces detected: ${surfaceNames.filter((name, idx) => surfaceNames.indexOf(name) !== idx).join(', ')}`
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('T2.7 — new surfaces are already-present for cursor (real repo)', () => {
  test('lefthook surface is already-present for cursor', () => {
    const plan = buildPlan('cursor', { repoRoot: REPO_ROOT });
    const lefthookAction = plan.find(action => action.surface === SURFACE_LEFTHOOK);
    assert.ok(lefthookAction, 'lefthook surface must be in cursor plan');
    assert.equal(lefthookAction.op, 'already-present', 'lefthook must be already-present for cursor');
  });

  test('governance-profiles surface is already-present for cursor', () => {
    const plan = buildPlan('cursor', { repoRoot: REPO_ROOT });
    const govAction = plan.find(action => action.surface === SURFACE_GOVERNANCE_PROFILES);
    assert.ok(govAction, 'governance-profiles surface must be in cursor plan');
    assert.equal(govAction.op, 'already-present', 'governance-profiles must be already-present for cursor');
  });

  test('instruction-set surface is already-present for cursor', () => {
    const plan = buildPlan('cursor', { repoRoot: REPO_ROOT });
    const instrAction = plan.find(action => action.surface === SURFACE_INSTRUCTION_SET);
    assert.ok(instrAction, 'instruction-set surface must be in cursor plan');
    assert.equal(instrAction.op, 'already-present', 'instruction-set must be already-present for cursor');
  });

  test('auth-profile surface is already-present for cursor', () => {
    const plan = buildPlan('cursor', { repoRoot: REPO_ROOT });
    const authAction = plan.find(action => action.surface === SURFACE_AUTH_PROFILE);
    assert.ok(authAction, 'auth-profile surface must be in cursor plan');
    assert.equal(authAction.op, 'already-present', 'auth-profile must be already-present for cursor');
  });

  test('goal-tier surface is already-present for cursor', () => {
    const plan = buildPlan('cursor', { repoRoot: REPO_ROOT });
    const goalAction = plan.find(action => action.surface === SURFACE_GOAL_TIER);
    assert.ok(goalAction, 'goal-tier surface must be in cursor plan');
    assert.equal(goalAction.op, 'already-present', 'goal-tier must be already-present for cursor');
  });

  test('config-dir surface is already-present for cursor', () => {
    const plan = buildPlan('cursor', { repoRoot: REPO_ROOT });
    const configAction = plan.find(action => action.surface === SURFACE_CONFIG_DIR);
    assert.ok(configAction, 'config-dir surface must be in cursor plan');
    assert.equal(configAction.op, 'already-present', 'config-dir must be already-present for cursor');
  });

  test('cursor re-scaffold plan has 17 total surfaces and zero pending', () => {
    const plan = buildPlan('cursor', { repoRoot: REPO_ROOT });
    assert.equal(plan.length, 17, `cursor plan must have 17 surfaces, got ${plan.length}`);
    const pendingActions = plan.filter(action => action.op !== 'already-present');
    assert.deepEqual(
      pendingActions,
      [],
      `cursor re-scaffold must be a clean no-op but found pending: [${pendingActions.map(action => action.surface).join(', ')}]`
    );
  });
});

describe('T2.7 — new surfaces already-present detection with shared files present', () => {
  test('lefthook already-present when lefthook.yml exists in temp repo', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      fs.writeFileSync(path.join(tempRoot, 'lefthook.yml'), 'pre-push:\n  commands: {}\n', 'utf8');
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const lefthookAction = plan.find(action => action.surface === SURFACE_LEFTHOOK);
      assert.equal(lefthookAction.op, 'already-present', 'lefthook must flip to already-present when file exists');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('instruction-set already-present when runtime descriptor exists', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      fs.writeFileSync(
        path.join(tempRoot, 'inventory', 'runtimes', 'testrt.json'),
        JSON.stringify({ runtime: 'testrt', deploy: { home: '~/.testrt' } }, null, 2)
      );
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const instrAction = plan.find(action => action.surface === SURFACE_INSTRUCTION_SET);
      assert.equal(instrAction.op, 'already-present', 'instruction-set must flip to already-present when descriptor exists');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('config-dir already-present when runtime descriptor has deploy.home', () => {
    const tempRoot = makeTempDir();
    try {
      setupMinimalRepoForNewSurfaces(tempRoot);
      fs.writeFileSync(
        path.join(tempRoot, 'inventory', 'runtimes', 'testrt.json'),
        JSON.stringify({ runtime: 'testrt', deploy: { home: '~/.testrt' } }, null, 2)
      );
      const plan = buildPlan('testrt', { repoRoot: tempRoot });
      const configAction = plan.find(action => action.surface === SURFACE_CONFIG_DIR);
      assert.equal(configAction.op, 'already-present', 'config-dir must flip to already-present when descriptor has deploy.home');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
