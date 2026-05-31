const test = require('node:test');
const assert = require('node:assert');
const {
  probeHostModel, parsePsLoaded, computeBusy, classify,
  QUEUE_HIGH_DEPTH,
} = require('../scripts/global/fleet-probe');

test('parsePsLoaded: returns true when model in ps response', () => {
  assert.strictEqual(parsePsLoaded({ models: [{ name: 'qwen2.5-coder:32b' }] }, 'qwen2.5-coder:32b'), true);
});

test('parsePsLoaded: returns false when model not in ps', () => {
  assert.strictEqual(parsePsLoaded({ models: [{ name: 'other' }] }, 'qwen2.5-coder:32b'), false);
});

test('parsePsLoaded: handles empty ps response', () => {
  assert.strictEqual(parsePsLoaded({}, 'any'), false);
  assert.strictEqual(parsePsLoaded(null, 'any'), false);
});

test('computeBusy: no active models means not busy', () => {
  const result = computeBusy({ models: [{ name: 'm', size_vram: 0 }] }, 'm');
  assert.strictEqual(result.busy, false);
  assert.strictEqual(result.queue_depth, 0);
});

test('computeBusy: active model triggers busy + queue_depth', () => {
  const result = computeBusy({ models: [{ name: 'm', size_vram: 1000000 }] }, 'm');
  assert.strictEqual(result.busy, true);
  assert.strictEqual(result.queue_depth, 1);
});

test('classify: UNAVAILABLE when not reachable', () => {
  assert.strictEqual(classify({ reachable: false }), 'UNAVAILABLE');
});

test('classify: AVAILABLE when reachable + not loaded', () => {
  assert.strictEqual(classify({ reachable: true, loaded: false }), 'AVAILABLE');
});

test('classify: AVAILABLE when loaded + not busy', () => {
  assert.strictEqual(classify({ reachable: true, loaded: true, busy: false }), 'AVAILABLE');
});

test('classify: WAIT when loaded + busy + low queue', () => {
  assert.strictEqual(classify({ reachable: true, loaded: true, busy: true, queue_depth: 1 }), 'WAIT');
});

test('classify: ROUTE_ELSEWHERE when queue depth high', () => {
  assert.strictEqual(classify({ reachable: true, loaded: true, busy: true, queue_depth: QUEUE_HIGH_DEPTH }), 'ROUTE_ELSEWHERE');
});

test('probeHostModel: returns UNAVAILABLE when host unreachable', async () => {
  const mockHttp = {
    request(opts, cb) {
      const req = {
        on(evt, h) { if (evt === 'error') setImmediate(() => h(new Error('network'))); return req; },
        end() {}, destroy() {},
      };
      return req;
    },
  };
  const result = await probeHostModel('1.2.3.4:11434', 'm', { httpImpl: mockHttp });
  assert.strictEqual(result.reachable, false);
  assert.strictEqual(result.decision, 'UNAVAILABLE');
});

test('probeHostModel: returns AVAILABLE when reachable + not loaded', async () => {
  let callCount = 0;
  const mockHttp = {
    request(opts, cb) {
      callCount++;
      const res = { _h: {}, on(evt, h) { this._h[evt] = h; return this; } };
      const body = callCount === 1 ? { version: '0.21' } : { models: [] };
      setImmediate(() => {
        cb(res);
        setImmediate(() => { res._h.data(JSON.stringify(body)); res._h.end(); });
      });
      const req = { on() { return req; }, end() {}, destroy() {} };
      return req;
    },
  };
  const result = await probeHostModel('1.2.3.4:11434', 'm', { httpImpl: mockHttp });
  assert.strictEqual(result.reachable, true);
  assert.strictEqual(result.loaded, false);
  assert.strictEqual(result.decision, 'AVAILABLE');
});
