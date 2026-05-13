const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');

const C = require(path.resolve(__dirname, '..', 'scripts', 'global', 'token-spend-cache.js'));

test('keyFromRequest is deterministic for same payload', () => {
  const p = { lane: 'fleet', model: 'm1', prompt: 'hello', scope: 'abc' };
  expect(C.keyFromRequest(p)).toBe(C.keyFromRequest(p));
});

test('putCached then getCached returns entry within ttl', () => {
  const file = path.join(os.tmpdir(), `dispatch-cache-${Date.now()}.jsonl`);
  const key = C.keyFromRequest({ prompt: 'repeatable' });
  C.putCached(key, { content: 'cached response' }, { file });
  const hit = C.getCached(key, { file, now: Date.now(), ttlMs: C.TTL_MS });
  expect(hit).toBeTruthy();
  expect(hit.value.content).toBe('cached response');
});

test('getCached ignores expired rows', () => {
  const file = path.join(os.tmpdir(), `dispatch-cache-expired-${Date.now()}.jsonl`);
  const key = C.keyFromRequest({ prompt: 'stale' });
  C.putCached(key, { content: 'old' }, { file });
  const miss = C.getCached(key, { file, now: Date.now() + C.TTL_MS + 10, ttlMs: C.TTL_MS });
  expect(miss).toBeNull();
});
