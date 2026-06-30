#!/usr/bin/env node
'use strict';
// #3359 — discovery completeness + G8 orphaned-after-merge signal. Epic #3352 C4. tdd-pyramid.
const { test, expect } = require('@playwright/test');
const audit = require('../scripts/global/worktree-discovery-audit');

// AC4.1: the porcelain sweep parses every path convention in one pass.
test('AC4.1 discoverRegistry parses all path conventions from porcelain', () => {
  const porcelain = [
    'worktree /home/u/devenv-ops\nHEAD a\nbranch refs/heads/main',
    'worktree /home/u/devenv-ops-3300\nHEAD b\nbranch refs/heads/feat/3300-x',
    'worktree /home/u/wt-3029\nHEAD c\nbranch refs/heads/feat/3029-y',
    'worktree /home/u/worktree-3106\nHEAD d\nbranch refs/heads/feat/3106-z',
    'worktree /home/u/.worktrees/feat-2919\nHEAD e\nbranch refs/heads/feat/2919-q',
    'worktree /home/u/devenv-ops/.claude/worktrees/wf_x\nHEAD f\nbranch refs/heads/feat/3047-w',
  ].join('\n\n');
  const entries = audit.discoverRegistry(() => porcelain);
  expect(entries).toHaveLength(6);
  expect(entries.map((e) => e.path)).toContain('/home/u/.worktrees/feat-2919');
  expect(entries.map((e) => e.path)).toContain('/home/u/devenv-ops/.claude/worktrees/wf_x');
});

// AC4.2: detached detection requires real git-worktree metadata AND porcelain-absence.
test('AC4.2 isDetachedWorktree flags only valid, registry-absent worktrees', () => {
  const registry = new Set(['/home/u/in-registry']);
  const runGit = () => 'true'; // rev-parse --is-inside-work-tree
  const exists = () => true;
  // real fs read of .git pointer — stub via a temp; here use the function's readFile path indirectly:
  // a directory that IS in the registry is never flagged
  expect(audit.isDetachedWorktree('/home/u/in-registry', registry, runGit, exists)).toBe(false);
});

test('AC4.2 nested independent repo is NOT flagged (rev-parse true but no worktree gitdir)', () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nested-'));
  fs.writeFileSync(path.join(dir, '.git'), 'gitdir: /some/repo/.git\n'); // a submodule-style pointer, NOT a worktree
  const flagged = audit.isDetachedWorktree(dir, new Set(), () => 'true', fs.existsSync);
  expect(flagged).toBe(false); // no /worktrees/ in the gitdir → not a detached worktree
});

test('AC4.2 a real detached worktree pointer IS flagged', () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detached-'));
  fs.writeFileSync(path.join(dir, '.git'), 'gitdir: /home/u/devenv-ops/.git/worktrees/detached-x\n');
  const flagged = audit.isDetachedWorktree(dir, new Set(), () => 'true', fs.existsSync);
  expect(flagged).toBe(true);
});

// AC4.3: the G8 signal counts merged worktrees still on disk, minus teardown-audited removals.
test('AC4.3 orphanedAfterMerge counts lingering merged worktrees, excludes torn-down paths', () => {
  const inventory = { worktrees: [
    { path: '/a', branch: 'feat/1-x', mergedToMain: true },        // lingering merged-clean
    { path: '/b', branch: 'feat/2-y', mergedToMainDirty: true },   // lingering merged-dirty
    { path: '/c', branch: 'feat/3-z', mergedToMain: true },        // already torn down per audit
    { path: '/d', branch: 'main', mergedToMain: true },            // main excluded
    { path: '/e', branch: 'feat/5-q', mergedToMain: false },       // not merged
  ] };
  const auditEvents = [{ event: 'worktree-teardown-removed', worktree_path: '/c' }];
  const result = audit.orphanedAfterMerge({ inventory, auditEvents });
  expect(result.count).toBe(2);
  expect(result.paths.sort()).toEqual(['/a', '/b']);
});

test('AC4.3 emitSignal emits a schema-v3 G8 event with the counts', () => {
  const emitted = [];
  const rec = audit.emitSignal({
    inventory: { worktrees: [{ path: '/a', branch: 'feat/1-x', mergedToMain: true }] },
    auditEvents: [], detached: [], emit: (event) => emitted.push(event), now: () => '2026-06-30T00:00:00Z',
  });
  expect(rec.event).toBe('worktree-orphaned-after-merge-count');
  expect(rec.orphaned_after_merge).toBe(1);
  expect(emitted).toHaveLength(1);
});
