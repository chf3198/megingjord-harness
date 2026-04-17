// Fleet Probe — health check each configured resource
// Probes health endpoints, returns status objects

const PROBE_TIMEOUT_MS = 5000;

async function probeResource(resource) {
  if (!resource.enabled || !resource.baseUrl) {
    return { ...resource, status: 'disabled', checkedAt: now() };
  }
  const url = resource.baseUrl + (resource.healthEndpoint || '/v1/models');
  const headers = buildAuthHeaders(resource);
  try {
    const res = await fetch(url, {
      headers, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });
    if (!res.ok) {
      return { ...resource, status: 'error', statusCode: res.status, checkedAt: now() };
    }
    const data = await res.json().catch(() => ({}));
    const models = extractModels(data, resource.provider);
    return { ...resource, status: 'healthy', models, checkedAt: now() };
  } catch (e) {
    const msg = e.name === 'TimeoutError' ? 'timeout' : e.message;
    return { ...resource, status: 'offline', error: msg, checkedAt: now() };
  }
}

function buildAuthHeaders(resource) {
  const auth = resource.auth || {};
  if (auth.type === 'bearer' && auth.key) {
    return { Authorization: `Bearer ${auth.key}` };
  }
  if (auth.type === 'header' && auth.headerName && auth.key) {
    return { [auth.headerName]: auth.key };
  }
  return {};
}

function extractModels(data, provider) {
  if (provider === 'ollama' && data.models) {
    return data.models.map(m => m.name);
  }
  if (data.data && Array.isArray(data.data)) {
    return data.data.map(m => m.id).slice(0, 20);
  }
  return [];
}

async function probeAllResources(resources) {
  const enabled = (resources || []).filter(r => r.enabled);
  return Promise.all(enabled.map(r => probeResource(r)));
}

function now() { return new Date().toISOString(); }
