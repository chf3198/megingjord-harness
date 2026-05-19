'use strict';

const assert = require('node:assert/strict');
const { run, WIKI_PATHS, SEARCH_SCRIPTS, REQUIRED_SUBDIRS } = require('../scripts/global/wiki-parity-check');

const test = (label, fn) => {
  try { fn(); console.log(`  PASS: ${label}`); }
  catch (e) { console.error(`  FAIL: ${label}\n       ${e.message}`); process.exitCode = 1; }
};

console.log('\n wiki-parity-check');

test('run() returns structured result', () => {
  const result = run();
  assert.ok(typeof result === 'object', 'result is object');
  assert.ok(typeof result.ok === 'boolean', 'ok is boolean');
  assert.equal(result.surface, 'wiki_docs_memory');
  assert.ok(Array.isArray(result.findings), 'findings is array');
  assert.ok(typeof result.checkedAt === 'string', 'checkedAt is string');
  assert.ok(typeof result.wikiPaths === 'object', 'wikiPaths present');
});

test('WIKI_PATHS exports paths for all 3 runtimes', () => {
  for (const rt of ['copilot', 'codex', 'claude-code']) {
    assert.ok(rt in WIKI_PATHS, `WIKI_PATHS has ${rt}`);
    assert.ok(typeof WIKI_PATHS[rt] === 'string', `${rt} path is string`);
  }
});

test('SEARCH_SCRIPTS exports null for claude-code', () => {
  assert.equal(SEARCH_SCRIPTS['claude-code'], null);
  assert.ok(typeof SEARCH_SCRIPTS.copilot === 'string');
  assert.ok(typeof SEARCH_SCRIPTS.codex === 'string');
});

test('REQUIRED_SUBDIRS is non-empty array of strings', () => {
  assert.ok(Array.isArray(REQUIRED_SUBDIRS) && REQUIRED_SUBDIRS.length > 0);
  for (const s of REQUIRED_SUBDIRS) assert.ok(typeof s === 'string');
});

test('each finding has required schema fields', () => {
  const result = run();
  for (const f of result.findings) {
    assert.ok(f.id, 'finding has id');
    assert.ok(f.severity, 'finding has severity');
    assert.ok(f.summary, 'finding has summary');
    assert.ok(f.evidence, 'finding has evidence');
    assert.ok(f.recommendation, 'finding has recommendation');
  }
});

test('deployed environment has no wiki parity gaps', () => {
  if (process.env.CI) {
    console.log('    skip: CI environment has no deployed wiki runtime');
    return;
  }
  const result = run();
  const ids = result.findings.map(f => f.id);
  if (ids.length) console.log(`    advisory: ${ids.join(', ')}`);
  assert.ok(result.ok, `Expected parity — gaps found: ${ids.join(', ')}`);
});
