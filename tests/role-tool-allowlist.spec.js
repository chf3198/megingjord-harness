// #2919 — Role-scoped tool allowlist enforcement (G-16, ASI02, ASI06)
// Tests: per-role operation gates in pretool_guard via role_tool_allowlist_enforcer.
'use strict';

const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

function runPython(code, env = {}) {
  return execFileSync('python3', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

// ─── role_tool_allowlist_enforcer unit tests ─────────────────────────────────

test('#2919 enforcer: unknown phase fails open (returns None)', () => {
  const result = runPython(`
import sys; sys.path.insert(0, 'hooks/scripts')
from role_tool_allowlist_enforcer import check_command
assert check_command('git push origin main', None) is None
assert check_command('git push origin main', 'unknown') is None
print('OK')
`);
  expect(result.trim()).toBe('OK');
});

test('#2919 enforcer: manager phase denies git push', () => {
  const result = runPython(`
import sys; sys.path.insert(0, 'hooks/scripts')
from role_tool_allowlist_enforcer import check_command
res = check_command('git push origin feat/2919-role-tool-allowlist', 'manager')
assert res is not None and res[0] is False, f"Expected deny, got: {res}"
assert 'manager' in res[1]
assert 'git_push' in res[1]
print('OK')
`);
  expect(result.trim()).toBe('OK');
});

test('#2919 enforcer: collaborator phase denies gh pr merge', () => {
  const result = runPython(`
import sys; sys.path.insert(0, 'hooks/scripts')
from role_tool_allowlist_enforcer import check_command
res = check_command('gh pr merge 123 --squash', 'collaborator')
assert res is not None and res[0] is False, f"Expected deny, got: {res}"
assert 'collaborator' in res[1]
assert 'pr_merge' in res[1]
print('OK')
`);
  expect(result.trim()).toBe('OK');
});

test('#2919 enforcer: collaborator phase denies deploy', () => {
  const result = runPython(`
import sys; sys.path.insert(0, 'hooks/scripts')
from role_tool_allowlist_enforcer import check_command
res = check_command('npm run deploy:apply', 'collaborator')
assert res is not None and res[0] is False, f"Expected deny, got: {res}"
assert 'collaborator' in res[1]
assert 'deploy' in res[1]
print('OK')
`);
  expect(result.trim()).toBe('OK');
});

test('#2919 enforcer: admin phase denies branch creation', () => {
  const result = runPython(`
import sys; sys.path.insert(0, 'hooks/scripts')
from role_tool_allowlist_enforcer import check_command
res = check_command('git checkout -b feat/new-thing', 'admin')
assert res is not None and res[0] is False, f"Expected deny, got: {res}"
assert 'admin' in res[1]
assert 'git_branch_create' in res[1]
print('OK')
`);
  expect(result.trim()).toBe('OK');
});

test('#2919 enforcer: admin phase permits git push', () => {
  const result = runPython(`
import sys; sys.path.insert(0, 'hooks/scripts')
from role_tool_allowlist_enforcer import check_command
res = check_command('git push origin feat/2919', 'admin')
assert res is None, f"Expected permit, got: {res}"
print('OK')
`);
  expect(result.trim()).toBe('OK');
});

test('#2919 enforcer: collaborator phase permits branch creation', () => {
  const result = runPython(`
import sys; sys.path.insert(0, 'hooks/scripts')
from role_tool_allowlist_enforcer import check_command
res = check_command('git checkout -b feat/2919-sub', 'collaborator')
assert res is None, f"Expected permit, got: {res}"
print('OK')
`);
  expect(result.trim()).toBe('OK');
});

// ─── pretool_guard.py integration tests ──────────────────────────────────────

const MOCK_PREAMBLE = `
import sys, json
sys.path.insert(0, 'hooks/scripts')
import pretool_guard
from unittest.mock import patch
import io as _io
`;

function buildPayload(command) {
  return JSON.stringify({ tool_name: 'run_in_terminal', tool_input: { command }, cwd: '.' });
}

function buildMockPatch(phase) {
  return `{"flags": {}, "admin_ops": {}, "active_ticket": 2919, "current_phase": "${phase}"}`;
}

test('#2919 pretool_guard: manager phase denies git push via terminal', () => {
  const payload = buildPayload('git push origin main');
  const state = buildMockPatch('manager');
  const result = runPython(`${MOCK_PREAMBLE}
payload = json.dumps(${payload})
state = ${state}
captured = {}
def cap(decision, reason, extra=None):
    captured["d"] = decision; captured["r"] = reason; return 0
with patch("pretool_guard.emit", side_effect=cap), \\
     patch("sys.stdin", _io.StringIO(payload)), \\
     patch("pretool_guard.ensure_state", return_value=state), \\
     patch("state_store.reset_on_branch_change", return_value=state), \\
     patch("pretool_guard.enforce_blast_radius", return_value=None):
    pretool_guard.main()
assert captured.get("d") == "deny", f"Expected deny, got: {captured}"
assert "manager" in captured.get("r", ""), f"Expected manager in reason: {captured}"
print("OK: manager blocks git push")
`);
  expect(result.trim()).toBe('OK: manager blocks git push');
});

test('#2919 pretool_guard: admin phase denies git branch create via terminal', () => {
  const payload = buildPayload('git switch -c feat/new-branch');
  const state = buildMockPatch('admin');
  const result = runPython(`${MOCK_PREAMBLE}
payload = json.dumps(${payload})
state = ${state}
captured = {}
def cap(decision, reason, extra=None):
    captured["d"] = decision; captured["r"] = reason; return 0
with patch("pretool_guard.emit", side_effect=cap), \\
     patch("sys.stdin", _io.StringIO(payload)), \\
     patch("pretool_guard.ensure_state", return_value=state), \\
     patch("state_store.reset_on_branch_change", return_value=state), \\
     patch("pretool_guard.enforce_blast_radius", return_value=None):
    pretool_guard.main()
assert captured.get("d") == "deny", f"Expected deny, got: {captured}"
assert "admin" in captured.get("r", ""), f"Expected admin in reason: {captured}"
print("OK: admin blocks branch create")
`);
  expect(result.trim()).toBe('OK: admin blocks branch create');
});
