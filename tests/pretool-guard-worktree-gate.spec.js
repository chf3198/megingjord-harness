// #2586/#2587 — JS harness that runs the Python unittest suite for the
// worktree-ticket active-ticket gate. The implementation under test is a
// Python hook (pretool_guard.py + worktree_ticket.py), so the real assertions
// live in pytest/unittest; this spec satisfies the JS-centric test-evidence
// gate while executing the actual Python coverage in CI.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('pretool_guard worktree-ticket Python suite passes (4-runtime parity + stress)', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3', [
      '-m', 'unittest',
      'tests.hooks.test_pretool_guard_worktree_ticket',
      'tests.hooks.test_pretool_guard_antigravity',
    ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`Python unittest suite failed:\n${e.stdout || ''}\n${e.stderr || ''}`);
  }
  // execFileSync throws on non-zero exit, so reaching here means the suite passed.
  expect(typeof out).toBe('string');
});
