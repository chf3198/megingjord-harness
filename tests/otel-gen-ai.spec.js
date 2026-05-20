// OpenTelemetry GenAI semantic-conventions tests for #1969.
// Lane: code-change. test_strategy: tdd-pyramid.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const OTEL = require(path.resolve(__dirname, '..', 'scripts', 'global', 'otel-gen-ai-emit.js'));

test('buildGenAiAttributes emits all 5 required gen_ai.* keys', () => {
  const attrs = OTEL.buildGenAiAttributes({
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    operation: 'chat',
    response: { usage: { input_tokens: 123, output_tokens: 45 } },
  });
  expect(attrs['gen_ai.system']).toBe('anthropic');
  expect(attrs['gen_ai.operation.name']).toBe('chat');
  expect(attrs['gen_ai.request.model']).toBe('claude-opus-4-7');
  expect(attrs['gen_ai.usage.input_tokens']).toBe(123);
  expect(attrs['gen_ai.usage.output_tokens']).toBe(45);
});

test('buildGenAiAttributes handles OpenAI-style prompt_tokens/completion_tokens', () => {
  const attrs = OTEL.buildGenAiAttributes({
    provider: 'openai',
    model: 'gpt-5',
    response: { usage: { prompt_tokens: 100, completion_tokens: 50 } },
  });
  expect(attrs['gen_ai.usage.input_tokens']).toBe(100);
  expect(attrs['gen_ai.usage.output_tokens']).toBe(50);
});

test('sanitizeAttribute redacts credential patterns', () => {
  expect(OTEL.sanitizeAttribute('api_key=hunter2hunter2'))
    .toBe('[REDACTED]');
  expect(OTEL.sanitizeAttribute('bearer sk-abc12345def67890'))
    .toMatch(/REDACTED/);
});

test('sanitizeAttribute preserves non-string values', () => {
  expect(OTEL.sanitizeAttribute(123)).toBe(123);
  expect(OTEL.sanitizeAttribute(null)).toBeNull();
  expect(OTEL.sanitizeAttribute(true)).toBe(true);
});

test('emitGenAiEvent writes JSONL and returns attributes', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'otel-test-'));
  const origHome = process.env.HOME;
  process.env.HOME = tmpHome;
  // Re-require to pick up new HOME for the module-level paths.
  delete require.cache[require.resolve('../scripts/global/otel-gen-ai-emit.js')];
  const reloaded = require(path.resolve(__dirname, '..', 'scripts', 'global', 'otel-gen-ai-emit.js'));
  const out = reloaded.emitGenAiEvent({
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    response: { usage: { input_tokens: 10, output_tokens: 5 } },
  });
  expect(out.ok).toBe(true);
  expect(out.attributes['gen_ai.system']).toBe('anthropic');
  const eventsPath = path.join(tmpHome, '.megingjord', 'events.jsonl');
  expect(fs.existsSync(eventsPath)).toBe(true);
  const content = fs.readFileSync(eventsPath, 'utf8');
  expect(content).toMatch(/gen_ai\.system.*anthropic/);
  process.env.HOME = origHome;
});

test('appendJsonl returns false on un-writable path (degraded mode)', () => {
  const result = OTEL.appendJsonl('/proc/1/cannot-write/path.jsonl', { x: 1 });
  expect(result).toBe(false);
});

test('emitWithTiming reports elapsed_ms', () => {
  const out = OTEL.emitWithTiming({
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    response: { usage: { input_tokens: 1, output_tokens: 1 } },
  });
  expect(typeof out.elapsed_ms).toBe('number');
  expect(out.elapsed_ms).toBeGreaterThanOrEqual(0);
});

test('TOKEN_ID_RE matches sk- bearer tokens', () => {
  expect('sk-abc12345defghij').toMatch(OTEL.TOKEN_ID_RE);
  expect('plain-id-no-match').not.toMatch(OTEL.TOKEN_ID_RE);
});
