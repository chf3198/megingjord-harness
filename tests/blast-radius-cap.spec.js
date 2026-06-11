// #2917 - JS shim for test-evidence; authoritative logic tests are in Python.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

test('#2917: Python unittest suite for blast-radius cap passes', () => {
  let stdout = '';
  try {
    stdout = execFileSync('python3', [
      '-m', 'unittest', 'tests.hooks.test_blast_radius_cap', '-v',
    ], { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    throw new Error(
      `Python unittest failed:\nstdout: ${e.stdout || ''}\nstderr: ${e.stderr || ''}`,
    );
  }
  expect(stdout.length).toBeGreaterThanOrEqual(0);
});
