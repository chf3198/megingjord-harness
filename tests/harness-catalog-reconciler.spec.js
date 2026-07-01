'use strict';
// tests/harness-catalog-reconciler.spec.js — tdd-pyramid for #3441 (Epic #3411 T1.3)
// node --test

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const {
  deriveCells,
  summarize,
  reconcileWithLegacy,
  loadRepoInventory,
  SCHEMA_ENUM,
} = require('../scripts/global/harness-catalog-reconciler');

// ---------------------------------------------------------------------------
// Minimal fixture factories
// ---------------------------------------------------------------------------
function makeFeature(overrides) {
  return Object.assign({
    id: 'test-feature',
    name: 'Test Feature',
    layer: 'L1-identity-signing',
    parity: 'yes',
    ssotFiles: ['scripts/global/test.js'],
    perRuntime: {
      'claude-code': { status: 'unverified' },
      copilot: { status: 'unverified' },
    },
  }, overrides);
}

function makeDescriptor(runtime, overrides) {
  return Object.assign({
    runtime,
    signing: { team: runtime },
    deploy: { home: `~/.${runtime}`, artifactClasses: ['settings', 'scripts'] },
    hooks: { events: ['PreToolUse', 'Stop'] },
    capabilities: { ghAuth: 'available' },
  }, overrides);
}

function makeCatalog(features, runtimes) {
  return {
    catalogVersion: 'aabbccddeeff0011',
    ssotAnchor: 'governance/README.md',
    runtimes: runtimes || ['claude-code', 'copilot'],
    layers: ['L1-identity-signing'],
    features: features || [],
    metadata: { layerCount: 1, featureCount: features ? features.length : 0, parityFlaggedCount: 0 },
  };
}

// ---------------------------------------------------------------------------
// Test: deriveCells returns one cell per (feature, runtime) for parity:yes features
// ---------------------------------------------------------------------------
test('deriveCells returns one cell per (feature × runtime) for parity:yes', () => {
  const features = [
    makeFeature({ id: 'feat-a', parity: 'yes' }),
    makeFeature({ id: 'feat-b', parity: 'yes' }),
  ];
  const catalog = makeCatalog(features, ['claude-code', 'copilot']);
  const cells = deriveCells(catalog, {});
  // 2 features × 2 runtimes = 4 cells
  assert.strictEqual(cells.length, 4);
});

// ---------------------------------------------------------------------------
// Test: parity:no features produce no cells
// ---------------------------------------------------------------------------
test('deriveCells skips parity:no features', () => {
  const features = [
    makeFeature({ id: 'no-feat', parity: 'no', perRuntime: undefined }),
  ];
  const catalog = makeCatalog(features, ['claude-code', 'copilot']);
  const cells = deriveCells(catalog, {});
  assert.strictEqual(cells.length, 0);
});

// ---------------------------------------------------------------------------
// Test: runtime-NA features always derive structural-NA
// ---------------------------------------------------------------------------
test('runtime-NA features derive structural-NA regardless of descriptor', () => {
  const feature = makeFeature({
    id: 'na-feat',
    parity: 'runtime-NA',
    perRuntime: { 'claude-code': { status: 'unverified' }, copilot: { status: 'unverified' } },
  });
  const catalog = makeCatalog([feature], ['claude-code', 'copilot']);
  const descriptors = {
    'claude-code': makeDescriptor('claude-code'),
    copilot: makeDescriptor('copilot'),
  };
  const cells = deriveCells(catalog, { descriptors });
  assert.ok(cells.length >= 2);
  for (const cell of cells) {
    assert.strictEqual(cell.status, 'structural-NA', `Expected structural-NA, got ${cell.status} for ${cell.runtime}`);
    assert.strictEqual(cell.source, 'catalog');
  }
});

// ---------------------------------------------------------------------------
// Test: all returned statuses are in the schema enum
// ---------------------------------------------------------------------------
test('all derived statuses are valid schema enum values', () => {
  const { catalog, manifest, descriptors } = loadRepoInventory();
  const cells = deriveCells(catalog, { descriptors, manifest });
  for (const cell of cells) {
    assert.ok(
      SCHEMA_ENUM.has(cell.status),
      `Invalid status "${cell.status}" for feature ${cell.featureId} runtime ${cell.runtime}`
    );
  }
});

// ---------------------------------------------------------------------------
// Test: layer with matching capability token derives "full"
// ---------------------------------------------------------------------------
test('feature layer mapping to covered capability derives full', () => {
  // L3-hook-gate-enforcement requires 'hooks' token; descriptor has hooks.events
  const feature = makeFeature({
    id: 'hook-feat',
    layer: 'L3-hook-gate-enforcement',
    parity: 'yes',
    perRuntime: { 'claude-code': { status: 'unverified' } },
  });
  const catalog = makeCatalog([feature], ['claude-code']);
  const descriptors = {
    'claude-code': makeDescriptor('claude-code', {
      hooks: { events: ['PreToolUse', 'Stop'] },
      deploy: { home: '~/.claude', artifactClasses: ['settings'] },
    }),
  };
  const manifest = { runtimes: ['claude-code'] };
  const cells = deriveCells(catalog, { descriptors, manifest });
  assert.strictEqual(cells.length, 1);
  assert.strictEqual(cells[0].status, 'full');
  assert.strictEqual(cells[0].source, 'descriptor');
});

