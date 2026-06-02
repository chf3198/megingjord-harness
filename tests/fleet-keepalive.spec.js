// #2601 (G3) — fleet review dispatch keeps the model warm via keep_alive.
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const D = require(path.resolve(__dirname, '..', 'scripts', 'global', 'fleet-red-team-dispatch.js'));

function withEnv(value, fn) {
  const prev = process.env.FLEET_KEEP_ALIVE;
  if (value === undefined) delete process.env.FLEET_KEEP_ALIVE;
  else process.env.FLEET_KEEP_ALIVE = value;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.FLEET_KEEP_ALIVE;
    else process.env.FLEET_KEEP_ALIVE = prev;
  }
}

async function captureBody(env, args) {
  return withEnv(env, async () => {
    const realFetch = global.fetch;
    let body;
    global.fetch = async (_url, opts) => { body = JSON.parse(opts.body); return { ok: true, json: async () => ({ response: 'ok' }) }; };
    try { await D.callOllamaOnce(args); } finally { global.fetch = realFetch; }
    return body;
  });
}

test('keepAliveValue defaults to 30m (incl. empty/whitespace)', () => {
  expect(withEnv(undefined, () => D.keepAliveValue())).toBe('30m');
  expect(withEnv('   ', () => D.keepAliveValue())).toBe('30m');
});

test('keepAliveValue honors FLEET_KEEP_ALIVE override', () => {
  expect(withEnv('1h', () => D.keepAliveValue())).toBe('1h');
});

test('callOllamaOnce sends default keep_alive in the request body (#2601)', async () => {
  const body = await captureBody(undefined, { host: 'http://h:11434', model: 'qwen2.5-coder:32b', prompt: 'p', num_predict: 10 });
  expect(body.keep_alive).toBe('30m');
  expect(body.model).toBe('qwen2.5-coder:32b');
  expect(body.options.num_predict).toBe(10);
});

test('callOllamaOnce reflects FLEET_KEEP_ALIVE override in body', async () => {
  const body = await captureBody('45m', { host: 'http://h:11434', model: 'm', prompt: 'p', num_predict: 5 });
  expect(body.keep_alive).toBe('45m');
});
