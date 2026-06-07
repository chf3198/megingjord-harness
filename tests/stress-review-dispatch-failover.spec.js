// Stress spec for the review-dispatch free-cloud failover (#2646, G3).
// Asserts (per test-methodology-matrix): >=1 chaos/fault-injection path (G6) and
// >=1 p99 latency budget (G7). Deterministic — deps are injected, no real network.
const { test, expect } = require('@playwright/test');
const { freeCloudReviewFailover } = require('../scripts/global/review-dispatch-failover');

const noopRecord = () => {};
const ITER = 200;

function p99(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
}

test('chaos (G6): fleet-down → real $0 cross-family verdict on every invocation, no throw', async () => {
  const fcOk = async () => ({ ok: true, content: 'RATING: 90/100\nACCEPT', provider: 'gemini' });
  for (let i = 0; i < ITER; i += 1) {
    const out = await freeCloudReviewFailover('p', { deps: { dispatchFreeCloud: fcOk, recordTelemetry: noopRecord, parseFindings: () => ({ findings: [] }) } });
    expect(out.hamrStats.ok).toBe(true);
    expect(out.hamrStats.tier).toBe('free-cloud');
  }
});

test('chaos (G6): fleet-down AND free-cloud-down → advisory degrade every time, never throws, never paid', async () => {
  const subcases = [
    async () => ({ ok: false, reason: 'no_free_cloud_available', tried: ['gemini:no_key', 'groq:no_key'] }),
    async () => ({ ok: false, reason: 'no_free_cloud_available', tried: ['gemini:provider_error'] }),
    async () => { throw new Error('network partition'); },
  ];
  for (let i = 0; i < ITER; i += 1) {
    const fc = subcases[i % subcases.length];
    const out = await freeCloudReviewFailover('p', { deps: { dispatchFreeCloud: fc, recordTelemetry: noopRecord } });
    expect(out.hamrStats.ok).toBe(false);
    expect(out.hamrStats.degraded).toBe(true);
    expect(out.hamrStats.suggested_tier).toBe('free-cloud'); // advisory, not paid escalation
  }
});

test('p99 (G7): failover-decision latency < 50ms (excludes the provider call itself)', async () => {
  // Inject a zero-cost dispatch so we measure only the decision/classification path.
  const instantFc = async () => ({ ok: true, content: 'RATING: 88/100\nACCEPT', provider: 'gemini' });
  const samples = [];
  for (let i = 0; i < ITER; i += 1) {
    const start = process.hrtime.bigint();
    await freeCloudReviewFailover('p', { deps: { dispatchFreeCloud: instantFc, recordTelemetry: noopRecord, parseFindings: () => ({ findings: [] }) } });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  expect(p99(samples)).toBeLessThan(50);
});
