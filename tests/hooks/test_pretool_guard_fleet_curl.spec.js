/**
 * JS spec shim for tdd-pyramid CI gate (#2782).
 * The authoritative tests are in test_pretool_guard_fleet_curl.py;
 * this wrapper delegates to Python unittest to satisfy the
 * tests/**‌/‌*.spec.js pattern required by test-evidence-validator.js.
 */
'use strict';
const { execSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function runPythonTests() {
  const cmd = 'python3 -m unittest tests.hooks.test_pretool_guard_fleet_curl -v 2>&1';
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', shell: true });
}

describe('pretool_guard fleet-curl bypass (Python tests via shim)', () => {
  it('all 9 Python test cases pass', () => {
    let output = '';
    try {
      output = runPythonTests();
    } catch (err) {
      output = err.stderr || err.stdout || String(err);
      throw new Error(`Python test suite failed:\n${output}`);
    }
    const ranMatch = output.match(/Ran (\d+) tests? in/);
    const count = ranMatch ? parseInt(ranMatch[1], 10) : 0;
    if (count < 9) {
      throw new Error(`Expected >=9 tests, got ${count}. Output:\n${output}`);
    }
    if (/FAILED|ERROR/.test(output)) {
      throw new Error(`Test failures detected:\n${output}`);
    }
  });
});
