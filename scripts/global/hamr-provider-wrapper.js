#!/usr/bin/env node
// hamr-provider-wrapper.js — HAMR Wave 7 child B (#952).
// Opt-in shim: any provider call routes through cacheHeaders + appendCacheStat + spillover.
// Pure library — does NOT modify provider call sites (Copilot Team boundary preserved).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { cacheHeaders } = require('./litellm-client');
const { appendCacheStat } = require('./cache-stats-emit');
const ADAPTERS = require('./token-provider-adapters');
const { maybeSpillover } = require('./header-spillover');
const { pickStickyProvider } = require('./sticky-route');

const HTTP_OK_DEFAULT = 200;
const TEAM_CONFIG_PATHS = [
  path.join(os.homedir(), '.claude', 'hamr-config.json'),
  path.join(os.homedir(), '.copilot', 'hamr-config.json'),
  path.join(os.homedir(), '.codex', 'devenv-ops', 'hamr-config.json'),
];

/** Read the first available HAMR activation config across team runtimes.
 * @returns {object|null} Parsed config with source file, or null when absent.
 */
function readTeamConfig() {
  for (const file of TEAM_CONFIG_PATHS) {
    if (!fs.existsSync(file)) continue;
    try { return { file, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { /* skip malformed */ }
  }
  return null;
}

/** Determine whether HAMR wrapping is disabled for the current process.
 * @returns {boolean} True when wrapper should no-op.
 */
function isDisabled() {
  if (process.env.MEGINGJORD_HAMR_DISABLED === '1') return true;
  const cfg = readTeamConfig();
  if (cfg && cfg.enabled === false) return true;
  return false;
}

function emitStatSafe(provider, payload, opts = {}) {
  try {
    const adapter = ADAPTERS[provider];
    if (!adapter) return;
    const tokenRecord = adapter(payload || {}, { provider });
    appendCacheStat({
      provider, model: tokenRecord.model ?? null,
      cache_read_tokens: tokenRecord.cache_read_tokens ?? 0,
      input_tokens: tokenRecord.input_tokens ?? 0,
      output_tokens: tokenRecord.output_tokens ?? 0,
      executed: 'hamr-provider-wrapper',
      tier: opts.tier ?? null,
    });
  } catch { /* never let stats break the call */ }
}

/** Wrap any provider call with HAMR cost levers + observability.
 * @param {string} provider - 'anthropic'|'openai'|'gemini'|'groq'|'cerebras'|'openrouter'|'ollama'.
 * @param {Function} callFn - async fn that performs the provider call; receives `{headers, bodyExtras}`.
 * @param {object} [opts] - { tier, previousProvider, ttlSeconds, cacheKey, request }.
 * @returns {Promise<{ok: boolean, value?: object, sticky?: object, spillover?: object, error?: string}>} Wrapped result.
 */
async function wrapProviderCall(provider, callFn, opts = {}) {
  if (isDisabled()) {
    const value = await callFn({ headers: {}, bodyExtras: {} });
    return { ok: true, value, sticky: null, spillover: null, hamr_disabled: true };
  }
  const sticky = (opts.tier && opts.tier !== 'diagnostic')
    ? pickStickyProvider(opts.tier, { previousProvider: opts.previousProvider })
    : null;
  // Refs #2178 — fleet-local + ollama-explicit must pin to caller-supplied provider so
  // cost-stats records the actual call target (not a sticky-mis-pick paid provider).
  const effectiveProvider = (opts.tier === 'fleet-local' || provider === 'ollama')
    ? provider
    : (sticky?.provider || provider);
  const hints = cacheHeaders(effectiveProvider, opts);
  let response;
  try { response = await callFn(hints); }
  catch (err) { return { ok: false, error: err?.message || 'provider_call_failed', sticky, spillover: null }; }
  emitStatSafe(effectiveProvider, response, opts);
  const respShape = { status: response?.status ?? response?.response?.status ?? HTTP_OK_DEFAULT, headers: response?.headers ?? new Map() };
  const spillover = maybeSpillover(effectiveProvider, respShape);
  return { ok: true, value: response, sticky, spillover };
}

if (require.main === module) {
  console.log(JSON.stringify({ exports: ['wrapProviderCall'], hamr_disabled: isDisabled() }));
}

module.exports = { wrapProviderCall, isDisabled, readTeamConfig, TEAM_CONFIG_PATHS };
