'use strict';
// tests/harness-parity-matrix.spec.js — tdd-pyramid for #3451 (Epic #3411 T3.1)
// node --test

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const {
  probeCell,
  buildMatrix,
  VERDICT,
  resolveSsotFile,
} = require('../scripts/global/harness-parity-matrix');

const { loadRepoInventory } = require('../scripts/global/harness-catalog-reconciler');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------
function makeFeature(overrides) {
  return Object.assign({
    id: 'test-feature',
    name: 'Test Feature',
    layer: 'L1-identity-signing',
    parity: 'yes',
    ssotFiles: ['scripts/global/detect-runtime.js'],
    perRuntime: {
      'claude-code': { status: 'unverified' },
    },
  }, overrides);
}

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

// ---------------------------------------------------------------------------
// probeCell: ok verdict for a real wired cell
// detect-runtime.js exists in the repo and is declared unverified (FULL_STATUSES)
// ---------------------------------------------------------------------------
test('probeCell returns ok for a wired cell (ssotFile exists, status unverified)', () => {
  const feature = makeFeature({
    id: 'runtime-detector',
    ssotFiles: ['scripts/global/detect-runtime.js'],
    perRuntime: { 'claude-code': { status: 'unverified' } },
  });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.strictEqual(result.featureId, 'runtime-detector');
  assert.strictEqual(result.runtime, 'claude-code');
  assert.strictEqual(result.verdict, VERDICT.OK, `Expected ok, got ${result.verdict}`);
  assert.strictEqual(result.probed, 'present');
});

// ---------------------------------------------------------------------------
// probeCell: declared-full-but-missing when ssotFile absent
// ---------------------------------------------------------------------------
test('probeCell returns declared-full-but-missing for missing ssotFile', () => {
  const feature = makeFeature({
    id: 'synthetic-missing',
    ssotFiles: ['scripts/global/__nonexistent_probe_test__.js'],
    perRuntime: { 'claude-code': { status: 'unverified' } },
  });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.strictEqual(result.verdict, VERDICT.DECLARED_FULL_BUT_MISSING);
  assert.strictEqual(result.probed, 'missing');
});

// ---------------------------------------------------------------------------
// probeCell: declared-full-but-missing also triggers for status:full
// ---------------------------------------------------------------------------
test('probeCell declared-full-but-missing also for explicit status:full with missing ssotFile', () => {
  const feature = makeFeature({
    id: 'synthetic-full-missing',
    ssotFiles: ['scripts/global/__nonexistent_full__.js'],
    perRuntime: { 'claude-code': { status: 'full' } },
  });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.strictEqual(result.verdict, VERDICT.DECLARED_FULL_BUT_MISSING);
  assert.strictEqual(result.declared, 'full');
});

// ---------------------------------------------------------------------------
// probeCell: na-without-substitute for structural-NA cell with no substituteTest
// ---------------------------------------------------------------------------
test('probeCell returns na-without-substitute for structural-NA cell lacking substituteTest', () => {
  const feature = makeFeature({
    id: 'na-no-sub',
    ssotFiles: ['scripts/global/__nonexistent__.js'],
    perRuntime: { 'claude-code': { status: 'structural-NA' } },
  });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.strictEqual(result.verdict, VERDICT.NA_WITHOUT_SUBSTITUTE);
  assert.strictEqual(result.declared, 'structural-NA');
});

// ---------------------------------------------------------------------------
// probeCell: na-without-substitute also for waived cell missing substituteTest
// ---------------------------------------------------------------------------
test('probeCell returns na-without-substitute for waived cell missing substituteTest', () => {
  const feature = makeFeature({
    id: 'waived-no-sub',
    ssotFiles: ['scripts/global/detect-runtime.js'],
    perRuntime: { 'claude-code': { status: 'waived' } },
  });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.strictEqual(result.verdict, VERDICT.NA_WITHOUT_SUBSTITUTE);
});

// ---------------------------------------------------------------------------
// probeCell: ok-na when structural-NA has a valid substituteTest and ssotFile exists
// ---------------------------------------------------------------------------
test('probeCell returns ok-na for structural-NA with substituteTest and wired ssotFile', () => {
  const feature = makeFeature({
    id: 'na-with-sub',
    ssotFiles: ['scripts/global/detect-runtime.js'],
    perRuntime: { 'claude-code': { status: 'structural-NA', substituteTest: 'tests/harness-parity-matrix.spec.js' } },
  });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.strictEqual(result.verdict, VERDICT.OK_NA);
});

