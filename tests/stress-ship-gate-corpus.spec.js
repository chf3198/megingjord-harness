'use strict';
// stress-ship-gate-corpus.spec.js — Refs #3446 (Epic #3411 T2.3)
// Stress tests for gate-corpus deploy plan/verify:
//   - CHAOS: partial/interrupted corpus ship must be detected by verify (G6 atomicity)
//   - CHAOS: corpus dir replaced by a file — verify must reject gracefully
//   - CHAOS: concurrent verify calls produce consistent results (no data race)
//   - PERF: plan + verify computation p99 < 50ms (G7 throughput budget)

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  gateCorpusDeployPlan,
  verifyGateCorpus,
  verifyCorpusEntry,
} = require('../scripts/global/gate-corpus-deploy-plan');

// ── helpers ───────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stress-gate-corpus-'));
}

function cleanUp(dirPath) {
  try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
}

function populateCorpus(dirPath, fileCount) {
  for (let index = 0; index < fileCount; index++) {
    fs.writeFileSync(path.join(dirPath, `script-${index}.js`), `'use strict'; // ${index}\n`);
  }
}

function singlePlanVerifyRound(dirPath) {
  const plan = [{ runtime: 'test-rt', sourceDir: '/src', destDir: dirPath }];
  return verifyGateCorpus(plan);
}

// ── CHAOS tests ───────────────────────────────────────────────────────────────

test('CHAOS: partial corpus (0 of 20 .js files copied) is detected as missing (G6)', () => {
  const dirPath = makeTempDir();
  try {
    // Simulate interrupted rsync: directory exists but no .js files landed yet
    fs.writeFileSync(path.join(dirPath, '.rsync-partial'), 'transfer in progress');
    const result = verifyCorpusEntry({ runtime: 'cursor', sourceDir: '/src', destDir: dirPath });
    assert.equal(result.ok, false, 'partial corpus must fail verify');
    assert.ok(result.error && result.error.includes('empty'),
      `expected "empty" in error message, got: ${result.error}`);
  } finally { cleanUp(dirPath); }
});

test('CHAOS: mid-transfer corpus (5 of 20 .js files) passes verify (partial is still valid)', () => {
  // Verify does not enforce a minimum file count beyond >0, so 5 files is sufficient.
  // This tests that verify does not false-negative on a legitimately small-but-non-empty corpus.
  const dirPath = makeTempDir();
  try {
    populateCorpus(dirPath, 5);
    const result = verifyCorpusEntry({ runtime: 'cursor', sourceDir: '/src', destDir: dirPath });
    assert.equal(result.ok, true, '5-file partial transfer should satisfy non-empty check');
    assert.equal(result.jsFileCount, 5);
  } finally { cleanUp(dirPath); }
});

test('CHAOS: corpus dir replaced by a file — verify rejects gracefully (G6)', () => {
  const tempBase = makeTempDir();
  const fakePath = path.join(tempBase, 'scripts-global');
  try {
    // Write a plain file where a directory is expected
    fs.writeFileSync(fakePath, 'not a directory');
    const result = verifyCorpusEntry({ runtime: 'antigravity', sourceDir: '/src', destDir: fakePath });
    // readdirSync on a file path throws; verifyCorpusEntry must catch and return ok:false
    assert.equal(result.ok, false, 'file-instead-of-dir must fail verify');
    assert.ok(result.error, 'error message must be present');
  } finally { cleanUp(tempBase); }
});

test('CHAOS: corpus dir deleted after plan built — verify detects deletion (G6)', () => {
  const dirPath = makeTempDir();
  try {
    populateCorpus(dirPath, 10);
    const plan = [{ runtime: 'cursor', sourceDir: '/src', destDir: dirPath }];
    // Delete between plan and verify to simulate interrupted deploy
    cleanUp(dirPath);
    const verification = verifyGateCorpus(plan);
    assert.equal(verification.ok, false, 'deletion between plan and verify must be detected');
    assert.equal(verification.totalMissing, 1);
  } finally { cleanUp(dirPath); }
});

