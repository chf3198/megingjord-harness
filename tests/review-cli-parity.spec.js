'use strict';
// golden-file spec for scripts/global/review-cli-parity.js (#2935 / Epic #2926 C9).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../scripts/global/review-cli-parity');

const GOLDEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'review-cli-manifest.golden.json'), 'utf8'));
const SOURCE_DIR = path.join(__dirname, '..', 'scripts', 'global');

test('AC1: manifest matches the golden fixture (one shared CLI surface)', () => {
  assert.deepStrictEqual(P.reviewCliManifest(), GOLDEN);
});

test('AC2: all 6 review modules exist in the single canonical scripts/global source', () => {
  const r = P.verifyCanonicalSource(SOURCE_DIR);
  assert.strictEqual(r.ok, true, `missing: ${r.missing.join(', ')}`);
  assert.strictEqual(r.total, 6);
});

test('AC2: a missing module is reported (no forked/partial source)', () => {
  const r = P.verifyCanonicalSource('/nonexistent', { exists: () => false });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.missing.length, 6);
});

// In-memory fs doubles for AC3 (golden-file: deterministic synthetic dirs).
function fakeFs(files) {
  return {
    exists: (p) => Object.prototype.hasOwnProperty.call(files, p),
    readFile: (p) => Buffer.from(files[p] || ''),
  };
}

test('AC3: identical deployed copies → parity true, coverage 1', () => {
  const files = {};
  for (const m of P.REVIEW_CLI_MODULES) {
    files[path.join('/src', m)] = `content-${m}`;
    files[path.join('/rt/copilot', m)] = `content-${m}`;
  }
  files['/rt/copilot'] = ''; // dir exists marker
  const r = P.verifyRuntimeParity(
    { sourceDir: '/src', targets: [{ runtime: 'copilot', scriptsDir: '/rt/copilot' }] }, fakeFs(files));
  assert.strictEqual(r.parity, true);
  assert.strictEqual(r.coverage, 1);
  assert.strictEqual(r.mismatches.length, 0);
});

test('AC3: a hash-mismatch and an absent module are both reported', () => {
  const files = { '/src': '', '/rt/codex': '' };
  for (const m of P.REVIEW_CLI_MODULES) files[path.join('/src', m)] = `content-${m}`;
  // codex has all but one module, and one is stale (different content).
  for (const m of P.REVIEW_CLI_MODULES.slice(0, 5)) files[path.join('/rt/codex', m)] = `content-${m}`;
  files[path.join('/rt/codex', P.REVIEW_CLI_MODULES[0])] = 'STALE'; // hash-mismatch
  const r = P.verifyRuntimeParity(
    { sourceDir: '/src', targets: [{ runtime: 'codex', scriptsDir: '/rt/codex' }] }, fakeFs(files));
  assert.strictEqual(r.parity, false);
  const reasons = r.mismatches.map((x) => x.reason).sort();
  assert.deepStrictEqual(reasons, ['absent', 'hash-mismatch']);
});

test('AC3: an absent runtime target is reported (tolerant, not a crash)', () => {
  const files = { '/src': '' };
  for (const m of P.REVIEW_CLI_MODULES) files[path.join('/src', m)] = `c-${m}`;
  const r = P.verifyRuntimeParity(
    { sourceDir: '/src', targets: [{ runtime: 'agents', scriptsDir: '/rt/agents' }] }, fakeFs(files));
  assert.deepStrictEqual(r.absentTargets, ['agents']);
  assert.strictEqual(r.checked, 0);
});
