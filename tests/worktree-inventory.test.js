#!/usr/bin/env node
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { classify, enrich, inventory, parsePorcelain, ticketFrom } = require('../scripts/global/worktree-inventory');

const RAW = `worktree /repo
HEAD abc
branch refs/heads/main

worktree /repo-agent
HEAD def
branch refs/heads/feat/123-work
locked agent active

worktree /repo-old
HEAD 111
prunable gitdir file points to non-existent location

worktree /repo-detached
HEAD 222
detached`;

function runner(map = {}) {
  return (args) => map[args.join(' ')] || '';
}

test('parses porcelain lifecycle fields', () => {
  assert.deepStrictEqual(parsePorcelain(RAW).map(w => ({
    path: w.path, branch: w.branch, locked: w.locked, prunable: w.prunable, detached: w.detached,
  })), [
    { path: '/repo', branch: 'main', locked: false, prunable: false, detached: false },
    { path: '/repo-agent', branch: 'feat/123-work', locked: true, prunable: false, detached: false },
    { path: '/repo-old', branch: undefined, locked: false, prunable: true, detached: false },
    { path: '/repo-detached', branch: undefined, locked: false, prunable: false, detached: true },
  ]);
});

test('infers ticket numbers from governed branches', () => {
  assert.strictEqual(ticketFrom('feat/2250-worktree-lifecycle-classifier'), 2250);
  assert.strictEqual(ticketFrom('sandbox/codex'), null);
});

test('classifies active, parked, warning, safe, risky, abandoned, detached, and rescue states', () => {
  assert.strictEqual(classify({ branch: 'main' }), 'active');
  assert.strictEqual(classify({ locked: true, branch: 'feat/1-x' }), 'active');
  assert.strictEqual(classify({ prunable: true }), 'prunable-metadata');
  assert.strictEqual(classify({ branch: 'feat/no-ticket', dirty: false, untracked: false, ahead: 0 }), 'ready/parked');
  assert.strictEqual(classify({ branch: 'feat/1-x', ticket: 1, behind: 80, ahead: 0 }), 'stale-warning');
  assert.strictEqual(classify({ branch: 'feat/1-x', ticket: 1, mergedToMain: true, ahead: 0 }), 'stale-safe');
  assert.strictEqual(classify({ branch: 'feat/1-x', ticket: 1, dirty: true, behind: 80 }), 'stale-risky');
  assert.strictEqual(classify({ branch: 'feat/1-x', ticket: 1, ahead: 0, upstream: null }), 'abandoned');
  assert.strictEqual(classify({ detached: true, ahead: 0, dirty: false, untracked: false }), 'detached-temp');
  assert.strictEqual(classify({ detached: true, ahead: 1 }), 'rescue-needed');
});

test('behind main is warning evidence only, not removal-safe proof', () => {
  const item = enrich({ path: '.', head: 'abc', branch: 'feat/2250-x' }, runner({
    'status --porcelain --untracked-files=all': '',
    'rev-parse --abbrev-ref --symbolic-full-name @{u}': 'origin/feat/2250-x',
    'rev-list --left-right --count origin/feat/2250-x...HEAD': '63 0',
    'log -1 --format=%cI': '2026-05-27T00:00:00Z',
  }));
  assert.strictEqual(item.lifecycleState, 'stale-warning');
  assert.strictEqual(item.removalSafe, false);
});

test('inventory emits JSON-ready enriched worktree records', () => {
  const report = inventory(`worktree .
HEAD abc
branch refs/heads/feat/2250-x`, { runGit: runner({
    'status --porcelain --untracked-files=all': '?? note.txt',
    'rev-parse --abbrev-ref --symbolic-full-name @{u}': 'origin/feat/2250-x',
    'rev-list --left-right --count origin/feat/2250-x...HEAD': '1 0',
    'log -1 --format=%cI': '2026-05-27T00:00:00Z',
  }) });
  assert.strictEqual(report.mode, 'read-only');
  assert.strictEqual(report.worktrees[0].ticket, 2250);
  assert.strictEqual(report.worktrees[0].untracked, true);
  assert.strictEqual(report.worktrees[0].lifecycleState, 'stale-risky');
});
