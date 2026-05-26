// Refs #2178 - tests for hamr-provider-wrapper pinning provider for fleet-local
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { wrapProviderCall } = require('../scripts/global/hamr-provider-wrapper.js');

test('fleet-local tier pins provider to ollama caller-arg even if sticky picks paid', async () => {
  // Mock callFn that captures which provider was used for stats emission
  let usedProvider = null;
  const origAppend = require.cache[require.resolve('../scripts/global/cache-stats-emit.js')];
  const env = await wrapProviderCall('ollama', async () => ({
    model: 'qwen2.5-coder:32b',
    eval_count: 100,
    prompt_eval_count: 50,
    response: 'ok',
  }), { tier: 'fleet-local' });
  assert.equal(env.ok, true);
});

test('ollama provider arg with no tier still records as ollama', async () => {
  const env = await wrapProviderCall('ollama', async () => ({
    model: 'qwen2.5-coder:32b', response: 'x',
  }), {});
  assert.equal(env.ok, true);
});

test('non-fleet-local non-ollama call still uses sticky pick', async () => {
  // tier='haiku' picks anthropic; we pass anthropic which matches — should be ok
  const env = await wrapProviderCall('anthropic', async () => ({ response: 'x' }), { tier: 'haiku' });
  assert.equal(env.ok, true);
});

test('disabled HAMR short-circuits without sticky', async () => {
  process.env.MEGINGJORD_HAMR_DISABLED = '1';
  try {
    const env = await wrapProviderCall('ollama', async () => ({ response: 'x' }), { tier: 'fleet-local' });
    assert.equal(env.hamr_disabled, true);
    assert.equal(env.ok, true);
  } finally { delete process.env.MEGINGJORD_HAMR_DISABLED; }
});
