// tests/worktree-provision.spec.js — #3088 worktree provisioning policy (D3/D4/D6).
// Strategy: tdd-pyramid. Verifies shared-symlink propagation, local-ephemeral is left local,
// the fail-safe default for unclassified gitignored paths, and idempotency.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { provision, loadManifest, classify, linkShared } = require('../scripts/global/worktree-provision');

function tmp(p) { return fs.mkdtempSync(path.join(os.tmpdir(), p)); }
function fakeMain() {
  const main = tmp('wtmain-');
  fs.mkdirSync(path.join(main, 'node_modules'));
  fs.writeFileSync(path.join(main, 'node_modules', 'marker'), 'x');
  fs.writeFileSync(path.join(main, '.env'), 'GOOGLE_AI_STUDIO_API_KEY=secret');
  return main;
}

test('loadManifest exposes paths + a local-ephemeral fallback', () => {
  const m = loadManifest();
  expect(m.fallback).toBe('local-ephemeral');
  expect(m.paths['.env']).toBe('shared-symlink');
  expect(m.paths.node_modules).toBe('shared-symlink');
});

test('classify: unlisted gitignored path defaults to local-ephemeral (G4 fail-safe, never auto-shared)', () => {
  const m = loadManifest();
  expect(classify('some-new-secret-store', m)).toBe('local-ephemeral');
  expect(classify('.aws-creds', m)).toBe('local-ephemeral');
  expect(classify('.env', m)).toBe('shared-symlink');
});

test('provision symlinks the shared set (node_modules + .env) from main into the worktree', () => {
  const main = fakeMain(); const wt = tmp('wtwork-');
  const res = provision({ mainRoot: main, worktreeRoot: wt });
  expect(res.linked).toContain('.env');
  expect(res.linked).toContain('node_modules');
  expect(fs.lstatSync(path.join(wt, '.env')).isSymbolicLink()).toBe(true);
  // the symlinked .env resolves to main's real secret file (closes the no_key bug)
  expect(fs.readFileSync(path.join(wt, '.env'), 'utf8')).toContain('GOOGLE_AI_STUDIO_API_KEY');
});

test('provision leaves local-ephemeral paths local (does not propagate .dashboard/logs/generated)', () => {
  const main = fakeMain(); const wt = tmp('wtwork2-');
  const res = provision({ mainRoot: main, worktreeRoot: wt });
  expect(res.localEphemeral).toContain('.dashboard');
  expect(res.localEphemeral).toContain('logs');
  expect(fs.existsSync(path.join(wt, '.dashboard'))).toBe(false);
});

test('provision is idempotent — a second run reports present, not re-linked', () => {
  const main = fakeMain(); const wt = tmp('wtwork3-');
  provision({ mainRoot: main, worktreeRoot: wt });
  const second = provision({ mainRoot: main, worktreeRoot: wt });
  expect(second.linked).not.toContain('.env');
  expect(second.present).toContain('.env');
});

test('dry-run reports would-link without creating a symlink', () => {
  const main = fakeMain(); const wt = tmp('wtwork4-');
  const res = provision({ mainRoot: main, worktreeRoot: wt, dryRun: true });
  expect(res.linked).toContain('.env');
  expect(fs.existsSync(path.join(wt, '.env'))).toBe(false);
});

test('linkShared isolates a symlink failure as an error status (never throws / aborts the run)', () => {
  const main = fakeMain();
  const blocker = path.join(tmp('wtblk-'), 'is-a-file');
  fs.writeFileSync(blocker, 'x'); // dest parent is a FILE -> mkdirSync ENOTDIR -> caught
  const status = linkShared('node_modules', main, blocker, false);
  expect(status.startsWith('error')).toBe(true);
});

test('a shared path absent in main is skipped, not errored', () => {
  const main = tmp('wtmain2-'); const wt = tmp('wtwork5-'); // main has no node_modules/.env
  const res = provision({ mainRoot: main, worktreeRoot: wt });
  expect(res.skipped.join(' ')).toMatch(/source-absent/);
  expect(res.linked.length).toBe(0);
});
