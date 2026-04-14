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
  if (u === '/api/wiki-health') { return jsonRes(res, 200, getWikiHealth()); }
  if (u.startsWith('/api/events')) { const { readEvents } = require('./global/event-reader'); return jsonRes(res, 200, readEvents(u)); }
  jsonRes(res, 404, { error: 'not found' });
}

const WIKI_DIR = path.join(ROOT, 'wiki');
const WIKI_CATS = ['entities', 'concepts', 'sources', 'syntheses'];

function getWikiHealth() {
  let pages = 0; const broken = []; const orphans = [];
  const fmIssues = []; const idxIssues = []; const allSlugs = new Set();
  const inbound = new Set(); const linkGraph = {};
  for (const d of WIKI_CATS) {
    const dp = path.join(WIKI_DIR, d);
    if (!fs.existsSync(dp)) continue;
    for (const f of fs.readdirSync(dp).filter(x => x.endsWith('.md'))) {
      const slug = f.replace('.md', ''); allSlugs.add(slug); pages++;
      const content = fs.readFileSync(path.join(dp, f), 'utf-8');
      const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
      linkGraph[slug] = links;
      links.forEach(l => { if (!allSlugs.has(l)) broken.push(`${slug}→${l}`); inbound.add(l); });
      if (!content.startsWith('---')) fmIssues.push(slug);
    }
  }
  for (const s of allSlugs) if (!inbound.has(s)) orphans.push(s);
  const idxPath = path.join(WIKI_DIR, 'index.md');
  const idx = fs.existsSync(idxPath) ? fs.readFileSync(idxPath, 'utf-8') : '';
  for (const s of allSlugs) if (!idx.includes(`[[${s}]]`)) idxIssues.push(s);
  return { loaded: true, pages, dirs: WIKI_CATS.length,
    issues: broken.length + orphans.length + fmIssues.length + idxIssues.length,
    broken, orphans, frontmatter: fmIssues, indexSync: idxIssues,
    lastCheck: new Date().toISOString() };
}

http.createServer((req,res)=>{ if(req.url.startsWith('/api/')) return handleApi(req,res); serveStatic(req,res); }).listen(PORT,()=>{ console.log(`Dashboard: http://localhost:${PORT} Fleet: ${Object.keys(FLEET).join(', ')}`); });
