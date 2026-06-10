// #2876 — JS harness that runs the Python unittest suite for the
// MANAGER_HANDOFF first-edit ordering gate. The implementation under test is
// Python (live_checks.py + pretool_guard.py), so the real assertions live in
// Python unittest; this spec satisfies the JS-centric test-evidence gate while
// executing the actual Python coverage in CI.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('linked_issue_has_manager_handoff Python suite passes (unit + integration)', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3', [
      '-m', 'unittest',
      'tests.hooks.test_live_checks_manager_handoff',
    ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`Python unittest suite failed:\n${e.stdout || ''}\n${e.stderr || ''}`);
  }
  // execFileSync throws on non-zero exit, so reaching here means the suite passed.
  expect(typeof out).toBe('string');
});
