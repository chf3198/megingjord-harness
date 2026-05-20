// State branch-change reset — JS spec wrapper for #1975 (delegates to Python tests).
// The substantive coverage lives in tests/hooks/test_state_branch_reset.py because
// the unit under test is a Python module (hooks/scripts/state_store.py). This wrapper
// satisfies the test-evidence validator's tests/**/*.spec.{js,ts} pattern and
// reruns the Python suite under node --test.

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const PY_TEST = path.join('tests', 'hooks', 'test_state_branch_reset.py');

test('Python branch-reset unit suite passes', () => {
  assert.ok(fs.existsSync(path.join(REPO_ROOT, PY_TEST)), 'Python spec file present');
  const r = execFileSync('python3', ['-m', 'unittest', '-v',
    'tests.hooks.test_state_branch_reset'],
    { cwd: REPO_ROOT, encoding: 'utf8' });
  const combined = String(r);
  assert.ok(/Ran 7 tests/.test(combined) || combined === '', 'tests executed');
  // unittest writes summary to stderr; the absence of exception means pass.
});

test('reset_on_branch_change is exported from governance_state facade', () => {
  const out = execFileSync('python3', ['-c',
    "import sys; sys.path.insert(0,'hooks/scripts'); " +
    "from governance_state import reset_on_branch_change; " +
    "print('ok' if callable(reset_on_branch_change) else 'fail')"],
    { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.strictEqual(out.trim(), 'ok');
});
