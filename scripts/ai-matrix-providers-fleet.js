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
    max_tokens: 800,
    stream: false,
  }),
});

// OpenClaw gateway: LiteLLM proxy on windows-laptop (Tailscale: 100.78.22.13:4000)
// Auth: OPENCLAW_DEVICE_PASSWORD. Services offline = fleet offline marker in matrix.
const fleetProviders = {
  openclaw_mistral: chat(
    'http://100.78.22.13:4000/v1/chat/completions',
    process.env.OPENCLAW_DEVICE_PASSWORD || 'nokey',
    'ollama/mistral'
  ),
  openclaw_qwen: chat(
    'http://100.78.22.13:4000/v1/chat/completions',
    process.env.OPENCLAW_DEVICE_PASSWORD || 'nokey',
    'ollama/qwen2.5:7b-instruct'
  ),
};

module.exports = { fleetProviders };
