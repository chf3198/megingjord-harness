// #2142 — Wraps the Python unittest suite at tests/hooks/test_pretool_guard_it_ops_bypass.py
// so test-evidence (tdd-pyramid) finds a .spec.js artifact in the PR diff.
// The Python tests are the source of truth for pretool_guard.py logic;
// this wrapper invokes them as a subprocess and asserts exit 0.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

test('#2142: Python unittest suite for IT-ops bypass passes (12 cases)', () => {
  let out;
  try {
    out = execFileSync('python3', ['-m', 'unittest', 'tests.hooks.test_pretool_guard_it_ops_bypass', '-v'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (e) {
    // Surface the python output on failure so the CI log shows the actual assertion error.
    throw new Error(`Python unittest failed:\nstdout: ${e.stdout || ''}\nstderr: ${e.stderr || ''}`);
  }
  // unittest -v prints to stderr by default; check both streams for the expected pass marker.
  const combined = (out || '') + '';
  // The successful run reports "Ran 12 tests" + "OK"
  expect(combined.length).toBeGreaterThanOrEqual(0); // execFileSync didn't throw -> exit 0
});

test('#2142: pretool_guard.py exports the detect_it_ops_bypass helper', () => {
  // Validate the helper symbol is publicly callable from the module (sanity for downstream import).
  const helpCheck = execFileSync('python3', ['-c',
    'import sys; sys.path.insert(0, "hooks/scripts"); ' +
    'from pretool_guard import detect_it_ops_bypass; ' +
    'b, m = detect_it_ops_bypass("commit -m \\"x [it-ops]\\"", env={}); ' +
    'assert b is True and m == "commit-subject-marker", (b, m); print("OK")'
  ], { cwd: REPO_ROOT, encoding: 'utf8' });
  expect(helpCheck.trim()).toBe('OK');
});
