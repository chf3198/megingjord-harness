// hamr-provider-wrapper tests (#952).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const WRAP = require(path.resolve(__dirname, '..', 'scripts', 'global', 'hamr-provider-wrapper.js'));

test('wrapProviderCall passes cacheHeaders hints to callFn', async () => {
  let received = null;
  const result = await WRAP.wrapProviderCall('anthropic', (hints) => {
    received = hints;
    return { id: 'r1', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 70 } };
  });
  expect(result.ok).toBe(true);
  expect(received.headers['anthropic-beta']).toContain('prompt-caching');
});

test('wrapProviderCall returns spillover decision on rate-limited response', async () => {
  const result = await WRAP.wrapProviderCall('anthropic', () => ({
    status: 429, headers: new Map([['retry-after', '30']]),
    usage: { input_tokens: 0, output_tokens: 0 },
  }));
  expect(result.ok).toBe(true);
  expect(result.spillover.spillover_needed).toBe(true);
});

test('wrapProviderCall returns no-spillover on healthy response', async () => {
  const result = await WRAP.wrapProviderCall('groq', () => ({
    status: 200, headers: new Map(),
    usage: { prompt_tokens: 100, completion_tokens: 50, prompt_cache_hit_tokens: 30 },
  }));
  expect(result.spillover.spillover_needed).toBe(false);
});

test('wrapProviderCall surfaces sticky decision when tier is provided', async () => {
  const result = await WRAP.wrapProviderCall('anthropic', () => ({
    status: 200, headers: new Map(), usage: { input_tokens: 10, output_tokens: 5 },
  }), { tier: 'haiku', previousProvider: 'anthropic' });
  expect(result.sticky).not.toBeNull();
  expect(['anthropic', 'openrouter']).toContain(result.sticky.provider);
});

test('wrapProviderCall obeys MEGINGJORD_HAMR_DISABLED=1 (no-op)', async () => {
  const orig = process.env.MEGINGJORD_HAMR_DISABLED;
  process.env.MEGINGJORD_HAMR_DISABLED = '1';
  try {
    const result = await WRAP.wrapProviderCall('anthropic', () => ({ ok: true }));
    expect(result.hamr_disabled).toBe(true);
    expect(result.spillover).toBeNull();
  } finally {
    if (orig === undefined) delete process.env.MEGINGJORD_HAMR_DISABLED;
    else process.env.MEGINGJORD_HAMR_DISABLED = orig;
  }
});

test('wrapProviderCall catches provider exception and returns ok:false', async () => {
  const result = await WRAP.wrapProviderCall('openai', () => { throw new Error('network down'); });
  expect(result.ok).toBe(false);
  expect(result.error).toContain('network down');
});

test('emitStatSafe writes to cache-stats.jsonl on successful call', async () => {
  const statsFile = path.join(os.homedir(), '.megingjord', 'cache-stats.jsonl');
  const sizeBefore = fs.existsSync(statsFile) ? fs.statSync(statsFile).size : 0;
  await WRAP.wrapProviderCall('cerebras', () => ({
    status: 200, headers: new Map(),
    usage: { prompt_tokens: 1000, completion_tokens: 50, prompt_cache_hit_tokens: 800 },
  }));
  const sizeAfter = fs.existsSync(statsFile) ? fs.statSync(statsFile).size : 0;
  expect(sizeAfter).toBeGreaterThan(sizeBefore);
});
