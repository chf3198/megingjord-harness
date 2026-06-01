// Regression coverage for #2579 — agent-signature.js identity resolution.
// Asserts the CLI no longer hard-codes a codex/gpt-5.4 default: identity must
// come from --team/--model flags or HAMR_TEAM/HAMR_MODEL env, else fail loud.
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'scripts', 'global', 'agent-signature.js');

function run(args, extraEnv) {
  // Start from a clean slate so the host env can't leak identity into a test.
  const env = { ...process.env };
  delete env.HAMR_TEAM;
  delete env.MEGINGJORD_TEAM;
  delete env.HAMR_MODEL;
  delete env.MEGINGJORD_MODEL;
  const out = execFileSync('node', [CLI, ...args], {
    encoding: 'utf8',
    env: { ...env, ...(extraEnv || {}) },
  });
  return JSON.parse(out);
}

test('explicit flags resolve claude-code identity (AC2)', () => {
  const r = run(['--team', 'claude-code', '--model', 'opus', '--role', 'manager']);
  expect(r.signedBy).toBe('Orla Mason');
  expect(r.teamModel).toBe('claude-code:opus@local');
  expect(r.role).toBe('manager');
});

test('HAMR_TEAM/HAMR_MODEL env resolves identity without flags (AC3)', () => {
  const r = run(['--role', 'manager'], { HAMR_TEAM: 'claude-code', HAMR_MODEL: 'opus' });
  expect(r.signedBy).toBe('Orla Mason');
  expect(r.teamModel).toBe('claude-code:opus@local');
});

test('codex still works with explicit flags — only the SILENT default is gone (AC1)', () => {
  const r = run(['--team', 'codex', '--model', 'gpt-5.4', '--role', 'manager']);
  expect(r.signedBy).toBe('Quill Mason');
  expect(r.teamModel).toBe('codex:gpt-5.4@local');
});

test('no flags + no env fails loud instead of mis-attributing to codex (AC1)', () => {
  let err;
  try {
    run(['--role', 'manager']);
  } catch (e) {
    err = e;
  }
  expect(err, 'CLI should exit non-zero when identity is unresolved').toBeTruthy();
  expect(err.status).toBe(2);
  expect(String(err.stderr)).toContain('unresolved identity');
  // Must not have emitted any signature on the failure path.
  expect(String(err.stdout || '')).not.toContain('Signed-by');
  expect(String(err.stdout || '')).not.toContain('codex');
});
