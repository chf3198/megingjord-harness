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
// No auth required. Models: mistral:latest, phi3:mini, qwen2.5:7b-instruct
const fleetProviders = {
  openclaw_mistral: chat(
    'http://100.78.22.13:11434/v1/chat/completions',
    'ollama',
    'mistral:latest'
  ),
  openclaw_phi3: chat(
    'http://100.78.22.13:11434/v1/chat/completions',
    'ollama',
    'phi3:mini'
  ),
  openclaw_qwen: chat(
    'http://100.78.22.13:11434/v1/chat/completions',
    'ollama',
    'qwen2.5:7b-instruct'
  ),
};

module.exports = { fleetProviders };
