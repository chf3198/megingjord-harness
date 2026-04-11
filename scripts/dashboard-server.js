#!/usr/bin/env node
// Dashboard Server — static files + fleet/service API proxy
// Keeps API keys server-side, proxies to Tailscale + external APIs

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.DASH_PORT || 8090;
const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.css': 'text/css',
  '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png'
};
const FLEET = {
  'penguin-1': 'http://100.86.248.35:11434',
  'windows-laptop': 'http://100.78.22.13:11434'
};
const OPENCLAW = 'http://100.78.22.13:4000';

function serveStatic(req, res) {
  const fp = path.join(ROOT, req.url === '/' ? '/dashboard/index.html' : req.url);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  const ext = path.extname(fp);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

function proxyGet(url, headers, timeout = 5000) {
  return new Promise(resolve => {
    const mod = url.startsWith('https') ? require('https') : http;
    const req = mod.get(url, { headers, timeout }, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => resolve({ status: r.statusCode, body }));
    });
    req.on('error', () => resolve({ status: 502, body: '{}' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 504, body: '{}' }); });
  });
}

function jsonRes(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function handleApi(req, res) {
  const u = req.url;
  // Fleet proxy: /api/fleet/<device>/<path>
  const fm = u.match(/^\/api\/fleet\/([^/]+)\/(.+)$/);
  if (fm) {
    const base = FLEET[fm[1]];
    if (!base) return jsonRes(res, 404, { error: 'unknown device' });
    const r = await proxyGet(`${base}/${fm[2]}`);
    return jsonRes(res, r.status, r.body);
  }
  // OpenClaw proxy
  if (u === '/api/fleet/windows-laptop/openclaw/health') {
    const r = await proxyGet(`${OPENCLAW}/health`);
    return jsonRes(res, r.status, r.body);
  }
  // OpenRouter credits
  if (u === '/api/openrouter/credits') {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return jsonRes(res, 503, { error: 'no key' });
    const r = await proxyGet('https://openrouter.ai/api/v1/auth/key', {
      Authorization: `Bearer ${key}`
    });
    return jsonRes(res, r.status, r.body);
  }
  // Cloudflare AI gateway usage
  if (u === '/api/cloudflare/ai-usage') {
    const tok = process.env.CLOUDFLARE_API_TOKEN;
    const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!tok || !acct) return jsonRes(res, 503, { error: 'no key' });
    const ep = `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/runs`;
    const r = await proxyGet(ep, { Authorization: `Bearer ${tok}` });
    return jsonRes(res, r.status, r.body);
  }
  jsonRes(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  serveStatic(req, res);
});
server.listen(PORT, () => {
  console.log(`Dashboard server: http://localhost:${PORT}`);
  console.log(`Fleet proxy: ${Object.keys(FLEET).join(', ')}`);
});
