'use strict';
// #3763 (Epic #3719 P1-e): tests for the required frontmatter PR gate. tdd-pyramid.
// Unit: gateFiles() partition + pass/fail + nav-exclusion + no-op-empty (adversarial-ish inputs).
// Golden: the workflow always runs (no paths: filter) and is not continue-on-error, so it is safe
// to mark as a REQUIRED check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { gateFiles, isWikiPage } = require('../scripts/wiki/frontmatter-gate.js');

// Stub validator: valid unless the path contains 'BAD'. Keeps the unit test hermetic (no disk read).
const stub = (f) => ({ valid: !String(f).includes('BAD'), errors: String(f).includes('BAD') ? ['type is required'] : [] });

test('valid changed wiki page passes', () => {
  const r = gateFiles(['wiki/work-log/tickets/42.md'], { validate: stub });
  assert.equal(r.ok, true);
  assert.deepEqual(r.checked, ['wiki/work-log/tickets/42.md']);
  assert.equal(r.invalid.length, 0);
});

test('invalid changed wiki page fails with errors', () => {
  const r = gateFiles(['wiki/code/concepts/BAD.md'], { validate: stub });
  assert.equal(r.ok, false);
  assert.equal(r.invalid.length, 1);
  assert.match(r.invalid[0].errors[0], /type/);
});

test('navigational files are exempt (README/index/log/WIKI-*)', () => {
  const nav = ['wiki/README.md', 'wiki/index.md', 'wiki/log.md', 'wiki/WIKI-typology.md',
    'wiki/wisdom/global/README.md'];
  const r = gateFiles(nav, { validate: () => ({ valid: false, errors: ['should be skipped'] }) });
  assert.equal(r.ok, true);
  assert.equal(r.checked.length, 0);
  assert.equal(r.skipped.length, nav.length);
});

test('non-wiki paths are skipped, not validated', () => {
  const r = gateFiles(['scripts/foo.js', 'README.md', 'instructions/x.md'], { validate: stub });
  assert.equal(r.checked.length, 0);
  assert.equal(r.ok, true);
});

test('empty changed set no-ops green', () => {
  const r = gateFiles([], { validate: stub });
  assert.equal(r.ok, true);
  assert.equal(r.checked.length, 0);
});

test('isWikiPage: only wiki/**.md non-nav', () => {
  assert.equal(isWikiPage('wiki/wisdom/global/concepts/x.md'), true);
  assert.equal(isWikiPage('wiki/index.md'), false);
  assert.equal(isWikiPage('wiki/code/README.md'), false);
  assert.equal(isWikiPage('docs/howto/x.md'), false);
  assert.equal(isWikiPage('wiki/notes.txt'), false);
});

test('GOLDEN: workflow runs on all PRs (no paths filter) and is not advisory', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/wiki-frontmatter-gate.yml'), 'utf8');
  // pull_request trigger present with NO paths: filter (must stay a always-present required check).
  assert.match(yml, /on:\s*\n\s*pull_request:\s*\n(?!\s*paths)/);
  assert.ok(!/continue-on-error:\s*true/.test(yml), 'gate must not be advisory (no continue-on-error)');
  assert.match(yml, /frontmatter-gate\.js/);
});
