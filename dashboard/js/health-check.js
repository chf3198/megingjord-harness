// Health Check — ping Ollama and OpenClaw endpoints
// Returns status objects for each device

async function checkOllama(deviceId) {
  try {
    const r = await fetch(`/api/fleet/${deviceId}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return { status: 'error', models: [] };
    const data = await r.json();
    const models = (data.models || []).map(m => m.name);
    return { status: 'healthy', models };
  } catch {
    return { status: 'offline', models: [] };
  }
}

async function checkOpenClaw(deviceId) {
  try {
    const url = `/api/fleet/${deviceId}/openclaw/health`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    });
    return r.ok
      ? { status: 'healthy' }
      : { status: 'error' };
  } catch {
    return { status: 'offline' };
  }
}

async function runHealthChecks(devices) {
  const results = {};
  for (const d of devices) {
    if (d.local) {
      results[d.id] = { status: 'healthy' };
      continue;
    }
    if (!d.ollama && !d.openclaw) {
      results[d.id] = { status: 'unknown' };
      continue;
    }
    const ollama = d.ollama
      ? await checkOllama(d.id) : null;
    const openclaw = d.openclaw
      ? await checkOpenClaw(d.id) : null;

    if (ollama?.status === 'healthy') {
      results[d.id] = { status: 'healthy', ...ollama };
    } else if (openclaw?.status === 'healthy') {
      results[d.id] = { status: 'degraded' };
    } else {
      results[d.id] = { status: ollama?.status || 'unknown' };
    }
  }
  return results;
}

function mergeHealthStatus(devices, checks) {
  return devices.map(d => ({
    ...d,
    status: checks[d.id]?.status || d.status
  }));
}
