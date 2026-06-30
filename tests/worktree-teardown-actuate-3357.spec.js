#!/usr/bin/env node
'use strict';
// #3357 — post-merge worktree teardown actuation. Epic #3352 C2 (keystone). tdd-pyramid.
const { test, expect } = require('@playwright/test');
const { actuate, auditRecord } = require('../scripts/global/worktree-teardown-actuate');

const planWith = (worktrees) => ({ worktrees });
const wt = (over = {}) => ({ path: '/tmp/wt-x', branch: 'feat/1-x', ticket: 1,
  cleanupState: 'remove', squashMerged: true, ...over });

test('AC2.1 apply removes remove-state worktrees via injected runner', () => {
  const calls = [];
  const result = actuate({ apply: true, plan: planWith([wt()]),
    runRemove: (path) => { calls.push(path); return { ok: true, exitCode: 0, stderr: '' }; },
    emit: () => {}, currentPath: '/elsewhere' });
  expect(calls).toEqual(['/tmp/wt-x']);
  expect(result.removed).toHaveLength(1);
  expect(result.refused).toHaveLength(0);
});

test('AC2.1 dry-run (default) removes nothing, reports skipped', () => {
  const calls = [];
  const result = actuate({ plan: planWith([wt()]),
    runRemove: (path) => { calls.push(path); return { ok: true, exitCode: 0, stderr: '' }; },
    emit: () => {}, currentPath: '/elsewhere' });
  expect(calls).toHaveLength(0);
  expect(result.skipped).toHaveLength(1);
});

test('AC2.2 a refused (dirty-guard) removal is captured, never overridden', () => {
  const result = actuate({ apply: true, plan: planWith([wt()]),
    runRemove: () => ({ ok: false, exitCode: 1, stderr: 'contains modified or untracked files, use --force to delete' }),
    emit: () => {}, currentPath: '/elsewhere' });
  expect(result.removed).toHaveLength(0);
  expect(result.refused).toHaveLength(1);
  expect(result.refused[0].exitCode).toBe(1);
});

test('AC2.2 only remove-state worktrees are touched (dirty/unmerged never attempted)', () => {
  const calls = [];
  const plan = planWith([
    wt({ path: '/a', cleanupState: 'quarantine' }),      // dirty
    wt({ path: '/b', cleanupState: 'needs-review' }),     // unmerged/no-ticket
    wt({ path: '/c', cleanupState: 'remove' }),           // merged+clean
  ]);
  actuate({ apply: true, plan, runRemove: (p) => { calls.push(p); return { ok: true, exitCode: 0, stderr: '' }; },
    emit: () => {}, currentPath: '/elsewhere' });
  expect(calls).toEqual(['/c']);
});

test('AC2.2 never removes the current worktree or main', () => {
  const calls = [];
  const plan = planWith([
    wt({ path: '/here', cleanupState: 'remove' }),
    wt({ path: '/main', branch: 'main', cleanupState: 'remove' }),
  ]);
  const result = actuate({ apply: true, plan, runRemove: (p) => { calls.push(p); return { ok: true, exitCode: 0, stderr: '' }; },
    emit: () => {}, currentPath: '/here' });
  expect(calls).toHaveLength(0);
  expect(result.total).toBe(0);
});

test('AC2.3 audit record carries the required fields incl guard output', () => {
  const record = auditRecord(wt({ branch: 'feat/9-z', ticket: 9 }),
    { ok: false, exitCode: 1, stderr: 'dirty' }, '2026-06-30T00:00:00Z');
  for (const field of ['worktree_path', 'branch', 'ticket', 'merge_evidence',
    'operator_alias', 'ts', 'decision', 'remove_exit_code', 'remove_stderr']) {
    expect(record[field] !== undefined).toBe(true);
  }
  expect(record.decision).toBe('refused-by-dirty-guard');
  expect(record.remove_exit_code).toBe(1);
});

test('AC2.4 idempotent: empty plan is a no-op, never throws', () => {
  const result = actuate({ apply: true, plan: planWith([]), runRemove: () => { throw new Error('should not run'); },
    emit: () => {}, currentPath: '/elsewhere' });
  expect(result.total).toBe(0);
  expect(result.removed).toHaveLength(0);
});
