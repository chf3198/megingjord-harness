// #2770 - JS harness running the Python parity-shim unittest suite under the CI runner.
// The implementation under test is hooks/scripts/load_local_env.py; assertions live in unittest.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('load_local_env.py parity-shim Python suite passes (#2770)', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3', ['-m', 'unittest', 'tests.hooks.test_load_local_env'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`Python unittest suite failed:\n${err.stdout || ''}\n${err.stderr || ''}`);
  }
  expect(typeof out).toBe('string');
});
