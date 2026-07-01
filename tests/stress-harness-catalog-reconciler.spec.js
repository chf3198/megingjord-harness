'use strict';
// tests/stress-harness-catalog-reconciler.spec.js — stress-test for #3441 (Epic #3411 T1.3)
// node --test
// MUST assert BOTH:
//   (a) chaos/fault-injection paths — deriveCells never throws on malformed input (G6)
//   (b) p99 latency budget — full-catalog derivation stays under 50ms p99 (G7)

const { test } = require('node:test');
const assert = require('node:assert');

const {
  deriveCells,
  loadRepoInventory,
  SCHEMA_ENUM,
} = require('../scripts/global/harness-catalog-reconciler');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function computePercentile(sortedDurations, pct) {
  if (sortedDurations.length === 0) return 0;
  const idx = Math.ceil((pct / 100) * sortedDurations.length) - 1;
  return sortedDurations[Math.max(0, idx)];
}

function makeMalformedDescriptors() {
  return [
    null,
    undefined,
    {},
    { deploy: null },
    { deploy: { artifactClasses: null }, hooks: null, capabilities: null },
    { deploy: { artifactClasses: [null, 42, true, ''] }, hooks: { events: [null, 0] } },
    { signing: null, deploy: {}, hooks: {}, capabilities: {} },
    'string-not-object',
    42,
    [],
    { hooks: { events: ['PreToolUse'], configPath: null }, deploy: {} },
    // Deeply nested but wrong types
    { deploy: { home: 123, artifactClasses: 'not-array' }, hooks: { events: 'not-array' } },
  ];
}

function makeMalformedCatalogs() {
  return [
    // Empty catalog
    { runtimes: [], features: [], layers: [], metadata: {} },
    // Null features
    { runtimes: ['claude-code'], features: null, layers: [], metadata: {} },
    // Features with missing fields
    { runtimes: ['claude-code'], features: [{}], layers: [], metadata: {} },
    // Features with unknown parity
    { runtimes: ['claude-code'], features: [{ id: 'f', parity: 'unknown', name: 'F', layer: 'L1-identity-signing' }], layers: [], metadata: {} },
    // Features with no layer
    { runtimes: ['claude-code'], features: [{ id: 'f2', parity: 'yes', name: 'F2', perRuntime: { 'claude-code': { status: 'unverified' } } }], layers: [], metadata: {} },
    // Completely empty object
    {},
    // Missing runtimes
    { features: [{ id: 'f3', parity: 'yes', name: 'F3', layer: 'L3-hook-gate-enforcement', perRuntime: {} }] },
  ];
}

// ---------------------------------------------------------------------------
// (a) Chaos / Fault-injection tests — G6
// ---------------------------------------------------------------------------

test('chaos: deriveCells never throws on malformed descriptors', () => {
  const { catalog } = loadRepoInventory();
  const malformedDescriptors = makeMalformedDescriptors();

  for (const badDescriptor of malformedDescriptors) {
    assert.doesNotThrow(() => {
      const descriptors = {
        'claude-code': badDescriptor,
        copilot: badDescriptor,
        codex: badDescriptor,
        cursor: badDescriptor,
        antigravity: badDescriptor,
      };
      const cells = deriveCells(catalog, { descriptors });
      // All returned cells must have valid statuses
      for (const cell of cells) {
        assert.ok(
          SCHEMA_ENUM.has(cell.status),
          `Invalid status "${cell.status}" with malformed descriptor: ${JSON.stringify(badDescriptor)}`
        );
      }
    }, `deriveCells threw with malformed descriptor: ${JSON.stringify(badDescriptor)}`);
  }
});

test('chaos: deriveCells never throws on empty catalog', () => {
  assert.doesNotThrow(() => {
    const cells = deriveCells({ runtimes: [], features: [], layers: [], metadata: {} }, {});
    assert.strictEqual(cells.length, 0);
  });
});

test('chaos: deriveCells never throws on null/missing catalog fields', () => {
  const malformedCatalogs = makeMalformedCatalogs();
  for (const badCatalog of malformedCatalogs) {
    assert.doesNotThrow(() => {
      deriveCells(badCatalog, {});
    }, `deriveCells threw with malformed catalog: ${JSON.stringify(badCatalog)}`);
  }
});

test('chaos: deriveCells degrades to unverified on missing runtimes in descriptors', () => {
  const { catalog } = loadRepoInventory();
  // Pass empty descriptors object — all runtimes missing
  assert.doesNotThrow(() => {
    const cells = deriveCells(catalog, { descriptors: {} });
    for (const cell of cells) {
      assert.ok(SCHEMA_ENUM.has(cell.status), `Invalid status: ${cell.status}`);
    }
  });
});

