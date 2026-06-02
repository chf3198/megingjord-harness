// #2621: free-cloud execution on fleet-down (not just an advisory signal).
const { test, expect } = require('@playwright/test');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FC = require(path.join(ROOT, 'scripts', 'global', 'free-cloud-dispatch.js'));
const CASCADE = require(path.join(ROOT, 'scripts', 'global', 'cascade-dispatch.js'));

// injected fetch that returns an OpenAI-compatible (and gemini-shaped) success body
function okFetch(text) {
  return async () => ({
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],          // gemini shape
      choices: [{ message: { content: text } }],                  // openai-compatible shape
    }),
  });
}

test('providerOrder uses policy free-cloud provider list (known providers only)', () => {
  const order = FC.providerOrder();
  expect(order.length).toBeGreaterThan(0);
  for (const p of order) expect(FC.PROVIDERS[p]).toBeTruthy();
});

test('callProvider returns no_key when the provider key is absent', async () => {
  const r = await FC.callProvider('gemini', 'hello', { env: {} });
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('no_key');
});

test('callProvider succeeds with an injected fetch + configured key', async () => {
  const r = await FC.callProvider('gemini', 'hello', {
    env: { GOOGLE_AI_STUDIO_API_KEY: 'k' }, fetchImpl: okFetch('FC-ANSWER'),
  });
  expect(r.ok).toBe(true);
  expect(r.content).toBe('FC-ANSWER');
  expect(r.provider).toBe('gemini');
});

test('dispatchFreeCloud falls through unconfigured providers to the first that answers', async () => {
  // only the 2nd-in-order provider has a key; earlier ones return no_key and are skipped
  const order = FC.providerOrder();
  const env = { [FC.PROVIDERS[order[1]].envKey]: 'k' };
  const r = await FC.dispatchFreeCloud('hello', { env, fetchImpl: okFetch('SECOND') });
  expect(r.ok).toBe(true);
  expect(r.provider).toBe(order[1]);
  expect(r.content).toBe('SECOND');
});

test('dispatchFreeCloud returns no_free_cloud_available when no key is configured', async () => {
  const r = await FC.dispatchFreeCloud('hello', { env: {} });
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('no_free_cloud_available');
  expect(Array.isArray(r.tried)).toBe(true);
});

test('cascade fleet-down executes free-cloud and returns its content', async () => {
  // no Ollama in CI -> tryOllama reports ollama_unreachable -> availability failure -> free-cloud
  const order = FC.providerOrder();
  const env = { [FC.PROVIDERS[order[0]].envKey]: 'k' };
  const r = await CASCADE.cascade('summarize this short fleet-lane prompt', {
    freeCloud: { env, fetchImpl: okFetch('CLOUD-OK') },
  });
  expect(r.tier).toBe('free-cloud');
  expect(r.ok).toBe(true);
  expect(r.content).toBe('CLOUD-OK');
  expect(r.escalation_needed).toBe(false);
});

test('cascade fleet-down falls back to advisory free-cloud signal when execution disabled', async () => {
  const r = await CASCADE.cascade('summarize this short fleet-lane prompt', { executeFreeCloud: false });
  expect(r.ok).toBe(false);
  expect(r.escalation_needed).toBe(true);
  expect(r.suggested_tier).toBe('free-cloud'); // #2619 advisory signal preserved
});
