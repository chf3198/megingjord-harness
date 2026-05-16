const { test, expect } = require('@playwright/test');
const view = require('../scripts/global/cross-team-coordination-view');

const FUTURE = '2999-01-01T02:00:00.000Z';
const NOW = '2999-01-01T00:00:00.000Z';

function lease(overrides = {}) {
  return {
    ticket: 1801,
    team: 'codex',
    branch: 'feat/1801-demo',
    worktree: '/tmp/demo',
    paths: ['scripts/global'],
    ports: [],
    created_at: '2998-12-31T22:00:00.000Z',
    expires_at: FUTURE,
    status: 'active',
    ...overrides,
  };
}

function plan(worktrees = []) {
  return { worktrees };
}

test('reports an empty registry', () => {
  const report = view.summarize({ at: NOW, registry: { version: 1, leases: [] }, plan: plan() });
  expect(report.active).toEqual([]);
  expect(report.cleanup).toEqual([]);
});

test('groups active leases by team with links and age', () => {
  const report = view.summarize({ at: NOW, registry: { version: 1, leases: [lease()] }, plan: plan() });
  expect(report.byTeam.codex[0].ticket).toBe(1801);
  expect(report.active[0].age_hours).toBe(2);
  expect(report.active[0].links.issue).toContain('/issues/1801');
});

test('flags stale leases that expire soon', () => {
  const report = view.summarize({ at: NOW, registry: { version: 1, leases: [lease()] }, plan: plan() });
  expect(report.stale[0].ticket).toBe(1801);
});

test('detects conflicting active leases by shared path', () => {
  const registry = { version: 1, leases: [
    lease({ ticket: 1801, branch: 'feat/1801-a' }),
    lease({ ticket: 1802, team: 'copilot', branch: 'feat/1802-b' }),
  ] };
  const report = view.summarize({ at: NOW, registry, plan: plan() });
  expect(report.conflicts.map(row => row.ticket)).toEqual([1801, 1802]);
});

test('separates cleanup candidates from active work', () => {
  const report = view.summarize({
    at: NOW,
    registry: { version: 1, leases: [] },
    plan: plan([{ cleanupState: 'merged-clean', ticket: 1803, branch: 'feat/1803-done',
      path: '/tmp/done', commands: ['git worktree remove /tmp/done'] }]),
  });
  expect(report.cleanup[0].state).toBe('merged-clean');
  expect(view.text(report)).toContain('cleanup candidates: 1');
});
