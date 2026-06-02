// scripts/wiki/wiki-llm.js — LLM integration for wiki operations
// Fleet routing: OpenClaw (primary) → Groq → Cerebras (failover)
// HAMR-wrap (#1082): callLLM wraps via hamr-provider-wrapper when available.

const HAMR = (() => { try { return require('../global/hamr-provider-wrapper'); } catch { return null; } })();
const PROVIDER_TIER = { OpenClaw: 'fleet-fast', 'OpenClaw-Quality': 'fleet-quality',
  Groq: 'cloud-fleet-quality', Cerebras: 'cloud-fleet-quality' };
const MAX_TOKENS = 1500;
const FETCH_TIMEOUT_MS = 300000;
const PROMPT_BODY_MAX = 6000;
const DEFAULT_OPENCLAW_KEY = 'sk-1234';

const ENDPOINTS = (() => {
  let ocURL;
  try { ocURL = require('../global/fleet-config').getOpenClawURL(); } catch { ocURL = null; }
  const oc = ocURL ? `${ocURL}/v1/chat/completions` : null;
  const list = [];
  if (oc) {
    list.push({ name: 'OpenClaw', url: oc, model: 'qwen2.5-coder-1.5b', key: process.env.OPENCLAW_API_KEY || DEFAULT_OPENCLAW_KEY });
    list.push({ name: 'OpenClaw-Quality', url: oc, model: 'qwen2.5-coder-7b', key: process.env.OPENCLAW_API_KEY || DEFAULT_OPENCLAW_KEY });
  }
  list.push({ name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile', key: process.env.GROQ_API_KEY || '' });
  list.push({ name: 'Cerebras', url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.3-70b', key: process.env.CEREBRAS_API_KEY || '' });
  return list;
})();

async function rawCall(endpoint, prompt) {
  const resp = await fetch(endpoint.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${endpoint.key}` },
    body: JSON.stringify({ model: endpoint.model, messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_TOKENS, temperature: 0.3 }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) return { ok: false, status: resp.status };
  const data = await resp.json();
  return { ok: true, content: data.choices?.[0]?.message?.content || '' };
}

async function tryEndpoint(endpoint, prompt) {
  console.log(`   🔗 Trying ${endpoint.name} (${endpoint.model})...`);
  const callFn = () => rawCall(endpoint, prompt);
  const useHamr = HAMR?.wrapProviderCall && process.env.MEGINGJORD_HAMR_DISABLED !== '1';
  return useHamr
    ? (await HAMR.wrapProviderCall(endpoint.name.toLowerCase(), callFn,
        { tier: PROVIDER_TIER[endpoint.name] || 'fleet-fast' })).value // #1160 canonical (alias: .response)
    : await callFn();
}

async function callLLM(prompt) {
  for (const endpoint of ENDPOINTS) {
    if (!endpoint.key && endpoint.name !== 'OpenClaw') continue;
    try {
      const result = await tryEndpoint(endpoint, prompt);
      if (result?.ok && result.content) {
        console.log(`   ✅ ${endpoint.name} responded (${result.content.length} chars)`);
        return result.content;
      }
      if (result?.status) console.log(`   ⚠️  ${endpoint.name}: HTTP ${result.status}`);
    } catch (err) { console.log(`   ⚠️  ${endpoint.name}: ${err.message}`); }
  }
  return null;
}

function INGEST_PROMPT(title, body) {
  return `You are a wiki compiler. Read this source and produce a concise summary.

SOURCE TITLE: ${title}

SOURCE CONTENT:
${body.slice(0, PROMPT_BODY_MAX)}

INSTRUCTIONS:
1. Write a 3-5 sentence summary of the key points.
2. List the main entities mentioned.
3. List the main concepts.
4. Note any contradicting claims.

Format as plain markdown. Keep under 60 lines.`;
}

function SEARCH_PROMPT(question, context) {
  return `Answer this question using ONLY the wiki pages provided.
Cite pages with [[page-name]] wikilinks.

QUESTION: ${question}

WIKI CONTEXT:
${context.slice(0, PROMPT_BODY_MAX)}

Answer concisely. If the context is insufficient, say so.`;
}

module.exports = { callLLM, INGEST_PROMPT, SEARCH_PROMPT, ENDPOINTS };
