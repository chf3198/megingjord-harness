// Tests for scripts/global/merge-evidence-snapshot.js (Epic #1486 Phase-1d, #1508).
const { test, expect } = require('@playwright/test');
const snap = require('../scripts/global/merge-evidence-snapshot');

test('#1508 AC1: extractTeam pulls team from Team&Model line', () => {
  expect(snap.extractTeam('Team&Model: claude-code:opus-4-7@anthropic')).toBe('claude-code');
  expect(snap.extractTeam('Team&Model: copilot:gpt-5.3-codex@github')).toBe('copilot');
  expect(snap.extractTeam('Team&Model: codex:gpt-5.4@codex-cli')).toBe('codex');
});

test('#1508 AC1: extractTeam case-insensitive on the keyword', () => {
  expect(snap.extractTeam('team&model: claude-code:opus')).toBe('claude-code');
  expect(snap.extractTeam('TEAM&MODEL: copilot:foo')).toBe('copilot');
});

test('#1508 AC1: extractTeam returns "unknown" when no Team&Model line', () => {
  expect(snap.extractTeam('Signed-by: Someone\nNo team line.')).toBe('unknown');
  expect(snap.extractTeam('')).toBe('unknown');
  expect(snap.extractTeam(null)).toBe('unknown');
  expect(snap.extractTeam(undefined)).toBe('unknown');
});

test('#1508 AC1: aggregateByTeam sums violations per team', () => {
  const plan = {
    violations: [
      { number: 1, team: 'claude-code' },
      { number: 2, team: 'copilot' },
      { number: 3, team: 'claude-code' },
      { number: 4, team: 'copilot' },
      { number: 5, team: 'codex' },
      { number: 6 }, // no team field → unknown
    ],
  };
  expect(snap.aggregateByTeam(plan)).toEqual({
    'claude-code': 2, copilot: 2, codex: 1, unknown: 1,
  });
});

test('#1508 AC1: aggregateByTeam returns empty object for empty plan', () => {
  expect(snap.aggregateByTeam({ violations: [] })).toEqual({});
});

test('#1508 AC1: buildSnapshot composes all fields from plan', () => {
  const plan = {
    processed: 5, remaining: 0,
    violations: [
      { number: 1, title: 'A', team: 'claude-code' },
      { number: 2, title: 'B', team: 'copilot' },
    ],
    skipped: [{ number: 3, reason: 'lightweight-lane:lane:trivial' }],
    passed: [{ number: 4, mergedPRCount: 1 }, { number: 5, mergedPRCount: 2 }],
  };
  const snapshot = snap.buildSnapshot(plan, 7);
  expect(snapshot.window_days).toBe(7);
  expect(snapshot.processed).toBe(5);
  expect(snapshot.counts).toEqual({ violations: 2, skipped: 1, passed: 2 });
  expect(snapshot.by_team).toEqual({ 'claude-code': 1, copilot: 1 });
  expect(snapshot.violations).toHaveLength(2);
  expect(snapshot.violations[0]).toMatchObject({ number: 1, title: 'A', team: 'claude-code' });
  expect(typeof snapshot.generated_at).toBe('string');
});

test('#1508 AC1: buildSnapshot defaults window to 7 when not supplied', () => {
  const snapshot = snap.buildSnapshot({ processed: 0, remaining: 0, violations: [], skipped: [], passed: [] });
  expect(snapshot.window_days).toBe(7);
});

test('#1508 AC1: SNAPSHOT_PATH lives under ~/.megingjord', () => {
  expect(snap.SNAPSHOT_PATH).toContain('.megingjord');
  expect(snap.SNAPSHOT_PATH).toContain('merge-evidence-snapshot.json');
});
