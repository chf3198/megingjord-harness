// Stress test for OTel GenAI emit per #1969 AC4.
// Asserts p99 emission overhead ≤5ms per call across 1000 iterations.
// Stress strategy: chaos = bad-input fixtures, perf = p99 budget.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ITERATIONS = 1000;
const P99_BUDGET_MS = 5;

test('p99 emit overhead under ITERATIONS=1000 stays below P99_BUDGET_MS', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'otel-stress-'));
  const origHome = process.env.HOME;
  process.env.HOME = tmpHome;
  delete require.cache[require.resolve('../scripts/global/otel-gen-ai-emit.js')];
  const OTEL = require(path.resolve(__dirname, '..', 'scripts', 'global', 'otel-gen-ai-emit.js'));
  const samples = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const out = OTEL.emitWithTiming({
      provider: 'anthropic',
      model: 'claude-opus-4-7',
      operation: 'chat',
      response: { usage: { input_tokens: 100, output_tokens: 50 } },
    });
    samples.push(out.elapsed_ms);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  process.env.HOME = origHome;
  expect(p99).toBeLessThanOrEqual(P99_BUDGET_MS);
});

test('chaos: malformed response objects do not throw', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'otel-chaos-'));
  process.env.HOME = tmpHome;
  delete require.cache[require.resolve('../scripts/global/otel-gen-ai-emit.js')];
  const OTEL = require(path.resolve(__dirname, '..', 'scripts', 'global', 'otel-gen-ai-emit.js'));
  const cases = [
    {},
    { provider: null },
    { provider: 'x', response: null },
    { provider: 'x', response: { usage: null } },
    { provider: 'x', response: { usage: {} } },
    { provider: 'x', model: undefined, response: { usage: { input_tokens: 'NaN' } } },
  ];
  for (const c of cases) {
    expect(() => OTEL.emitGenAiEvent(c)).not.toThrow();
  }
});

test('credential leak chaos: hostile model strings sanitised', () => {
  delete require.cache[require.resolve('../scripts/global/otel-gen-ai-emit.js')];
  const OTEL = require(path.resolve(__dirname, '..', 'scripts', 'global', 'otel-gen-ai-emit.js'));
  const attrs = OTEL.buildGenAiAttributes({
    provider: 'anthropic',
    model: 'gpt-5 api_key=hunter2hunter2 secret: bearer-xyz98765',
  });
  expect(attrs['gen_ai.request.model']).toMatch(/REDACTED/);
});
