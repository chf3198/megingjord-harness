// Phase 0 capability probe — read-only substrate detection (#788)
// Writes .dashboard/capabilities.json. Never charges tokens. Idempotent.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TIMEOUT_TAILSCALE_MS = 4000;
const TIMEOUT_FLEET_MS = 4000;
const TIMEOUT_PROVIDER_MS = 6000;
const HTTP_OK_FLOOR = 200;
const HTTP_OK_CEILING = 400;
const ANTHROPIC_API_VERSION = '2023-06-01';
const OLLAMA_PORT = 11434;

const PROVIDER_PROBES = [
  { id: 'anthropic', env: 'ANTHROPIC_API_KEY', url: 'https://api.anthropic.com/v1/models', headers: k => ({ 'x-api-key': k, 'anthropic-version': ANTHROPIC_API_VERSION }) },
  { id: 'openai', env: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/models', headers: k => ({ Authorization: `Bearer ${k}` }) },
  { id: 'groq', env: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/models', headers: k => ({ Authorization: `Bearer ${k}` }) },
  { id: 'cerebras', env: 'CEREBRAS_API_KEY', url: 'https://api.cerebras.ai/v1/models', headers: k => ({ Authorization: `Bearer ${k}` }) },
  { id: 'google_ai_studio', env: 'GOOGLE_AI_STUDIO_API_KEY', url: k => `https://generativelanguage.googleapis.com/v1beta/models?key=${k}`, headers: () => ({}) },
  { id: 'openrouter', env: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai/api/v1/models', headers: k => ({ Authorization: `Bearer ${k}` }) },
];

async function _httpStatus(url, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    return resp.status;
  } catch { return 0; }
  finally { clearTimeout(timer); }
}

async function probeProvider(p, env) {
  const key = env[p.env];
  if (!key) return { available: false, reason: 'no-key' };
  const url = typeof p.url === 'function' ? p.url(key) : p.url;
  const status = await _httpStatus(url, p.headers(key), TIMEOUT_PROVIDER_MS);
  return {
    available: status >= HTTP_OK_FLOOR && status < HTTP_OK_CEILING,
    http_status: status,
  };
}

async function probeFleet(devices) {
  const out = {};
  await Promise.all(devices.filter(d => d.ollama).map(async d => {
    const ip = d.tailscaleIP || d.ip;
    if (!ip) { out[d.id] = { reachable: false, reason: 'no-ip' }; return; }
    try {
      const resp = await Promise.race([
        fetch(`http://${ip}:${OLLAMA_PORT}/api/tags`),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_FLEET_MS)),
      ]);
      const data = await resp.json();
      out[d.id] = { reachable: true, models: (data.models || []).map(m => m.name) };
    } catch { out[d.id] = { reachable: false }; }
  }));
  return out;
}

function probeTailscale() {
  try {
    execSync('tailscale status --json', { timeout: TIMEOUT_TAILSCALE_MS, stdio: 'pipe' });
    return { available: true };
  } catch { return { available: false }; }
}

async function probe() {
  require('dotenv').config({ quiet: true });
  const env = process.env;
  const inv = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'inventory', 'devices.json'), 'utf8'));
  const providerResults = await Promise.all(PROVIDER_PROBES.map(async p => [p.id, await probeProvider(p, env)]));
  const providers = Object.fromEntries(providerResults);
  const manifest = {
    probed_at: new Date().toISOString(),
    schema_version: 1,
    tailscale: probeTailscale(),
    fleet: await probeFleet(inv.devices || []),
    cloudflare: { account: { available: !!env.CLOUDFLARE_API_TOKEN } },
    providers,
    mcp: { rag_server: { reachable: false, url: env.MCP_RAG_URL || null } },
  };
  const dir = path.join(process.cwd(), '.dashboard');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'capabilities.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (require.main === module) probe().then(m => process.stdout.write(`✅ probed ${Object.keys(m.providers).length} providers, ${Object.keys(m.fleet).length} fleet hosts\n`));

module.exports = { probe, probeProvider, probeFleet, probeTailscale, PROVIDER_PROBES };
