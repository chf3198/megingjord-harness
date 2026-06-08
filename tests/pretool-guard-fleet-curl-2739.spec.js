// #2739 - JS harness that runs the Python unittest suite for the raw-fleet-curl
// bypass intercept guard. The implementation under test is a Python hook
// (pretool_guard.is_raw_fleet_curl); the real assertions live in unittest.
// This spec satisfies the JS-centric test-evidence gate while running Python coverage.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('pretool_guard raw-fleet-curl intercept Python suite passes (#2739)', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3', ['-m', 'unittest',
      'tests.hooks.test_pretool_guard_fleet_curl'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`Python unittest suite failed:\n${err.stdout || ''}\n${err.stderr || ''}`);
  }
  expect(typeof out).toBe('string');
});
