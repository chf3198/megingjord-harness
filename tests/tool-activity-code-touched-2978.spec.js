// #2978 — Wraps the Python unittest suite at tests/hooks/test_tool_activity_code_touched.py
// (Epic #2647). The Python tests are the source of truth (code_touched set only on real
// mutations, not read-only tools); this JS wrapper makes the tdd-pyramid evidence discoverable
// to the test-evidence gate and runs the suite in `npm test` / CI.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

test('#2978: Python unittest suite for tool_activity code_touched passes', () => {
  let stdout = '';
  try {
    stdout = execFileSync('python3', [
      '-m', 'unittest', 'tests.hooks.test_tool_activity_code_touched', '-v',
    ], { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    throw new Error(
      `Python unittest failed:\nstdout: ${e.stdout || ''}\nstderr: ${e.stderr || ''}`,
    );
  }
  expect(stdout.length).toBeGreaterThanOrEqual(0);
});
