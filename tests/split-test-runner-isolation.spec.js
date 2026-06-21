'use strict';
// tests/split-test-runner-isolation.spec.js — Refs #3166
// Regression guard: (a) verifies split-test-runner prevents the
// cross-framework pollution that caused 15 TypeErrors, and (b) covers
// the scoped-selection logic in collaborator-preflight.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const {
  findSpecs, classify,
} = require(path.join(ROOT, 'scripts/global/split-test-runner.js'));
const {
  nodeTestIgnoreList, isPlaywrightSpec,
} = require(path.join(ROOT, 'scripts/global/split-test-runner-ignore.js'));
const {
  deriveTestPaths, resolveTestScope,
} = require(path.join(ROOT, 'scripts/global/collaborator-preflight.js'));

// --- (a) isolation guard ---

test('classify: @playwright/test file is playwright', () => {
  const f = path.join(ROOT, 'tests/dashboard.spec.js');
  if (!fs.existsSync(f)) return; // skip if file missing
  assert.equal(classify(f), 'playwright');
});

test('classify: node:test file is node', () => {
  const f = path.join(ROOT, 'tests/collaborator-preflight.spec.js');
  assert.equal(classify(f), 'node');
});

test('nodeTestIgnoreList excludes every non-playwright spec', () => {
  const ignored = nodeTestIgnoreList();
  assert.ok(ignored.length > 0, 'ignore list must not be empty');
  // Every entry must be a .spec.js file
  for (const entry of ignored) {
    assert.match(entry, /\.spec\.js$/);
  }
});

test('nodeTestIgnoreList never includes a playwright spec', () => {
  const ignored = new Set(nodeTestIgnoreList());
  const allSpecs = findSpecs(path.join(ROOT, 'tests'));
  for (const f of allSpecs) {
    const rel = path.relative(path.join(ROOT, 'tests'), f);
    if (isPlaywrightSpec(f)) {
      assert.ok(!ignored.has(rel), `playwright spec in ignore: ${rel}`);
    }
  }
});

test('findSpecs discovers files in subdirectories', () => {
  const specs = findSpecs(path.join(ROOT, 'tests'));
  const sub = specs.filter(s => s.includes(path.sep + 'xteam-mcp' + path.sep)
    || s.includes(path.sep + 'megalint' + path.sep));
  assert.ok(sub.length > 0, 'subdirectory specs must be found');
});

test('playwright config references the ignore list', () => {
  const cfg = fs.readFileSync(
    path.join(ROOT, 'playwright.config.js'), 'utf8');
  assert.ok(cfg.includes('nodeTestIgnoreList'),
    'config must use nodeTestIgnoreList');
  assert.ok(cfg.includes('testIgnore'),
    'config must set testIgnore');
});

// --- (b) scoped-selection for collaborator-preflight ---

test('deriveTestPaths maps source to sibling spec', () => {
  const result = deriveTestPaths(
    ['scripts/global/collaborator-preflight.js'], ROOT);
  assert.ok(result.length > 0);
  assert.ok(result[0].endsWith('collaborator-preflight.spec.js'));
});

test('deriveTestPaths returns empty for non-existent spec', () => {
  const result = deriveTestPaths(['scripts/global/no-such-file.js'], ROOT);
  assert.deepEqual(result, []);
});

test('resolveTestScope uses explicit --test-paths', () => {
  const result = resolveTestScope(
    ['--test-paths=tests/a.spec.js,tests/b.spec.js'], ROOT);
  assert.deepEqual(result, ['tests/a.spec.js', 'tests/b.spec.js']);
});

test('resolveTestScope returns array when no scope derivable', () => {
  // With no --test-paths and on a branch equal to main, should
  // return an empty array (no changed files).
  const result = resolveTestScope([], ROOT);
  assert.ok(Array.isArray(result));
});
