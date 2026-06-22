'use strict';
// tests/one-ticket-per-worktree.spec.js — tdd-pyramid evidence bridge for #2967.
// The one-ticket-per-worktree guard is a Python hook (one_ticket_per_worktree.py +
// pretool_guard.py), so its real assertions live in pytest/unittest
// (tests/hooks/test_one_ticket_per_worktree.py). The test-evidence gate only
// recognizes tests/**/*.spec.{js,ts} for tdd-pyramid (known validator gap #2980/#3183),
// so this spec EXECUTES the Python suite and fails if it fails — genuine evidence,
// not a stub. Refs #2967, #2980.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

test('python one-ticket-per-worktree guard suite passes', () => {
  const result = spawnSync(
    'python3',
    ['-m', 'unittest', 'tests.hooks.test_one_ticket_per_worktree'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  // unittest writes its summary to stderr; surface it on failure for diagnosis.
  assert.strictEqual(result.status, 0,
    `python unittest suite failed (exit ${result.status}):\n${result.stderr || result.stdout}`);
});
