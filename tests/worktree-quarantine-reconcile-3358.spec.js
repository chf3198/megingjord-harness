#!/usr/bin/env node
'use strict';
// #3358 — dirty+merged quarantine reconciler. Epic #3352 C3. tdd-pyramid.
const { test, expect } = require('@playwright/test');
const { reconcile, classifyFiles, isSupersededArtifact } = require('../scripts/global/worktree-quarantine-reconcile');

const cand = (over = {}) => ({ path: '/tmp/wt', branch: 'feat/1-x', ticket: 1,
  mergedToMainDirty: true, ticketClosed: true, files: [], ...over });

test('AC3.2 untracked build/dep artifacts classify superseded', () => {
  expect(isSupersededArtifact({ untracked: true, path: 'node_modules/x/index.js' })).toBe(true);
  expect(isSupersededArtifact({ untracked: true, path: 'dist/bundle.js' })).toBe(true);
  expect(isSupersededArtifact({ untracked: true, path: 'run.log' })).toBe(true);
});

test('AC3.2/AC3.4 modified tracked files and untracked source are NEVER superseded', () => {
  expect(isSupersededArtifact({ untracked: false, path: 'scripts/global/x.js' })).toBe(false); // modified tracked
  expect(isSupersededArtifact({ untracked: true, path: 'scripts/global/new.js' })).toBe(false); // untracked source
  expect(isSupersededArtifact({ untracked: false, path: 'node_modules/x.js' })).toBe(false); // tracked, even in node_modules
});

test('AC3.2 classifyFiles splits superseded vs novel and decides', () => {
  const onlyArtifacts = classifyFiles([{ untracked: true, path: 'node_modules/a' }, { untracked: true, path: 'b.log' }]);
  expect(onlyArtifacts.decision).toBe('safe-remove');
  const withSource = classifyFiles([{ untracked: true, path: 'node_modules/a' }, { untracked: false, path: 'src/x.js' }]);
  expect(withSource.decision).toBe('rescue');
  expect(withSource.novel).toHaveLength(1);
});

test('AC3.1 only dirty && merged && ticket-closed are eligible', () => {
  const calls = [];
  const remove = (p) => { calls.push(p); return { ok: true, exitCode: 0 }; };
  const r = reconcile({ confirm: true, emit: () => {}, remove, candidates: [
    cand({ path: '/a', mergedToMainDirty: false, files: [{ untracked: true, path: 'node_modules/x' }] }),
    cand({ path: '/b', ticketClosed: false, files: [{ untracked: true, path: 'node_modules/x' }] }),
  ] });
  expect(calls).toHaveLength(0);
  expect(r.every((x) => x.decision === 'skip-not-eligible')).toBe(true);
});

test('AC3.3 superseded-only + confirm removes; emits audit', () => {
  const emitted = [];
  const r = reconcile({ confirm: true, emit: (rec) => emitted.push(rec),
    remove: () => ({ ok: true, exitCode: 0 }),
    candidates: [cand({ files: [{ untracked: true, path: 'node_modules/x' }, { untracked: true, path: 'x.log' }] })] });
  expect(r[0].decision).toBe('removed');
  expect(emitted).toHaveLength(1);
  expect(emitted[0].event).toBe('quarantine-reconciled-removed');
});

test('AC3.3 dry-run (no confirm) never removes superseded-only', () => {
  const calls = [];
  const r = reconcile({ emit: () => {}, remove: (p) => { calls.push(p); return { ok: true, exitCode: 0 }; },
    candidates: [cand({ files: [{ untracked: true, path: 'node_modules/x' }] })] });
  expect(calls).toHaveLength(0);
  expect(r[0].decision).toBe('safe-remove-pending-confirm');
});

test('AC3.4 ADVERSARIAL: novel work is never removed even with confirm + closed + merged', () => {
  const calls = [];
  const r = reconcile({ confirm: true, emit: () => {}, remove: (p) => { calls.push(p); return { ok: true, exitCode: 0 }; },
    candidates: [cand({ files: [{ untracked: false, path: 'scripts/global/important.js' }, { untracked: true, path: 'node_modules/x' }] })] });
  expect(calls).toHaveLength(0);                 // remove never invoked
  expect(r[0].decision).toBe('rescue-novel-work');
});
