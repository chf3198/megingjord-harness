// tier: 3
// fleet-preflight.js (Epic #3126 AC1): one cheap pass that reports every rater's
// reachability + key-presence + family BEFORE a run, so a consensus run never
// discovers `unknown_provider` / `no_key` / `429` mid-flight and burns the budget.
//
// G4: key PRESENCE only — never a value, never a prefix. Nothing here is logged.
// G6: every probe failure is a reported status, never a throw.
'use strict';

const { loadHosts, loadCapabilities, capabilityFor } = require('./fleet-registry');

const PROBE_TIMEOUT_MS = 4000;

// Free-cloud raters and the env var each needs. Mirrors free-cloud-dispatch's PROVIDERS
// contract; family is what the cross-family independence rule actually cares about.
const CLOUD_RATERS = [
  { provider: 'groq', envKey: 'GROQ_API_KEY', family: 'llama' },
  { provider: 'cerebras', envKey: 'CEREBRAS_API_KEY', family: 'llama' },
  { provider: 'mistral', envKey: 'MISTRAL_API_KEY', family: 'mistral' },
  { provider: 'gemini', envKey: 'GOOGLE_AI_STUDIO_API_KEY', family: 'gemini' },
  { provider: 'nvidia', envKey: 'NVIDIA_API_KEY', family: 'nvidia' },
  { provider: 'sambanova', envKey: 'SAMBANOVA_API_KEY', family: 'llama' },
  { provider: 'openrouter-free', envKey: 'OPENROUTER_API_KEY', family: 'llama' },
];

async function probeHost(host, fetchImpl = globalThis.fetch, timeoutMs = PROBE_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${host.url}/api/tags`, { signal: ctrl.signal });
    if (!res || !res.ok) {
      return { ...host, reachable: false, reason: `http_${res ? res.status : 'no_response'}`, models: [] };
    }
    const body = await res.json();
    const models = Array.isArray(body && body.models) ? body.models.map((m) => m.name) : [];
    return { ...host, reachable: true, reason: 'ok', models };
  } catch (err) {
    return { ...host, reachable: false, reason: err.name === 'AbortError' ? 'timeout' : 'unreachable', models: [] };
  } finally {
    clearTimeout(timer);
  }
}

// Cheap: no inference, no tokens. Key presence is a boolean — the value never leaves env (G4).
function probeCloudRaters(env = process.env, raters = CLOUD_RATERS) {
  return raters.map((r) => ({
    provider: r.provider,
    family: r.family,
    tier: 'free-cloud',
    key_present: Boolean(env[r.envKey] && String(env[r.envKey]).trim()),
    reason: env[r.envKey] && String(env[r.envKey]).trim() ? 'ok' : 'no_key',
  }));
}

// The usable panel = every fleet model actually served by a reachable host, plus every
// free-cloud rater holding a key. Each entry carries its capability profile so the caller
// can size timeouts / set think:false without a second lookup.
async function fleetPreflight(opts = {}) {
  const hosts = opts.hosts || loadHosts();
  const caps = opts.caps || loadCapabilities();
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const probed = [];
  // Sequential: probes are cheap, and serial keeps a down host from stalling the others
  // behind a shared connection pool.
  for (const h of hosts) probed.push(await probeHost(h, fetchImpl, opts.timeoutMs));

  const fleetPanel = [];
  for (const h of probed.filter((p) => p.reachable)) {
    for (const model of h.models) {
      const cap = capabilityFor(model, caps);
      fleetPanel.push({
        provider: `ollama:${h.id}`, host_id: h.id, host_url: h.url, model,
        tier: 'local', family: cap.family, quality: cap.quality,
        judge_eligible: cap.judge_eligible, thinking: cap.thinking, timeout_ms: cap.timeout_ms,
      });
    }
  }
  const cloudPanel = probeCloudRaters(opts.env || process.env, opts.raters);
  const usableCloud = cloudPanel.filter((c) => c.key_present);
  const families = [...new Set([...fleetPanel.map((f) => f.family), ...usableCloud.map((c) => c.family)])];

  return {
    hosts: probed,
    fleet_panel: fleetPanel,
    cloud_panel: cloudPanel,
    usable: [...fleetPanel, ...usableCloud],
    families,
    unreachable_hosts: probed.filter((p) => !p.reachable).map((p) => ({ id: p.id, reason: p.reason })),
    no_key_providers: cloudPanel.filter((c) => !c.key_present).map((c) => c.provider),
  };
}

module.exports = { fleetPreflight, probeHost, probeCloudRaters, CLOUD_RATERS, PROBE_TIMEOUT_MS };
