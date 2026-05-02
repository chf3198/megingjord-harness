const { test, expect } = require('@playwright/test');
const adapters = require('../scripts/global/token-provider-adapters');

test('anthropic adapter maps usage with exact confidence', () => {
  const r = adapters.anthropic({
    id: 'msg_1', model: 'claude-sonnet-4-6',
    usage: { input_tokens: 12, output_tokens: 9, cache_read_input_tokens: 2, cache_creation_input_tokens: 3 }
  }, { lane: 'premium' });
  expect(r.provider).toBe('anthropic');
  expect(r.total_tokens).toBe(26);
  expect(r.confidence_level).toBe('exact_request');
});

test('openrouter adapter maps usage and cost', () => {
  const r = adapters.openrouter({
    id: 'gen_1', model: 'qwen/qwen3-coder:free', cost: 0.004,
    usage: { prompt_tokens: 30, completion_tokens: 11, reasoning_tokens: 4, cached_tokens: 5, total_tokens: 50 }
  }, { lane: 'fleet' });
  expect(r.provider).toBe('openrouter');
  expect(r.cache_read_tokens).toBe(5);
  expect(r.cost_usd).toBe(0.004);
  expect(r.confidence_level).toBe('exact_request');
});

test('litellm adapter handles partial payloads', () => {
  const r = adapters.litellm({ request_id: 'spend_1', prompt_tokens: 8 }, { lane: 'haiku' });
  expect(r.provider).toBe('litellm');
  expect(r.input_tokens).toBe(8);
  expect(r.output_tokens).toBe(0);
  expect(r.confidence_level).toBe('derived');
});

test('gemini adapter maps usageMetadata fields', () => {
  const r = adapters.gemini({
    responseId: 'resp_1', modelVersion: 'gemini-2.5-pro',
    usageMetadata: { promptTokenCount: 14, candidatesTokenCount: 7, cachedContentTokenCount: 2, thoughtsTokenCount: 1, totalTokenCount: 24 }
  }, { lane: 'premium' });
  expect(r.provider).toBe('gemini');
  expect(r.reasoning_tokens).toBe(1);
  expect(r.total_tokens).toBe(24);
  expect(r.confidence_level).toBe('exact_request');
});

test('ollama adapter maps eval counters', () => {
  const r = adapters.ollama({ id: 'run_1', model: 'qwen2.5-coder:7b', prompt_eval_count: 20, eval_count: 6 }, { lane: 'fleet' });
  expect(r.provider).toBe('ollama');
  expect(r.input_tokens).toBe(20);
  expect(r.output_tokens).toBe(6);
  expect(r.confidence_level).toBe('exact_request');
});
