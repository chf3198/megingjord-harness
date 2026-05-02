#!/usr/bin/env node
'use strict';
// Unified fleet client: LiteLLM gateway (preferred) → direct Ollama (fallback).
// Activates when LITELLM_URL env var or fleet-config OpenClaw URL resolves.
// Uses named LiteLLM route groups to trigger fallback chain from litellm-config.yaml.

const { chatComplete: ollamaChat, healthCheck: ollamaHealth } = require('./ollama-direct');
const { getOpenClawURL } = require('./fleet-config');

// Map Ollama model IDs to LiteLLM named groups (triggers fallback chain).
const NAMED_GROUPS = {
  'qwen2.5-coder:1.5b': 'fleet-primary',
  'starcoder2:3b': 'fleet-fast',
  'qwen2.5-coder:7b': 'fleet-quality',
  'qwen2.5:7b-instruct': 'fleet-fallback'
};

function getLiteLLMUrl() {
  return process.env.LITELLM_URL || getOpenClawURL();
}

async function litellmChat(prompt, opts = {}) {
  const url = opts.url || getLiteLLMUrl();
  if (!url) return { ok: false, error: 'no_litellm_url' };
  const model = opts.litellmModel || NAMED_GROUPS[opts.model] || 'fleet-primary';
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: opts.maxTokens || 512,
  });
  try {
    const res = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-litellm-timeout': '120' },
      body,
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (!content) return { ok: false, error: 'empty_response' };
    return { ok: true, content, model: data.model || model, backend: 'litellm' };
  } catch (e) {
    return { ok: false, error: e.message || 'litellm_error' };
  }
}

async function chatComplete(prompt, opts = {}) {
  const url = getLiteLLMUrl();
  if (url) {
    const r = await litellmChat(prompt, { ...opts, url });
    if (r.ok) return r;
  }
  return ollamaChat(prompt, opts);
}

async function healthCheck() {
  const url = getLiteLLMUrl();
  if (url) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return { ok: true, backend: 'litellm', url };
    } catch { /* fall through to direct Ollama */ }
  }
  const h = await ollamaHealth();
  return { ...h, backend: 'ollama' };
}

module.exports = { chatComplete, healthCheck, getLiteLLMUrl };
