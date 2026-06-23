// #2913 — Session behavioral anomaly detection (Gap G-15 / ASI05 / EU-AI-Act-Art14)
// JS shim for test-evidence gate; authoritative logic tests are in Python.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

test('#2913: Python unittest suite for session anomaly detection passes', () => {
  let stdout = '';
  try {
    stdout = execFileSync('python3', [
      '-m', 'unittest', 'tests.hooks.test_session_anomaly_detection', '-v',
    ], { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    throw new Error(
      `Python unittest failed:\nstdout: ${e.stdout || ''}\nstderr: ${e.stderr || ''}`,
    );
  }
  expect(stdout.length).toBeGreaterThanOrEqual(0);
});
