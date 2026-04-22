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
  if (u === '/api/github/summary') {
    try {
      const { getSummary } = require('./github-api');
      // Retry on transient failures (gh CLI sometimes returns null)
      const maxAttempts = 3;
      let summary = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          summary = getSummary();
        } catch (e) {
          summary = null;
        }
        if (summary && Object.keys(summary).length) break;
        // exponential-ish backoff
        await new Promise(r => setTimeout(r, 150 * attempt));
      }
      if (!summary) return jsonRes(res, 503, { error: 'github_unavailable', message: 'GitHub API unavailable or unauthenticated (gh CLI).' });
      return jsonRes(res, 200, summary);
    } catch (e) {
      return jsonRes(res, 500, { error: e.message });
    }
  }
  if (u === '/api/governance') {
    try { const rs = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'repo-scope.json'), 'utf8')); const gh = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'global-standards.json'), 'utf8')); return jsonRes(res, 200, { enabled: rs.default_enabled, repoScope: rs, hooks: gh.hooks }); } catch (e) { return jsonRes(res, 500, { error: e.message }); }
  }
  if (u === '/api/host-info') { return jsonRes(res, 200, getHostInfo()); }
  if (u.startsWith('/api/fleet-health')) { const { readLog } = require('./fleet-health-log'); return jsonRes(res, 200, readLog(100)); }
  if (u === '/api/quota-probes') { const { probeAll } = require('./quota-probes'); return jsonRes(res, 200, await probeAll()); }
  if (u === '/api/copilot-usage') { const { getCopilotQuota } = require('./copilot-tracker'); return jsonRes(res, 200, getCopilotQuota()); }
  if (u === '/api/copilot-usage/sync' && req.method === 'POST') { let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try { const d=JSON.parse(b); const { setManualUsage } = require('./copilot-tracker'); return jsonRes(res,200,setManualUsage(d.cost,d.requests)); } catch(e){ return jsonRes(res,400,{error:e.message}); } }); return; }
  jsonRes(res, 404, { error: 'not found' });
}

http.createServer((req,res)=>{ const p=req.url.split('?')[0]; if(p.startsWith('/api/')) return handleApi(req,res); serveStatic(req,res); }).listen(PORT,()=>{ console.log(`Dashboard: http://localhost:${PORT} Fleet: ${Object.keys(FLEET).join(', ')}`); try { require('./fleet-health-log').startMonitor(); } catch(e) { console.error('Fleet health monitor:', e.message); } });
