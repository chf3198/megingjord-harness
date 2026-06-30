// #3403 (Epic #3392 AC2/AC5) — JS harness running the Python unit suite for the adjudicate-first
// S6/S7 classifiers. The implementation under test is the Python hook; assertions live in Python.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('pretool_guard adjudicate-first S6/S7 Python unit suite passes (#3403)', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3', ['-m', 'unittest',
      'tests.hooks.test_pretool_guard_adjudicate_first'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`Python unit suite failed:\n${err.stdout || ''}\n${err.stderr || ''}`);
  }
  expect(typeof out).toBe('string');
});
