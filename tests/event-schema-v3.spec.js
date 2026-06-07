// Event schema v3 — contract tests (#1353, Epic #1339 C2).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const S = require(path.resolve(__dirname, '..', 'scripts', 'global', 'event-schema-v3.js'));

const minimalV3 = () => ({
  version: 3, ts: '2026-05-11T18:00:00.000Z', service: 'test',
  env: 'test', event: 'unit', trace_id: 'trace-1', session_id: 'session-1',
});
const tmpfile = (suffix) => path.join(os.tmpdir(), `event-schema-v3-${suffix}-${Date.now()}.jsonl`);

test('detectVersion: handles v1 (no version), v2, v3', () => {
  expect(S.detectVersion({ timestamp: 't' })).toBe(1);
  expect(S.detectVersion({ version: 2 })).toBe(2);
  expect(S.detectVersion({ version: 3 })).toBe(3);
});

test('isValidV3: minimal valid passes; missing required fails', () => {
  expect(S.isValidV3(minimalV3()).ok).toBe(true);
  const e = minimalV3(); delete e.service;
  const r = S.isValidV3(e);
  expect(r.ok).toBe(false);
  expect(r.errors.some(x => x.includes('service'))).toBe(true);
});

test('isValidV3: env enum + _summary length enforced', () => {
  const e = minimalV3(); e.env = 'production';
  expect(S.isValidV3(e).errors.some(x => x.includes('env'))).toBe(true);
  e.env = 'test'; e._summary = 'x'.repeat(201);
  expect(S.isValidV3(e).errors.some(x => x.includes('_summary'))).toBe(true);
});

test('upgradeToV3: v1 event upgrades with defaults; preserves v1 fields', () => {
  const v1 = { timestamp: '2026-05-11T00:00:00.000Z', pattern_id: 'p-1' };
  const v3 = S.upgradeToV3(v1, { service: 'sensor', event: 'detect' });
  expect(v3.version).toBe(3);
  expect(v3.ts).toBe('2026-05-11T00:00:00.000Z');
  expect(v3.service).toBe('sensor');
  expect(v3.pattern_id).toBe('p-1');
});

test('upgradeToV3: v2 anneal preserves tier/trigger_role/severity', () => {
  const v2 = {
    version: 2, timestamp: '2026-05-11T00:00:00.000Z',
    tier: 2, trigger_role: 'collaborator', trigger_type: 'manual-pull',
    severity: 'high', pattern_id: 'p-x',
  };
  const v3 = S.upgradeToV3(v2, { service: 'anneal', event: 'pivot-start' });
  expect(v3.version).toBe(3);
  expect(v3.tier).toBe(2);
  expect(v3.trigger_role).toBe('collaborator');
  expect(v3.severity).toBe('high');
});

test('normalize: v3 passes through unchanged', () => {
  const v3 = minimalV3();
  expect(S.normalize(v3)).toBe(v3);
});

test('isOtelGenAI: gen_ai.* attributes detected, otherwise false', () => {
  expect(S.isOtelGenAI({ ...minimalV3(), 'gen_ai.system': 'anthropic' })).toBe(true);
  expect(S.isOtelGenAI(minimalV3())).toBe(false);
});

test('emitV3 + readEvents round-trip', () => {
  const f = tmpfile('rt');
  S.emitV3(minimalV3(), f);
  const read = S.readEvents(f);
  expect(read).toHaveLength(1);
  expect(read[0].event).toBe('unit');
  fs.unlinkSync(f);
});

test('readEvents: mixed v1/v2/v3 feed normalizes all to v3', () => {
  const f = tmpfile('mixed');
  fs.writeFileSync(f, [
    JSON.stringify({ timestamp: '2026-05-11T00:00:00.000Z', pattern_id: 'p1' }),
    JSON.stringify({ version: 2, timestamp: '2026-05-11T01:00:00.000Z', tier: 1, trigger_role: 'system' }),
    JSON.stringify(minimalV3()),
  ].join('\n') + '\n');
  const read = S.readEvents(f, { service: 'mixed', event: 'legacy' });
  expect(read).toHaveLength(3);
  expect(read.every(e => e.version === 3)).toBe(true);
  expect(read[0].pattern_id).toBe('p1');
  expect(read[1].tier).toBe(1);
  fs.unlinkSync(f);
});

test('emitV3: invalid event throws', () => {
  expect(() => S.emitV3({ version: 3, ts: 't' }, tmpfile('inv'))).toThrow(/Invalid v3/);
});

// --- OTel GenAI conformance tests (AC5, #1375) ---

test('isValidGenAI: valid Anthropic event passes', () => {
  const ev = { 'gen_ai.system': 'anthropic', 'gen_ai.request.model': 'claude-3-haiku', 'gen_ai.usage.input_tokens': 100, 'gen_ai.usage.output_tokens': 50 };
  const r = S.isValidGenAI(ev);
  expect(r.ok).toBe(true);
  expect(r.errors).toHaveLength(0);
});

test('isValidGenAI: valid OpenAI event passes', () => {
  const ev = { 'gen_ai.system': 'openai', 'gen_ai.request.model': 'gpt-4o', 'gen_ai.usage.input_tokens': 200 };
  expect(S.isValidGenAI(ev).ok).toBe(true);
});

test('isValidGenAI: invalid system enum fails with error', () => {
  const r = S.isValidGenAI({ 'gen_ai.system': 'wrong-format' });
  expect(r.ok).toBe(false);
  expect(r.errors[0]).toMatch(/unrecognized value/);
});

test('isValidGenAI: non-integer usage.input_tokens fails', () => {
  const r = S.isValidGenAI({ 'gen_ai.system': 'anthropic', 'gen_ai.usage.input_tokens': '100' });
  expect(r.ok).toBe(false);
  expect(r.errors[0]).toMatch(/non-negative integer/);
});

test('isValidGenAI: missing model field is OK (optional)', () => {
  const r = S.isValidGenAI({ 'gen_ai.system': 'ollama' });
  expect(r.ok).toBe(true);
  expect(r.errors).toHaveLength(0);
});

test('isValidGenAI: no gen_ai.* fields returns ok with warning', () => {
  const r = S.isValidGenAI({ event: 'test', version: 3 });
  expect(r.ok).toBe(true);
  expect(r.warnings[0]).toMatch(/no gen_ai/);
});

test('isValidGenAI: null input returns graceful ok+warning', () => {
  const r = S.isValidGenAI(null);
  expect(r.ok).toBe(true);
  expect(r.warnings.length).toBeGreaterThan(0);
});

