#!/usr/bin/env node
// hamr-provider-wrapper.js — HAMR Wave 7 child B (#952).
// Opt-in shim: any provider call routes through cacheHeaders + appendCacheStat + spillover.
// Pure library — does NOT modify provider call sites (Copilot Team boundary preserved).
'use strict';
const { cacheHeaders } = require('./litellm-client');
const { appendCacheStat } = require('./cache-stats-emit');
const ADAPTERS = require('./token-provider-adapters');
const { maybeSpillover } = require('./header-spillover');
const { pickStickyProvider } = require('./sticky-route');

const HTTP_OK_DEFAULT = 200;

function isDisabled() {
  return process.env.MEGINGJORD_HAMR_DISABLED === '1';
}

function emitStatSafe(provider, payload) {
  try {
    const adapter = ADAPTERS[provider];
    if (!adapter) return;
    const tokenRecord = adapter(payload || {}, { provider });
    appendCacheStat({
      provider, model: tokenRecord.model ?? null,
      cache_read_tokens: tokenRecord.cache_read_tokens ?? 0,
      input_tokens: tokenRecord.input_tokens ?? 0,
      output_tokens: tokenRecord.output_tokens ?? 0,
    });
  } catch { /* never let stats break the call */ }
}

/** Wrap any provider call with HAMR cost levers + observability.
 * @param {string} provider - 'anthropic'|'openai'|'gemini'|'groq'|'cerebras'|'openrouter'.
 * @param {Function} callFn - async fn that performs the provider call; receives `{headers, bodyExtras}`.
 * @param {object} [opts] - { tier, previousProvider, ttlSeconds, cacheKey, request }.
 * @returns {Promise<{ok: boolean, value?: object, sticky?: object, spillover?: object, error?: string}>} Wrapped result.
 */
async function wrapProviderCall(provider, callFn, opts = {}) {
  if (isDisabled()) {
    const value = await callFn({ headers: {}, bodyExtras: {} });
    return { ok: true, value, sticky: null, spillover: null, hamr_disabled: true };
  }
  const sticky = opts.tier
    ? pickStickyProvider(opts.tier, { previousProvider: opts.previousProvider })
    : null;
  const effectiveProvider = sticky?.provider || provider;
  const hints = cacheHeaders(effectiveProvider, opts);
  let response;
  try { response = await callFn(hints); }
  catch (err) { return { ok: false, error: err?.message || 'provider_call_failed', sticky, spillover: null }; }
  emitStatSafe(effectiveProvider, response);
  const respShape = { status: response?.status ?? response?.response?.status ?? HTTP_OK_DEFAULT, headers: response?.headers ?? new Map() };
  const spillover = maybeSpillover(effectiveProvider, respShape);
  return { ok: true, value: response, sticky, spillover };
}

if (require.main === module) {
  console.log(JSON.stringify({ exports: ['wrapProviderCall'], hamr_disabled: isDisabled() }));
}

module.exports = { wrapProviderCall, isDisabled };
