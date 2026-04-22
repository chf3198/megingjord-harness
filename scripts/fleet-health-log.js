// Fleet Health Log — records device/service availability events
// Writes to logs/fleet-health.jsonl — telemetry schema: {ts,device,status,detail,latency_ms}

const fs = require('fs');
const path = require('path');
const http = require('http');

const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'fleet-health.jsonl');
const MAX_ENTRIES = 500;
const CHECK_INTERVAL = 60000; // 1 min

const { resolveFleet, getOpenClawURL } = require('./global/fleet-config');

function buildFleetTargets() {
  const fleet = {};
  const claw = {};
  for (const d of resolveFleet().filter(x => !x.local && x.resolvedIP)) {
    fleet[d.id] = { url: `http://${d.resolvedIP}:11434`, type: 'ollama' };
  }
  const clawURL = getOpenClawURL();
  if (clawURL) claw['windows-laptop'] = { url: `${clawURL}/health` };
  return { fleet, claw };
}
const { fleet: FLEET, claw: OPENCLAW } = buildFleetTargets();

function logEntry(device, status, detail, latency_ms) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const entry = {
    ts: new Date().toISOString(), device, status, detail, latency_ms: latency_ms || 0
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  return entry;
}

function probe(url, timeout) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const mod = url.startsWith('https') ? require('https') : http;
    const req = mod.get(url, { timeout }, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => resolve({ ok: r.statusCode < 400, code: r.statusCode, latency_ms: Date.now()-t0 }));
    });
    req.on('error', e => resolve({ ok: false, error: e.code || e.message, latency_ms: Date.now()-t0 }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'TIMEOUT', latency_ms: timeout }); });
  });
}

const _lastStatus = {};

async function checkAll() {
  for (const [id, cfg] of Object.entries(FLEET)) {
    const r = await probe(`${cfg.url}/api/tags`, 5000);
    const prev = _lastStatus[id];
    if (!r.ok && prev !== 'offline') {
      logEntry(id, 'offline', `${cfg.type}: ${r.error || 'HTTP ' + r.code}`, r.latency_ms);
      _lastStatus[id] = 'offline';
    } else if (r.ok && prev === 'offline') {
      logEntry(id, 'recovered', `${cfg.type} back online`, r.latency_ms);
      _lastStatus[id] = 'online';
    } else if (r.ok) {
      _lastStatus[id] = 'online';
    }
  }
  for (const [id, cfg] of Object.entries(OPENCLAW)) {
    const r = await probe(cfg.url, 5000);
    const key = `${id}-openclaw`;
    const prev = _lastStatus[key];
    if (!r.ok && prev !== 'offline') {
      logEntry(id, 'openclaw-offline', r.error || 'HTTP ' + r.code, r.latency_ms);
      _lastStatus[key] = 'offline';
    } else if (r.ok && prev === 'offline') {
      logEntry(id, 'openclaw-recovered', 'OpenClaw back online', r.latency_ms);
      _lastStatus[key] = 'online';
    } else if (r.ok) {
      _lastStatus[key] = 'online';
    }
  }
}

function readLog(limit) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
  const entries = [];
  for (const l of lines.slice(-(limit || 50))) {
    try { entries.push(JSON.parse(l)); } catch { /* skip */ }
  }
  return entries;
}

function startMonitor() {
  checkAll();
  return setInterval(checkAll, CHECK_INTERVAL);
}

module.exports = { logEntry, readLog, startMonitor, checkAll };
