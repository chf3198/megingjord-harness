// wrapProviderCall result-contract standardization tests (#1160).
// Canonical envelope: { ok, value, sticky, spillover, meta }; back-compat aliases:
// response (=value), top-level error (=meta.error), hamr_disabled (=meta.hamrDisabled).
const { test, expect } = require('@playwright/test');
const path = require('path');

const WRAP = require(path.resolve(__dirname, '..', 'scripts', 'global', 'hamr-provider-wrapper.js'));
const CANONICAL_KEYS = ['ok', 'value', 'sticky', 'spillover', 'meta'];
const META_KEYS = ['provider', 'tier', 'hamrDisabled', 'goalContextInjected', 'error'];

function assertEnvelope(r) {
  for (const k of CANONICAL_KEYS) expect(r).toHaveProperty(k);
  for (const k of META_KEYS) expect(r.meta).toHaveProperty(k);
  // back-compat aliases present on every path
  expect(r.response).toBe(r.value);
  expect(r.error).toBe(r.meta.error);
  expect(r.hamr_disabled).toBe(r.meta.hamrDisabled);
}

test('makeResult builds the full canonical envelope with defaults', () => {
  const r = WRAP.makeResult({ ok: true });
  assertEnvelope(r);
  expect(r.ok).toBe(true);
  expect(r.value).toBeNull();
  expect(r.meta.hamrDisabled).toBe(false);
  expect(r.meta.goalContextInjected).toBe(false);
  expect(r.meta.error).toBeNull();
});

test('success path returns canonical envelope with populated meta', async () => {
  const r = await WRAP.wrapProviderCall('groq', () => ({
    status: 200, headers: new Map(), usage: { prompt_tokens: 10, completion_tokens: 5 },
  }), { tier: 'haiku' });
  assertEnvelope(r);
  expect(r.ok).toBe(true);
  expect(r.value).not.toBeNull();
  expect(r.meta.provider).toBeTruthy();
  expect(r.meta.tier).toBe('haiku');
  expect(r.meta.error).toBeNull();
});

test('error path returns canonical envelope with meta.error + ok=false', async () => {
  const r = await WRAP.wrapProviderCall('anthropic', () => { throw new Error('boom-429'); }, { tier: 'haiku' });
  assertEnvelope(r);
  expect(r.ok).toBe(false);
  expect(r.value).toBeNull();
  expect(r.meta.error).toBe('boom-429');
  // back-compat: top-level error alias mirrors meta.error
  expect(r.error).toBe('boom-429');
  // sticky still surfaced on failure (provider-choice telemetry preserved)
  expect(r).toHaveProperty('sticky');
});

test('hamr-disabled path returns canonical envelope with meta.hamrDisabled', async () => {
  process.env.MEGINGJORD_HAMR_DISABLED = '1';
  try {
    const r = await WRAP.wrapProviderCall('anthropic', () => ({ id: 'x', status: 200 }));
    assertEnvelope(r);
    expect(r.ok).toBe(true);
    expect(r.meta.hamrDisabled).toBe(true);
    expect(r.hamr_disabled).toBe(true); // alias
    expect(r.value).toEqual({ id: 'x', status: 200 });
    expect(r.response).toEqual(r.value); // alias equivalence
  } finally {
    delete process.env.MEGINGJORD_HAMR_DISABLED;
  }
});

test('error-path back-compat: meta.error and top-level error agree (latent .response fix)', async () => {
  const r = await WRAP.wrapProviderCall('anthropic', () => { throw new Error(); }, { tier: 'haiku' });
  // default message when err has none
  expect(r.meta.error).toBe('provider_call_failed');
  expect(r.error).toBe(r.meta.error);
  expect(r.value).toBeNull();
  expect(r.response).toBeNull(); // alias of value — never undefined
});
