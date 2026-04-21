// ai-matrix-providers.js — cloud providers; fleet providers: ai-matrix-providers-fleet.js
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

const providers = {
  openrouter_qwen3coder: chat('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, 'qwen/qwen3-coder:free'),
  openrouter_gemma4b: chat('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, 'google/gemma-3-4b-it:free'),
  openrouter_nemotron: chat('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, 'nvidia/nemotron-3-super-120b-a12b:free'),
  openrouter_llama70b: chat('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, 'meta-llama/llama-3.3-70b-instruct:free'),
  openrouter_hermes405b: chat('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, 'nvidia/nemotron-3-nano-30b-a3b:free'),
  openrouter_gptoss120b: chat('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, 'openai/gpt-oss-20b:free'),
  openrouter_glm45: chat('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, 'nvidia/nemotron-nano-9b-v2:free'),
  openrouter_gemma27b: chat('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, 'google/gemma-3-27b-it:free'),
  groq_llama70b: chat('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, 'llama-3.3-70b-versatile'),
  groq_gptoss120b: chat('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, 'openai/gpt-oss-120b'),
  groq_qwen32b: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: process.env.GROQ_API_KEY,
    buildBody: (task) => ({
      model: 'qwen/qwen3-32b',
      messages: [{ role: 'user', content: task }],
      temperature: 0.1,
      max_tokens: 800,
      stream: false,
      reasoning_effort: 'none',
    }),
  },
  groq_llama4scout: chat('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, 'meta-llama/llama-4-scout-17b-16e-instruct'),
  groq_llama8b: chat('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, 'llama-3.1-8b-instant'),
  cerebras_qwen235b: chat('https://api.cerebras.ai/v1/chat/completions', process.env.CEREBRAS_API_KEY, 'qwen-3-235b-a22b-instruct-2507'),
  cerebras_llama8b: chat('https://api.cerebras.ai/v1/chat/completions', process.env.CEREBRAS_API_KEY, 'llama3.1-8b'),
};

const { fleetProviders } = require('./ai-matrix-providers-fleet');
module.exports = { providers: { ...providers, ...fleetProviders } };
