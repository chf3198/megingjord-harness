#!/usr/bin/env node
require('dotenv').config(); const http = require('http'); const fs = require('fs'); const path = require('path');
const PORT = process.env.DASH_PORT || 8090; const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
const FLEET = {'penguin-1':'http://100.86.248.35:11434','windows-laptop':'http://100.78.22.13:11434'};
const OPENCLAW = 'http://100.78.22.13:4000';

function serveStatic(req, res) {
  if (req.url === '/') { res.writeHead(302,{Location:'/dashboard/'}); res.end(); return; }
  let fp=path.join(ROOT,req.url); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} if(fp.endsWith('/')||fp.endsWith(path.sep)) fp=path.join(fp,'index.html');
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
  jsonRes(res, 404, { error: 'not found' });
}

http.createServer((req,res)=>{ if(req.url.startsWith('/api/')) return handleApi(req,res); serveStatic(req,res); }).listen(PORT,()=>{ console.log(`Dashboard: http://localhost:${PORT} Fleet: ${Object.keys(FLEET).join(', ')}`); });
