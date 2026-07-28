'use strict';
// #3729 (Option B, client-ratified): the mirror automation must push to the non-protected wiki-mirror
// branch, NOT directly to main (main's baton-authority-merge-gate ruleset GH013-rejects skip-ci pushes).
// Golden-file: the barrier cannot silently return. test_strategy: golden-file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const WF = path.join(__dirname, '..', '.github/workflows');
const RECON = fs.readFileSync(path.join(WF, 'wiki-reconcile-cron.yml'), 'utf8');
const MIRROR = fs.readFileSync(path.join(WF, 'wiki-work-log-mirror.yml'), 'utf8');

for (const [name, yml] of [['reconcile-cron', RECON], ['work-log-mirror', MIRROR]]) {
  test(`${name} pushes to the wiki-mirror branch (not main)`, () => {
    assert.match(yml, /HEAD:refs\/heads\/wiki-mirror/, 'must target wiki-mirror');
    // no bare push (an implicit push to the checked-out default branch = main)
    assert.ok(!/^\s*git push\s*(--no-verify\s*)?$/m.test(yml), 'no bare implicit-main push');
  });
  test(`${name} bypasses developer lefthook on the bot commit/push (subsumes #3723)`, () => {
    assert.match(yml, /commit --no-verify/, 'bot commit must skip verify');
    assert.match(yml, /push --no-verify/, 'bot push must skip verify');
  });
}
