// scripts/wiki/wiki-llm.js — LLM integration for wiki operations
// Fleet routing: OpenClaw (primary) → Groq → Cerebras (failover)

const ENDPOINTS = (() => {
  let ocURL;
  try { ocURL = require('../global/fleet-config').getOpenClawURL(); } catch { ocURL = null; }
  const oc = ocURL ? `${ocURL}/v1/chat/completions` : null;
  const list = [];
  if (oc) {
    list.push({ name: 'OpenClaw', url: oc, model: 'ollama/mistral', key: process.env.OPENCLAW_API_KEY || 'sk-1234' });
    list.push({ name: 'OpenClaw-7B', url: oc, model: 'ollama/qwen2.5:7b-instruct', key: process.env.OPENCLAW_API_KEY || 'sk-1234' });
  }
  list.push({ name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile', key: process.env.GROQ_API_KEY || '' });
  list.push({ name: 'Cerebras', url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.3-70b', key: process.env.CEREBRAS_API_KEY || '' });
  return list;
})();

async function callLLM(prompt) {
  for (const ep of ENDPOINTS) {
    if (!ep.key && ep.name !== 'OpenClaw') continue;
    try {
      console.log(`   🔗 Trying ${ep.name} (${ep.model})...`);
      const resp = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ep.key}`,
        },
        body: JSON.stringify({
          model: ep.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(300000),
      });
      if (!resp.ok) {
        console.log(`   ⚠️  ${ep.name}: HTTP ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        console.log(`   ✅ ${ep.name} responded (${text.length} chars)`);
        return text;
      }
    } catch (err) {
      console.log(`   ⚠️  ${ep.name}: ${err.message}`);
    }
  }
  return null;
}

function INGEST_PROMPT(title, body) {
  return `You are a wiki compiler. Read this source and produce a concise summary.

SOURCE TITLE: ${title}

SOURCE CONTENT:
${body.slice(0, 6000)}

INSTRUCTIONS:
1. Write a 3-5 sentence summary of the key points.
2. List the main entities mentioned (people, tools, services, devices).
3. List the main concepts (ideas, patterns, decisions).
4. Note any claims that could contradict existing knowledge.

Format as plain markdown (no frontmatter). Keep under 60 lines.`;
}

function SEARCH_PROMPT(question, context) {
  return `Answer this question using ONLY the wiki pages provided.
Cite pages with [[page-name]] wikilinks.

QUESTION: ${question}

WIKI CONTEXT:
${context.slice(0, 6000)}

Answer concisely. If the context is insufficient, say so.`;
}

module.exports = { callLLM, INGEST_PROMPT, SEARCH_PROMPT };
