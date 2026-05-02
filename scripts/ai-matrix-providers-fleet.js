// ai-matrix-providers-fleet.js — OpenClaw local fleet provider configs
'use strict';
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

const chat = (url, apiKey, model) => ({
  url,
  apiKey,
  buildBody: (task) => ({
    model,
    messages: [{ role: 'user', content: task }],
    temperature: 0.1,
    max_tokens: 300,  // capped for local 7B inference speed
    stream: true,     // streaming keeps socket alive through full generation
  }),
});

// OpenClaw: Ollama on windows-laptop (Tailscale: 100.78.22.13:11434, bound 0.0.0.0)
// No auth required. Models: qwen2.5-coder:1.5b, starcoder2:3b, qwen2.5-coder:7b
const fleetProviders = {
  openclaw_small: chat(
    'http://100.78.22.13:11434/v1/chat/completions',
    'ollama',
    'qwen2.5-coder:1.5b'
  ),
  openclaw_fast: chat(
    'http://100.78.22.13:11434/v1/chat/completions',
    'ollama',
    'starcoder2:3b'
  ),
  openclaw_qwen: chat(
    'http://100.78.22.13:11434/v1/chat/completions',
    'ollama',
    'qwen2.5-coder:7b'
  ),
};

module.exports = { fleetProviders };
