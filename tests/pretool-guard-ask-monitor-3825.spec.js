// #3825 (Epic #3822 C1, Gap A) — JS harness for the ask-time reference monitor
// Python suite. The implementation under test is a Python hook
// (hooks/scripts/ask_reference_monitor.py + the AskUserQuestion branch in
// pretool_guard.py), so the real assertions live in unittest; this spec satisfies
// the JS-centric test-evidence gate while executing the actual Python coverage in CI.
// Strategy: tdd-pyramid (unit + committed-corpus replay + config parity + end-to-end
// enforcement that the hook emits ask/deny).
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('ask-time reference monitor Python suite passes (unit + corpus replay + enforcement)', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3', [
      '-m', 'unittest',
      'tests.hooks.test_ask_reference_monitor_3825',
    ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`ask-monitor unittest suite failed:\n${e.stdout || ''}\n${e.stderr || ''}`);
  }
  expect(typeof out).toBe('string');
});
