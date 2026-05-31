const test = require('node:test');
const assert = require('node:assert');
const { benchHostModel, percentile, CANONICAL_PROMPT, DEFAULT_SAMPLES } =
  require('../scripts/global/fleet-profile-bench');

test('percentile: median of [1,2,3] is 2', () => {
  assert.strictEqual(percentile([1, 2, 3], 0.5), 2);
});

test('percentile: empty returns 0', () => {
  assert.strictEqual(percentile([], 0.5), 0);
});

test('percentile: p99 of 100-item array returns near-max', () => {
  const arr = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.ok(percentile(arr, 0.99) >= 99);
});

test('CANONICAL_PROMPT is short stable text', () => {
  assert.ok(CANONICAL_PROMPT.length < 50);
  assert.match(CANONICAL_PROMPT, /OK/);
});

test('DEFAULT_SAMPLES is positive int', () => {
  assert.ok(Number.isInteger(DEFAULT_SAMPLES) && DEFAULT_SAMPLES > 0);
});

test('benchHostModel: returns null when all samples fail', async () => {
  const mockHttp = {
    request(opts, cb) {
      const req = { on(evt, h) { if (evt === 'error') setImmediate(() => h(new Error('n'))); return req; },
        write() {}, end() {}, destroy() {} };
      return req;
    },
  };
  const result = await benchHostModel('1.2.3.4:11434', 'm', { samples: 2, httpImpl: mockHttp });
  assert.strictEqual(result, null);
});
