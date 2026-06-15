// #2971 — JS wrapper for Python hook gate tests (node:test runtime).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('planning-consensus Python gate suites pass', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3', [
      '-m', 'unittest',
      'tests.hooks.test_planning_consensus',
      'tests.hooks.test_pretool_guard_planning_consensus',
    ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`Python unittest suite failed:\n${e.stdout || ''}\n${e.stderr || ''}`);
  }
  assert.equal(typeof out, 'string');
});
