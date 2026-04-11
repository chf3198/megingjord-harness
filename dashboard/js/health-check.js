// Health Check — ping Ollama and OpenClaw endpoints
// Returns status objects for each device

async function checkOllama(host) {
  try {
    const r = await fetch(`http://${host}:11434/api/tags`, {
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

async function checkOpenClaw(host) {
  try {
    const r = await fetch(`http://${host}:4000/health`, {
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
    if (!d.tailscaleIP) {
      results[d.id] = { status: 'unknown' };
      continue;
    }
    const host = d.tailscaleIP;
    const ollama = d.ollama
      ? await checkOllama(host) : null;
    const openclaw = d.openclaw
      ? await checkOpenClaw(host) : null;

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
