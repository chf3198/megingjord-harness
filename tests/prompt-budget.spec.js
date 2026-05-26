// Refs #2204 - tests for prompt-budget policy
const test = require('node:test');
const assert = require('node:assert/strict');
const { enforcePromptBudget, modelBudget, estimateTokens, chunkPrompt, loadPolicy } = require('../scripts/global/prompt-budget.js');

const POLICY = loadPolicy();

test('loadPolicy: returns version 1 + models + default', () => {
  assert.equal(POLICY.version, 1);
  assert.ok(POLICY.default);
  assert.ok(POLICY.models);
});

test('modelBudget: qwen2.5-coder:32b returns 32K context', () => {
  const b = modelBudget('qwen2.5-coder:32b', POLICY);
  assert.equal(b.context_tokens, 32768);
});

test('modelBudget: unknown model returns default', () => {
  const b = modelBudget('unknown-model', POLICY);
  assert.deepEqual(b, POLICY.default);
});

test('estimateTokens: ~4 chars per token', () => {
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcdefgh'), 2);
  assert.equal(estimateTokens(''), 0);
});

test('enforcePromptBudget: small prompt passes through', () => {
  const r = enforcePromptBudget({ prompt: 'small prompt', model: 'qwen2.5-coder:32b' });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'pass-through');
});

test('enforcePromptBudget: oversized prompt for small model chunks', () => {
  // gemma3:1b has 6144 prompt_cap; build a 30000-char prompt (~7500 tokens)
  const prompt = 'x'.repeat(30000);
  const r = enforcePromptBudget({ prompt, model: 'gemma3:1b' });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'chunked');
  assert.ok(r.chunks.length >= 2);
});

test('enforcePromptBudget: massive prompt triggers RAG fallback (no chunk attempt)', () => {
  const prompt = 'x'.repeat(100000); // 100K chars > rag.trigger_chars 80K
  const r = enforcePromptBudget({ prompt, model: 'gemma3:1b' });
  assert.equal(r.ok, false);
  assert.equal(r.action, 'rag-fallback');
  assert.match(r.reason, /rag_fallback/);
});

test('chunkPrompt: produces chunks with overlap', () => {
  const chunks = chunkPrompt('a'.repeat(1000), 400, 100);
  assert.ok(chunks.length >= 3);
});

test('chunkPrompt: short prompt returns single chunk', () => {
  const chunks = chunkPrompt('short', 100, 10);
  assert.equal(chunks.length, 1);
});

test('enforcePromptBudget: templateBudget caps the effective budget', () => {
  const prompt = 'x'.repeat(10000); // 2500 tokens
  // With qwen2.5-coder:32b (24576 cap) AND templateBudget 1000, effective cap is 1000
  const r = enforcePromptBudget({ prompt, model: 'qwen2.5-coder:32b', templateBudget: 1000 });
  assert.ok(r.cap === 1000);
});
