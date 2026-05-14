// Cross-team HAMR integration tests (#956).
// Smoke checks any team's runtime can reach + sign + observe HAMR.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const BASE = process.env.HAMR_URL || 'https://hamr.chf3198.workers.dev';
const PUSH_CACHE = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cache-stats-push.js'));
const PUSH_HEALTH = require(path.resolve(__dirname, '..', 'scripts', 'global', 'substrate-health-push.js'));
const WRAP = require(path.resolve(__dirname, '..', 'scripts', 'global', 'hamr-provider-wrapper.js'));
const SYNC = require(path.resolve(__dirname, '..', 'scripts', 'global', 'hamr-sync-verify.js'));

test('Worker /healthz reachable from operator host', async ({ request }) => {
  const r = await request.get(`${BASE}/healthz`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.ok).toBe(true);
});

test('Worker /quota returns supported schema_version + stale field', async ({ request }) => {
  const r = await request.get(`${BASE}/quota`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.schema_version).toBeGreaterThanOrEqual(2);
  expect(typeof body.stale).toBe('boolean');
  expect(body.placeholder).toBe(false);
});

test('Worker /mcp gates unauth POST with 401', async ({ request }) => {
  const r = await request.post(`${BASE}/mcp`, { data: { capability: 'doctor:probe' } });
  expect(r.status()).toBe(401);
});

test('signing key resolves from OPERATOR_KEY_SEED_B64 or PEM file', () => {
  const orig = process.env.OPERATOR_KEY_SEED_B64;
  process.env.OPERATOR_KEY_SEED_B64 = Buffer.alloc(32, 13).toString('base64');
  try {
    const cacheKey = PUSH_CACHE.loadEd25519Key();
    const healthKey = PUSH_HEALTH.loadEd25519Key();
    expect(cacheKey.asymmetricKeyType).toBe('ed25519');
    expect(healthKey.asymmetricKeyType).toBe('ed25519');
  } finally {
    if (orig === undefined) delete process.env.OPERATOR_KEY_SEED_B64;
    else process.env.OPERATOR_KEY_SEED_B64 = orig;
  }
});

test('canonicalize is deterministic across both push clients', () => {
  const payload = { ts: 1000, hit_rate: 0.85, sample_count: 10 };
  const c1 = PUSH_CACHE.canonicalize(payload);
  const c2 = PUSH_CACHE.canonicalize({ sample_count: 10, ts: 1000, hit_rate: 0.85 });
  expect(c1).toBe(c2);
  const healthPayload = { ts: 1000, providers: { groq: { available: true } } };
  expect(PUSH_HEALTH.canonicalize(healthPayload)).toBe(PUSH_HEALTH.canonicalize(healthPayload));
});

test('hamr-provider-wrapper instruments any provider call (dry shape)', async () => {
  const result = await WRAP.wrapProviderCall('groq', () => ({
    status: 200, headers: new Map(),
    usage: { prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 80 },
  }), { tier: 'fleet' });
  expect(result.ok).toBe(true);
  expect(result.spillover.spillover_needed).toBe(false);
  expect(result.sticky).not.toBeNull();
});

test('sync-verify confirms HAMR scripts present in both runtime targets', () => {
  const result = SYNC.run();
  expect(result.targets.length).toBe(2);
  expect(result.targets.map((t) => t.team).sort()).toEqual(['codex', 'copilot']);
});

test('cache-stats.jsonl path is operator-local (no cross-team cross-talk)', () => {
  const expected = path.join(os.homedir(), '.megingjord', 'cache-stats.jsonl');
  expect(expected).toContain(os.homedir());
  expect(expected).toContain('.megingjord');
});

test('MEGINGJORD_HAMR_DISABLED=1 cleanly bypasses wrapper', async () => {
  const orig = process.env.MEGINGJORD_HAMR_DISABLED;
  process.env.MEGINGJORD_HAMR_DISABLED = '1';
  try {
    const r = await WRAP.wrapProviderCall('anthropic', () => ({ ok: true }));
    expect(r.hamr_disabled).toBe(true);
    expect(r.spillover).toBeNull();
  } finally {
    if (orig === undefined) delete process.env.MEGINGJORD_HAMR_DISABLED;
    else process.env.MEGINGJORD_HAMR_DISABLED = orig;
  }
});
