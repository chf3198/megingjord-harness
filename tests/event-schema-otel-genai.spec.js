const test = require('node:test');
const assert = require('node:assert/strict');
const { providerToGenAiSystem, OTEL_GENAI_SYSTEMS, isValidGenAI } = require('../scripts/global/event-schema-otel-genai.js');

// --- P1-5 (#2232) providerToGenAiSystem ---

test('providerToGenAiSystem: AC2 identity for valid semconv systems', () => {
  for (const sys of ['anthropic', 'openai', 'gemini', 'ollama', 'cohere', 'vertex_ai', 'bedrock']) {
    assert.equal(providerToGenAiSystem(sys), sys, `${sys} should map to itself`);
  }
});

test('providerToGenAiSystem: AC2 non-semconv providers -> other_system', () => {
  for (const provider of ['openrouter', 'litellm', 'copilot', 'groq', 'cerebras']) {
    assert.equal(providerToGenAiSystem(provider), 'other_system', `${provider} -> other_system`);
  }
});

test('providerToGenAiSystem: AC2 unknown/empty/undefined -> other_system', () => {
  assert.equal(providerToGenAiSystem('zzz-unknown'), 'other_system');
  assert.equal(providerToGenAiSystem(''), 'other_system');
  assert.equal(providerToGenAiSystem(undefined), 'other_system');
  assert.equal(providerToGenAiSystem(null), 'other_system');
});

test('providerToGenAiSystem: AC3 result is ALWAYS a valid OTEL_GENAI_SYSTEMS value', () => {
  const providers = ['anthropic', 'openai', 'gemini', 'ollama', 'openrouter', 'litellm',
    'copilot', 'groq', 'cerebras', 'cohere', 'vertex_ai', 'bedrock', 'mystery-provider', '', undefined];
  for (const provider of providers) {
    assert.ok(OTEL_GENAI_SYSTEMS.includes(providerToGenAiSystem(provider)),
      `providerToGenAiSystem(${provider}) must be in OTEL_GENAI_SYSTEMS`);
  }
});

test('isValidGenAI: accepts a mapped gen_ai.system value', () => {
  assert.equal(isValidGenAI({ 'gen_ai.system': providerToGenAiSystem('groq') }).ok, true);
});

test('isValidGenAI: rejects a raw non-semconv provider as gen_ai.system', () => {
  assert.equal(isValidGenAI({ 'gen_ai.system': 'groq' }).ok, false);
});
