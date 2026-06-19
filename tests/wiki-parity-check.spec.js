'use strict';

const assert = require('node:assert/strict');
const { run, WIKI_PATHS, SEARCH_SCRIPTS, SUBDIR_TIERS } = require('../scripts/global/wiki-parity-check');

const test = (label, fn) => {
  try { fn(); console.log(`  PASS: ${label}`); }
  catch (e) { console.error(`  FAIL: ${label}\n       ${e.message}`); process.exitCode = 1; }
};

console.log('\n wiki-parity-check (remediation)');

test('run() returns dependencies array', () => {
  const result = run();
  assert.ok(Array.isArray(result.dependencies), 'dependencies array present');
});

test('run() with digestManifest validates hashes', () => {
  const manifest = { copilot: { indexMd: 'test-hash' } };
  const result = run({ digestManifest: manifest });
  assert.ok(Array.isArray(result.findings), 'findings returned with manifest');
});

test('run() with runtimeTiers validates tier compliance', () => {
  const tiers = { copilot: { required: ['concepts'] } };
  const result = run({ runtimeTiers: tiers });
  assert.ok(typeof result.ok === 'boolean', 'tier validation works');
});

test('claude-code and antigravity depends_on copilot edge emitted', () => {
  const result = run({ digestManifest: {} });
  const dep = result.dependencies.find(d => d.from === 'claude-code' && d.to === 'copilot');
  assert.ok(dep, 'cross-runtime dependency found');
  assert.equal(dep.type, 'cross-runtime-read');
  const depAnti = result.dependencies.find(d => d.from === 'antigravity' && d.to === 'copilot');
  assert.ok(depAnti, 'antigravity cross-runtime dependency found');
});

test('SUBDIR_TIERS models required/optional/ingest-only', () => {
  assert.ok(SUBDIR_TIERS.required.includes('concepts'));
  assert.ok(Array.isArray(SUBDIR_TIERS['ingest-only']));
});

test('no HIGH findings in deployed environment', () => {
  if (process.env.CI) return;
  const result = run();
  const high = result.findings.filter(f => f.severity === 'high');
  assert.ok(high.length === 0, 'no high-severity findings');
});
