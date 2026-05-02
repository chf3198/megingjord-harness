#!/usr/bin/env node
// ai-matrix-build-final.js — builds the final matrix from best-of-runs data
'use strict';
const fs = require('fs');
const path = require('path');
const glob = require('node:fs');

const TEST_RESULTS_DIR = path.join(process.cwd(), 'test-results');
const MATRIX_PATH = path.join(process.cwd(), 'research', 'model-compare', 'design-analysis', 'LLM-EVALUATION-MATRIX.md');

// Load all run files and aggregate best score per provider
function loadBestResults() {
  const files = fs.readdirSync(TEST_RESULTS_DIR)
    .filter((f) => f.startsWith('ai-matrix-run-') && f.endsWith('.json'))
    .sort();
  const best = {};
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(TEST_RESULTS_DIR, file), 'utf8'));
    for (const r of data.results || []) {
      const sc = r.scores;
      if (!sc) continue;
      const prev = best[r.name];
      if (!prev || sc.composite > (prev.scores?.composite || -1)) best[r.name] = r;
    }
  }
  return best;
}

const LABELS = {
  openrouter_qwen3coder:  { label: 'OpenRouter — qwen/qwen3-coder:free',          cost: '0x / free-cloud', tier: 'OpenRouter' },
  openrouter_nemotron:    { label: 'OpenRouter — nvidia/nemotron-super-120b:free', cost: '0x / free-cloud', tier: 'OpenRouter' },
  openrouter_llama70b:    { label: 'OpenRouter — llama-3.3-70b-instruct:free',     cost: '0x / free-cloud', tier: 'OpenRouter' },
  openrouter_hermes405b:  { label: 'OpenRouter — hermes-3-llama-3.1-405b:free',   cost: '0x / free-cloud', tier: 'OpenRouter' },
  openrouter_gptoss120b:  { label: 'OpenRouter — openai/gpt-oss-20b:free',         cost: '0x / free-cloud', tier: 'OpenRouter' },
  openrouter_gemma4b:     { label: 'OpenRouter — google/gemma-3-4b-it:free',       cost: '0x / free-cloud', tier: 'OpenRouter' },
  openrouter_gemma27b:    { label: 'OpenRouter — google/gemma-3-27b-it:free',      cost: '0x / free-cloud', tier: 'OpenRouter' },
  groq_llama70b:          { label: 'Groq — llama-3.3-70b-versatile',              cost: '0x / free-cloud', tier: 'Groq' },
  groq_gptoss120b:        { label: 'Groq — openai/gpt-oss-120b',                  cost: '0x / free-cloud', tier: 'Groq' },
  groq_qwen32b:           { label: 'Groq — qwen/qwen3-32b',                       cost: '0x / free-cloud', tier: 'Groq' },
  groq_llama4scout:       { label: 'Groq — llama-4-scout-17b-16e',                cost: '0x / free-cloud', tier: 'Groq' },
  groq_llama8b:           { label: 'Groq — llama-3.1-8b-instant',                 cost: '0x / free-cloud', tier: 'Groq' },
  cerebras_qwen235b:      { label: 'Cerebras — qwen-3-235b-a22b',                 cost: '0x / free-cloud', tier: 'Cerebras' },
  cerebras_llama8b:       { label: 'Cerebras — llama3.1-8b',                      cost: '0x / free-cloud', tier: 'Cerebras' },
  openclaw_mistral:       { label: 'OpenClaw — mistral:latest',                   cost: '0x / local-fleet', tier: 'OpenClaw' },
  openclaw_qwen:          { label: 'OpenClaw — qwen2.5:7b-instruct',              cost: '0x / local-fleet', tier: 'OpenClaw' },
};

function formatRow(key, meta, result) {
  const { label, cost } = meta;
  if (!result) return `| **${label}** | ${cost} | — | — | — | — | *Not yet evaluated* | — | Pending |`;
  const sc = result.scores;
  if (!sc || sc.composite === 0) {
    const reason = result.status === 429 ? 'RPM/RPD rate-limited (free tier)' : result.error || `HTTP ${result.status}`;
    return `| **${label}** | ${cost} | — | — | — | — | *${reason}* | — | ⚠ ${reason} |`;
  }
  const { clarity, accuracy, security, ux, composite } = sc;
  const date = new Date().toISOString().slice(0, 10);
  return `| **${label}** | ${cost} | ${clarity} | ${accuracy} | ${security} | ${ux} | *Empirical controlled eval* | **${composite}** | Measured ${date} |`;
}

function buildSection(best) {
  const rows = Object.entries(LABELS).map(([k, m]) => formatRow(k, m, best[k]));
  const header = '| Model | Cost | Clarity | Accuracy | Security | UX | Emerging Property | Composite | Notes |';
  const sep = '|---|---|---|---|---|---|---|---|---|';
  return `${header}\n${sep}\n${rows.join('\n')}`;
}

function updateMatrix(best) {
  let content = fs.readFileSync(MATRIX_PATH, 'utf8');
  // Remove any stale EMPIRICAL-RESULTS-START block if present
  content = content.replace(/\n*<!--\s*EMPIRICAL-RESULTS-START\s*-->[\s\S]*?<!--\s*EMPIRICAL-RESULTS-END\s*-->/g, '');
  // Update Empirical column in Dynamic Tracking Table for each known provider
  for (const [key, meta] of Object.entries(LABELS)) {
    const result = best[key];
    if (!result) continue;
    const sc = result.scores;
    const empirical = sc && sc.composite ? `**${sc.composite}**` : '—';
    // Match rows containing the label text, update the empirical column (second-to-last cell before Best Use Case)
    const escaped = meta.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    content = content.replace(
      new RegExp(`(\\|[^|]*${escaped}[^|]*\\|(?:[^|]*\\|){7})([^|]*)(\\|[^|]*\\|)`, 'm'),
      (_, pre, _old, post) => `${pre} ${empirical} ${post}`
    );
  }
  fs.writeFileSync(MATRIX_PATH, content);
  console.log('Matrix written:', MATRIX_PATH);
}

const best = loadBestResults();
updateMatrix(best);
