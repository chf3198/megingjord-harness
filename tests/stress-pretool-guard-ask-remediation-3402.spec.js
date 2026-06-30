// stress-test spec for the #3402 ask-surface remediation (Epic #3392 AC2).
// Per the test matrix a stress spec MUST assert ≥1 chaos / fault-injection path (G6) AND ≥1 p99
// latency budget (G7). pretool_guard is a side-effect-bearing gate + adversarial-input parser that
// runs on every command, so both apply. The Python harness owns the assertions; this drives it.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('pretool_guard ask-remediation stress — G6 fault-injection + G7 p99 budget (#3402)', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3',
      ['tests/hooks/stress_pretool_guard_ask_remediation.py'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`Stress suite failed:\n${err.stdout || ''}\n${err.stderr || ''}`);
  }
  expect(out).toContain('PASS G6'); // chaos / fault-injection path
  expect(out).toContain('PASS G7'); // p99 latency budget
});
