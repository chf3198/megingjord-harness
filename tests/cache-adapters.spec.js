// Cache-hit-gate + sticky-route + provider-adapter tests (#926).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ADAPTERS = require(path.resolve(__dirname, '..', 'scripts', 'global', 'token-provider-adapters.js'));
const GATE = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cache-hit-gate.js'));
const STICKY = require(path.resolve(__dirname, '..', 'scripts', 'global', 'sticky-route.js'));
const LLM = require(path.resolve(__dirname, '..', 'scripts', 'global', 'litellm-client.js'));

test('all 9 providers have token adapters', () => {
  for (const p of ['anthropic', 'openrouter', 'litellm', 'gemini', 'ollama', 'copilot', 'openai', 'groq', 'cerebras']) {
    expect(typeof ADAPTERS[p]).toBe('function');
  }
});

test('openai/groq/cerebras adapters extract cache-read-tokens', () => {
  const oai = ADAPTERS.openai({ id: 'r1', model: 'gpt-5', usage: { prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 700 } } });
  expect(oai.cache_read_tokens).toBe(700);
  const groq = ADAPTERS.groq({ id: 'r2', usage: { prompt_tokens: 500, prompt_cache_hit_tokens: 400 } });
  expect(groq.cache_read_tokens).toBe(400);
  const cer = ADAPTERS.cerebras({ id: 'r3', usage: { prompt_tokens: 800, prompt_cache_hit_tokens: 600 } });
  expect(cer.cache_read_tokens).toBe(600);
});

test('cacheHeaders covers anthropic + gemini + OAI-shape providers', () => {
  expect(LLM.cacheHeaders('anthropic').headers['anthropic-beta']).toContain('prompt-caching-2024-07-31');
  const gem = LLM.cacheHeaders('gemini', { ttlSeconds: 600, cacheKey: 'cache-abc' });
  expect(gem.bodyExtras).toMatchObject({ cachedContent: 'cache-abc', ttl: '600s' });
  for (const p of ['groq', 'cerebras', 'openai']) {
    expect(LLM.cacheHeaders(p, { ttlSeconds: 1800 }).headers['x-cache-control']).toBe('max-age=1800');
  }
});

test('computeHitRate handles empty + populated + windowed records', () => {
  const now = Date.now();
  expect(GATE.computeHitRate([], { now }).hit_rate).toBeNull();
  const r1 = GATE.computeHitRate([
    { ts: now - 1000, cache_read_tokens: 800, input_tokens: 1000 },
    { ts: now - 2000, cache_read_tokens: 600, input_tokens: 1000 },
  ], { now });
  expect(r1.hit_rate).toBeCloseTo(0.7, 2);
  const r2 = GATE.computeHitRate([
    { ts: now - 1000, cache_read_tokens: 800, input_tokens: 1000 },
    { ts: now - 30 * 24 * 60 * 60 * 1000, cache_read_tokens: 0, input_tokens: 1000 },
  ], { now });
  expect(r2.sample_count).toBe(1);
});

test('runGate pass/fail vs floor with tmp file', () => {
  const now = Date.now();
  const fail = path.join(os.tmpdir(), `cs-${now}-fail.jsonl`);
  fs.writeFileSync(fail, JSON.stringify({ ts: now - 1000, cache_read_tokens: 100, input_tokens: 1000 }) + '\n');
  const fr = GATE.runGate({ file: fail, floor: 0.80, now });
  fs.unlinkSync(fail);
  expect(fr.passed).toBe(false);
  expect(fr.alert).toContain('below_floor');
  const ok = path.join(os.tmpdir(), `cs-${now}-ok.jsonl`);
  fs.writeFileSync(ok, JSON.stringify({ ts: now - 1000, cache_read_tokens: 900, input_tokens: 1000 }) + '\n');
  const okR = GATE.runGate({ file: ok, floor: 0.80, now });
  fs.unlinkSync(ok);
  expect(okR.passed).toBe(true);
  expect(okR.alert).toBeNull();
});

test('pickStickyProvider returns previous provider when healthy', () => {
  const r = STICKY.pickStickyProvider('fleet', { previousProvider: 'groq', substrateHealth: { providers: { groq: { available: true } } } });
  expect(r).toMatchObject({ provider: 'groq', sticky: true });
});

test('pickStickyProvider falls back when previous unhealthy', () => {
  const r = STICKY.pickStickyProvider('fleet', { previousProvider: 'groq',
    substrateHealth: { providers: { groq: { available: false }, cerebras: { available: true } } } });
  expect(r.provider).toBe('cerebras');
  expect(r.reason).toContain('fallback_from_groq');
});

test('pickStickyProvider first-pick + null when none healthy', () => {
  expect(STICKY.pickStickyProvider('premium', { substrateHealth: { providers: { anthropic: { available: true } } } }).provider).toBe('anthropic');
  expect(STICKY.pickStickyProvider('premium',
    { substrateHealth: { providers: { anthropic: { available: false }, openai: { available: false }, openrouter: { available: false } } } }).provider).toBeNull();
});

test('TIER_PROVIDER_MAP covers free/fleet/haiku/premium', () => {
  for (const t of ['free', 'fleet', 'haiku', 'premium']) {
    expect(Array.isArray(STICKY.TIER_PROVIDER_MAP[t])).toBe(true);
    expect(STICKY.TIER_PROVIDER_MAP[t].length).toBeGreaterThan(0);
  }
});
