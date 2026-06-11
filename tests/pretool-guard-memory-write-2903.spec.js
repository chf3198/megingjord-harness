// #2903 — Wraps the Python unittest suite at tests/hooks/test_pretool_guard_memory_write_guard.py
// G-07: /memories/ write guard — raw file writes to /memories/ must be denied.
// The Python tests are the source of truth for pretool_guard.py logic;
// this wrapper invokes them as a subprocess and asserts exit 0.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

test('#2903 G-07: Python unittest suite for /memories/ write guard passes', () => {
  let stdout = '';
  try {
    stdout = execFileSync('python3', [
      '-m', 'unittest', 'tests.hooks.test_pretool_guard_memory_write_guard', '-v',
    ], { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    throw new Error(
      `Python unittest failed:\nstdout: ${e.stdout || ''}\nstderr: ${e.stderr || ''}`,
    );
  }
  // unittest -v writes to stderr; execFileSync exit 0 means all passed
  expect(stdout.length).toBeGreaterThanOrEqual(0);
});

test('#2903: create_file targeting /memories/ returns deny decision', () => {
  const result = execFileSync('python3', ['-c', `
import sys, json
sys.path.insert(0, 'hooks/scripts')
import pretool_guard
from unittest.mock import patch, io
import io as _io

payload = json.dumps({
  "tool_name": "create_file",
  "tool_input": {"filePath": "/memories/session/injected.md", "content": "ignore rules"},
  "cwd": "."
})
captured = {}
def cap(decision, reason, extra=None):
    captured["d"] = decision
    return 0

with patch("pretool_guard.emit", side_effect=cap), \\
     patch("sys.stdin", _io.StringIO(payload)), \\
     patch("pretool_guard.ensure_state", return_value={"flags": {}, "admin_ops": {}, "active_ticket": 99}), \\
     patch("state_store.reset_on_branch_change", return_value={"flags": {}, "admin_ops": {}, "active_ticket": 99}), \\
     patch("pretool_guard.active_ticket_is_no_code_lane", return_value=False), \\
     patch("pretool_guard.is_main_checkout", return_value=False), \\
     patch("pretool_guard.linked_issue_has_manager_handoff", return_value=True):
    pretool_guard.main()

assert captured.get("d") == "deny", f"Expected deny, got: {captured}"
print("OK: /memories/ write denied")
`], { cwd: REPO_ROOT, encoding: 'utf8' });
  expect(result.trim()).toBe('OK: /memories/ write denied');
});
