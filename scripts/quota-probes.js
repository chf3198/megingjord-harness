// Quota Probes — live API checks for Groq, Google AI Studio
// Returns normalized quota data for dashboard consumption

const https = require('https');

function probeWithHeaders(url, headers, timeout = 5000) {
  return new Promise(resolve => {
    const req = https.get(url, { headers, timeout }, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => resolve({
        status: r.statusCode, body, headers: r.headers
      }));
    });
    req.on('error', () => resolve({ status: 502, body: '{}', headers: {} }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 504, body: '{}', headers: {} }); });
  });
}

/** Groq: make tiny completion to read rate-limit headers */
async function probeGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { id: 'groq', error: 'no key' };
  const payload = JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1
  });
  return new Promise(resolve => {
    const opts = {
      hostname: 'api.groq.com', path: '/openai/v1/chat/completions',
      method: 'POST', timeout: 8000,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(opts, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => {
        const h = r.headers;
        resolve({
          id: 'groq',
          limitReqs: +(h['x-ratelimit-limit-requests'] || 0),
          remainReqs: +(h['x-ratelimit-remaining-requests'] || 0),
          limitTokens: +(h['x-ratelimit-limit-tokens'] || 0),
          remainTokens: +(h['x-ratelimit-remaining-tokens'] || 0),
          resetReqs: h['x-ratelimit-reset-requests'] || '',
          resetTokens: h['x-ratelimit-reset-tokens'] || '',
        });
      });
    });
    req.on('error', () => resolve({ id: 'groq', error: 'unreachable' }));
    req.on('timeout', () => { req.destroy(); resolve({ id: 'groq', error: 'timeout' }); });
    req.end(payload);
  });
}

/** Google AI Studio: validate key + count available models */
async function probeGoogle() {
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!key) return { id: 'google-ai', error: 'no key' };
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const r = await probeWithHeaders(url, {});
  if (r.status !== 200) return { id: 'google-ai', error: `HTTP ${r.status}` };
  try {
    const data = JSON.parse(r.body);
    return {
      id: 'google-ai', status: 'active',
      models: (data.models || []).length,
    };
  } catch (e) { return { id: 'google-ai', error: 'parse error' }; }
}

/** Cerebras: validate key */
async function probeCerebras() {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) return { id: 'cerebras', error: 'no key' };
  const url = 'https://api.cerebras.ai/v1/models';
  const r = await probeWithHeaders(url, { Authorization: `Bearer ${key}` });
  if (r.status !== 200) return { id: 'cerebras', error: `HTTP ${r.status}` };
  try {
    const data = JSON.parse(r.body);
    return { id: 'cerebras', status: 'active', models: (data.data || []).length };
  } catch (e) { return { id: 'cerebras', error: 'parse error' }; }
}

async function probeAll() {
  const [groq, google, cerebras] = await Promise.all([
    probeGroq(), probeGoogle(), probeCerebras()
  ]);
  return { groq, google, cerebras, timestamp: new Date().toISOString() };
}

module.exports = { probeGroq, probeGoogle, probeCerebras, probeAll };
