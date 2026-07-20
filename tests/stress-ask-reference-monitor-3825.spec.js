// #3825 (Epic #3822 C1, Gap A) — stress harness for the ask-time reference monitor.
// The classifier runs INSIDE the pretool_guard hook on every AskUserQuestion, so it
// must never raise on malformed/adversarial input (G6 fault-injection) and must stay
// within the ≤~50 ms inline budget (G7 p99). Real assertions live in the Python
// stress unittest; this spec is the JS-centric `tests/stress-*.spec.js` evidence.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

test('ask-time reference monitor stress: fault-injection survives + p99 under 50ms budget', () => {
  const root = path.resolve(__dirname, '..');
  let out = '';
  try {
    out = execFileSync('python3', [
      '-m', 'unittest',
      'tests.hooks.stress_ask_reference_monitor_3825',
    ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`ask-monitor stress suite failed:\n${e.stdout || ''}\n${e.stderr || ''}`);
  }
  expect(typeof out).toBe('string');
});
