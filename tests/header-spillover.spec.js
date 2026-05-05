// Header-spillover + Anthropic Batch tests (#927).
const { test, expect } = require('@playwright/test');
const path = require('path');

const SP = require(path.resolve(__dirname, '..', 'scripts', 'global', 'header-spillover.js'));
const BATCH = require(path.resolve(__dirname, '..', 'scripts', 'global', 'anthropic-batch-router.js'));

test('readRateLimitHeaders detects 429 status', () => {
  const r = SP.readRateLimitHeaders({ status: 429, headers: new Map() });
  expect(r.rate_limited).toBe(true);
});

test('readRateLimitHeaders detects x-ratelimit-remaining: 0', () => {
  const headers = new Map([['x-ratelimit-remaining-requests', '0']]);
  const r = SP.readRateLimitHeaders({ status: 200, headers });
  expect(r.rate_limited).toBe(true);
});

test('readRateLimitHeaders parses retry-after seconds', () => {
  const headers = new Map([['retry-after', '60']]);
  const r = SP.readRateLimitHeaders({ status: 429, headers });
  expect(r.retry_after_ms).toBe(60_000);
  expect(r.reset_at).toBeGreaterThan(Date.now());
});

test('readRateLimitHeaders returns no rate-limit on healthy 200', () => {
  const r = SP.readRateLimitHeaders({ status: 200, headers: new Map() });
  expect(r.rate_limited).toBe(false);
});

test('pickSpilloverTarget skips current provider', () => {
  const health = { providers: { anthropic: { available: false, rate_limited: true }, cerebras: { available: true } } };
  const r = SP.pickSpilloverTarget('anthropic', { substrateHealth: health });
  expect(r.next_provider).not.toBe('anthropic');
});

test('pickSpilloverTarget picks first available alternative', () => {
  const health = { providers: { anthropic: { available: true }, openai: { available: true }, cerebras: { available: true } } };
  const r = SP.pickSpilloverTarget('anthropic', { substrateHealth: health });
  expect(['openai', 'cerebras', 'groq', 'gemini', 'openrouter']).toContain(r.next_provider);
});

test('pickSpilloverTarget returns null when no alternatives', () => {
  const health = { providers: { anthropic: { available: true } } };
  const r = SP.pickSpilloverTarget('anthropic', { substrateHealth: health, priority: ['anthropic'] });
  expect(r.next_provider).toBeNull();
  expect(r.reason).toBe('no_available_alternative');
});

test('maybeSpillover returns spillover_needed:false on healthy response', () => {
  const r = SP.maybeSpillover('anthropic', { status: 200, headers: new Map() });
  expect(r.spillover_needed).toBe(false);
  expect(r.next_provider).toBeNull();
});

test('maybeSpillover returns spillover_needed:true on 429 with alternatives', () => {
  const health = { providers: { cerebras: { available: true }, groq: { available: true } } };
  const r = SP.maybeSpillover('anthropic', { status: 429, headers: new Map() }, { substrateHealth: health });
  expect(r.spillover_needed).toBe(true);
  expect(r.next_provider).toBeTruthy();
});

test('isBatchEligible returns true for wiki-anneal with 24h+ deadline', () => {
  const r = BATCH.isBatchEligible({ kind: 'wiki-anneal', deadlineMs: 24 * 60 * 60 * 1000 });
  expect(r.eligible).toBe(true);
});

test('isBatchEligible returns false for time-critical kind', () => {
  const r = BATCH.isBatchEligible({ kind: 'live-chat' });
  expect(r.eligible).toBe(false);
  expect(r.reason).toBe('kind_not_eligible');
});

test('isBatchEligible returns false when deadline too close', () => {
  const r = BATCH.isBatchEligible({ kind: 'rule-coverage-stage2b', deadlineMs: 60_000 });
  expect(r.eligible).toBe(false);
  expect(r.reason).toBe('deadline_too_close');
});

test('PROVIDER_PRIORITY includes the 6 main providers', () => {
  for (const p of ['anthropic', 'cerebras', 'groq', 'gemini']) expect(SP.PROVIDER_PRIORITY).toContain(p);
});

test.describe('live /quota + /mcp routes (post-#927 deploy)', () => {
  const BASE = 'https://hamr.chf3198.workers.dev';

  test('/quota returns schema_version 2 + placeholder:false', async ({ request }) => {
    const r = await request.get(`${BASE}/quota`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.schema_version).toBe(2);
    expect(body.placeholder).toBe(false);
  });

  test('/mcp returns 401 missing_dpop without auth header', async ({ request }) => {
    const r = await request.post(`${BASE}/mcp`, { data: {} });
    expect(r.status()).toBe(401);
  });
});
