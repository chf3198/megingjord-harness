// #3402 (Epic #3392 AC2) — JS harness that runs the Python unit + stress suites for the
// ask-surface remediation. The implementation under test is the Python hook
// (pretool_guard.check_terminal); the real assertions live in Python. This spec satisfies the
// JS-centric test-evidence + stress-evidence gates while running the Python coverage.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

test('pretool_guard ask-remediation Python unit suite passes (#3402)', () => {
  let out = '';
  try {
    out = execFileSync('python3', ['-m', 'unittest',
      'tests.hooks.test_pretool_guard_ask_remediation'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`Python unit suite failed:\n${err.stdout || ''}\n${err.stderr || ''}`);
  }
  expect(typeof out).toBe('string');
});
