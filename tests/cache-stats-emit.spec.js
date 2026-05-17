// cache-stats-emit tests (#932).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const EMIT = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cache-stats-emit.js'));
const GATE = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cache-hit-gate.js'));

function tmpFile() { return path.join(os.tmpdir(), `cache-stats-emit-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`); }

test('appendCacheStat writes valid JSONL with normalized schema', () => {
  const file = tmpFile();
  const r = EMIT.appendCacheStat({ provider: 'anthropic', model: 'opus-4', cache_read_tokens: 700, input_tokens: 1000, output_tokens: 50 }, { file });
  expect(r.ok).toBe(true);
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  expect(lines).toHaveLength(1);
  const parsed = JSON.parse(lines[0]);
  expect(parsed).toMatchObject({ provider: 'anthropic', model: 'opus-4', cache_read_tokens: 700, input_tokens: 1000, output_tokens: 50 });
  expect(typeof parsed.ts).toBe('number');
  fs.unlinkSync(file);
});

test('appendCacheStat throws on missing provider', () => {
  expect(() => EMIT.appendCacheStat({ cache_read_tokens: 100 })).toThrow(/provider required/);
});

test('appendCacheStat appends multiple records', () => {
  const file = tmpFile();
  EMIT.appendCacheStat({ provider: 'groq', cache_read_tokens: 100, input_tokens: 200 }, { file });
  EMIT.appendCacheStat({ provider: 'cerebras', cache_read_tokens: 50, input_tokens: 100 }, { file });
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  expect(lines).toHaveLength(2);
  fs.unlinkSync(file);
});

test('appendCacheStat skips non-informative zero-token records', () => {
  const file = tmpFile();
  const r = EMIT.appendCacheStat({ provider: 'litellm', cache_read_tokens: 0, input_tokens: 0, output_tokens: 0 }, { file });
  expect(r.ok).toBe(false);
  expect(r.skipped).toBe(true);
  expect(fs.existsSync(file)).toBe(false);
});

test('fromTokenRecord converts adapter output to cache-stat shape', () => {
  const tokenRecord = { provider: 'openai', model: 'gpt-5', cache_read_tokens: 400, input_tokens: 800, output_tokens: 100 };
  const stat = EMIT.fromTokenRecord(tokenRecord);
  expect(stat).toMatchObject({ provider: 'openai', model: 'gpt-5', cache_read_tokens: 400, input_tokens: 800, output_tokens: 100 });
  expect(typeof stat.ts).toBe('number');
});

test('fromTokenRecord returns null on missing provider', () => {
  expect(EMIT.fromTokenRecord({ cache_read_tokens: 100 })).toBeNull();
  expect(EMIT.fromTokenRecord(null)).toBeNull();
});

test('emitted records flow into cache-hit-gate without modification', () => {
  const file = tmpFile();
  EMIT.appendCacheStat({ provider: 'gemini', cache_read_tokens: 800, input_tokens: 1000 }, { file });
  EMIT.appendCacheStat({ provider: 'gemini', cache_read_tokens: 850, input_tokens: 1000 }, { file });
  const r = GATE.runGate({ file, floor: 0.80, now: Date.now() });
  expect(r.passed).toBe(true);
  expect(r.hit_rate).toBeCloseTo(0.825, 3);
  fs.unlinkSync(file);
});

test('emit + gate detect below-floor scenario', () => {
  const file = tmpFile();
  EMIT.appendCacheStat({ provider: 'openrouter', cache_read_tokens: 100, input_tokens: 1000 }, { file });
  const r = GATE.runGate({ file, floor: 0.80, now: Date.now() });
  expect(r.passed).toBe(false);
  expect(r.alert).toContain('below_floor');
  fs.unlinkSync(file);
});
