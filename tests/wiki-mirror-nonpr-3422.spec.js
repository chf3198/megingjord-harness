'use strict';
// Regression coverage for #3422 (Epic #3398 C4): the Wiki-B ticket-mirror must
// refresh on NON-PR state changes (closed/labeled/reopened/gh-api). The mirror
// mechanism shipped in Epic #3063/#3066 but its bot commit ran the dev git hooks
// (validate-branch-name + the lefthook lint-router), and the runner's missing
// `ruff` (lint-py) failed the commit — so the mirror silently went stale (the
// #1899 casualty). This asserts the commit AND push bypass those hooks, that the
// non-PR triggers are wired, and that the #1899 backfill reflects terminal state.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github/workflows/wiki-work-log-mirror.yml'), 'utf8');

test('mirror workflow fires on the non-PR issue state-change events', () => {
  const onBlock = WORKFLOW.slice(WORKFLOW.indexOf('on:'), WORKFLOW.indexOf('permissions:'));
  for (const evt of ['closed', 'labeled', 'reopened']) {
    assert.ok(new RegExp(`\\b${evt}\\b`).test(onBlock), `workflow must trigger on issues:${evt}`);
  }
});

test('the bot commit bypasses git hooks (--no-verify) so missing ruff cannot break the mirror', () => {
  // The failing class: `git commit` → lefthook/pre-commit → lint-py → `ruff: not found` → exit 1.
  assert.match(WORKFLOW, /git commit\s+--no-verify/, 'commit must use --no-verify');
});

test('the bot push bypasses the pre-push lint-router (--no-verify)', () => {
  assert.match(WORKFLOW, /git push\s+--no-verify/, 'push must use --no-verify');
  // Guard against a plain `git push` line silently reappearing without the flag.
  const pushLines = WORKFLOW.split('\n').filter((l) => /^\s*git push\b/.test(l));
  assert.ok(pushLines.length > 0 && pushLines.every((l) => /--no-verify/.test(l)), 'every git push must carry --no-verify');
});

test('#1899 mirror backfill reflects the live terminal state (not the stale OPEN/backlog)', () => {
  const mirror = fs.readFileSync(path.join(ROOT, 'wiki/work-log/tickets/1899.md'), 'utf8');
  assert.match(mirror, /state:\s*CLOSED/i, '#1899 mirror must show CLOSED');
  assert.match(mirror, /status:cancelled/i, '#1899 mirror must carry status:cancelled');
  assert.ok(!/state:\s*OPEN/i.test(mirror.split('---')[2] || mirror), 'no residual OPEN state in the body source line');
});
