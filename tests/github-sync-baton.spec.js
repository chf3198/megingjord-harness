const { test, expect } = require('@playwright/test');

test.describe('GitHub Sync → Baton Integration (#3666)', () => {
  const SYNC_CODE = `
    ${require('fs').readFileSync(require('path').resolve(__dirname, '../dashboard/js/github-sync.js'), 'utf8')}
  `;
  function mkIssue(n, labels, state = 'open', extra = {}) {
    return { number: n, title: `Test-${n}`, state, labels, assignee: null, epic: null, lastComment: null, ...extra };
  }

  test('syncWithGitHub maps status:in-progress to in-progress', () => {
    const { syncWithGitHub } = require('../dashboard/js/github-sync.js');
    const result = syncWithGitHub([mkIssue(100, ['status:in-progress', 'role:collaborator'])]);
    expect(result[0].status).toBe('in-progress');
    expect(result[0].activeRole).toBe('collaborator');
  });

  test('syncWithGitHub maps status:review to review', () => {
    const { syncWithGitHub } = require('../dashboard/js/github-sync.js');
    const result = syncWithGitHub([mkIssue(200, ['status:review', 'role:consultant'])]);
    expect(result[0].status).toBe('review');
    expect(result[0].activeRole).toBe('consultant');
  });

  test('syncWithGitHub maps closed issues to done', () => {
    const { syncWithGitHub } = require('../dashboard/js/github-sync.js');
    const result = syncWithGitHub([mkIssue(300, ['status:in-progress'], 'closed')]);
    expect(result[0].status).toBe('done');
    expect(result[0].closed).toBe(true);
  });

  test('extractActiveBaton filters to active statuses only', () => {
    const { syncWithGitHub, extractActiveBaton } = require('../dashboard/js/github-sync.js');
    const issues = [
      mkIssue(1, ['status:in-progress', 'role:collaborator']),
      mkIssue(2, ['status:backlog']),
      mkIssue(3, ['status:review', 'role:consultant']),
      mkIssue(4, ['status:done'], 'closed'),
      mkIssue(5, ['status:testing', 'role:admin']),
      mkIssue(6, ['status:triage', 'role:manager']),
      mkIssue(7, ['status:ready']),
      mkIssue(8, ['status:cancelled'], 'closed'),
    ];
    const synced = syncWithGitHub(issues);
    const active = extractActiveBaton(synced);
    const activeNums = active.map(t => t.issue).sort((a, b) => a - b);
    expect(activeNums).toEqual([1, 3, 5, 6, 7]);
  });

  test('extractActiveBaton excludes closed issues even with active status', () => {
    const { syncWithGitHub, extractActiveBaton } = require('../dashboard/js/github-sync.js');
    const issues = [mkIssue(10, ['status:in-progress'], 'closed')];
    const active = extractActiveBaton(syncWithGitHub(issues));
    expect(active).toHaveLength(0);
  });

  test('isEpic detected from type:epic label', () => {
    const { syncWithGitHub } = require('../dashboard/js/github-sync.js');
    const result = syncWithGitHub([
      mkIssue(50, ['type:epic', 'status:in-progress', 'role:manager']),
    ]);
    expect(result[0].isEpic).toBe(true);
  });

  test('non-epic ticket has isEpic=false', () => {
    const { syncWithGitHub } = require('../dashboard/js/github-sync.js');
    const result = syncWithGitHub([
      mkIssue(51, ['type:task', 'status:in-progress', 'role:collaborator']),
    ]);
    expect(result[0].isEpic).toBe(false);
  });

  test('inferRole falls back from status when role label missing', () => {
    const { syncWithGitHub } = require('../dashboard/js/github-sync.js');
    const result = syncWithGitHub([mkIssue(60, ['status:testing'])]);
    expect(result[0].activeRole).toBe('admin');
  });

  test('empty input returns empty array', () => {
    const { syncWithGitHub, extractActiveBaton } = require('../dashboard/js/github-sync.js');
    expect(syncWithGitHub([])).toEqual([]);
    expect(syncWithGitHub(null)).toEqual([]);
    expect(extractActiveBaton([])).toEqual([]);
  });

  test('all 11 statuses mapped correctly', () => {
    const { syncWithGitHub } = require('../dashboard/js/github-sync.js');
    const statuses = [
      'triage', 'ready', 'in-progress', 'testing', 'review',
      'done', 'backlog', 'blocked', 'cancelled', 'queued', 'dormant',
    ];
    for (const s of statuses) {
      const result = syncWithGitHub([mkIssue(1, [`status:${s}`])]);
      expect(result[0].status).toBe(s);
    }
  });
});