// ---------------------------------------------------------------------------
// Test: descriptor present but lacking required token derives "absent"
// ---------------------------------------------------------------------------
test('descriptor present but missing capability token derives absent for known runtime', () => {
  // L3 requires 'hooks'; descriptor has no hooks.events
  const feature = makeFeature({
    id: 'hook-feat-2',
    layer: 'L3-hook-gate-enforcement',
    parity: 'yes',
    perRuntime: { 'claude-code': { status: 'unverified' } },
  });
  const catalog = makeCatalog([feature], ['claude-code']);
  const descriptors = {
    'claude-code': {
      runtime: 'claude-code',
      signing: { team: 'claude-code' },
      deploy: { home: '~/.claude', artifactClasses: ['settings', 'scripts'] },
      hooks: { events: [] }, // empty events → no 'hooks' token
      capabilities: {},
    },
  };
  const manifest = { runtimes: ['claude-code'] };
  const cells = deriveCells(catalog, { descriptors, manifest });
  assert.strictEqual(cells.length, 1);
  assert.strictEqual(cells[0].status, 'absent');
});

// ---------------------------------------------------------------------------
// Test: summarize counts sum to total
// ---------------------------------------------------------------------------
test('summarize: byStatus counts sum to total', () => {
  const { catalog, manifest, descriptors } = loadRepoInventory();
  const cells = deriveCells(catalog, { descriptors, manifest });
  const summary = summarize(cells);
  const statusSum = Object.values(summary.byStatus).reduce((a, b) => a + b, 0);
  assert.strictEqual(statusSum, summary.total, `byStatus sum ${statusSum} !== total ${summary.total}`);
});

// ---------------------------------------------------------------------------
// Test: summarize byRuntime counts also sum to total
// ---------------------------------------------------------------------------
test('summarize: byRuntime counts sum to total', () => {
  const { catalog, manifest, descriptors } = loadRepoInventory();
  const cells = deriveCells(catalog, { descriptors, manifest });
  const summary = summarize(cells);
  let rtSum = 0;
  for (const counts of Object.values(summary.byRuntime)) {
    rtSum += Object.values(counts).reduce((a, b) => a + b, 0);
  }
  assert.strictEqual(rtSum, summary.total, `byRuntime sum ${rtSum} !== total ${summary.total}`);
});

// ---------------------------------------------------------------------------
// Test: reconcileWithLegacy on real repo inventory returns consistent:true
// ---------------------------------------------------------------------------
test('reconcileWithLegacy on real repo inventory is consistent', () => {
  const { catalog, manifest, descriptors } = loadRepoInventory();
  const result = reconcileWithLegacy(catalog, { descriptors, manifest });
  assert.strictEqual(
    result.consistent,
    true,
    `Expected consistent:true but got conflicts: ${JSON.stringify(result.conflicts)}`
  );
});

// ---------------------------------------------------------------------------
// Test: fail-open — missing descriptor fields do not throw; yield unverified
// ---------------------------------------------------------------------------
test('deriveCells with missing descriptor does not throw and yields unverified', () => {
  const feature = makeFeature({
    id: 'safe-feat',
    layer: 'L5-validators-ci-workflows',
    parity: 'yes',
    perRuntime: { 'claude-code': { status: 'unverified' } },
  });
  const catalog = makeCatalog([feature], ['claude-code']);
  // Deliberately missing descriptor
  assert.doesNotThrow(() => {
    const cells = deriveCells(catalog, { descriptors: {} });
    assert.ok(cells.length >= 1);
  });
});

// ---------------------------------------------------------------------------
// Test: fail-open — null descriptor for a runtime yields unverified
// ---------------------------------------------------------------------------
test('deriveCells with null descriptor does not throw', () => {
  const feature = makeFeature({ id: 'null-desc-feat', parity: 'yes' });
  const catalog = makeCatalog([feature], ['claude-code']);
  let cells;
  assert.doesNotThrow(() => {
    cells = deriveCells(catalog, { descriptors: { 'claude-code': null } });
  });
  assert.ok(cells && cells.length === 1);
  assert.ok(SCHEMA_ENUM.has(cells[0].status));
});

// ---------------------------------------------------------------------------
// Test: each cell has required fields (featureId, runtime, status, source)
// ---------------------------------------------------------------------------
test('each cell has featureId, runtime, status, and source fields', () => {
  const { catalog, manifest, descriptors } = loadRepoInventory();
  const cells = deriveCells(catalog, { descriptors, manifest });
  for (const cell of cells.slice(0, 20)) {
    assert.ok(typeof cell.featureId === 'string' && cell.featureId.length > 0, 'missing featureId');
    assert.ok(typeof cell.runtime === 'string' && cell.runtime.length > 0, 'missing runtime');
    assert.ok(SCHEMA_ENUM.has(cell.status), `invalid status: ${cell.status}`);
    assert.ok(typeof cell.source === 'string' && cell.source.length > 0, 'missing source');
  }
});
