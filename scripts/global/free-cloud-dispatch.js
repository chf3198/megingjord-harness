#!/usr/bin/env node
'use strict';
// free-cloud-dispatch.js (#2621): execute a $0 cloud provider when the fleet is unreachable.
// Tries the policy free-cloud providers in order; routes through wrapProviderCall (#1160) for
// HAMR cost/observability; gracefully no-ops (no_key / all-fail) so callers fall back to the
// advisory escalation signal (#2619). All providers below are free-tier; never a paid model.
const policy = require('./model-routing-policy.json');
let wrapProviderCall;
try { ({ wrapProviderCall } = require('./hamr-provider-wrapper')); }
catch { wrapProviderCall = async (_p, fn) => ({ ok: true, value: await fn({}) }); }

// provider -> { envKey, url(key), body(prompt), headers(key), parse(json) }. OpenAI-compatible or REST.
const PROVIDERS = {
  gemini: {
    envKey: 'GOOGLE_AI_STUDIO_API_KEY',
    url: (k) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${k}`,
    body: (p) => ({ contents: [{ parts: [{ text: p }] }] }),
    headers: () => ({ 'content-type': 'application/json' }),
    parse: (j) => j?.candidates?.[0]?.content?.parts?.[0]?.text,
  },
  'openrouter-free': {
    envKey: 'OPENROUTER_API_KEY',
    url: () => 'https://openrouter.ai/api/v1/chat/completions',
    body: (p) => ({ model: 'meta-llama/llama-3.3-70b-instruct:free', messages: [{ role: 'user', content: p }] }),
    headers: (k) => ({ 'content-type': 'application/json', authorization: `Bearer ${k}` }),
    parse: (j) => j?.choices?.[0]?.message?.content,
  },
  groq: {
    envKey: 'GROQ_API_KEY',
    url: () => 'https://api.groq.com/openai/v1/chat/completions',
    body: (p) => ({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: p }] }),
    headers: (k) => ({ 'content-type': 'application/json', authorization: `Bearer ${k}` }),
    parse: (j) => j?.choices?.[0]?.message?.content,
  },
  cerebras: {
    envKey: 'CEREBRAS_API_KEY',
    url: () => 'https://api.cerebras.ai/v1/chat/completions',
    body: (p) => ({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: p }] }),
    headers: (k) => ({ 'content-type': 'application/json', authorization: `Bearer ${k}` }),
    parse: (j) => j?.choices?.[0]?.message?.content,
  },
};

/** Ordered free-cloud providers from policy (falls back to all known). @returns {string[]} */
function providerOrder() {
  const list = policy?.models?.['free-cloud']?.providers;
  return Array.isArray(list) && list.length ? list.filter((n) => PROVIDERS[n]) : Object.keys(PROVIDERS);
}

/** Call one free-cloud provider. @returns {Promise<{ok,content?,provider?,reason?}>} */
async function callProvider(name, prompt, opts = {}) {
  const spec = PROVIDERS[name];
  if (!spec) return { ok: false, reason: `unknown_provider:${name}` };
  const key = (opts.env || process.env)[spec.envKey];
  if (!key) return { ok: false, reason: 'no_key' };
  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return { ok: false, reason: 'no_fetch' };
  const wrapProvider = name === 'gemini' ? 'gemini' : 'openai-compatible';
  const wrapped = await wrapProviderCall(wrapProvider, async () => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), opts.timeoutMs || 30000);
    try {
      const res = await fetchImpl(spec.url(key), { method: 'POST', headers: spec.headers(key),
        body: JSON.stringify(spec.body(prompt)), signal: ac.signal });
      return await res.json();
    } finally { clearTimeout(t); }
  }, { tier: 'free-cloud' });
  if (!wrapped.ok) return { ok: false, reason: wrapped.meta?.error || 'provider_error' };
  const content = spec.parse(wrapped.value);
  return content ? { ok: true, content, provider: name } : { ok: false, reason: 'empty_response' };
}

/** Try free-cloud providers in policy order until one returns content. @returns {Promise<object>} */
async function dispatchFreeCloud(prompt, opts = {}) {
  if (!prompt) return { ok: false, reason: 'no_prompt' };
  const tried = [];
  for (const name of providerOrder()) {
    const r = await callProvider(name, prompt, opts);
    if (r.ok) return r;
    tried.push(`${name}:${r.reason}`);
  }
  return { ok: false, reason: 'no_free_cloud_available', tried };
}

module.exports = { dispatchFreeCloud, callProvider, providerOrder, PROVIDERS };
