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
    'rev-list --left-right --count origin/feat/2250-x...HEAD': '0 0',
    'rev-list --left-right --count origin/main...HEAD': '63 0',
    'log -1 --format=%cI': '2026-05-27T00:00:00Z',
  }));
  assert.strictEqual(item.lifecycleState, 'stale-warning');
  assert.strictEqual(item.removalSafe, false);
  assert.strictEqual(item.ahead, 0);
  assert.strictEqual(item.behind, 63);
});

test('inventory emits JSON-ready enriched worktree records', () => {
  const report = inventory(`worktree .
HEAD abc
branch refs/heads/feat/2250-x`, { runGit: runner({
    'status --porcelain --untracked-files=all': '?? note.txt',
    'rev-parse --abbrev-ref --symbolic-full-name @{u}': 'origin/feat/2250-x',
    'rev-list --left-right --count origin/feat/2250-x...HEAD': '1 0',
    'rev-list --left-right --count origin/main...HEAD': '1 0',
    'log -1 --format=%cI': '2026-05-27T00:00:00Z',
  }) });
  assert.strictEqual(report.mode, 'read-only');
  assert.strictEqual(report.worktrees[0].ticket, 2250);
  assert.strictEqual(report.worktrees[0].untracked, true);
  assert.strictEqual(report.worktrees[0].lifecycleState, 'stale-risky');
});

// --- #2552 squash-merge probe tests (AC1, AC2, AC6, AC9a,b,e) ---
function mockRunner(map = {}) {
  return (args) => map[args.join(' ')] || '';
}

test('#2552 squash probe: runGh finds merged PR → mergedToMain true for clean branch', () => {
  const report = inventory(`worktree /tmp\nHEAD abc\nbranch refs/heads/feat/2552-fix`, {
    runGit: mockRunner({
      'status --porcelain --untracked-files=all': '',
      'rev-parse --abbrev-ref --symbolic-full-name @{u}': 'origin/feat/2552-fix',
      'rev-list --left-right --count origin/feat/2552-fix...HEAD': '0 0',
      'rev-list --left-right --count origin/main...HEAD': '5 0',
      'log -1 --format=%cI': '2026-06-05T00:00:00Z',
    }),
    runGh: () => '[{"number":2552}]',
  });
  assert.strictEqual(report.worktrees[0].mergedToMain, true);
  assert.strictEqual(report.worktrees[0].squashMerged, true);
  assert.strictEqual(report.worktrees[0].lifecycleState, 'stale-safe');
});

test('#2552 squash probe: runGh throws → mergedToMain false (safe fallback, no crash)', () => {
  const report = inventory(`worktree /tmp\nHEAD abc\nbranch refs/heads/feat/2552-fix`, {
    runGit: mockRunner({
      'status --porcelain --untracked-files=all': '',
      'rev-parse --abbrev-ref --symbolic-full-name @{u}': 'origin/feat/2552-fix',
      'rev-list --left-right --count origin/feat/2552-fix...HEAD': '0 0',
      'rev-list --left-right --count origin/main...HEAD': '5 0',
      'log -1 --format=%cI': '2026-06-05T00:00:00Z',
    }),
    runGh: () => { throw new Error('gh: offline'); },
  });
  assert.strictEqual(report.worktrees[0].mergedToMain, false);
  assert.strictEqual(report.worktrees[0].squashMerged, false);
});

test('#2552 squash probe: squash-merged + dirty → mergedToMain false (quarantine safety)', () => {
  const report = inventory(`worktree /tmp\nHEAD abc\nbranch refs/heads/feat/2552-fix`, {
    runGit: mockRunner({
      'status --porcelain --untracked-files=all': ' M dirty-file.js',
      'rev-parse --abbrev-ref --symbolic-full-name @{u}': 'origin/feat/2552-fix',
      'rev-list --left-right --count origin/feat/2552-fix...HEAD': '0 0',
      'rev-list --left-right --count origin/main...HEAD': '5 0',
      'log -1 --format=%cI': '2026-06-05T00:00:00Z',
    }),
    runGh: () => '[{"number":2552}]',
  });
  assert.strictEqual(report.worktrees[0].mergedToMain, false, 'dirty squash-merged must not set mergedToMain');
  assert.strictEqual(report.worktrees[0].lifecycleState, 'stale-risky');
});

test('#2552 squash probe: in-memory cache — same branch probed at most once', () => {
  let callCount = 0;
  const runGh = () => { callCount++; return '[{"number":2552}]'; };
  // Use /tmp (guaranteed to exist) so parsePorcelain does not set missing:true
  const raw = [
    'worktree /tmp\nHEAD abc\nbranch refs/heads/feat/2552-fix',
    'worktree /tmp\nHEAD def\nbranch refs/heads/feat/2552-fix',
  ].join('\n\n');
  inventory(raw, {
    runGit: mockRunner({
      'status --porcelain --untracked-files=all': '',
      'rev-parse --abbrev-ref --symbolic-full-name @{u}': '',
      'rev-list --left-right --count origin/main...HEAD': '5 0',
      'log -1 --format=%cI': '2026-06-05T00:00:00Z',
    }),
    runGh,
  });
  assert.strictEqual(callCount, 1, 'same branch should be probed exactly once (cache hit on 2nd)');
});
