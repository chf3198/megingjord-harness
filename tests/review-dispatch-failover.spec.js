// Unit tests for the review-dispatch free-cloud failover (#2646, G3).
// Covers: AC1 availability-vs-capability (failover ONLY on availability fail),
// AC2 cross-family substituted-reviewer tagging, AC5 the 3 free-cloud-down sub-cases,
// AC6 fleet-up backward-compat (no substitution), AC7 idempotency (one dispatch).
const { test, expect } = require('@playwright/test');
const { freeCloudReviewFailover, classifyDegradation } = require('../scripts/global/review-dispatch-failover');
const { dispatchRedTeam } = require('../scripts/global/fleet-red-team-dispatch');

const noopRecord = () => {};
const okFleet = async () => ({ ok: true, value: { response: 'RATING: 80/100\nACCEPT: adequate review body exceeding fifty characters easily.' } });
const downFleet = async () => ({ ok: false, meta: { error: 'ECONNREFUSED' } });
const fcOk = async () => ({ ok: true, content: 'RATING: 95/100\nACCEPT: real cross-family verdict.', provider: 'gemini' });

test('classifyDegradation maps each free-cloud-down sub-case (AC5)', () => {
  expect(classifyDegradation({ reason: 'no_free_cloud_available', tried: ['gemini:no_key', 'groq:no_key'] })).toBe('free-cloud-unconfigured');
  expect(classifyDegradation({ tried: ['gemini:timeout'] })).toBe('free-cloud-timeout');
  expect(classifyDegradation({ tried: ['gemini:provider_error', 'groq:empty_response'] })).toBe('free-cloud-exhausted');
  expect(classifyDegradation({ reason: 'no_prompt' })).toBe('free-cloud-no-prompt');
});

test('failover SUCCESS returns a substituted cross-family envelope (AC2) + records telemetry (AC4)', async () => {
  let recorded = null;
  const out = await freeCloudReviewFailover('prompt', {
    deps: { dispatchFreeCloud: fcOk, recordTelemetry: (entry) => { recorded = entry; },
      parseFindings: (raw) => ({ findings: [{ raw: raw.response.split('\n')[1] }] }), now: () => 0 },
  });
  expect(out.hamrStats.ok).toBe(true);
  expect(out.hamrStats.substituted).toBe(true);
  expect(out.modelUsed).toBe('free-cloud:gemini');
  expect(out.hamrStats.substitution_reason).toBe('fleet-unreachable');
  expect(out.hamrStats.tier).toBe('free-cloud');
  expect(recorded.lane).toBe('free-cloud');
});

test('failover DEGRADED is advisory, never throws, never escalates to paid (AC5)', async () => {
  for (const fc of [
    async () => ({ ok: false, reason: 'no_free_cloud_available', tried: ['gemini:no_key'] }),
    async () => { throw new Error('boom'); },
  ]) {
    const out = await freeCloudReviewFailover('p', { deps: { dispatchFreeCloud: fc, recordTelemetry: noopRecord }, fallbackModel: 'qwen' });
    expect(out.hamrStats.ok).toBe(false);
    expect(out.hamrStats.degraded).toBe(true);
    expect(out.hamrStats.suggested_tier).toBe('free-cloud');
    expect(out.findings).toEqual([]);
  }
});

test('failover calls dispatchFreeCloud exactly once (AC7 idempotency)', async () => {
  let calls = 0;
  await freeCloudReviewFailover('p', { deps: { dispatchFreeCloud: async () => { calls += 1; return fcOk(); }, recordTelemetry: noopRecord, parseFindings: () => ({ findings: [] }) } });
  expect(calls).toBe(1);
});

test('dispatchRedTeam: fleet AVAILABILITY failure fails over to free-cloud (AC1)', async () => {
  const out = await dispatchRedTeam({
    artifactType: 'collaborator-handoff', content: 'x', model: 'qwen2.5-coder:7b',
    // #3333: stub the bounded reachability probe as UP so this exercises the
    // wrap-level availability-failure path (not the probe path) and stays hermetic in CI.
    deps: { dispatchGet: async () => ({ ok: true }), wrapProviderCall: downFleet, freeCloud: { dispatchFreeCloud: fcOk, recordTelemetry: noopRecord } },
  });
  expect(out.hamrStats.substituted).toBe(true);
  expect(out.modelUsed).toBe('free-cloud:gemini');
});

test('dispatchRedTeam: CAPABILITY failure does NOT fail over; fleet-up is unchanged (AC1/AC6)', async () => {
  const out = await dispatchRedTeam({
    artifactType: 'collaborator-handoff', content: 'x', model: 'qwen2.5-coder:7b',
    // #3333: probe UP so capability-failure path is tested without a live fleet host.
    deps: { dispatchGet: async () => ({ ok: true }), wrapProviderCall: okFleet, freeCloud: { dispatchFreeCloud: async () => { throw new Error('must not be called'); } } },
  });
  expect(out.hamrStats.ok).toBe(true);
  expect(out.hamrStats.substituted).toBeUndefined();
  expect(out.modelUsed).toBe('qwen2.5-coder:7b');
});
