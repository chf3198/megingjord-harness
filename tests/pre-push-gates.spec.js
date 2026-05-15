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
  expect(result.stdout).toContain('test-evidence-validator.js --diff-only');
});

test('pre-push-gates returns fake success status for tests', () => {
  const result = run([], { PRE_PUSH_GATES_FAKE_STATUS: '0' });
  expect(result.status).toBe(0);
});

test('pre-push-gates returns fake failure status for tests', () => {
  const result = run([], { PRE_PUSH_GATES_FAKE_STATUS: '1' });
  expect(result.status).toBe(1);
});