// ---------------------------------------------------------------------------
// probeCell: absent declared status is always ok (not a failure)
// ---------------------------------------------------------------------------
test('probeCell returns ok for absent declared status (known gap, not a wiring claim)', () => {
  const feature = makeFeature({
    id: 'known-absent',
    ssotFiles: ['scripts/global/__nonexistent__.js'],
    perRuntime: { 'claude-code': { status: 'absent' } },
  });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.strictEqual(result.verdict, VERDICT.OK);
});

// ---------------------------------------------------------------------------
// buildMatrix: only covers parity:yes features
// ---------------------------------------------------------------------------
test('buildMatrix only covers parity:yes features (skips parity:no and runtime-NA)', () => {
  const features = [
    makeFeature({ id: 'yes-feat', parity: 'yes', ssotFiles: ['scripts/global/detect-runtime.js'] }),
    { id: 'no-feat', name: 'No', layer: 'L1-identity-signing', parity: 'no', ssotFiles: ['scripts/global/detect-runtime.js'] },
    { id: 'rna-feat', name: 'RNA', layer: 'L1-identity-signing', parity: 'runtime-NA',
      ssotFiles: ['scripts/global/detect-runtime.js'],
      perRuntime: { 'claude-code': { status: 'unverified' } } },
  ];
  const catalog = makeCatalog(features, ['claude-code']);
  const { cells } = buildMatrix(catalog, { repoRoot: REPO_ROOT });
  // Only yes-feat should be probed: 1 feature × 1 runtime = 1 cell
  assert.strictEqual(cells.length, 1);
  assert.strictEqual(cells[0].featureId, 'yes-feat');
});

// ---------------------------------------------------------------------------
// buildMatrix: over real catalog — report findings
// ---------------------------------------------------------------------------
test('buildMatrix over real catalog: report failure count (real parity findings)', () => {
  const { catalog } = loadRepoInventory();
  const { cells, failures, summary } = buildMatrix(catalog, { repoRoot: REPO_ROOT });

  // Must probe something (117 parity:yes features × 5 runtimes = 585 cells)
  assert.ok(cells.length > 0, 'Expected at least one cell to be probed');
  assert.ok(summary.totalCells >= 500, `Expected >=500 cells, got ${summary.totalCells}`);

  // Log the real findings for observability (not a blocking assertion)
  process.stdout.write(`\n[real-catalog] cells=${summary.totalCells} failures=${summary.failureCount}\n`);
  process.stdout.write(`[real-catalog] verdicts=${JSON.stringify(summary.verdictCounts)}\n`);

  if (failures.length > 0) {
    const byVerdict = {};
    for (const fail of failures) {
      byVerdict[fail.verdict] = (byVerdict[fail.verdict] || []);
      byVerdict[fail.verdict].push(fail.featureId);
    }
    process.stdout.write('[real-catalog] failures by verdict:\n');
    for (const [verdict, featureIds] of Object.entries(byVerdict)) {
      process.stdout.write(`  ${verdict}: ${featureIds.length} features\n`);
      // Print first 5 per verdict
      for (const fid of featureIds.slice(0, 5)) {
        process.stdout.write(`    - ${fid}\n`);
      }
      if (featureIds.length > 5) {
        process.stdout.write(`    ... and ${featureIds.length - 5} more\n`);
      }
    }
  }

  // Gate: no na-without-substitute failures (these are spec violations)
  const naWithoutSub = failures.filter(f => f.verdict === VERDICT.NA_WITHOUT_SUBSTITUTE);
  assert.strictEqual(
    naWithoutSub.length, 0,
    `Found ${naWithoutSub.length} na-without-substitute cell(s) — structural-NA/waived cells require substituteTest`
  );

  // declared-full-but-missing is advisory only (not a blocking test assertion)
  // The count is reported above as a real parity finding
  assert.ok(typeof summary.failureCount === 'number', 'failureCount must be numeric');
});

