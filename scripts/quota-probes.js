// Quota Probes — live API checks for Groq, Google AI Studio
// Returns normalized quota data for dashboard consumption

const https = require('https');

const HTTP_OK = 200, HTTP_BAD_GATEWAY = 502, HTTP_GATEWAY_TIMEOUT = 504;
const DEFAULT_TIMEOUT_MS = 5000, GROQ_TIMEOUT_MS = 8000;

function probeWithHeaders(url, headers, timeout = DEFAULT_TIMEOUT_MS) {
  return new Promise(resolve => {
    const req = https.get(url, { headers, timeout }, response => {
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('end', () => resolve({
        status: response.statusCode, body, headers: response.headers
      }));
    });
    req.on('error', () => resolve({ status: HTTP_BAD_GATEWAY, body: '{}', headers: {} }));
    req.on('timeout', () => { req.destroy(); resolve({ status: HTTP_GATEWAY_TIMEOUT, body: '{}', headers: {} }); });
  });
}

function parseGroqHeaders(headers) {
  return {
    id: 'groq',
    limitReqs: +(headers['x-ratelimit-limit-requests'] || 0),
    remainReqs: +(headers['x-ratelimit-remaining-requests'] || 0),
    limitTokens: +(headers['x-ratelimit-limit-tokens'] || 0),
    remainTokens: +(headers['x-ratelimit-remaining-tokens'] || 0),
    resetReqs: headers['x-ratelimit-reset-requests'] || '',
    resetTokens: headers['x-ratelimit-reset-tokens'] || '',
  };
}

/** Groq: make tiny completion to read rate-limit headers */
async function probeGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { id: 'groq', error: 'no key' };
  const payload = JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 });
  const opts = {
    hostname: 'api.groq.com', path: '/openai/v1/chat/completions',
    method: 'POST', timeout: GROQ_TIMEOUT_MS,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  return new Promise(resolve => {
    const req = https.request(opts, response => {
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('end', () => resolve(parseGroqHeaders(response.headers)));
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
  const response = await probeWithHeaders(url, {});
  if (response.status !== HTTP_OK) return { id: 'google-ai', error: `HTTP ${response.status}` };
  try {
    const data = JSON.parse(response.body);
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
  const response = await probeWithHeaders(url, { Authorization: `Bearer ${key}` });
  if (response.status !== HTTP_OK) return { id: 'cerebras', error: `HTTP ${response.status}` };
  try {
    const data = JSON.parse(response.body);
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
