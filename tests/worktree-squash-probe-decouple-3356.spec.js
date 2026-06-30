#!/usr/bin/env node
'use strict';
// #3356 — squash-probe decouple + openPr guard (#2691) + degraded signal. Epic #3352 C1.
const { test, expect } = require('@playwright/test');
const { enrich } = require('../scripts/global/worktree-inventory');
const cleanup = require('../scripts/global/worktree-cleanup-plan');

// Mock runGit: routes git arg-vectors to canned output for a single worktree.
function makeGit({ status = '', ancestor = false, upstream = 'origin/feat/1-x', mainDiv = '0\t0' } = {}) {
  return (gitArgs) => {
    const joined = gitArgs.join(' ');
    if (joined.startsWith('status --porcelain')) return status;
    if (joined.startsWith('merge-base --is-ancestor')) return ancestor ? 'yes' : 'no';
    if (joined.includes('abbrev-ref')) return upstream;
    if (joined.startsWith('rev-list --left-right --count') && joined.includes('origin/main')) return mainDiv;
    if (joined.startsWith('rev-list --left-right --count')) return '0\t0';
    if (joined.startsWith('log -1')) return '2026-06-29T00:00:00Z';
    return '';
  };
}
// Mock runGh: merged/open PR list responses keyed by --state.
function makeGh({ merged = false, open = false, nullOut = false } = {}) {
  return (ghArgs) => {
    if (nullOut) return null;
    const state = ghArgs[ghArgs.indexOf('--state') + 1];
    if (state === 'merged') return merged ? '[{"number":1}]' : '[]';
    if (state === 'open') return open ? '[{"number":2}]' : '[]';
    return '[]';
  };
}
const makeWt = (overrides = {}) => ({ path: '/tmp/wt', head: 'abc', branch: 'feat/1-x', ...overrides });

test('AC1.1 clean + squash-merged classifies stale-safe (regression-lock #2552)', () => {
  const enriched = enrich(makeWt(), makeGit(), makeGh({ merged: true }), {}, {});
  expect(enriched.squashMerged).toBe(true);
  expect(enriched.mergedToMain).toBe(true);
  expect(enriched.mergedToMainDirty).toBe(false);
  expect(enriched.lifecycleState).toBe('stale-safe');
});

test('AC1.1 ahead-unmerged is never removable', () => {
  const enriched = enrich(makeWt(), makeGit({ mainDiv: '0\t2' }), makeGh({ merged: false }), {}, {});
  expect(enriched.mergedToMain).toBe(false);
  expect(enriched.lifecycleState).not.toBe('stale-safe');
});

test('AC1.2 dirty + merged exposes mergedToMainDirty; clean-path semantics unchanged', () => {
  const enriched = enrich(makeWt(), makeGit({ status: ' M scripts/x.js' }), makeGh({ merged: true }), {}, {});
  expect(enriched.mergedToMainDirty).toBe(true);
  expect(enriched.squashMerged).toBe(false);
  expect(enriched.mergedToMain).toBe(false);
  expect(enriched.lifecycleState).toBe('stale-risky');
});

test('AC1.3 merged + openPr is not removable (#2691) — inventory', () => {
  const enriched = enrich(makeWt(), makeGit(), makeGh({ merged: true, open: true }), {}, {});
  expect(enriched.openPr).toBe(true);
  expect(enriched.lifecycleState).not.toBe('stale-safe');
});

test('AC1.3 cleanup-plan classify: openPr blocks remove, else remove', () => {
  const base = { branch: 'feat/1-x', dirtyCount: 0, untrackedCount: 0, mergedToMain: true };
  expect(cleanup.classify({ ...base, openPr: true }, null)).toBe('quarantine');
  expect(cleanup.classify({ ...base, openPr: false }, null)).toBe('remove');
});

test('AC1.4 probe-unreachable returns conservative merged=false with degraded signal', () => {
  const lines = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => { lines.push(String(chunk)); return true; };
  try {
    const enriched = enrich(makeWt(), makeGit(), makeGh({ nullOut: true }), {}, {});
    expect(enriched.mergedToMain).toBe(false);
  } finally { process.stderr.write = original; }
  expect(lines.join('')).toContain('degraded: merge-probe-unreachable');
});
