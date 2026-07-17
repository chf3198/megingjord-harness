#!/usr/bin/env node
'use strict';
// tier: 3
// Direct Ollama native-API client — fallback when OpenClaw/LiteLLM is unavailable.

const fs = require('node:fs');
const path = require('node:path');

// #3126 AC2: the host list is CONFIG, not code. This legacy constant stays only as the
// last-resort default so existing callers/tests keep working when no config is present.
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://100.91.113.16:11434';
const DEFAULT_MODEL = 'qwen2.5:7b-instruct';
const DEFAULT_NUM_PREDICT = 512;

// #3126 AC2/AC3: registry is optional — a missing module must never break direct dispatch (G6).
let registry = null;
try { registry = require('./fleet-registry'); } catch { registry = null; }

// Ordered hosts that could serve `model`, best-guess first.
// Precedence: explicit opts.ollamaUrl > OLLAMA_URL env (back-compat) > family-matched
// configured hosts > all configured hosts > legacy default.
function resolveHostsForModel(model, opts = {}) {
  if (opts.ollamaUrl) return [opts.ollamaUrl];
  if (process.env.OLLAMA_URL) return [process.env.OLLAMA_URL];
  if (!registry) return [OLLAMA_URL];
  let hosts = [];
  try { hosts = registry.loadHosts(); } catch { hosts = []; }
  if (!hosts.length) return [OLLAMA_URL];
  let family = null;
  try { family = registry.capabilityFor(model).family; } catch { family = null; }
  const matched = family ? hosts.filter((h) => h.families.includes(family)) : [];
  const rest = hosts.filter((h) => !matched.includes(h));
  // A family match is a hint, not a guarantee — keep the others as failover so a stale
  // `families` entry degrades to "try everything" rather than a hard 404 (G6).
  return [...matched, ...rest].map((h) => h.url);
}

// #3126 AC3: registry-implied dispatch options. A "thinking" model returns EMPTY content at
// low num_predict unless think:false, and a 32B cold load needs a far larger budget than the
// 7b-class default — the pair that produced the observed 306s qwen3:32b timeout.
function optionsForModel(model) {
  if (!registry) return {};
  try {
    const cap = registry.capabilityFor(model);
    return { think: cap.thinking ? false : undefined, timeoutMs: cap.timeout_ms };
  } catch { return {}; }
}
const DEFAULT_TIMEOUT_POLICY = path.join(__dirname, '..', '..', 'config', 'timeout-policy.json');
// G3 patience: read the fleet-dispatch-basic class (300s for 7b-class models); fall back to the prior 120s
// on a missing/malformed policy. Path-injectable for tests.
function loadBasicTimeout(policyPath = DEFAULT_TIMEOUT_POLICY, fallbackMs = 120_000) {
  try {
    const classes = JSON.parse(fs.readFileSync(policyPath, 'utf8')).classes;
    const ms = classes && classes['fleet-dispatch-basic'] && classes['fleet-dispatch-basic'].ms;
    return typeof ms === 'number' && ms > 0 ? ms : fallbackMs;
  } catch { return fallbackMs; }
}
const TIMEOUT_MS = loadBasicTimeout();

// A host that does not serve the model answers 404 / "model not found"; that is the only
// error worth failing over on. Any other error IS the answer and must surface.
const MODEL_NOT_FOUND_RE = /404|not found|model .*not/i;

// #3126 AC2: try each candidate host in sequence (Ollama serializes per host, so parallel
// fan-out just aborts) and fail over on "model not found" — the defect that made host B's
// deepseek/granite (the only non-Qwen local families) structurally unreachable.
async function chatComplete(prompt, opts = {}) {
  const model = opts.model || DEFAULT_MODEL;
  const hosts = resolveHostsForModel(model, opts);
  let last = { ok: false, error: 'no_host_configured' };
  for (const host of hosts) {
    const res = await chatCompleteOnHost(prompt, { ...opts, ollamaUrl: host });
    if (res.ok) return res;
    last = res;
    // Only a missing-model/not-found is worth failing over; a real error is the answer.
    if (!MODEL_NOT_FOUND_RE.test(String(res.error || ''))) return res;
  }
  return last;
}

function buildChatBody(prompt, model, capOpts, opts) {
  return JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    // #3126 AC3: a thinking model returns EMPTY content at low num_predict unless disabled.
    ...(capOpts.think === false ? { think: false } : {}),
    options: { num_predict: opts.maxTokens || DEFAULT_NUM_PREDICT },
    // #3484: pin a hot model resident (keep_alive) so the common path isn't a cold load.
    ...(opts.keepAlive ? { keep_alive: opts.keepAlive } : {}),
  });
}

async function chatCompleteOnHost(prompt, opts = {}) {
  const model = opts.model || DEFAULT_MODEL;
  const base = opts.ollamaUrl || OLLAMA_URL;
  const capOpts = optionsForModel(model);
  const body = buildChatBody(prompt, model, capOpts, opts);
  const ac = new AbortController();
  // #3126 AC3: size the budget from the model's capability row (a 32B thinking model needs
  // ~600s incl. cold load), not the fixed 7b-class default that aborted qwen3:32b at 306s.
  // Explicit opts.timeoutMs still wins; TIMEOUT_MS remains the floor for unknown models.
  const budgetMs = opts.timeoutMs || capOpts.timeoutMs || TIMEOUT_MS;
  const timer = setTimeout(() => ac.abort(new Error('ollama timeout')), budgetMs);
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, content: data.message?.content || '', model, usage: data };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e.message || 'unknown' };
  }
}

async function healthCheck(ollamaUrl = OLLAMA_URL) {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, models: (data.models || []).map(m => m.name) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const isHealth = args.includes('--health');
  const prompt = args[args.indexOf('--prompt') + 1] || '';
  const model = args[args.indexOf('--model') + 1] || DEFAULT_MODEL;

  const run = isHealth
    ? healthCheck()
    : chatComplete(prompt, { model });

  run.then(r => {
    if (json) { console.log(JSON.stringify(r, null, 2)); return; }
    if (r.ok) console.log(isHealth ? `Ollama healthy — ${r.models?.join(', ')}` : r.content);
    else { console.error(`ollama-direct error: ${r.error}`); process.exit(1); }
  }).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = {
  chatComplete, chatCompleteOnHost, healthCheck, resolveHostsForModel, optionsForModel, buildChatBody,
  OLLAMA_URL, DEFAULT_MODEL, loadBasicTimeout, TIMEOUT_MS,
};
