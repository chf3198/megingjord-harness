// Goal Coverage Panel — visual-regression + unit tests (#1359, Epic #1339 C8).
const { test, expect } = require('@playwright/test');
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'dashboard', 'api', 'goal-coverage-handlers.js'));

test('GOAL_MAP exports G1..G9', () => {
  for (const id of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9']) {
    expect(H.GOAL_MAP[id]).toBeDefined();
    expect(H.GOAL_MAP[id].name).toBeTruthy();
    expect(Array.isArray(H.GOAL_MAP[id].triggers)).toBe(true);
  }
});

test('classifyCoverage: thresholds (gap/low/ok)', () => {
  expect(H.classifyCoverage(0)).toBe('gap');
  expect(H.classifyCoverage(1)).toBe('low');
  expect(H.classifyCoverage(2)).toBe('low');
  expect(H.classifyCoverage(3)).toBe('ok');
  expect(H.classifyCoverage(100)).toBe('ok');
});

test('computeGoalCoverage: goal with empty triggers list returns coverage_status=gap', () => {
  const result = H.computeGoalCoverage([]);
  expect(result.G4.coverage_status).toBe('gap');  // Privacy has no current signal
  expect(result.G5.coverage_status).toBe('gap');
  expect(result.G9.coverage_status).toBe('gap');
});

test('computeGoalCoverage: matching events count toward goal', () => {
  const now = Date.now();
  const recent = new Date(now - 1000).toISOString();
  const events = [
    { timestamp: recent, trigger_type: 'manual-pull' },
    { timestamp: recent, trigger_type: 'manual-pull' },
    { timestamp: recent, trigger_type: 'manual-pull' },
    { timestamp: recent, trigger_type: 'sensor-driven' },
  ];
  const result = H.computeGoalCoverage(events, now);
  // G1 listens for manual-pull + goal-failure → 3 manual-pull events
  expect(result.G1.count_7d).toBe(3);
  expect(result.G1.coverage_status).toBe('ok');
  // G3 listens for sensor-driven → 1 event
  expect(result.G3.count_7d).toBe(1);
  expect(result.G3.coverage_status).toBe('low');
});

test('computeGoalCoverage: events outside 7d window excluded', () => {
  const now = Date.now();
  const old = new Date(now - 14 * 86400000).toISOString();  // 14 days ago
  const events = [
    { timestamp: old, trigger_type: 'manual-pull' },
    { timestamp: old, trigger_type: 'manual-pull' },
  ];
  const result = H.computeGoalCoverage(events, now);
  expect(result.G1.count_7d).toBe(0);
  expect(result.G1.coverage_status).toBe('gap');
});

test('computeGoalCoverage: 24h subset of 7d', () => {
  const now = Date.now();
  const inDay = new Date(now - 3600000).toISOString();   // 1h ago
  const inWeek = new Date(now - 4 * 86400000).toISOString();  // 4d ago
  const events = [
    { timestamp: inDay, trigger_type: 'manual-pull' },
    { timestamp: inWeek, trigger_type: 'manual-pull' },
  ];
  const result = H.computeGoalCoverage(events, now);
  expect(result.G1.count_24h).toBe(1);
  expect(result.G1.count_7d).toBe(2);
});

test('computeGoalCoverage: ts field accepted as alias for timestamp', () => {
  const now = Date.now();
  const recent = new Date(now - 1000).toISOString();
  const events = [{ ts: recent, trigger_type: 'sensor-driven' }];
  const result = H.computeGoalCoverage(events, now);
  expect(result.G3.count_7d).toBe(1);
});

test('route export matches mounted endpoint', () => {
  expect(H.route).toBe('/api/goal-coverage');
});
