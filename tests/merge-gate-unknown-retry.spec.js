// #2603 — JS harness running the Python unittest for the merge-gate
// indeterminate-state retry (ci_gate_status_stable). Implementation is a Python
// hook helper; this spec satisfies the JS-centric test-evidence gate while
// executing the real unittest coverage in CI quality-gates.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('merge-gate unknown-retry Python suite passes (#2603)', () => {
  const root = path.resolve(__dirname, '..');
  try {
    execFileSync('python3', ['-m', 'unittest', 'tests.hooks.test_live_checks_wait_gate'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    throw new Error(`Python unittest failed:\n${e.stdout || ''}\n${e.stderr || ''}`);
  }
  expect(true).toBe(true);
});
