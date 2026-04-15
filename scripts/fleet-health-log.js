// Fleet Health Log — records device/service availability events
// Writes to .dashboard/fleet-health.jsonl for error audit trail

const fs = require('fs');
const path = require('path');
const http = require('http');

const LOG_DIR = path.resolve(__dirname, '..', '.dashboard');
const LOG_FILE = path.join(LOG_DIR, 'fleet-health.jsonl');
const MAX_ENTRIES = 500;
const CHECK_INTERVAL = 60000; // 1 min

const FLEET = {
  'penguin-1': { url: 'http://100.86.248.35:11434', type: 'ollama' },
  'windows-laptop': { url: 'http://100.78.22.13:11434', type: 'ollama' },
};
const OPENCLAW = {
  'windows-laptop': { url: 'http://100.78.22.13:4000/health/liveliness' }
};

function logEntry(device, status, detail) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const entry = {
    ts: new Date().toISOString(), device, status, detail
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  return entry;
}

function probe(url, timeout) {
  return new Promise(resolve => {
    const mod = url.startsWith('https') ? require('https') : http;
    const req = mod.get(url, { timeout }, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => resolve({ ok: r.statusCode < 400, code: r.statusCode }));
    });
    req.on('error', e => resolve({ ok: false, error: e.code || e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'TIMEOUT' }); });
  });
}

const _lastStatus = {};

async function checkAll() {
  for (const [id, cfg] of Object.entries(FLEET)) {
    const r = await probe(`${cfg.url}/api/tags`, 5000);
    const prev = _lastStatus[id];
    if (!r.ok && prev !== 'offline') {
      logEntry(id, 'offline', `${cfg.type}: ${r.error || 'HTTP ' + r.code}`);
      _lastStatus[id] = 'offline';
    } else if (r.ok && prev === 'offline') {
      logEntry(id, 'recovered', `${cfg.type} back online`);
      _lastStatus[id] = 'healthy';
    } else if (r.ok) {
      _lastStatus[id] = 'healthy';
    }
  }
  for (const [id, cfg] of Object.entries(OPENCLAW)) {
    const r = await probe(cfg.url, 5000);
    const key = `${id}-openclaw`;
    const prev = _lastStatus[key];
    if (!r.ok && prev !== 'offline') {
      logEntry(id, 'openclaw-offline', r.error || 'HTTP ' + r.code);
      _lastStatus[key] = 'offline';
    } else if (r.ok && prev === 'offline') {
      logEntry(id, 'openclaw-recovered', 'OpenClaw back online');
      _lastStatus[key] = 'healthy';
    } else if (r.ok) {
      _lastStatus[key] = 'healthy';
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
