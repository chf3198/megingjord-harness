// tier: 3
// fleet-registry.js (Epic #3126 AC2+AC3): settings-driven fleet host list + model-capability registry.
//
// Why: `ollama-direct.js` hardcoded a single OLLAMA_URL, so the second Tailscale host
// (sole source of the non-Qwen deepseek/granite families) was structurally unreachable —
// a dispatch to it 404'd and fell through to free-cloud, killing local cross-family
// diversity (G3 loss). The host list is now config, not code (G5: no user-specific coupling).
//
// Degradation (G6): a missing/malformed config is never a throw — hosts degrade to [] and
// capabilities degrade to the `default` profile, so callers keep their existing fallback path.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Budget for a model with no capability row: the 7b-class default (see DEFAULT_PROFILE).
const UNKNOWN_MODEL_TIMEOUT_MS = 120_000;
const HOSTS_FILE = 'fleet-hosts.json';
const CAPS_FILE = 'model-capability-registry.json';

function configPath(file, envVar) {
  if (process.env[envVar]) return process.env[envVar];
  return path.join(__dirname, '..', '..', 'config', file);
}

function readJsonSafe(file, envVar) {
  try {
    return JSON.parse(fs.readFileSync(configPath(file, envVar), 'utf8'));
  } catch {
    return null; // G6: absent/malformed -> caller degrades, never throws
  }
}

function isValidHost(h) {
  return Boolean(h && typeof h.url === 'string' && /^https?:\/\/.+/.test(h.url) && h.id);
}

function normalizeHost(h) {
  return {
    id: String(h.id),
    url: String(h.url).replace(/\/+$/, ''),
    families: Array.isArray(h.families) ? h.families.map(String) : [],
    // Ollama serializes per host: concurrency is clamped to >=1 so a bad config
    // can never produce a 0/negative slot count (which would deadlock a scheduler).
    max_concurrency: Number.isFinite(h.max_concurrency) && h.max_concurrency > 0
      ? Math.floor(h.max_concurrency) : 1,
  };
}

// MEGINGJORD_FLEET_HOSTS accepts a JSON array of host objects, or a comma-separated URL list.
function hostsFromEnv() {
  const raw = process.env.MEGINGJORD_FLEET_HOSTS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(isValidHost).map(normalizeHost);
  } catch { /* not JSON — fall through to the URL-list form */ }
  const urls = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return urls
    .map((url, i) => ({ id: `env-${i}`, url, families: [], max_concurrency: 1 }))
    .filter(isValidHost)
    .map(normalizeHost);
}

function loadHosts() {
  const fromEnv = hostsFromEnv();
  if (fromEnv && fromEnv.length) return fromEnv;
  const cfg = readJsonSafe(HOSTS_FILE, 'FLEET_HOSTS_PATH');
  if (!cfg || !Array.isArray(cfg.hosts)) return [];
  return cfg.hosts.filter(isValidHost).map(normalizeHost);
}

function loadCapabilities() {
  const cfg = readJsonSafe(CAPS_FILE, 'FLEET_CAPABILITY_PATH');
  if (!cfg || typeof cfg.models !== 'object' || !cfg.models) {
    return { default: DEFAULT_PROFILE, models: {} };
  }
  return { default: { ...DEFAULT_PROFILE, ...(cfg.default || {}) }, models: cfg.models };
}

// Profile for an UNREGISTERED model. Deliberately asymmetric (cross-family review finding,
// deepseek-coder-v2, #3803): an unknown model stays *dispatchable* so a new model works out of
// the box (G6 fail-open), but is NOT judge-eligible — trusting an undeclared model's verdict is
// a G2 risk, and declaring a model is one JSON row. Fail-open on availability, fail-closed on authority.
const DEFAULT_PROFILE = {
  family: 'unknown', params_b: 7, thinking: false, tok_per_s: 8,
  cold_load_s: 20, timeout_ms: UNKNOWN_MODEL_TIMEOUT_MS, quality: 0.5, judge_eligible: false,
};

// Capability lookup for a model id. Unknown ids resolve to the default profile so the
// dispatcher always has a timeout + thinking flag to act on (never undefined).
function capabilityFor(model, caps = loadCapabilities()) {
  const exact = caps.models[model];
  if (exact) return { model, ...caps.default, ...exact };
  // tolerate tag drift: "qwen3:32b-q4" should still resolve to the "qwen3:32b" profile
  const base = String(model || '').split('-')[0];
  const loose = caps.models[base];
  if (loose) return { model, ...caps.default, ...loose };
  return { model, ...caps.default };
}

// Which configured host can serve this model? Prefers an explicit family match.
function hostsForFamily(family, hosts = loadHosts()) {
  return hosts.filter((h) => h.families.includes(family));
}

module.exports = {
  loadHosts, loadCapabilities, capabilityFor, hostsForFamily,
  DEFAULT_PROFILE, normalizeHost, isValidHost, UNKNOWN_MODEL_TIMEOUT_MS,
};
