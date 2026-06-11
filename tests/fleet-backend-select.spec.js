'use strict';
// tdd-pyramid spec for scripts/global/fleet-backend-select.js (#2929 / Epic #2926 C3).
const test = require('node:test');
const assert = require('node:assert');
const { selectFleetBackend, dispatchFleet } = require('../scripts/global/fleet-backend-select');

test('AC1: litellm-healthy probe selects litellm', () => {
  assert.deepStrictEqual(selectFleetBackend({ ok: true, backend: 'litellm' }), { backend: 'litellm' });
});

test('AC1: probe-failed (null / ok:false) selects ollama with probe-failed reason', () => {
  assert.deepStrictEqual(selectFleetBackend(null), { backend: 'ollama', fallback_reason: 'probe-failed' });
  assert.deepStrictEqual(selectFleetBackend({ ok: false }), { backend: 'ollama', fallback_reason: 'probe-failed' });
});

test('AC1: healthy-but-not-litellm backend selects ollama with gateway-unhealthy reason', () => {
  assert.deepStrictEqual(selectFleetBackend({ ok: true, backend: 'ollama' }), { backend: 'ollama', fallback_reason: 'gateway-unhealthy' });
});

test('AC2/AC3: litellm healthy + call ok → serves litellm, no fallback, no stderr, records ok', async () => {
  const writes = []; const events = [];
  const r = await dispatchFleet('p', {}, {
    healthCheck: async () => ({ ok: true, backend: 'litellm' }),
    litellmChat: async () => ({ ok: true, content: 'lite answer' }),
    ollamaChat: async () => { throw new Error('ollama must NOT be called'); },
    write: (l) => writes.push(l), record: (e) => events.push(e),
  });
  assert.strictEqual(r.backend, 'litellm');
  assert.strictEqual(r.content, 'lite answer');
  assert.strictEqual(writes.length, 0, 'no fallback line when litellm serves');
  assert.deepStrictEqual(events, [{ backend: 'litellm', fallback: false }]);
});

test('AC2/AC3: gateway down → probe-first routes to ollama, emits fallback line, records fallback', async () => {
  const writes = []; const events = [];
  let litellmCalled = false;
  const r = await dispatchFleet('p', {}, {
    healthCheck: async () => ({ ok: false }),
    litellmChat: async () => { litellmCalled = true; return { ok: true, content: 'should not be used' }; },
    ollamaChat: async () => ({ ok: true, content: 'ollama answer' }),
    write: (l) => writes.push(l), record: (e) => events.push(e),
  });
  assert.strictEqual(litellmCalled, false, 'probe-first must NOT attempt the 120s litellm call when down');
  assert.strictEqual(r.backend, 'ollama');
  assert.strictEqual(r.fallback_reason, 'probe-failed');
  assert.match(writes.join(''), /\[fleet\] litellm probe-failed → direct Ollama fallback/);
  assert.deepStrictEqual(events, [{ backend: 'ollama', fallback: true, fallback_reason: 'probe-failed' }]);
});

test('AC2/AC3: probe ok but litellm call fails → falls back to ollama with the error reason', async () => {
  const writes = [];
  const r = await dispatchFleet('p', {}, {
    healthCheck: async () => ({ ok: true, backend: 'litellm' }),
    litellmChat: async () => ({ ok: false, error: 'HTTP 502' }),
    ollamaChat: async () => ({ ok: true, content: 'ollama rescue' }),
    write: (l) => writes.push(l),
  });
  assert.strictEqual(r.backend, 'ollama');
  assert.strictEqual(r.fallback_reason, 'HTTP 502');
  assert.match(writes.join(''), /\[fleet\] litellm HTTP 502 → direct Ollama fallback/);
});