test('chaos: deriveCells with truncated perRuntime block does not throw', () => {
  const partialCatalog = {
    runtimes: ['claude-code', 'copilot', 'codex'],
    features: [
      {
        id: 'partial-feat',
        name: 'Partial',
        layer: 'L1-identity-signing',
        parity: 'yes',
        perRuntime: {
          'claude-code': { status: 'full' },
          // copilot and codex entries intentionally missing
        },
      },
    ],
    layers: ['L1-identity-signing'],
    metadata: {},
  };
  assert.doesNotThrow(() => {
    const cells = deriveCells(partialCatalog, { descriptors: {} });
    assert.strictEqual(cells.length, 3, 'should produce 3 cells even with truncated perRuntime');
    for (const cell of cells) {
      assert.ok(SCHEMA_ENUM.has(cell.status));
    }
  });
});

test('chaos: deriveCells with descriptor having circular-reference-like bad types', () => {
  const { catalog } = loadRepoInventory();
  const weirdDescriptor = {
    runtime: 'claude-code',
    deploy: { artifactClasses: [null, undefined, {}, [], 'scripts'] },
    hooks: { events: [null, '', 0, 'PreToolUse'] },
    capabilities: { key: null, key2: undefined },
    signing: { team: null },
  };
  assert.doesNotThrow(() => {
    deriveCells(catalog, { descriptors: { 'claude-code': weirdDescriptor } });
  });
});

test('chaos: runtime-NA features are stable even with all-bad descriptors', () => {
  const catalog = {
    runtimes: ['claude-code', 'copilot'],
    features: [{
      id: 'na-feat',
      name: 'NA',
      layer: 'L3-hook-gate-enforcement',
      parity: 'runtime-NA',
      perRuntime: { 'claude-code': { status: 'unverified' }, copilot: { status: 'unverified' } },
    }],
    layers: ['L3-hook-gate-enforcement'],
    metadata: {},
  };
  assert.doesNotThrow(() => {
    const cells = deriveCells(catalog, { descriptors: { 'claude-code': null, copilot: 'bad' } });
    for (const cell of cells) {
      assert.strictEqual(cell.status, 'structural-NA');
    }
  });
});

// ---------------------------------------------------------------------------
// (b) p99 latency budget — G7
// Stated budget: 50ms per full-catalog derivation (223 features × 5 runtimes).
// Measured on first run to calibrate; asserted with margin.
// ---------------------------------------------------------------------------

test('p99 latency: 200 full-catalog derivations complete under 50ms p99', () => {
  const ITERATIONS = 200;
  const P99_BUDGET_MS = 50;

  const { catalog, descriptors, manifest } = loadRepoInventory();

  // Warm up JIT with a few runs before measuring
  for (let warmup = 0; warmup < 5; warmup++) {
    deriveCells(catalog, { descriptors, manifest });
  }

  const durations = [];
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const start = performance.now();
    deriveCells(catalog, { descriptors, manifest });
    const end = performance.now();
    durations.push(end - start);
  }

  durations.sort((firstDuration, secondDuration) => firstDuration - secondDuration);
  const observedP99 = computePercentile(durations, 99);
  const observedP50 = computePercentile(durations, 50);
  const minDuration = durations[0];
  const maxDuration = durations[durations.length - 1];

  process.stdout.write(
    `[stress] deriveCells p99=${observedP99.toFixed(3)}ms ` +
    `p50=${observedP50.toFixed(3)}ms ` +
    `min=${minDuration.toFixed(3)}ms ` +
    `max=${maxDuration.toFixed(3)}ms ` +
    `over ${ITERATIONS} iterations\n`
  );

  assert.ok(
    observedP99 < P99_BUDGET_MS,
    `p99 latency ${observedP99.toFixed(3)}ms exceeds budget of ${P99_BUDGET_MS}ms`
  );
});

test('p99 latency: summarize over 200 iterations stays under 10ms p99', () => {
  const ITERATIONS = 200;
  const P99_BUDGET_MS = 10;

  const { summarize } = require('../scripts/global/harness-catalog-reconciler');
  const { catalog, descriptors, manifest } = loadRepoInventory();
  const cells = deriveCells(catalog, { descriptors, manifest });

  // Warm up
  for (let warmup = 0; warmup < 5; warmup++) {
    summarize(cells);
  }

  const durations = [];
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const start = performance.now();
    summarize(cells);
    const end = performance.now();
    durations.push(end - start);
  }

  durations.sort((firstDuration, secondDuration) => firstDuration - secondDuration);
  const observedP99 = computePercentile(durations, 99);

  process.stdout.write(
    `[stress] summarize p99=${observedP99.toFixed(3)}ms over ${ITERATIONS} iterations\n`
  );

  assert.ok(
    observedP99 < P99_BUDGET_MS,
    `summarize p99 ${observedP99.toFixed(3)}ms exceeds budget of ${P99_BUDGET_MS}ms`
  );
});
