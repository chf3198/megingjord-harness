#!/usr/bin/env node
// ai-matrix-updater.js — orchestrates controlled LLM evaluations
// Usage: node scripts/ai-matrix-updater.js [--run] [--provider NAME]
'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const fetch = require('node-fetch');
const { scoreResponse } = require('./ai-matrix-scorer');
const { providers } = require('./ai-matrix-providers');

const EVAL_TASK = `You are a technical architect reviewing a devenv-ops dashboard design.

**Context**: A Fleet Resources table in a Chromebook dashboard (1366px viewport) must:
- Display available LLM/SLM inference endpoints (local fleet + cloud free-tier)
- Manage credentials securely per resource (lock/unlock/missing states)
- Auto-update via a multi-LLM research pipeline with JSON-schema validation
- Stay within 640px usable width, no horizontal scroll

**Your task - critical analysis covering all 5 areas:**
1. Table layout: column widths, overflow prevention
2. Credential state: locked / unlocked / missing enum and UI treatment
3. Auto-update pipeline: LLM ensemble, validation, consensus, commit policy
4. Secret storage UX: Vault KV v2, TTL, audit logging, break-glass
5. Failure modes and mitigations

Be specific. Identify gaps and concrete fixes. Max 500 words.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callProvider(name, cfg, retries = 2) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` };
  const body = cfg.buildBody(EVAL_TASK);
  console.log(`\n[${name}] -> ${cfg.url} (model: ${body.model || 'default'})`);
  try {
    const isFleet = cfg.url.includes('100.78.22.13');
    const timeoutMs = isFleet ? 360000 : 45000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(cfg.url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal }).finally(() => clearTimeout(timer));
    let text = await res.text();
    if (res.status === 429 && retries > 0) {
      const wait = 9000;
      console.log(`[${name}] 429 rate-limited — waiting ${wait}ms then retrying (${retries} left)`);
      await sleep(wait);
      return callProvider(name, cfg, retries - 1);
    }
    // Fleet (Ollama) streams SSE — reassemble full content from delta chunks
    let content;
    if (isFleet && body.stream) {
      content = text.split('\n')
        .filter(l => l.startsWith('data: ') && !l.includes('[DONE]'))
        .map(l => { try { return JSON.parse(l.slice(6))?.choices?.[0]?.delta?.content || ''; } catch { return ''; } })
        .join('');
    } else {
      // Some providers send SSE padding before JSON — strip it
      const jsonText = text.replace(/^[\s\n]+/, '').replace(/^[^{[]*({[\s\S]*})[\s\S]*$/, '$1');
      const parsed = JSON.parse(jsonText);
      content = parsed?.choices?.[0]?.message?.content || parsed?.output || '';
    }
    const scores = scoreResponse(content);
    console.log(`[${name}] HTTP ${res.status} | scores:`, scores);
    return { name, status: res.status, model: body.model, scores, responseLength: content.length, excerpt: content.slice(0, 400) };
  } catch (err) {
    console.error(`[${name}] ERROR:`, err.message);
    return { name, status: 'error', error: err.message, scores: null };
  }
}

async function main() {
  if (!process.argv.includes('--run')) {
    console.log('Dry-run mode -- pass --run to execute live calls');
    Object.entries(providers).forEach(([n, c]) => {
      const body = c.buildBody('test');
      console.log(` ${n}: ${c.url} | model: ${body.model}`);
    });
    return;
  }
  const provIdx = process.argv.indexOf('--provider');
  const only = provIdx > -1 ? process.argv[provIdx + 1] : null;
  const active = only ? { [only]: providers[only] } : providers;
  if (only && !providers[only]) { console.error('Unknown provider: ' + only); process.exit(1); }
  console.log('EXECUTE mode -- providers:', Object.keys(active).join(', '));
  const results = [];
  for (const [name, cfg] of Object.entries(active)) {
    results.push(await callProvider(name, cfg));
  }
  const outDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `ai-matrix-run-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ mode: 'execute', results }, null, 2));
  console.log('\nResults saved to', outPath);
  const { updateMatrix } = require('./ai-matrix-matrix-writer');
  updateMatrix(results);
}

main().catch((e) => { console.error(e); process.exit(1); });
