#!/usr/bin/env node
'use strict';
// Direct Ollama native-API client — fallback when OpenClaw/LiteLLM is unavailable.

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://100.78.22.13:11434';
const DEFAULT_MODEL = 'qwen2.5:7b-instruct';
const TIMEOUT_MS = 120000;

async function chatComplete(prompt, opts = {}) {
  const model = opts.model || DEFAULT_MODEL;
  const base = opts.ollamaUrl || OLLAMA_URL;
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: { num_predict: opts.maxTokens || 512 },
  });
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error('ollama timeout')), TIMEOUT_MS);
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

module.exports = { chatComplete, healthCheck, OLLAMA_URL, DEFAULT_MODEL };
