// #2596 — JS harness that runs the Python unittest for ci_gate_status's
// exit-code fallback. The implementation under test is a Python hook helper
// (live_checks.py), so the real assertions live in unittest; this spec
// satisfies the JS-centric test-evidence gate while executing the Python
// coverage in CI.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('live_checks ci_gate_status fallback Python suite passes (#2596)', () => {
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
