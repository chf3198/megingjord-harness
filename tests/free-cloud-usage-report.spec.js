// #2624: free-cloud usage report — surfaces lane:free-cloud executions + paid-spend avoided.
const { test, expect } = require('@playwright/test');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = require(path.join(ROOT, 'scripts', 'global', 'free-cloud-usage-report.js'));

const now = () => new Date().toISOString();

test('buildReport aggregates free-cloud rows: count, per-provider, paid-avoided, latency', () => {
  const entries = [
    { lane: 'free-cloud', model: 'gemini', outcome: 'ok', latencyMs: 1200, ts: now() },
    { lane: 'free-cloud', model: 'gemini', outcome: 'ok', latencyMs: 800, ts: now() },
    { lane: 'free-cloud', model: 'openrouter-free', outcome: 'ok', latencyMs: 2000, ts: now() },
    { lane: 'fleet', model: 'qwen2.5-coder', outcome: 'ok', latencyMs: 50, ts: now() }, // ignored
    { lane: 'haiku', model: 'balanced-cloud', outcome: 'ok', ts: now() },               // ignored
  ];
  const r = REPORT.buildReport(7, entries);
  expect(r.free_cloud_executions).toBe(3);
  expect(r.paid_haiku_calls_avoided).toBe(3); // each free-cloud execution = one paid-Haiku call avoided
  expect(r.per_provider).toEqual({ gemini: 2, 'openrouter-free': 1 });
  expect(r.avg_latency_ms).toBe(1333); // round((1200+800+2000)/3)
  expect(r.est_paid_usd_avoided).toBeGreaterThan(0);
});

test('buildReport handles latency-less rows and supports legacy latency_ms field', () => {
  const entries = [
    { lane: 'free-cloud', model: 'groq', outcome: 'ok', latency_ms: 600, ts: now() }, // snake_case
    { lane: 'free-cloud', model: 'groq', outcome: 'ok', ts: now() },                   // no latency
  ];
  const r = REPORT.buildReport(7, entries);
  expect(r.free_cloud_executions).toBe(2);
  expect(r.per_provider.groq).toBe(2);
  expect(r.avg_latency_ms).toBe(600); // only the one with a latency value is averaged
});

test('buildReport is graceful on empty telemetry (zero report, no crash)', () => {
  const r = REPORT.buildReport(7, []);
  expect(r.free_cloud_executions).toBe(0);
  expect(r.paid_haiku_calls_avoided).toBe(0);
  expect(r.per_provider).toEqual({});
  expect(r.avg_latency_ms).toBeNull();
  expect(r.est_paid_usd_avoided).toBe(0);
});

test('formatReport renders human-readable text with the key fields', () => {
  const text = REPORT.formatReport(REPORT.buildReport(7, [
    { lane: 'free-cloud', model: 'gemini', outcome: 'ok', latencyMs: 1000, ts: now() },
  ]));
  expect(text).toContain('Free-cloud usage (last 7d)');
  expect(text).toContain('executions: 1');
  expect(text).toContain('paid $ avoided');
});
