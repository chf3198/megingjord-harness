'use strict';
// tests/canonical-main-shell-write.spec.js — tdd-pyramid evidence bridge for #2995.
// The shell-write canonical-main guard lives in a Python hook (pretool_guard.py), so its
// real tests are pytest (tests/hooks/test_pretool_guard_shell_write_main.py). The
// test-evidence gate only recognizes tests/**/*.spec.{js,ts} for tdd-pyramid (known
// validator gap #2980), so this spec EXECUTES the Python suite and fails if it fails —
// genuine evidence, not a stub. Refs #2995, #2980.
// #3001: the executed Python suite now also covers the arrow-token over-block fix
// (test_arrow_minus/equals_not_a_redirect, test_fd_redirect_to_file_still_caught).
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

test('python shell-write canonical-main guard suite passes', () => {
  const result = spawnSync(
    'python3',
    ['-m', 'unittest', 'tests.hooks.test_pretool_guard_shell_write_main'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  // unittest writes its summary to stderr; surface it on failure for diagnosis.
  assert.strictEqual(result.status, 0,
    `pytest/unittest suite failed (exit ${result.status}):\n${result.stderr || result.stdout}`);
});
