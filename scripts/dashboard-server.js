#!/usr/bin/env node
require('dotenv').config(); const http = require('http'); const fs = require('fs'); const path = require('path');
const PORT = process.env.DASH_PORT || 8090; const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
const { resolveFleet, getDeviceURL, getOpenClawURL } = require('./global/fleet-config');
function buildFleetMap() {
  const fleet = {}; for (const device of resolveFleet()) {
    if (!device.resolvedIP) continue; const ip = device.resolvedIP;
    fleet[device.id] = `http://${ip}:11434`; fleet[`${device.id}-ollama`] = `http://${ip}:11434`;
    if (device.services?.includes('openclaw')) fleet['openclaw-litellm'] = `http://${ip}:4000`;
  } return fleet;
}
const FLEET = buildFleetMap(); const OPENCLAW = getOpenClawURL() || ''; const os = require('os');
function getHostInfo() {
  const up = os.uptime(); const hours = Math.floor(up/3600); const minutes = Math.floor((up%3600)/60);
  return { hostname: os.hostname(), platform: os.platform(), arch: os.arch(),
    uptime: `${hours}h ${minutes}m`, memory: `${(os.freemem()/1e9).toFixed(1)}/${(os.totalmem()/1e9).toFixed(1)} GB`,
    nodeVersion: process.version, timestamp: new Date().toISOString() };
}
const { getWikiHealth, getWikiPages } = require('./dashboard-wiki');
const { recordAccess, getWikiMetrics } = require('./wiki-metrics');
const GOVERNANCE_AUDIT_FILE = '/tmp/governance-audit.json';
function serveStatic(req, res) {
  const pn = req.url.split('?')[0];
  let fp = path.join(ROOT, pn === '/' ? 'dashboard/index.html' : pn.startsWith('/dashboard/') || pn.startsWith('/inventory/') ? pn : 'dashboard' + pn);
  fp = path.resolve(fp);
  if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;}
  if(fs.existsSync(fp)&&fs.statSync(fp).isDirectory()&&!pn.endsWith('/')){res.writeHead(302,{Location:pn+'/'});res.end();return;}
  if(fp.endsWith('/')||fp.endsWith(path.sep)) fp=path.join(fp,'index.html');
  const ext=path.extname(fp); fs.readFile(fp,(err,data)=>{ if(err){res.writeHead(404);res.end('Not found');return;} res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':'no-cache'}); res.end(data); });
}
function proxyGet(url, headers, timeout = 5000) {
  if (!url || !url.startsWith('http')) return Promise.resolve({status:502,body:'{}'});
  return new Promise(resolve=>{ const mod=url.startsWith('https')?require('https'):http; const req=mod.get(url,{headers,timeout},r=>{let body=''; r.on('data',c=>body+=c); r.on('end',()=>resolve({status:r.statusCode,body}));}); req.on('error',()=>resolve({status:502,body:'{}'})); req.on('timeout',()=>{req.destroy();resolve({status:504,body:'{}'})}); });
}
function jsonRes(res, status, body) {
  res.writeHead(status,{'Content-Type':'application/json'}); res.end(typeof body==='string'?body:JSON.stringify(body));
}

async function handleApi(req, res) {
  const requestUrl = req.url;
  if (requestUrl === '/api/fleet/windows-laptop/openclaw/health') {
    const healthResponse = await proxyGet(`${OPENCLAW}/health`);
    return jsonRes(res, healthResponse.status, healthResponse.body);
  }
  const fm = requestUrl.match(/^\/api\/fleet\/([^/]+)\/(.+)$/);
  if (fm) {
    const base = FLEET[fm[1]];
    if (!base) return jsonRes(res, 404, { error: 'unknown device' });
    const fleetResponse = await proxyGet(`${base}/${fm[2]}`);
    return jsonRes(res, fleetResponse.status, fleetResponse.body);
  }
  // OpenRouter credits
  if (requestUrl === '/api/openrouter/credits') {
    const key = process.env.OPENROUTER_API_KEY; if (!key) return jsonRes(res, 503, { error: 'no key' });
    const creditsResponse = await proxyGet('https://openrouter.ai/api/v1/auth/key', { Authorization: `Bearer ${key}` });
    return jsonRes(res, creditsResponse.status, creditsResponse.body);
  }
  // Cloudflare AI gateway usage
  if (requestUrl === '/api/cloudflare/ai-usage') {
    const tok = process.env.CLOUDFLARE_API_TOKEN; const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!tok || !acct) return jsonRes(res, 503, { error: 'no key' }); const ep = `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/runs`; const usageResponse = await proxyGet(ep, { Authorization: `Bearer ${tok}` });
    return jsonRes(res, usageResponse.status, usageResponse.body);
  }
  if (requestUrl === '/api/router/metrics') { try { const { getRouterMetrics } = require('./global/router-metrics'); return jsonRes(res,200,getRouterMetrics()); } catch(e){ return jsonRes(res,200,{timestamp:new Date().toISOString(),lanes:{free:0,fleet:0,premium:0}}); } }
  if (requestUrl === '/api/anneal/queue') return require('../dashboard/api/anneal-queue-handlers').handleAnnealQueue(req, res); if (requestUrl === '/api/goal-coverage') return require('../dashboard/api/goal-coverage-handlers').handleGoalCoverage(req, res); if (requestUrl === '/api/merge-evidence-stats') return require('../dashboard/api/merge-evidence-handlers').handleMergeEvidenceStats(req, res); if (requestUrl === '/api/wiki-health') { return jsonRes(res, 200, getWikiHealth()); } if (requestUrl === '/api/projects-v2/in-flight') return require('../dashboard/api/projects-v2-handlers').handleProjectsV2InFlight(req, res);
  if (requestUrl === '/api/wiki-pages') { return jsonRes(res, 200, getWikiPages()); }
  if (requestUrl === '/api/wiki-metrics') { const wikiHealth = getWikiHealth(); return jsonRes(res, 200, getWikiMetrics(wikiHealth)); }
  if (requestUrl.startsWith('/api/wiki-access')) {
    const parsedUrl = new URL(req.url, 'http://x'); const sec = parsedUrl.searchParams.get('section'); const sl = parsedUrl.searchParams.get('slug');
    recordAccess(sec, sl); return jsonRes(res, 200, { ok: true });
  }
  if (requestUrl === '/api/events/stream') return require('./sse-handler').stream(req, res);
  if (requestUrl.startsWith('/api/events')) { const { readEvents } = require('./global/event-reader'); return jsonRes(res, 200, readEvents(requestUrl)); }
  if (requestUrl === '/api/github/summary') { try { const { getSummary } = require('./github-api'); return jsonRes(res, 200, await getSummary()); } catch(e) { return jsonRes(res, 500, {error:e.message}); } }
  if (requestUrl === '/api/governance') {
    try { const rs = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'repo-scope.json'), 'utf8')); const gh = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'global-standards.json'), 'utf8')); return jsonRes(res, 200, { enabled: rs.default_enabled, repoScope: rs, hooks: gh.hooks }); } catch (e) { return jsonRes(res, 500, { error: e.message }); }
  }
  if (requestUrl === '/api/governance-audit') {
    try {
      if (!fs.existsSync(GOVERNANCE_AUDIT_FILE)) return jsonRes(res, 200, { overall: 'UNAVAILABLE', goal_health: { score: null, stale: true, reason: 'governance audit report unavailable', contributing: {}, weights_used: {}, computed_utc: null }, actuator_state: null, violations: [] });
      return jsonRes(res, 200, JSON.parse(fs.readFileSync(GOVERNANCE_AUDIT_FILE, 'utf8')));
    } catch (error) { return jsonRes(res, 500, { error: error.message }); }
  }
  if (requestUrl === '/api/host-info') { return jsonRes(res, 200, getHostInfo()); }
  if (requestUrl.startsWith('/api/fleet-health')) { const { readLog } = require('./fleet-health-log'); return jsonRes(res, 200, readLog(100)); }
  if (requestUrl === '/api/quota-probes') { const { probeAll } = require('./quota-probes'); return jsonRes(res, 200, await probeAll()); }
  if (requestUrl === '/api/copilot-usage') { const { getCopilotQuota } = require('./copilot-tracker'); return jsonRes(res, 200, getCopilotQuota()); }
  if (requestUrl === '/api/copilot-usage/sync' && req.method === 'POST') { let syncBody=''; req.on('data',c=>syncBody+=c); req.on('end',()=>{ try { const syncData=JSON.parse(syncBody); const { setManualUsage } = require('./copilot-tracker'); return jsonRes(res,200,setManualUsage(syncData.cost,syncData.requests)); } catch(e){ return jsonRes(res,400,{error:e.message}); } }); return; }
  if (requestUrl === '/api/logs/token-telemetry-summary') { const { writeTokenTelemetryReport } = require('./global/token-telemetry-report'); return jsonRes(res, 200, writeTokenTelemetryReport(30)); }
  if (requestUrl === '/api/logs/quality-parity') {
    const { writeQualityParityReport } = require('./global/quality-parity-report'); const parsedUrl = new URL(req.url, 'http://localhost'); const live = parsedUrl.searchParams.get('live') === '1' || process.env.QUALITY_PARITY_LIVE === '1';
    return writeQualityParityReport({ mode: live ? 'live' : 'dry-run' }).then(report => jsonRes(res, 200, report)).catch(error => jsonRes(res, 500, { error: error.message }));
  }
  if (requestUrl === '/api/logs/token-telemetry-reconcile') { const { writeReconciliationReport } = require('./global/token-telemetry-reconcile'); writeReconciliationReport(30).then(reconcileReport => jsonRes(res, 200, reconcileReport)).catch(e => jsonRes(res, 500, { error: e.message })); return; }
  if (requestUrl === '/api/logs/cost-telemetry') { const logFile=path.join(ROOT,'logs','cost-telemetry.jsonl'); const text=fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8'):''; res.setHeader('Content-Type','text/plain'); return res.end(text); }
  jsonRes(res, 404, { error: 'not found' });
}

http.createServer((req,res)=>{ const pathname=req.url.split('?')[0]; if(pathname.startsWith('/api/')) return handleApi(req,res); serveStatic(req,res); }).listen(PORT,()=>{ console.log(`Dashboard: http://localhost:${PORT} Fleet: ${Object.keys(FLEET).join(', ')}`); try { require('./fleet-health-log').startMonitor(); } catch(e) { console.error('Fleet health monitor:', e.message); } });