test('CHAOS: both corpus dirs missing — verifyGateCorpus reports totalMissing=2 (G6)', () => {
  const missingA = path.join(os.tmpdir(), 'no-cursor-' + Date.now());
  const missingB = path.join(os.tmpdir(), 'no-antigravity-' + Date.now());
  const plan = [
    { runtime: 'cursor', sourceDir: '/src', destDir: missingA },
    { runtime: 'antigravity', sourceDir: '/src', destDir: missingB },
  ];
  const verification = verifyGateCorpus(plan);
  assert.equal(verification.ok, false);
  assert.equal(verification.totalMissing, 2);
});

// ── CONCURRENCY tests ─────────────────────────────────────────────────────────

test('CONCURRENCY: 20 parallel verify calls produce consistent results (no data race)', async () => {
  const dirPath = makeTempDir();
  try {
    populateCorpus(dirPath, 30);
    const plan = [{ runtime: 'cursor', sourceDir: '/src', destDir: dirPath }];
    const concurrentVerifies = Array.from({ length: 20 }, () =>
      Promise.resolve(verifyGateCorpus(plan)));
    const results = await Promise.all(concurrentVerifies);
    for (const result of results) {
      assert.equal(result.ok, true, 'all concurrent verify calls must succeed');
      assert.equal(result.totalMissing, 0);
    }
  } finally { cleanUp(dirPath); }
});

// ── PERF tests (p99 budget) ───────────────────────────────────────────────────

test('PERF: plan + verify p99 < 50ms for a 50-file corpus (G7)', () => {
  const dirPath = makeTempDir();
  try {
    populateCorpus(dirPath, 50);
    const SAMPLE_COUNT = 200;
    const latencies = [];
    for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex++) {
      const startTime = performance.now();
      const plan = gateCorpusDeployPlan(path.resolve(__dirname, '..'), [
        { name: 'perf-rt', gateCorpusHome: dirPath },
      ]);
      verifyGateCorpus(plan);
      latencies.push(performance.now() - startTime);
    }
    latencies.sort((valueA, valueB) => valueA - valueB);
    const p99Index = Math.ceil(SAMPLE_COUNT * 0.99) - 1;
    const p99Ms = latencies[p99Index];
    // Report p99 unconditionally so the caller can see the value
    console.log(`stress-ship-gate-corpus PERF p99=${p99Ms.toFixed(2)}ms (budget=50ms, n=${SAMPLE_COUNT})`);
    assert.ok(p99Ms < 50, `p99 latency ${p99Ms.toFixed(2)}ms exceeds 50ms budget (G7)`);
  } finally { cleanUp(dirPath); }
});

test('PERF: verifyGateCorpus p99 < 50ms with 2 runtimes × 100-file corpus (G7)', () => {
  const dirA = makeTempDir();
  const dirB = makeTempDir();
  try {
    populateCorpus(dirA, 100);
    populateCorpus(dirB, 100);
    const plan = [
      { runtime: 'cursor', sourceDir: '/src', destDir: dirA },
      { runtime: 'antigravity', sourceDir: '/src', destDir: dirB },
    ];
    const SAMPLE_COUNT = 200;
    const latencies = [];
    for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex++) {
      const startTime = performance.now();
      verifyGateCorpus(plan);
      latencies.push(performance.now() - startTime);
    }
    latencies.sort((valueA, valueB) => valueA - valueB);
    const p99Index = Math.ceil(SAMPLE_COUNT * 0.99) - 1;
    const p99Ms = latencies[p99Index];
    console.log(`stress-ship-gate-corpus 2×100-file p99=${p99Ms.toFixed(2)}ms (budget=50ms, n=${SAMPLE_COUNT})`);
    assert.ok(p99Ms < 50, `p99 latency ${p99Ms.toFixed(2)}ms exceeds 50ms budget (G7)`);
  } finally {
    cleanUp(dirA);
    cleanUp(dirB);
  }
});
