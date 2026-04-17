#!/usr/bin/env node
require('dotenv').config(); const http = require('http'); const fs = require('fs'); const path = require('path');
const PORT = process.env.DASH_PORT || 8090; const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
const FLEET = {
  'penguin-1': process.env.DEVICE_PENGUIN1_URL || 'http://100.86.248.35:11434',
  'windows-laptop': process.env.DEVICE_WINDOWS_URL || 'http://100.78.22.13:11434',
  'openclaw-litellm': process.env.OPENCLAW_URL || 'http://100.78.22.13:4000',
  'chromebook-2': process.env.DEVICE_CHROMEBOOK2_URL || 'http://100.87.216.75:11434'
};
const OPENCLAW = process.env.OPENCLAW_URL || 'http://100.78.22.13:4000';
const { getWikiHealth, getWikiPages } = require('./dashboard-wiki');
const { recordAccess, getWikiMetrics } = require('./wiki-metrics');

const DASH = path.join(ROOT, 'dashboard');
function serveStatic(req, res) {
  const pn = req.url.split('?')[0];
  let fp = pn.startsWith('/dashboard/') ? path.join(ROOT, pn) : path.join(DASH, pn);
  if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;}
  if(fs.existsSync(fp)&&fs.statSync(fp).isDirectory()&&!pn.endsWith('/')){res.writeHead(302,{Location:pn+'/'});res.end();return;}
  if(fp.endsWith('/')||fp.endsWith(path.sep)) fp=path.join(fp,'index.html');
  const ext=path.extname(fp); fs.readFile(fp,(err,data)=>{ if(err){res.writeHead(404);res.end('Not found');return;} res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':'no-cache'}); res.end(data); });
}

function proxyGet(url, headers, timeout = 5000) {
  return new Promise(resolve=>{ const mod=url.startsWith('https')?require('https'):http; const req=mod.get(url,{headers,timeout},r=>{let body=''; r.on('data',c=>body+=c); r.on('end',()=>resolve({status:r.statusCode,body}));}); req.on('error',()=>resolve({status:502,body:'{}'})); req.on('timeout',()=>{req.destroy();resolve({status:504,body:'{}'})}); });
}

function jsonRes(res, status, body) {
  res.writeHead(status,{'Content-Type':'application/json'}); res.end(typeof body==='string'?body:JSON.stringify(body));
}

async function handleApi(req, res) {
  const u = req.url;
  // OpenClaw proxy (must precede fleet regex)
  if (u === '/api/fleet/windows-laptop/openclaw/health') {
    const r = await proxyGet(`${OPENCLAW}/health`);
    return jsonRes(res, r.status, r.body);
  }
  // Fleet proxy: /api/fleet/<device>/<path>
  const fm = u.match(/^\/api\/fleet\/([^/]+)\/(.+)$/);
  if (fm) {
    const base = FLEET[fm[1]];
    if (!base) return jsonRes(res, 404, { error: 'unknown device' });
    const r = await proxyGet(`${base}/${fm[2]}`);
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
  if (u === '/api/router/metrics') { try { const { getRouterMetrics } = require('./global/router-metrics'); return jsonRes(res,200,getRouterMetrics()); } catch(e){ return jsonRes(res,200,{timestamp:new Date().toISOString(),lanes:{free:0,fleet:0,premium:0}}); } }
  if (u === '/api/wiki-health') { return jsonRes(res, 200, getWikiHealth()); }
  if (u === '/api/wiki-pages') { return jsonRes(res, 200, getWikiPages()); }
  if (u === '/api/wiki-metrics') { const h = getWikiHealth(); return jsonRes(res, 200, getWikiMetrics(h)); }
  if (u.startsWith('/api/wiki-access')) {
    const p = new URL(req.url, 'http://x'); const sec = p.searchParams.get('section'); const sl = p.searchParams.get('slug');
    recordAccess(sec, sl); return jsonRes(res, 200, { ok: true });
  }
  if (u === '/api/events/stream') return require('./sse-handler').stream(req, res);
  if (u.startsWith('/api/events')) { const { readEvents } = require('./global/event-reader'); return jsonRes(res, 200, readEvents(u)); }
  if (u === '/api/github/summary') { try { const { getSummary } = require('./github-api'); return jsonRes(res, 200, getSummary()); } catch(e) { return jsonRes(res, 500, {error:e.message}); } }
  if (u === '/api/governance') {
    try {
      const repoScope = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'repo-scope.json'), 'utf8'));
      const globalHooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'global-standards.json'), 'utf8'));
      return jsonRes(res, 200, { enabled: repoScope.default_enabled, repoScope, hooks: globalHooks.hooks });
    } catch (e) {
      return jsonRes(res, 500, { error: 'governance state unavailable', detail: e.message });
    }
  }
  if (u.startsWith('/api/fleet-health')) { const { readLog } = require('./fleet-health-log'); return jsonRes(res, 200, readLog(100)); }
  jsonRes(res, 404, { error: 'not found' });
}

http.createServer((req,res)=>{ const p=req.url.split('?')[0]; if(p.startsWith('/api/')) return handleApi(req,res); serveStatic(req,res); }).listen(PORT,()=>{ console.log(`Dashboard: http://localhost:${PORT} Fleet: ${Object.keys(FLEET).join(', ')}`); try { require('./fleet-health-log').startMonitor(); } catch(e) { console.error('Fleet health monitor:', e.message); } });
