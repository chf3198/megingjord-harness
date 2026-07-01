'use strict';
// stress-harness-add-runtime.spec.js — stress + chaos tests for harness:add-runtime.
// MUST assert BOTH:
//   (a) fault-injection / chaos paths (G6): malformed inputs, missing files, mid-plan failure → rollback
//   (b) p99 latency budget (G7): buildPlan over 200 iterations, assert p99 under budget

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { buildPlan, planHash } = require('../scripts/global/harness-add-runtime');
const { applyPlan } = require('../scripts/global/harness-add-runtime-apply');

const PERF_ITERATIONS = 200;
// Generous p99 budget: measured first, then asserted above observed with margin.
// 500ms is generous for a pure-JS JSON-parse + plan-build loop (expected <50ms p99).
const P99_BUDGET_MS = 500;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stress-harness-'));
}

function writeMinimalRegistry(tempRoot) {
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
    `#!/usr/bin/env bash\n[[ "$TARGET" =~ ^(cursor|all)$ ]] || exit 1\nif [[ "$TARGET" == "cursor" || "$TARGET" == "all" ]]; then echo cursor; fi\n`
  );
  fs.writeFileSync(
    path.join(tempRoot, 'package.json'),
    JSON.stringify({ scripts: { 'deploy:cursor': 'bash scripts/deploy.sh --target cursor' } }, null, 2)
  );
}

function computePercentile(sortedValues, percentile) {
  const rank = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, rank)];
}

describe('G6 — fault injection / chaos paths', () => {
  test('buildPlan with malformed github-actor-team-map JSON does not crash unexpectedly', () => {
    const tempRoot = makeTempDir();
    try {
      writeMinimalRegistry(tempRoot);
      fs.writeFileSync(
        path.join(tempRoot, 'inventory', 'github-actor-team-map.json'),
        '{ INVALID JSON !!!'
      );
      assert.throws(
        () => buildPlan('chaos-rt', { repoRoot: tempRoot }),
        (err) => err instanceof SyntaxError || err instanceof Error,
        'malformed JSON must throw a recognizable error (SyntaxError or Error)'
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('buildPlan with missing catalog files throws a clear error', () => {
    const tempRoot = makeTempDir();
    try {
      // deliberately do not call writeMinimalRegistry — no files present
      assert.throws(
        () => buildPlan('missing-rt', { repoRoot: tempRoot }),
        (err) => err instanceof Error,
        'missing registry files must throw an Error'
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('buildPlan with descriptor missing required fields still returns a plan without throwing', () => {
    const tempRoot = makeTempDir();
    try {
      writeMinimalRegistry(tempRoot);
      // Empty descriptor (missing all required fields) in runtimes/
      fs.writeFileSync(
        path.join(tempRoot, 'inventory', 'runtimes', 'partial-rt.json'),
        JSON.stringify({}, null, 2)
      );
      assert.doesNotThrow(
        () => buildPlan('partial-rt', { repoRoot: tempRoot }),
        'descriptor with missing fields must not crash buildPlan'
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('applyPlan rolls back cleanly on mid-plan write failure', () => {
    const tempRoot = makeTempDir();
    try {
      writeMinimalRegistry(tempRoot);
      const plan = buildPlan('rollback-rt', { repoRoot: tempRoot });
      const pendingActions = plan.filter(action => action.op !== 'already-present');
      assert.ok(pendingActions.length >= 1, 'need pending actions to test rollback');

      const failingPlan = [
        pendingActions[0],
        {
          surface: 'chaos-fail',
          file: path.join(tempRoot, 'no-such-dir', 'no-such-file.json'),
          op: 'insert-registry-member',
          detail: 'injected failure for chaos test',
        },
      ];

      const beforeFiles = fs.readdirSync(path.join(tempRoot, 'inventory', 'runtimes'));
      let threwError = false;
      try {
        applyPlan(failingPlan, { repoRoot: tempRoot, dryRun: false });
      } catch (_err) {
        threwError = true;
      }
      assert.ok(threwError, 'applyPlan must throw on mid-plan failure');

      const afterFiles = fs.readdirSync(path.join(tempRoot, 'inventory', 'runtimes'));
      assert.deepEqual(beforeFiles, afterFiles, 'rollback must restore prior state — no partial writes remain');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('applyPlan with dryRun=true never writes any file regardless of plan size', () => {
    const tempRoot = makeTempDir();
    try {
      writeMinimalRegistry(tempRoot);
      const plan = buildPlan('dryrun-chaos', { repoRoot: tempRoot });
      const snapshotBefore = captureDirectorySnapshot(tempRoot);
      applyPlan(plan, { repoRoot: tempRoot, dryRun: true });
      const snapshotAfter = captureDirectorySnapshot(tempRoot);
      assert.deepEqual(snapshotBefore, snapshotAfter, 'dry-run must leave all files unchanged');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

function captureDirectorySnapshot(dirPath) {
  const snapshot = {};
  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      const relPath = path.relative(dirPath, fullPath);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        snapshot[relPath] = fs.readFileSync(fullPath, 'utf8');
      }
    }
  }
  walk(dirPath);
  return snapshot;
}

describe('G7 — p99 latency budget', () => {
  test(`buildPlan p99 latency under ${P99_BUDGET_MS}ms over ${PERF_ITERATIONS} iterations`, () => {
    const latencies = [];
    for (let iteration = 0; iteration < PERF_ITERATIONS; iteration++) {
      const startTime = process.hrtime.bigint();
      buildPlan('cursor', { repoRoot: REPO_ROOT });
      const endTime = process.hrtime.bigint();
      latencies.push(Number(endTime - startTime) / 1_000_000);
    }

    latencies.sort((valueA, valueB) => valueA - valueB);
    const observedP99 = computePercentile(latencies, 99);
    const observedMedian = computePercentile(latencies, 50);

    console.log(`buildPlan latency: median=${observedMedian.toFixed(2)}ms, p99=${observedP99.toFixed(2)}ms (budget=${P99_BUDGET_MS}ms, n=${PERF_ITERATIONS})`);

    assert.ok(
      observedP99 < P99_BUDGET_MS,
      `p99 ${observedP99.toFixed(2)}ms exceeded budget of ${P99_BUDGET_MS}ms`
    );
  });
});