// ---------------------------------------------------------------------------
// buildMatrix: failures array contains only the two FAIL verdicts
// ---------------------------------------------------------------------------
test('buildMatrix failures array contains only declared-full-but-missing and na-without-substitute', () => {
  const features = [
    makeFeature({
      id: 'missing-feat',
      ssotFiles: ['__nonexistent_probe_test_x__.js'],
      perRuntime: { 'claude-code': { status: 'unverified' } },
    }),
    makeFeature({
      id: 'ok-feat',
      ssotFiles: ['scripts/global/detect-runtime.js'],
      perRuntime: { 'claude-code': { status: 'unverified' } },
    }),
  ];
  const catalog = makeCatalog(features, ['claude-code']);
  const { failures } = buildMatrix(catalog, { repoRoot: REPO_ROOT });
  assert.strictEqual(failures.length, 1);
  assert.strictEqual(failures[0].featureId, 'missing-feat');
  assert.strictEqual(failures[0].verdict, VERDICT.DECLARED_FULL_BUT_MISSING);
});

// ---------------------------------------------------------------------------
// probeCell: result always has required fields
// ---------------------------------------------------------------------------
test('probeCell result always has featureId, runtime, declared, probed, verdict', () => {
  const feature = makeFeature({ id: 'field-check' });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.ok(typeof result.featureId === 'string', 'missing featureId');
  assert.ok(typeof result.runtime === 'string', 'missing runtime');
  assert.ok(typeof result.declared === 'string', 'missing declared');
  assert.ok(typeof result.probed === 'string', 'missing probed');
  assert.ok(typeof result.verdict === 'string', 'missing verdict');
  assert.ok(Object.values(VERDICT).includes(result.verdict), `unknown verdict: ${result.verdict}`);
});

// ---------------------------------------------------------------------------
// resolveSsotFile: bare filename found under a source root → not null
// ---------------------------------------------------------------------------
test('resolveSsotFile resolves bare filename under scripts/global source root', () => {
  // detect-runtime.js exists at scripts/global/detect-runtime.js
  // When passed as bare name it should be found via the SOURCE_ROOT search
  const resolved = resolveSsotFile('detect-runtime.js', REPO_ROOT);
  assert.ok(resolved !== null, 'Expected bare filename to resolve via source roots');
  assert.ok(resolved.includes('detect-runtime.js'), `Resolved path should contain filename: ${resolved}`);
});

test('resolveSsotFile resolves qualified path directly', () => {
  const resolved = resolveSsotFile('scripts/global/detect-runtime.js', REPO_ROOT);
  assert.ok(resolved !== null, 'Expected qualified path to resolve directly');
});

test('resolveSsotFile returns null for truly nonexistent file', () => {
  const resolved = resolveSsotFile('__totally_nonexistent_xyz_abc__.js', REPO_ROOT);
  assert.strictEqual(resolved, null, 'Expected null for nonexistent file');
});

test('resolveSsotFile returns null for HOME-relative path (not probeable on disk)', () => {
  const resolved = resolveSsotFile('~/.megingjord/goal-tier-state.json', REPO_ROOT);
  assert.strictEqual(resolved, null, 'Expected null for HOME-relative path');
});

test('resolveSsotFile returns null for glob pattern (not probeable on disk)', () => {
  const resolved = resolveSsotFile('skills/*/SKILL.md', REPO_ROOT);
  assert.strictEqual(resolved, null, 'Expected null for glob pattern');
});

// ---------------------------------------------------------------------------
// probeCell: bare-filename ssotFile under source root probes ok, not missing
// ---------------------------------------------------------------------------
test('probeCell ok for bare-filename ssotFile that exists under a source root', () => {
  const feature = makeFeature({
    id: 'bare-name-resolution',
    // Pass bare filename — should be found at scripts/global/detect-runtime.js
    ssotFiles: ['detect-runtime.js'],
    perRuntime: { 'claude-code': { status: 'unverified' } },
  });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.strictEqual(result.verdict, VERDICT.OK,
    `Expected ok for bare-filename resolution, got ${result.verdict}`);
  assert.strictEqual(result.probed, 'present');
});

test('probeCell declared-full-but-missing for truly nonexistent ssotFile', () => {
  const feature = makeFeature({
    id: 'truly-missing',
    ssotFiles: ['__totally_nonexistent_xyz_abc__.js'],
    perRuntime: { 'claude-code': { status: 'unverified' } },
  });
  const result = probeCell(feature, 'claude-code', REPO_ROOT);
  assert.strictEqual(result.verdict, VERDICT.DECLARED_FULL_BUT_MISSING,
    `Expected declared-full-but-missing, got ${result.verdict}`);
});
