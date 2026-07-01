'use strict';
// ship-gate-corpus.spec.js — unit tests for #3446 (Epic #3411 T2.3)
// Verifies the gate-corpus deploy plan for cursor + antigravity:
//   - plan includes the correct scripts/global → gateCorpusHome mapping
//   - verify step detects a missing corpus directory
//   - verify step detects an empty corpus directory (no .js files)
//   - verify step passes when corpus dir contains .js files

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  gateCorpusDeployPlan,
  verifyGateCorpus,
  verifyCorpusEntry,
  buildRuntimePlan,
  GATE_CORPUS_RUNTIMES,
} = require('../scripts/global/gate-corpus-deploy-plan');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gate-corpus-spec-'));
}

function cleanUp(dirPath) {
  try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
}

// ── PLAN tests ────────────────────────────────────────────────────────────────

test('plan: contains exactly two entries (cursor and antigravity)', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const plan = gateCorpusDeployPlan(repoRoot);
  assert.equal(plan.length, 2, 'expected two runtime entries in plan');
  const names = plan.map((entry) => entry.runtime).sort();
  assert.deepEqual(names, ['antigravity', 'cursor']);
});

test('plan: cursor entry sourceDir is scripts/global/', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const plan = gateCorpusDeployPlan(repoRoot);
  const cursorEntry = plan.find((entry) => entry.runtime === 'cursor');
  assert.ok(cursorEntry, 'cursor entry must exist in plan');
  assert.equal(cursorEntry.sourceDir, path.join(repoRoot, 'scripts', 'global'));
});

test('plan: antigravity entry sourceDir is scripts/global/', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const plan = gateCorpusDeployPlan(repoRoot);
  const agEntry = plan.find((entry) => entry.runtime === 'antigravity');
  assert.ok(agEntry, 'antigravity entry must exist in plan');
  assert.equal(agEntry.sourceDir, path.join(repoRoot, 'scripts', 'global'));
});

test('plan: cursor destDir matches descriptor gateCorpusHome', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const plan = gateCorpusDeployPlan(repoRoot);
  const cursorEntry = plan.find((entry) => entry.runtime === 'cursor');
  const expectedDest = path.join(os.homedir(), '.cursor', 'scripts', 'global');
  assert.equal(cursorEntry.destDir, expectedDest,
    'cursor destDir must match ~/.cursor/scripts/global from descriptor');
});

test('plan: antigravity destDir matches descriptor gateCorpusHome', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const plan = gateCorpusDeployPlan(repoRoot);
  const agEntry = plan.find((entry) => entry.runtime === 'antigravity');
  const expectedDest = path.join(os.homedir(), '.antigravity', 'scripts', 'global');
  assert.equal(agEntry.destDir, expectedDest,
    'antigravity destDir must match ~/.antigravity/scripts/global from descriptor');
});

test('plan: custom runtimes override default GATE_CORPUS_RUNTIMES', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const customRuntimes = [{ name: 'test-rt', gateCorpusHome: '/tmp/test-rt/scripts/global' }];
  const plan = gateCorpusDeployPlan(repoRoot, customRuntimes);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].runtime, 'test-rt');
  assert.equal(plan[0].destDir, '/tmp/test-rt/scripts/global');
});

test('buildRuntimePlan: produces expected shape', () => {
  const descriptor = { name: 'mock-rt', gateCorpusHome: '/mock/path' };
  const sourceDir = '/repo/scripts/global';
  const result = buildRuntimePlan(descriptor, sourceDir);
  assert.equal(result.runtime, 'mock-rt');
  assert.equal(result.sourceDir, sourceDir);
  assert.equal(result.destDir, '/mock/path');
});

test('GATE_CORPUS_RUNTIMES: exported constant contains cursor and antigravity', () => {
  const names = GATE_CORPUS_RUNTIMES.map((descriptor) => descriptor.name).sort();
  assert.deepEqual(names, ['antigravity', 'cursor']);
});

// ── VERIFY tests (use temp dirs — never touches ~/.cursor or ~/.antigravity) ──

test('verify: detects missing corpus directory', () => {
  const missingPath = path.join(os.tmpdir(), 'no-such-gate-corpus-dir-' + Date.now());
  const entry = { runtime: 'cursor', sourceDir: '/src', destDir: missingPath };
  const result = verifyCorpusEntry(entry);
  assert.equal(result.ok, false);
  assert.ok(result.error && result.error.includes('does not exist'), `expected "does not exist" in error, got: ${result.error}`);
  assert.equal(result.jsFileCount, 0);
});

test('verify: detects empty corpus directory (no .js files)', () => {
  const tempDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# corpus\n');
    const entry = { runtime: 'antigravity', sourceDir: '/src', destDir: tempDir };
    const result = verifyCorpusEntry(entry);
    assert.equal(result.ok, false);
    assert.ok(result.error && result.error.includes('empty'), `expected "empty" in error, got: ${result.error}`);
    assert.equal(result.jsFileCount, 0);
  } finally { cleanUp(tempDir); }
});

test('verify: passes when corpus directory contains .js files', () => {
  const tempDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(tempDir, 'hamr-sync-verify.js'), "'use strict';\n");
    fs.writeFileSync(path.join(tempDir, 'gate-corpus-deploy-plan.js'), "'use strict';\n");
    const entry = { runtime: 'cursor', sourceDir: '/src', destDir: tempDir };
    const result = verifyCorpusEntry(entry);
    assert.equal(result.ok, true);
    assert.equal(result.jsFileCount, 2);
    assert.equal(result.error, undefined);
  } finally { cleanUp(tempDir); }
});

test('verifyGateCorpus: ok false when any entry fails', () => {
  const goodDir = makeTempDir();
  const missingPath = path.join(os.tmpdir(), 'no-dir-' + Date.now());
  try {
    fs.writeFileSync(path.join(goodDir, 'foo.js'), "'use strict';\n");
    const plan = [
      { runtime: 'cursor', sourceDir: '/src', destDir: goodDir },
      { runtime: 'antigravity', sourceDir: '/src', destDir: missingPath },
    ];
    const verification = verifyGateCorpus(plan);
    assert.equal(verification.ok, false);
    assert.equal(verification.totalMissing, 1);
    assert.equal(verification.results.length, 2);
  } finally { cleanUp(goodDir); }
});

test('verifyGateCorpus: ok true when all entries pass', () => {
  const dirA = makeTempDir();
  const dirB = makeTempDir();
  try {
    fs.writeFileSync(path.join(dirA, 'alpha.js'), "'use strict';\n");
    fs.writeFileSync(path.join(dirB, 'beta.js'), "'use strict';\n");
    const plan = [
      { runtime: 'cursor', sourceDir: '/src', destDir: dirA },
      { runtime: 'antigravity', sourceDir: '/src', destDir: dirB },
    ];
    const verification = verifyGateCorpus(plan);
    assert.equal(verification.ok, true);
    assert.equal(verification.totalMissing, 0);
  } finally {
    cleanUp(dirA);
    cleanUp(dirB);
  }
});
