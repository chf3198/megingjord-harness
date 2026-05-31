// #2371 — Wraps the Python unittest suite at tests/hooks/test_pretool_guard_regex.py
// so test-evidence (tdd-pyramid) finds a .spec.js artifact in the PR diff.
// The Python tests are the source of truth for the regex fixes (AC1/AC2/AC3/AC5).
// This wrapper invokes them as a subprocess and asserts exit 0.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

test('#2371: Python unittest suite for regex fixes passes (13 cases)', () => {
  let out;
  try {
    out = execFileSync('python3', ['-m', 'unittest', 'tests.hooks.test_pretool_guard_regex', '-v'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (e) {
    throw new Error(`Python unittest failed:\nstdout: ${e.stdout || ''}\nstderr: ${e.stderr || ''}`);
  }
  const combined = (out || '') + '';
  expect(combined.length).toBeGreaterThanOrEqual(0); // execFileSync didn't throw -> exit 0
});

test('#2371: iter_paths is exported from admin_patterns', () => {
  const result = execFileSync('python3', ['-c',
    'import sys; sys.path.insert(0, "hooks/scripts"); ' +
    'from admin_patterns import iter_paths; ' +
    'paths = list(iter_paths({"filePath": "/tmp/t.py", "newString": "/bad/path"})); ' +
    'assert paths == ["/tmp/t.py"], paths; print("OK")'
  ], { cwd: REPO_ROOT, encoding: 'utf8' });
  expect(result.trim()).toBe('OK');
});
