// Quick Stress Test — low-token, lightweight endpoint probes

function buildStressTargets(devices) {
  const base = ['/api/router/metrics', '/api/openrouter/credits', '/api/cloudflare/ai-usage'];
  const fleet = devices.filter(d => d.ollama).map(d => `/api/fleet/${d.id}/api/tags`);
  const claw = devices.filter(d => d.openclaw).map(d => `/api/fleet/${d.id}/openclaw/health`);
  return [...base, ...fleet, ...claw];
}

async function probe(url) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return { ok: r.ok || r.status === 503, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

async function runStressRound(targets) {
  const all = await Promise.all(targets.map(probe));
  const ok = all.filter(x => x.ok).length;
  const fail = all.length - ok;
  const maxMs = all.reduce((m, x) => Math.max(m, x.ms), 0);
  return { ok, fail, ms: maxMs };
}

function renderStressPanel(run) {
  const cls = run.running ? 'badge degraded' : (run.fail ? 'badge error' : 'badge healthy');
  return `<div class="config-grid">
    <p><strong>Status:</strong> <span class="${cls}">${run.last || 'idle'}</span></p>
    <p><strong>Rounds:</strong> ${run.rounds || 0}/12 (~1 min)</p>
    <p><strong>Checks:</strong> ✅ ${run.ok || 0} / ❌ ${run.fail || 0}</p>
    <p class="config-note">Uses lightweight pings only; no model inference tokens.</p>
  </div>`;
}
