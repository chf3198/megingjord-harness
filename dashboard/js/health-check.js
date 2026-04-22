// Health Check — ping Ollama and OpenClaw endpoints
// 4-state enum: online | degraded | offline | unknown

const HEALTH_TIMEOUT_MS = 5000;
const OPENCLAW_TIMEOUT_MS = 5000;

async function checkOllama(deviceId) {
  const t0 = Date.now();
  try {
    const r = await fetch(`/api/fleet/${deviceId}/api/tags`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS)
    });
    const latency_ms = Date.now() - t0;
    if (!r.ok) return { status: 'offline', models: [], latency_ms };
    const data = await r.json();
    const models = (data.models || []).map(m => m.name);
    const status = models.length > 0 ? 'online' : 'degraded';
    return { status, models, latency_ms };
  } catch (e) {
    console.warn('health-check: ollama failed:', e.message);
    return { status: 'offline', models: [], latency_ms: Date.now() - t0 };
  }
}

async function checkOpenClaw(deviceId) {
  const t0 = Date.now();
  try {
    const r = await fetch(`/api/fleet/${deviceId}/openclaw/health`, {
      signal: AbortSignal.timeout(OPENCLAW_TIMEOUT_MS)
    });
    const latency_ms = Date.now() - t0;
    return r.ok
      ? { status: 'online', latency_ms }
      : { status: 'degraded', latency_ms };
  } catch (e) {
    console.warn('health-check: openclaw failed:', e.message);
    return { status: 'offline', latency_ms: Date.now() - t0 };
  }
}

async function runHealthChecks(devices) {
  const results = {};
  for (const d of devices) {
    if (d.local) {
      results[d.id] = { status: 'online', checkedAt: new Date().toISOString() };
      continue;
    }
    if (!d.ollama && !d.openclaw) {
      results[d.id] = { status: 'unknown', checkedAt: new Date().toISOString() };
      continue;
    }
    const ollama = d.ollama ? await checkOllama(d.id) : null;
    const openclaw = d.openclaw ? await checkOpenClaw(d.id) : null;
    const checkedAt = new Date().toISOString();
    if (ollama?.status === 'online') {
      results[d.id] = { ...ollama, checkedAt };
    } else if (openclaw?.status === 'online') {
      results[d.id] = { status: 'degraded', checkedAt };
    } else if (ollama || openclaw) {
      results[d.id] = { status: ollama?.status || openclaw?.status || 'offline', checkedAt };
    } else {
      results[d.id] = { status: 'unknown', checkedAt };
    }
  }
  return results;
}

function mergeHealthStatus(devices, checks) {
  return devices.map(d => ({
    ...d,
    status: checks[d.id]?.status || d.status,
    checkedAt: checks[d.id]?.checkedAt || d.checkedAt,
    models: checks[d.id]?.models || d.models
  }));
}
if (typeof module !== 'undefined') module.exports = {
  mergeHealthStatus, runHealthChecks, checkOllama, checkOpenClaw, HEALTH_TIMEOUT_MS
};
