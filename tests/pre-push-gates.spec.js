'use strict';

const { test, expect } = require('@playwright/test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'global', 'pre-push-gates.js');

function run(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test('pre-push-gates warns on env bypass', () => {
  const result = run([], { PUSH_GATES_BYPASS: '1' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('bypass active');
  expect(result.stdout).toContain('npm run lint:js');
});

test('pre-push-gates warns on cli bypass', () => {
  const result = run(['--bypass']);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('bypass active');
  // #1613: replaced --diff-only reference (which never existed as a CLI flag) with
  // a known-present entry. The diff-only string was removed from BYPASSED_GATES.
  expect(result.stdout).toContain('megalint/index.js');
});

test('#1613: BYPASSED_GATES no longer lists the non-existent --diff-only command', () => {
  const result = run(['--bypass']);
  expect(result.stdout).not.toContain('--diff-only');
});

test('#1613: lefthook.yml no longer invokes --diff-only on test-evidence-validator', () => {
  const fs = require('fs');
  const path = require('path');
  const lefthook = fs.readFileSync(
    path.resolve(__dirname, '..', 'lefthook.yml'), 'utf-8'
  );
  expect(lefthook).not.toMatch(/test-evidence-validator\.js\s+--diff-only/);
  // The truthful explanatory comment is present
  expect(lefthook).toContain('#1613');
});

test('pre-push-gates returns fake success status for tests', () => {
  const result = run([], { PRE_PUSH_GATES_FAKE_STATUS: '0' });
  expect(result.status).toBe(0);
});

test('pre-push-gates returns fake failure status for tests', () => {
  const result = run([], { PRE_PUSH_GATES_FAKE_STATUS: '1' });
  expect(result.status).toBe(1);
});
