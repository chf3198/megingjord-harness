// worktree-lifecycle-events.spec.js — Tests for worktree-lifecycle-events.js
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const {
  buildEvent, emitLifecycleEvents, redactPath, ACTIONS, REPORT_STATES,
} = require(path.resolve(__dirname, '..', 'scripts', 'global', 'worktree-lifecycle-events'));

function makeEntry(override = {}) {
  return {
    lifecycleState: 'stale-risky', branch: 'feat/1234-some-feature',
    path: `${process.env.HOME}/devenv-ops-1234`, ticket: 1234,
    ahead: 2, behind: 0, dirty: true, untracked: false,
    mergedToMain: false, lastActivity: '2025-07-25T00:00:00Z', ...override,
  };
}

test('REPORT_STATES covers 5 required states', () => {
  const required = ['stale-safe', 'stale-risky', 'rescue-needed', 'stale-warning', 'abandoned'];
  for (const s of required) expect(REPORT_STATES.has(s)).toBe(true);
});

test('buildEvent returns correct type for stale-risky', () => {
  expect(buildEvent(makeEntry()).type).toBe('worktree:stale-risky');
});

test('buildEvent maps issue from ticket field', () => {
  expect(buildEvent(makeEntry()).issue).toBe(1234);
});

test('buildEvent returns null issue when no ticket', () => {
  expect(buildEvent(makeEntry({ ticket: null })).issue).toBeNull();
});

test('buildEvent detail is valid JSON', () => {
  const e = buildEvent(makeEntry());
  expect(() => JSON.parse(e.detail)).not.toThrow();
});

test('buildEvent detail contains required structured fields', () => {
  const d = JSON.parse(buildEvent(makeEntry()).detail);
  for (const f of ['lifecycleState', 'proposedAction', 'branch', 'path', 'ahead', 'behind', 'dirty']) {
    expect(Object.hasOwn(d, f)).toBe(true);
  }
});

test('buildEvent detail does not expose untracked file names', () => {
  const text = buildEvent(makeEntry({ untracked: true })).detail;
  expect(text).not.toContain('untrackedFiles');
  expect(text).not.toContain('\.env');
});

test('buildEvent redacts home directory from path', () => {
  const home = process.env.HOME || '/home/user';
  const d = JSON.parse(buildEvent(makeEntry({ path: `${home}/devenv-ops-9999` })).detail);
  expect(d.path).not.toContain(home);
  expect(d.path.startsWith('~')).toBe(true);
});

test('emitLifecycleEvents only emits for REPORT_STATES entries', () => {
  const inv = { worktrees: [
    makeEntry({ lifecycleState: 'active' }),
    makeEntry({ lifecycleState: 'stale-risky' }),
    makeEntry({ lifecycleState: 'stale-safe', ticket: null }),
  ] };
  const results = emitLifecycleEvents({ dryRun: true, inventory: inv });
  expect(results.length).toBe(2);
});

test('emitLifecycleEvents skips active worktrees', () => {
  const inv = { worktrees: [makeEntry({ lifecycleState: 'active' })] };
  expect(emitLifecycleEvents({ dryRun: true, inventory: inv }).length).toBe(0);
});

test('emitted events have required fields', () => {
  const inv = { worktrees: [makeEntry()] };
  const [e] = emitLifecycleEvents({ dryRun: true, inventory: inv });
  expect(e.type).toBeTruthy();
  expect(e.detail).toBeTruthy();
});

test('redactPath replaces home prefix with ~', () => {
  const home = process.env.HOME || '/home/user';
  expect(redactPath(`${home}/foo`)).toBe('~/foo');
});

test('redactPath passes through non-home paths unchanged', () => {
  expect(redactPath('/tmp/foo')).toBe('/tmp/foo');
});
