// #2910 — Authorization profile runtime enforcement in pretool_guard (G-05, ASI02)
// Tests: guarded mode blocks install; restricted mode blocks execute_remote.
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

// ─── auth-profile-enforcer.js unit tests ────────────────────────────────────

test('#2910 auth-profile-enforcer: owner profile permits install', () => {
  const { checkCapability } = require('../scripts/global/auth-profile-enforcer');
  const result = checkCapability('install', { env: { MEGINGJORD_AUTH_PROFILE: 'owner' } });
  expect(result.allowed).toBe(true);
  expect(result.profile).toBe('owner');
});

test('#2910 auth-profile-enforcer: guarded profile denies install', () => {
  const { checkCapability } = require('../scripts/global/auth-profile-enforcer');
  const result = checkCapability('install', { env: { MEGINGJORD_AUTH_PROFILE: 'guarded' } });
  expect(result.allowed).toBe(false);
  expect(result.profile).toBe('guarded');
});

test('#2910 auth-profile-enforcer: restricted profile denies execute_remote', () => {
  const { checkCapability } = require('../scripts/global/auth-profile-enforcer');
  const result = checkCapability('execute_remote', { env: { MEGINGJORD_AUTH_PROFILE: 'restricted' } });
  expect(result.allowed).toBe(false);
  expect(result.profile).toBe('restricted');
});

test('#2910 auth-profile-enforcer: guarded profile permits execute_remote', () => {
  const { checkCapability } = require('../scripts/global/auth-profile-enforcer');
  const result = checkCapability('execute_remote', { env: { MEGINGJORD_AUTH_PROFILE: 'guarded' } });
  expect(result.allowed).toBe(true);
});

test('#2910 inferCapabilities: npm install → install', () => {
  const { inferCapabilities } = require('../scripts/global/auth-profile-enforcer');
  expect(inferCapabilities('npm install lodash')).toContain('install');
});

test('#2910 inferCapabilities: ssh → execute_remote', () => {
  const { inferCapabilities } = require('../scripts/global/auth-profile-enforcer');
  expect(inferCapabilities('ssh user@host ls')).toContain('execute_remote');
});

test('#2910 inferCapabilities: sudo → privileged', () => {
  const { inferCapabilities } = require('../scripts/global/auth-profile-enforcer');
  expect(inferCapabilities('sudo apt update')).toContain('privileged');
});

// ─── pretool_guard.py integration tests ─────────────────────────────────────

test('#2910 pretool_guard: guarded profile denies npm install via terminal', () => {
  const result = runPython(`
import sys, json
sys.path.insert(0, 'hooks/scripts')
import pretool_guard
from unittest.mock import patch
import io as _io

payload = json.dumps({
  "tool_name": "run_in_terminal",
  "tool_input": {"command": "npm install lodash"},
  "cwd": "."
})
captured = {}
def cap(decision, reason, extra=None):
    captured["d"] = decision
    captured["r"] = reason
    return 0

with patch("pretool_guard.emit", side_effect=cap), \\
     patch("sys.stdin", _io.StringIO(payload)), \\
     patch("pretool_guard.ensure_state", return_value={"flags": {}, "admin_ops": {}, "active_ticket": 2910}), \\
     patch("state_store.reset_on_branch_change", return_value={"flags": {}, "admin_ops": {}, "active_ticket": 2910}), \\
     patch("pretool_guard.enforce_blast_radius", return_value=None):
    pretool_guard.main()

assert captured.get("d") == "deny", f"Expected deny, got: {captured}"
assert "guarded" in captured.get("r", ""), f"Expected guarded in reason: {captured}"
print("OK: guarded blocks install")
`, { MEGINGJORD_AUTH_PROFILE: 'guarded' });
  expect(result.trim()).toBe('OK: guarded blocks install');
});

test('#2910 pretool_guard: restricted profile denies ssh execute_remote', () => {
  const result = runPython(`
import sys, json
sys.path.insert(0, 'hooks/scripts')
import pretool_guard
from unittest.mock import patch
import io as _io

payload = json.dumps({
  "tool_name": "run_in_terminal",
  "tool_input": {"command": "ssh user@remotehost ls"},
  "cwd": "."
})
captured = {}
def cap(decision, reason, extra=None):
    captured["d"] = decision
    captured["r"] = reason
    return 0

with patch("pretool_guard.emit", side_effect=cap), \\
     patch("sys.stdin", _io.StringIO(payload)), \\
     patch("pretool_guard.ensure_state", return_value={"flags": {}, "admin_ops": {}, "active_ticket": 2910}), \\
     patch("state_store.reset_on_branch_change", return_value={"flags": {}, "admin_ops": {}, "active_ticket": 2910}), \\
     patch("pretool_guard.enforce_blast_radius", return_value=None):
    pretool_guard.main()

assert captured.get("d") == "deny", f"Expected deny, got: {captured}"
assert "restricted" in captured.get("r", ""), f"Expected restricted in reason: {captured}"
print("OK: restricted blocks execute_remote")
`, { MEGINGJORD_AUTH_PROFILE: 'restricted' });
  expect(result.trim()).toBe('OK: restricted blocks execute_remote');
});

test('#2910 pretool_guard: owner profile permits npm install', () => {
  const result = runPython(`
import sys, json
sys.path.insert(0, 'hooks/scripts')
import pretool_guard
from unittest.mock import patch
import io as _io

payload = json.dumps({
  "tool_name": "run_in_terminal",
  "tool_input": {"command": "npm install lodash"},
  "cwd": "."
})
captured = {}
def cap(decision, reason, extra=None):
    captured["d"] = decision
    return 0

with patch("pretool_guard.emit", side_effect=cap), \\
     patch("sys.stdin", _io.StringIO(payload)), \\
     patch("pretool_guard.ensure_state", return_value={"flags": {}, "admin_ops": {}, "active_ticket": 2910}), \\
     patch("state_store.reset_on_branch_change", return_value={"flags": {}, "admin_ops": {}, "active_ticket": 2910}), \\
     patch("pretool_guard.enforce_blast_radius", return_value=None), \\
     patch("pretool_guard.check_terminal", return_value=None):
    pretool_guard.main()

# check_terminal patched to None means no deny was emitted from auth profile
assert captured.get("d") != "deny", f"Should not deny under owner: {captured}"
print("OK: owner permits install")
`, { MEGINGJORD_AUTH_PROFILE: 'owner' });
  expect(result.trim()).toBe('OK: owner permits install');
});
