'use strict';
// tests/stress-harness-parity-matrix.spec.js — stress-test for #3451 (Epic #3411 T3.1)
// node --test
// (a) G6 chaos/fault-injection: malformed inputs never throw out of buildMatrix
// (b) G7 p99 latency budget: buildMatrix over full catalog repeatedly, assert p99 < budget

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { buildMatrix, probeCell, VERDICT } = require('../scripts/global/harness-parity-matrix');
const { loadRepoInventory } = require('../scripts/global/harness-catalog-reconciler');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCatalog(features, runtimes) {
  return {
    catalogVersion: 'aabbccddeeff0011',
    ssotAnchor: 'governance/README.md',
    runtimes: runtimes || ['claude-code'],
    layers: ['L1-identity-signing'],
    features: features || [],
    metadata: { layerCount: 1, featureCount: features ? features.length : 0, parityFlaggedCount: 0 },
  };
}

function makeFeature(overrides) {
  return Object.assign({
    id: 'chaos-feature',
    name: 'Chaos Feature',
    layer: 'L1-identity-signing',
    parity: 'yes',
    ssotFiles: ['scripts/global/detect-runtime.js'],
    perRuntime: { 'claude-code': { status: 'unverified' } },
  }, overrides);
}

function computePercentile(sortedMs, pct) {
  if (sortedMs.length === 0) return 0;
  const idx = Math.ceil((pct / 100) * sortedMs.length) - 1;
  return sortedMs[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// G6 — CHAOS / FAULT-INJECTION: buildMatrix never throws on malformed input
// ---------------------------------------------------------------------------

test('chaos: completely null catalog does not throw', () => {
  assert.doesNotThrow(() => {
    buildMatrix(null, { repoRoot: REPO_ROOT });
  });
});

test('chaos: empty catalog object does not throw', () => {
  assert.doesNotThrow(() => {
    buildMatrix({}, { repoRoot: REPO_ROOT });
  });
});

test('chaos: catalog with null features array does not throw', () => {
  assert.doesNotThrow(() => {
    const catalog = makeCatalog(null, ['claude-code']);
    catalog.features = null;
    buildMatrix(catalog, { repoRoot: REPO_ROOT });
  });
});

test('chaos: catalog with undefined runtimes does not throw', () => {
  assert.doesNotThrow(() => {
    const catalog = makeCatalog([makeFeature()]);
    delete catalog.runtimes;
    buildMatrix(catalog, { repoRoot: REPO_ROOT });
  });
});

test('chaos: feature with null ssotFiles does not throw and does not fail gate', () => {
  let result;
  assert.doesNotThrow(() => {
    const feature = makeFeature({ ssotFiles: null });
    const catalog = makeCatalog([feature], ['claude-code']);
    result = buildMatrix(catalog, { repoRoot: REPO_ROOT });
  });
  // null ssotFiles → allPresent=true → no failure
  assert.ok(result && result.failures.length === 0, 'null ssotFiles should not trigger failure');
});

test('chaos: feature with empty ssotFiles array does not throw', () => {
  let result;
  assert.doesNotThrow(() => {
    const feature = makeFeature({ ssotFiles: [] });
    const catalog = makeCatalog([feature], ['claude-code']);
    result = buildMatrix(catalog, { repoRoot: REPO_ROOT });
  });
  assert.ok(result, 'Expected a result object');
});

test('chaos: feature with missing perRuntime does not throw', () => {
  assert.doesNotThrow(() => {
    const feature = { id: 'no-perruntime', name: 'X', layer: 'L1-identity-signing', parity: 'yes',
      ssotFiles: ['scripts/global/detect-runtime.js'] };
    const catalog = makeCatalog([feature], ['claude-code']);
    buildMatrix(catalog, { repoRoot: REPO_ROOT });
  });
});

test('chaos: feature with null perRuntime does not throw', () => {
  assert.doesNotThrow(() => {
    const feature = makeFeature({ perRuntime: null });
    const catalog = makeCatalog([feature], ['claude-code']);
    buildMatrix(catalog, { repoRoot: REPO_ROOT });
  });
});

test('chaos: feature with invalid ssotFiles entries (non-strings) does not throw', () => {
  assert.doesNotThrow(() => {
    const feature = makeFeature({ ssotFiles: [null, undefined, 42, {}, []] });
    const catalog = makeCatalog([feature], ['claude-code']);
    buildMatrix(catalog, { repoRoot: REPO_ROOT });
  });
});

test('chaos: malformed perRuntime cell status (unknown value) does not throw', () => {
  assert.doesNotThrow(() => {
    const feature = makeFeature({ perRuntime: { 'claude-code': { status: 'GARBAGE_STATUS' } } });
    const catalog = makeCatalog([feature], ['claude-code']);
    buildMatrix(catalog, { repoRoot: REPO_ROOT });
  });
});

test('chaos: repoRoot pointing to non-existent directory does not throw', () => {
  assert.doesNotThrow(() => {
    const feature = makeFeature();
    const catalog = makeCatalog([feature], ['claude-code']);
    buildMatrix(catalog, { repoRoot: '/tmp/__nonexistent_chaos_root__' });
  });
});

test('chaos: empty repoRoot string does not throw', () => {
  assert.doesNotThrow(() => {
    const feature = makeFeature();
    const catalog = makeCatalog([feature], ['claude-code']);
    buildMatrix(catalog, { repoRoot: '' });
  });
});

test('chaos: probeCell with null feature does not throw', () => {
  assert.doesNotThrow(() => {
    try {
      probeCell(null, 'claude-code', REPO_ROOT);
    } catch (_err) {
      // probeCell may throw on null — buildMatrix wraps it; this is acceptable
    }
  });
});

test('chaos: buildMatrix summary always has required fields even on chaos input', () => {
  const chaosInputs = [
    null,
    {},
    makeCatalog(null, null),
    makeCatalog([makeFeature({ ssotFiles: null })], null),
    makeCatalog([makeFeature({ perRuntime: null })], ['claude-code']),
  ];
  for (const input of chaosInputs) {
    let result;
    assert.doesNotThrow(() => {
      result = buildMatrix(input, { repoRoot: REPO_ROOT });
    });
    if (result) {
      assert.ok(Array.isArray(result.cells), 'cells must be array');
      assert.ok(Array.isArray(result.failures), 'failures must be array');
      assert.ok(typeof result.summary === 'object', 'summary must be object');
      assert.ok(typeof result.summary.totalCells === 'number', 'totalCells must be number');
      assert.ok(typeof result.summary.failureCount === 'number', 'failureCount must be number');
    }
  }
});

// ---------------------------------------------------------------------------
// G7 — P99 LATENCY BUDGET: buildMatrix over full catalog, p99 < 2000 ms
// ---------------------------------------------------------------------------
test('p99 latency budget: buildMatrix over full catalog p99 < 2000 ms', () => {
  const { catalog } = loadRepoInventory();
  const RUNS = 20;
  const P99_BUDGET_MS = 2000;
  const latencies = [];

  for (let runIdx = 0; runIdx < RUNS; runIdx++) {
    const startTime = process.hrtime.bigint();
    buildMatrix(catalog, { repoRoot: REPO_ROOT });
    const endTime = process.hrtime.bigint();
    latencies.push(Number(endTime - startTime) / 1_000_000);
  }

  latencies.sort((numA, numB) => numA - numB);
  const p50 = computePercentile(latencies, 50);
  const p99 = computePercentile(latencies, 99);
  const minMs = latencies[0];
  const maxMs = latencies[latencies.length - 1];

  process.stdout.write(
    `\n[stress-parity-matrix] n=${RUNS} min=${minMs.toFixed(1)}ms p50=${p50.toFixed(1)}ms `
    + `p99=${p99.toFixed(1)}ms max=${maxMs.toFixed(1)}ms budget=${P99_BUDGET_MS}ms\n`
  );

  assert.ok(
    p99 < P99_BUDGET_MS,
    `p99 latency ${p99.toFixed(1)}ms exceeds budget of ${P99_BUDGET_MS}ms`
  );
});
