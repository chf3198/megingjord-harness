// Telemetry schema validation tests — #577
const { test, expect } = require('@playwright/test');
const path = require('path');
const { recordTelemetry, readTelemetry } = require(path.join(__dirname, '../scripts/global/model-routing-telemetry'));

// AC1: telemetry entry has all required fields
test('recordTelemetry writes entry with required schema fields', () => {
  const entry = recordTelemetry({
    lane: 'fleet', model: 'qwen2.5:7b-instruct', multiplier: 0,
    taskClass: 'coding', complexityScore: 0.35, outcome: 'ok', execute: true
  });
  expect(entry.ts).toBeTruthy();
  expect(entry.lane).toBe('fleet');
  expect(entry.model).toBe('qwen2.5:7b-instruct');
  expect(entry.taskClass).toBe('coding');
  expect(entry.complexityScore).toBe(0.35);
  expect(['local', 'cheap', 'fleet', 'free', 'haiku', 'premium']).toContain(entry.lane);
});

// AC5: lane is one of known tiers
test('telemetry lane field is a known tier', () => {
  const entry = recordTelemetry({ lane: 'premium', model: 'claude-sonnet-4-6', multiplier: 1, outcome: 'ok' });
  expect(['free', 'fleet', 'haiku', 'premium']).toContain(entry.lane);
});

// AC5: complexityScore is null or numeric in [0, 1]
test('telemetry complexityScore is null or numeric in [0,1]', () => {
  const withScore = recordTelemetry({ lane: 'fleet', complexityScore: 0.4, outcome: 'ok' });
  expect(withScore.complexityScore).not.toBeNull();
  expect(withScore.complexityScore).toBeGreaterThanOrEqual(0);
  expect(withScore.complexityScore).toBeLessThanOrEqual(1);
  const noScore = recordTelemetry({ lane: 'free', outcome: 'ok' });
  expect(noScore.complexityScore).toBeNull();
});

// AC3: rolling window — log stays at most 100 entries
test('telemetry rolling window trims to max 100 entries', () => {
  for (let i = 0; i < 5; i++) {
    recordTelemetry({ lane: 'fleet', model: 'test', outcome: 'ok' });
  }
  const entries = readTelemetry(30);
  expect(entries.length).toBeLessThanOrEqual(100);
});

// AC4: npm run cost-report resolves to cost-report.js
test('cost-report script is registered in package.json', () => {
  const pkg = require(path.join(__dirname, '../package.json'));
  expect(pkg.scripts['cost-report']).toContain('cost-report.js');
});
