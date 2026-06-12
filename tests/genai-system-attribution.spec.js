const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { emitStatSafe } = require('../scripts/global/hamr-provider-wrapper.js');
const { appendCacheStat } = require('../scripts/global/cache-stats-emit.js');

// P1-5 (#2232): gen_ai.system attribution end-to-end through emitStatSafe + appendCacheStat.

function tmpStats() {
  return path.join(os.tmpdir(), `cs-2232-${process.pid}-${Math.floor(performance.now() * 1000)}.jsonl`);
}
function lastLine(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  return JSON.parse(lines[lines.length - 1]);
}

test('emitStatSafe: AC1/AC5 sets gen_ai.system + retains raw provider (groq -> other_system)', () => {
  const file = tmpStats();
  emitStatSafe('groq', { usage: { prompt_tokens: 5, completion_tokens: 3 } }, { file });
  const rec = lastLine(file);
  assert.equal(rec['gen_ai.system'], 'other_system');
  assert.equal(rec.provider, 'groq'); // raw provider preserved alongside the semconv value
  fs.unlinkSync(file);
});

test('emitStatSafe: AC5 identity provider keeps its system (anthropic)', () => {
  const file = tmpStats();
  emitStatSafe('anthropic', { usage: { input_tokens: 7, output_tokens: 2 } }, { file });
  assert.equal(lastLine(file)['gen_ai.system'], 'anthropic');
  fs.unlinkSync(file);
});

test('emitStatSafe: AC5 unknown provider with no adapter is a safe no-op (no throw)', () => {
  const file = tmpStats();
  assert.doesNotThrow(() => emitStatSafe('mystery-no-adapter', { usage: {} }, { file }));
  assert.equal(fs.existsSync(file), false); // no adapter -> nothing written
});

test('appendCacheStat: AC4 additive — gen_ai.system written when present', () => {
  const file = tmpStats();
  appendCacheStat({ provider: 'openai', input_tokens: 4, 'gen_ai.system': 'openai' }, { file });
  assert.equal(lastLine(file)['gen_ai.system'], 'openai');
  fs.unlinkSync(file);
});

test('appendCacheStat: AC4 backward-compat — no gen_ai.system key when caller omits it', () => {
  const file = tmpStats();
  appendCacheStat({ provider: 'openai', input_tokens: 4 }, { file });
  assert.equal(Object.prototype.hasOwnProperty.call(lastLine(file), 'gen_ai.system'), false);
  fs.unlinkSync(file);
});
