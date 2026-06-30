// stress-test spec for the #3403 adjudicate-first S6/S7 classifiers (Epic #3392 AC2/AC5).
// Per the matrix a stress spec MUST assert ≥1 chaos / fault-injection path (G6) AND ≥1 p99
// latency budget (G7). These classifiers are adversarial-input security gates in the hook hot
// path, so both apply. The Python harness owns the assertions; this drives it.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('pretool_guard adjudicate-first stress — G6 fault-injection + G7 p99 budget (#3403)', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3',
      ['tests/hooks/stress_pretool_guard_adjudicate_first.py'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`Stress suite failed:\n${err.stdout || ''}\n${err.stderr || ''}`);
  }
  expect(out).toContain('PASS G6'); // chaos / fault-injection, no silent G4 weakening
  expect(out).toContain('PASS G7'); // p99 latency budget
});
