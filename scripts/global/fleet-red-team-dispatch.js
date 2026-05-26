#!/usr/bin/env node
// fleet-red-team-dispatch — HAMR-wrapped Ollama dispatcher for adversarial review.
// Refs #2175 (Phase-1 P1-1 of Epic #2041). Consumes templates from #2181 P1-3.
// Uses tier='fleet-local' (per #2178 P1-7) so cache-stats records ollama provider correctly.

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { wrapProviderCall } = require('/home/curtisfranks/devenv-ops/scripts/global/hamr-provider-wrapper');

const DEFAULT_HOST = 'http://100.91.113.16:11434';
const DEFAULT_MODEL = 'qwen2.5-coder:32b';
const TIER = 'fleet-local';
const RETRY_DELAYS_MS = [1000, 4000];
const REQUEST_TIMEOUT_MS = 600_000;
const TEMPLATES_PATH = path.join(__dirname, '..', '..', 'config', 'fleet-red-team-prompts.json');
const TOKEN_BUDGET_HEADROOM = 200;
const MAX_NUM_PREDICT = 2000;
const REFUSAL_PATTERNS = [/^i cannot help with/i, /^i'm sorry, but i cannot/i, /^i am unable to/i];
const ARXIV_HALLUCINATION_RE = /arxiv\.org\/abs\/[0-9]{4}\.[0-9]{4,5}/gi;

function loadTemplate(artifactType, templatesPath = TEMPLATES_PATH) {
  const obj = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
  const tmpl = obj.templates[artifactType];
  if (!tmpl) throw new Error(`unknown artifact-type: ${artifactType}`);
  return tmpl;
}

function buildPrompt(template, content) {
  return template.prompt_template.replace('{{content}}', content);
}

function stripArxivHallucinations(text) {
  return String(text).replace(ARXIV_HALLUCINATION_RE, '[arxiv-ref-stripped]');
}

function detectRefusal(text) {
  const trimmed = String(text).trim();
  return REFUSAL_PATTERNS.some((re) => re.test(trimmed));
}

async function callOllamaOnce({ host, model, prompt, num_predict }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.3, num_predict } }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

async function callWithRetry({ host, model, prompt, num_predict }) {
  const attempts = RETRY_DELAYS_MS.length + 1;
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await callOllamaOnce({ host, model, prompt, num_predict }); }
    catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
      }
    }
  }
  throw lastErr;
}

function parseFindings(raw) {
  const text = (raw && raw.response) || '';
  if (!text || text.length < 50) return { findings: [], warning: 'empty-or-short-response' };
  if (detectRefusal(text)) return { findings: [], warning: 'fleet-refused' };
  const cleaned = stripArxivHallucinations(text);
  const lines = cleaned.split('\n').filter((l) => /^\s*(?:[-*]\s*)?\*?\*?(ACCEPT|REJECT|PARTIAL)/i.test(l));
  return { findings: lines.map((line) => ({ raw: line.trim() })), warning: null };
}

async function dispatchRedTeam({ artifactType, content, model = DEFAULT_MODEL, host = DEFAULT_HOST, templatesPath = TEMPLATES_PATH } = {}) {
  const template = loadTemplate(artifactType, templatesPath);
  const prompt = buildPrompt(template, content);
  const numPredict = Math.min(template.expected_token_range[1] + TOKEN_BUDGET_HEADROOM, MAX_NUM_PREDICT);
  const start = Date.now();
  const envelope = await wrapProviderCall('ollama', () => callWithRetry({ host, model, prompt, num_predict: numPredict }), { tier: TIER });
  const elapsed = Date.now() - start;
  if (!envelope.ok) {
    return { findings: [], raw: null, hamrStats: { ok: false, elapsed, error: envelope.error } };
  }
  const { findings, warning } = parseFindings(envelope.value);
  return { findings, raw: envelope.value, hamrStats: { ok: true, elapsed, sticky: envelope.sticky, warning } };
}

module.exports = { dispatchRedTeam, loadTemplate, buildPrompt, callWithRetry, parseFindings, stripArxivHallucinations, detectRefusal, TIER, RETRY_DELAYS_MS };
