'use strict';
// #3061: extra free-tier providers wired into free-cloud rotation, with graceful key-absent skip.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { PROVIDERS, providerOrder, callProvider, dispatchFreeCloud } = require('../scripts/global/free-cloud-dispatch.js');

const NEW = ['mistral', 'github-models', 'nvidia', 'sambanova'];

describe('#3061 free-cloud provider rotation', () => {
  test('the 4 new providers are registered with the required shape', () => {
    for (const name of NEW) {
      const spec = PROVIDERS[name];
      assert.ok(spec, `${name} missing from PROVIDERS`);
      for (const field of ['envKey', 'url', 'body', 'headers', 'parse']) {
        assert.strictEqual(typeof spec[field], field === 'envKey' ? 'string' : 'function', `${name}.${field}`);
      }
      assert.ok(spec.url().startsWith('https://'), `${name} url must be https`);
    }
  });

  test('providerOrder includes all new providers and every entry exists in PROVIDERS', () => {
    const order = providerOrder();
    assert.ok(NEW.every((n) => order.includes(n)), 'new providers missing from order');
    assert.ok(order.every((n) => PROVIDERS[n]), 'order has an unknown provider');
    // reliable/high-volume first: cerebras before gemini (the rate-limited one)
    assert.ok(order.indexOf('cerebras') < order.indexOf('gemini'), 'cerebras should precede gemini');
  });

  test('a provider with no key gracefully returns no_key (skip, not throw)', async () => {
    for (const name of NEW) {
      const res = await callProvider(name, 'hi', { env: {} });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.reason, 'no_key', `${name} should skip with no_key`);
    }
  });

  test('dispatchFreeCloud skips key-absent providers and reports them in tried[]', async () => {
    const res = await dispatchFreeCloud('hi', { env: {}, fetchImpl: null });
    assert.strictEqual(res.ok, false);
    assert.ok(Array.isArray(res.tried));
    assert.ok(res.tried.some((t) => t.startsWith('mistral:')), 'mistral should appear in tried');
  });
});
