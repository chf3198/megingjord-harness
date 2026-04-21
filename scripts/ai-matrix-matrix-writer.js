// ai-matrix-matrix-writer.js — updates LLM-EVALUATION-MATRIX.md with run results
'use strict';
const fs = require('fs');
const path = require('path');

const MATRIX_PATH = path.join(process.cwd(), 'model-compare', 'design-analysis', 'LLM-EVALUATION-MATRIX.md');

const PROVIDER_LABELS = {
  openrouter_qwen3coder:  'OpenRouter — qwen/qwen3-coder:free',
  openrouter_gemma4b:      'OpenRouter — google/gemma-3-4b-it:free',
  openrouter_nemotron:    'OpenRouter — nvidia/nemotron-super-120b:free',
  openrouter_llama70b:    'OpenRouter — llama-3.3-70b-instruct:free',
  openrouter_hermes405b:  'OpenRouter — nvidia/nemotron-nano-30b:free',
  openrouter_gptoss120b:  'OpenRouter — openai/gpt-oss-20b:free',
  openrouter_glm45:       'OpenRouter — nvidia/nemotron-nano-9b-v2:free',
  openrouter_gemma27b:     'OpenRouter — google/gemma-3-27b-it:free',
  groq_llama70b:          'Groq — llama-3.3-70b-versatile',
  groq_gptoss120b:        'Groq — openai/gpt-oss-120b',
  groq_qwen32b:           'Groq — qwen/qwen3-32b',
  groq_llama4scout:       'Groq — llama-4-scout-17b',
  groq_llama8b:           'Groq — llama-3.1-8b-instant',
  cerebras_qwen235b:      'Cerebras — qwen-3-235b-a22b',
  cerebras_llama8b:       'Cerebras — llama3.1-8b',
  openclaw_mistral:       'OpenClaw — mistral:latest',
  openclaw_qwen:          'OpenClaw — qwen2.5:7b-instruct',
};

function formatRow(result) {
  const { name, status, model, scores } = result;
  const label = PROVIDER_LABELS[name] || name;
  if (!scores) return `| **${label}** | — | — | — | — | — | — | — | ⚠ offline/error (${status}) |`;
  const { clarity, accuracy, security, ux, composite } = scores;
  return `| **${label}** | 0x / cloud | ${clarity} | ${accuracy} | ${security} | ${ux} | *Empirical — controlled eval* | ${composite} | Measured ${new Date().toISOString().slice(0, 10)}, model: ${model} |`;
}

function updateMatrix(results) {
  if (!fs.existsSync(MATRIX_PATH)) { console.warn('Matrix file not found:', MATRIX_PATH); return; }
  let content = fs.readFileSync(MATRIX_PATH, 'utf8');

  const SECTION_MARKER = '\n<!-- EMPIRICAL-RESULTS-START -->';
  const END_MARKER = '<!-- EMPIRICAL-RESULTS-END -->';

  const rows = results.map(formatRow).join('\n');
  const block = `${SECTION_MARKER}\n_Auto-updated: ${new Date().toISOString()} by ai-matrix-updater_\n\n| Model | Cost | Clarity | Accuracy | Security | UX | Emerging Property | Composite | Notes |\n|---|---|---|---|---|---|---|---|---|\n${rows}\n${END_MARKER}`;

  if (content.includes(SECTION_MARKER)) {
    content = content.replace(new RegExp(`${SECTION_MARKER.trim()}[\\s\\S]*?${END_MARKER}`), block.trim());
  } else {
    content += `\n\n## Empirical Evaluation Results\n${block}`;
  }

  fs.writeFileSync(MATRIX_PATH, content);
  console.log('Matrix updated:', MATRIX_PATH);
}

module.exports = { updateMatrix };
