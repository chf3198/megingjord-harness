const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadStats, withinWindow, aggregate, renderReport, generateReport } = require('../../scripts/global/fleet-hamr-weekly-report.js');

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'fleet-hamr', 'sample-stats.jsonl');

test('loadStats: parses JSONL fixture', () => {
  const stats = loadStats(FIXTURE);
  assert.equal(stats.length, 5);
});

test('loadStats: missing file returns empty', () => {
  assert.deepEqual(loadStats('/tmp/does-not-exist.jsonl'), []);
});

test('withinWindow: 7-day cutoff filters old entries', () => {
  const stats = [{ ts: Date.now() - (10 * 86400000) }, { ts: Date.now() }];
  assert.equal(withinWindow(stats, 7).length, 1);
});

test('aggregate: counts ollama fleet calls correctly', () => {
  const stats = loadStats(FIXTURE);
  const agg = aggregate(stats);
  assert.equal(agg.totalCalls, 5);
  assert.equal(agg.fleetCalls, 3);
  assert.equal(agg.fleetRatio, 0.6);
});

test('aggregate: byProvider includes all providers', () => {
  const stats = loadStats(FIXTURE);
  const agg = aggregate(stats);
  assert.equal(agg.byProvider['ollama'], 3);
  assert.equal(agg.byProvider['anthropic'], 1);
  assert.equal(agg.byProvider['groq'], 1);
});

test('aggregate: byTier includes fleet-local', () => {
  const stats = loadStats(FIXTURE);
  const agg = aggregate(stats);
  assert.equal(agg.byTier['fleet-local'], 3);
});

test('renderReport: produces markdown with Summary section', () => {
  const md = renderReport({ window: 7, aggregate: aggregate(loadStats(FIXTURE)), generatedAt: '2026-05-27T02:00:00Z' });
  assert.match(md, /# Fleet\+HAMR Weekly Compliance Report/);
  assert.match(md, /## Summary/);
  assert.match(md, /Fleet utilization ratio/);
});

test('generateReport: produces non-empty string when fixture provided', () => {
  const report = generateReport({ statsPath: FIXTURE, windowDays: 365 });
  assert.ok(report.length > 100);
});
